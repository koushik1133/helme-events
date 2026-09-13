#!/usr/bin/env python3
"""
pano360 — make Helm's 360° plates behave like real equirectangular panoramas.

The problem
-----------
Every plate in this repo is mapped onto a full sphere by Pannellum, but none of
them were prepared for it. Measured on the originals:

  * the left and right edges do not match, so there is a hard vertical seam at
    yaw 180° — edge difference is 3-4x the normal neighbouring-pixel difference;
  * the top and bottom rows still vary horizontally, and every column of an
    equirectangular image converges to the SAME physical point at the pole, so
    that variation is what smears when you look straight up or down
    (nadir standard deviation up to 38);
  * half the plates are 1.79:1 rather than 2:1, so the whole sphere is stretched
    ~12% vertically on top of that.

What this does
--------------
Keeps the full 360° x 180° sphere — you can still look anywhere, which is the
point of the product — and fixes the three defects:

  1. FIT    resample to a true 2:1 so the sphere is not stretched.
  2. SEAM   cross-fade a band across the x = 0 / x = W boundary so the left and
            right edges meet at one point with no visible join.
  3. POLES  blend each row toward its own row-mean with the weight rising to 1 at
            the pole, so the zenith resolves to sky and the nadir to ground
            instead of a pinwheel smear.

`--reproject` additionally treats the source as a rectilinear photograph and
places it on the sphere with correct pinhole geometry, optionally compositing a
real rear-view plate supplied with `--rear`. That mode is geometrically honest
but leaves most of the sphere invented, so it is only worth using once genuine
back-view images exist. The default mode is what ships.

Usage
-----
    python3 tools/pano360.py in.jpg out.jpg
    python3 tools/pano360.py in.jpg out.jpg --reproject --rear back.jpg
    python3 tools/pano360.py --check out.jpg
"""

from __future__ import annotations

import argparse
import sys

import numpy as np
from PIL import Image, ImageFilter

# --------------------------------------------------------------------------- #
# Shared helpers
# --------------------------------------------------------------------------- #

def _box_blur_1d(a: np.ndarray, radius: int, axis: int, wrap: bool) -> np.ndarray:
    """Separable box blur along one axis; wraps or clamps at the edges."""
    if radius < 1:
        return a
    a = np.moveaxis(a, axis, 0)
    k = radius * 2 + 1
    if wrap:
        padded = np.concatenate([a[-radius:], a, a[:radius]], axis=0)
    else:
        padded = np.concatenate([np.repeat(a[:1], radius, 0), a, np.repeat(a[-1:], radius, 0)], axis=0)
    cum = np.cumsum(padded, axis=0)
    cum = np.concatenate([np.zeros_like(cum[:1]), cum], axis=0)
    out = (cum[k:] - cum[:-k]) / k
    return np.moveaxis(out, 0, axis)


# --------------------------------------------------------------------------- #
# 1 — fit to a true 2:1 sphere
# --------------------------------------------------------------------------- #

def fit_sphere(img: Image.Image, width: int) -> Image.Image:
    """
    Resample to exactly width x (width/2).

    The source plates are 1.79:1 or 2.00:1. Going to 2:1 costs at most a ~12%
    horizontal scale change, which is invisible in a panorama, and removes the
    vertical stretch the viewer was applying to every 1.79:1 plate.
    """
    return img.convert("RGB").resize((width, width // 2), Image.LANCZOS)


# --------------------------------------------------------------------------- #
# 2 — close the wrap seam
# --------------------------------------------------------------------------- #

def close_seam(a: np.ndarray, band_frac: float = 0.055) -> np.ndarray:
    """
    Make column 0 and column W-1 continuous.

    Those two columns are physically adjacent on the sphere. We cross-fade the
    left band with the mirrored right band (and vice versa) over a narrow strip,
    weighted so the centre of the image is untouched and the two edges converge
    to an identical value at the join.
    """
    out = a.copy()
    h, w = a.shape[:2]
    band = max(8, int(w * band_frac))

    left = out[:, :band].copy()            # columns 0 .. band
    right = out[:, -band:].copy()          # columns W-band .. W-1

    # Ramp: 0.5 exactly at the join, falling to 0 at the inner edge of each band.
    t = np.linspace(0.5, 0.0, band)[None, :, None]

    # The pixel that should meet left[:, i] is right[:, -1 - i].
    right_mirror = right[:, ::-1]
    left_mirror = left[:, ::-1]

    out[:, :band] = left * (1 - t) + right_mirror * t
    out[:, -band:] = right * (1 - t[:, ::-1]) + left_mirror * t[:, ::-1]

    # A light wrapped blur across the join removes any residual step.
    smooth_band = max(4, band // 3)
    region = np.concatenate([out[:, -smooth_band:], out[:, :smooth_band]], axis=1)
    region = _box_blur_1d(region, max(1, smooth_band // 6), axis=1, wrap=False)
    out[:, -smooth_band:] = region[:, :smooth_band]
    out[:, :smooth_band] = region[:, smooth_band:]
    return out


# --------------------------------------------------------------------------- #
# 3 — collapse the poles
# --------------------------------------------------------------------------- #

def collapse_poles(a: np.ndarray, band_deg: float = 30.0, softness: float = 2.2) -> np.ndarray:
    """
    Drive the top and bottom rows toward a single colour.

    Weight rises from 0 at the inner edge of the band to 1 at the pole, so the
    horizon is untouched and the very top/bottom row becomes flat — which is what
    a real panorama does, because every column meets at the same point there.

    The per-row target is a horizontally blurred version of the row rather than a
    flat mean, so large-scale structure (a bright patch of sky on one side) is
    preserved until close to the pole.
    """
    out = a.copy()
    h, w = a.shape[:2]
    band = max(4, int(h * band_deg / 180.0))

    # Horizontally smoothed copy, wrapped: the "target" each row eases toward.
    target = _box_blur_1d(out.astype(np.float64), max(2, w // 12), axis=1, wrap=True)

    for is_top in (True, False):
        for step in range(band):
            row = step if is_top else h - 1 - step
            t = (1.0 - step / band) ** softness          # 1 at the pole, 0 at band edge
            blended = out[row] * (1 - t) + target[row] * t
            # In the last few rows go all the way to a single colour.
            if step < band * 0.12:
                hard = (1.0 - step / (band * 0.12)) ** 1.5
                blended = blended * (1 - hard) + blended.mean(axis=0) * hard
            out[row] = blended
    return out


# --------------------------------------------------------------------------- #
# Optional — true rectilinear reprojection (needs a real rear plate to be useful)
# --------------------------------------------------------------------------- #

def _rays(width: int, height: int):
    lon = (np.arange(width, dtype=np.float64) + 0.5) / width * 2.0 * np.pi - np.pi
    lat = np.pi / 2.0 - (np.arange(height, dtype=np.float64) + 0.5) / height * np.pi
    lon, lat = np.meshgrid(lon, lat)
    cos_lat = np.cos(lat)
    return cos_lat * np.sin(lon), np.sin(lat), cos_lat * np.cos(lon)


def reproject_rectilinear(src, width, height, hfov_deg, yaw_deg=0.0):
    """Place a pinhole photograph at its true position on the sphere."""
    src_h, src_w = src.shape[:2]
    x, y, z = _rays(width, height)
    yaw = np.deg2rad(yaw_deg)
    xr = x * np.cos(yaw) - z * np.sin(yaw)
    zr = x * np.sin(yaw) + z * np.cos(yaw)

    focal = (src_w / 2.0) / np.tan(np.deg2rad(hfov_deg) / 2.0)
    in_front = zr > 1e-6
    safe_z = np.where(in_front, zr, 1.0)
    u = focal * xr / safe_z + src_w / 2.0
    v = -focal * y / safe_z + src_h / 2.0
    valid = in_front & (u >= 0) & (u <= src_w - 1) & (v >= 0) & (v <= src_h - 1)

    u_c, v_c = np.clip(u, 0, src_w - 1), np.clip(v, 0, src_h - 1)
    u0, v0 = np.floor(u_c).astype(np.int32), np.floor(v_c).astype(np.int32)
    u1, v1 = np.minimum(u0 + 1, src_w - 1), np.minimum(v0 + 1, src_h - 1)
    du, dv = (u_c - u0)[..., None], (v_c - v0)[..., None]
    out = (src[v0, u0] * (1 - du) * (1 - dv) + src[v0, u1] * du * (1 - dv)
           + src[v1, u0] * (1 - du) * dv + src[v1, u1] * du * dv)
    return out * valid[..., None], valid.astype(np.float64)


def build_reprojected(front: Image.Image, rear: Image.Image | None, width: int,
                      hfov: float, rear_hfov: float) -> Image.Image:
    height = width // 2
    src = np.asarray(front.convert("RGB"), dtype=np.float64)
    equi, cover = reproject_rectilinear(src, width, height, hfov, 0.0)

    # Per-latitude colour taken from the photo itself, so the fill is never a hole.
    weight = cover.sum(axis=1)
    total = (equi * cover[..., None]).sum(axis=1)
    profile = np.zeros((height, 3))
    known = weight > 8
    profile[known] = total[known] / weight[known][:, None]
    if known.any():
        idx = np.where(known)[0]
        profile[:idx[0]] = profile[idx[0]]
        profile[idx[-1] + 1:] = profile[idx[-1]]
        for i in range(idx[0] + 1, idx[-1] + 1):
            if not known[i]:
                profile[i] = profile[i - 1]
    base = np.repeat(profile[:, None, :], width, axis=1)

    if rear is not None:
        rear_src = np.asarray(rear.convert("RGB"), dtype=np.float64)
    else:
        m = front.convert("RGB").transpose(Image.FLIP_LEFT_RIGHT)
        m = m.filter(ImageFilter.GaussianBlur(max(2.0, front.width / 110.0)))
        rear_src = np.asarray(m, dtype=np.float64)
    rear_equi, rear_cover = reproject_rectilinear(rear_src, width, height, rear_hfov, 180.0)

    def soften(mask, r):
        m = mask.astype(np.float64)
        m = _box_blur_1d(m, r, axis=1, wrap=True)
        return np.clip(_box_blur_1d(m, r, axis=0, wrap=False), 0, 1)

    ra = soften(rear_cover, max(4, width // 90))[..., None]
    out = base * (1 - ra) + rear_equi * ra
    fa = soften(cover, max(3, width // 200))[..., None]
    out = out * (1 - fa) + equi * fa
    return Image.fromarray(np.clip(collapse_poles(out), 0, 255).astype(np.uint8), "RGB")


# --------------------------------------------------------------------------- #
# Verification
# --------------------------------------------------------------------------- #

def check(path: str, quiet: bool = False) -> int:
    img = Image.open(path).convert("RGB")
    a = np.asarray(img, dtype=np.float64)
    h, w = a.shape[:2]
    problems = []

    if abs(w / h - 2.0) > 0.001:
        problems.append(f"aspect {w/h:.4f} != 2.000")

    seam = np.abs(a[:, 0] - a[:, -1]).mean()
    interior = np.abs(a[:, 1:] - a[:, :-1]).mean()
    if seam > max(4.0, interior * 1.6):
        problems.append(f"wrap seam visible: edge {seam:.2f} vs interior {interior:.2f}")

    z_std, n_std = a[0].std(axis=0).mean(), a[-1].std(axis=0).mean()
    if z_std > 3.0:
        problems.append(f"zenith varies {z_std:.2f} (smears when looking up)")
    if n_std > 3.0:
        problems.append(f"nadir varies {n_std:.2f} (smears when looking down)")

    if not quiet:
        print(f"{path}\n   {w}x{h}  seam={seam:.2f} interior={interior:.2f} "
              f"zenith_std={z_std:.2f} nadir_std={n_std:.2f}")
        for p in problems:
            print(f"   FAIL  {p}")
        if not problems:
            print("   PASS  seamless full sphere, poles resolved")
    return 1 if problems else 0


# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src", nargs="?")
    ap.add_argument("dst", nargs="?")
    ap.add_argument("--width", type=int, default=4096)
    ap.add_argument("--quality", type=int, default=88)
    ap.add_argument("--reproject", action="store_true",
                    help="treat the source as a pinhole photo and place it geometrically")
    ap.add_argument("--rear", help="real rear-view plate (only used with --reproject)")
    ap.add_argument("--hfov", type=float, default=110.0)
    ap.add_argument("--rear-hfov", type=float, default=150.0)
    ap.add_argument("--check", metavar="FILE")
    ap.add_argument("--check-all", action="store_true",
                    help="verify every plate under public/images and exit non-zero on any failure")
    args = ap.parse_args()

    if args.check_all:
        import pathlib
        root = pathlib.Path(__file__).resolve().parent.parent / "public" / "images"
        failures = 0
        total = 0
        for path in sorted(root.rglob("*.jpg")):
            with Image.open(path) as im:
                if im.width == im.height:
                    continue          # catalogue thumbnail, not a panorama
            total += 1
            if check(str(path), quiet=True):
                failures += 1
                check(str(path))
        print(f"{total - failures}/{total} plates are seamless full spheres")
        return 1 if failures else 0

    if args.check:
        return check(args.check)
    if not args.src or not args.dst:
        ap.error("src and dst are required unless --check is used")

    front = Image.open(args.src)

    if args.reproject:
        rear = Image.open(args.rear) if args.rear else None
        pano = build_reprojected(front, rear, args.width, args.hfov, args.rear_hfov)
        mode = f"reprojected (rear={'real' if rear else 'synthesised'})"
    else:
        fitted = fit_sphere(front, args.width)
        a = np.asarray(fitted, dtype=np.float64)
        a = close_seam(a)
        a = collapse_poles(a)
        pano = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
        mode = "sphere-fit"

    pano.save(args.dst, "JPEG", quality=args.quality, optimize=True, progressive=True)
    print(f"{args.src} -> {args.dst}  {pano.width}x{pano.height}  [{mode}]")
    return 0


if __name__ == "__main__":
    sys.exit(main())
