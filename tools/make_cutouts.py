#!/usr/bin/env python3
"""
Cut catalogue product shots out of their studio background.

Why
---
Every decor item in the catalogue is a 1024x1024 studio photograph on a dark
gradient sweep. To make a swap visibly change the 360 view we need the item on
transparency, so it can be composited into the panorama instead of pasted as an
obvious square tile.

How
---
These shots share one helpful property: the subject is lit and the sweep is not.
So the matte is driven by luminance distance from the measured background, not by
a single chroma key:

  1. MEASURE   sample the border ring to learn the background's colour and its
               vertical gradient, since a sweep is darker at the top than at the
               bottom.
  2. MATTE     alpha from distance to the *local* background colour at that row,
               so the gradient does not eat the subject's dark edges.
  3. CONNECT   keep only the component touching the image centre, which drops
               vignette corners and stray specks.
  4. GROUND    keep the contact shadow. It is what stops the object reading as a
               sticker once it is in the scene, so the bottom band is matted more
               gently and kept as semi-transparent darkness.
  5. FEATHER   soften the edge by a pixel or two to kill the cut-out fringe.
  6. TRIM      crop to the subject's bounding box and record where the object's
               floor contact sits, which the compositor needs to stand it on the
               ground rather than float it.

Output is a PNG with alpha plus a JSON sidecar of placement metadata.

    python3 tools/make_cutouts.py                 # all catalogue items
    python3 tools/make_cutouts.py chair-ghost     # one item, for tuning
"""

from __future__ import annotations

import json
import pathlib
import re
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"
OUT_DIR = IMAGES / "cutouts"
CATALOG = ROOT / "src" / "data" / "catalog.js"


# --------------------------------------------------------------------------- #

def catalogue_items() -> list[dict]:
    """Pull id + imageUrl pairs straight out of catalog.js."""
    src = CATALOG.read_text()
    items = []
    for block in re.finditer(r"\{[^{}]*?id:\s*'([^']+)'[^{}]*?\}", src, re.S):
        body = block.group(0)
        img = re.search(r"imageUrl:\s*'([^']+)'", body)
        cat = re.search(r"category:\s*'([^']+)'", body)
        if img:
            items.append({
                "id": block.group(1),
                "imageUrl": img.group(1),
                "category": cat.group(1) if cat else None,
            })
    return items


def background_surface(a: np.ndarray, ring: int = 26) -> np.ndarray:
    """
    Model the studio sweep as a smooth surface across BOTH axes.

    A per-row median handles the top-to-bottom gradient but not the lens vignette,
    which darkens the corners — and that leftover error is what survives the matte
    as grey patches floating beside the subject. Fitting a quadratic in x and y to
    the border ring models gradient and vignette together.

    Returns an (h, w, 3) background estimate.
    """
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    ys = (yy / h) - 0.5
    xs = (xx / w) - 0.5

    border = np.zeros((h, w), dtype=bool)
    border[:ring, :] = border[-ring:, :] = True
    border[:, :ring] = border[:, -ring:] = True

    # Quadratic basis: 1, x, y, x^2, y^2, xy
    def basis(x, y):
        return np.stack([np.ones_like(x), x, y, x * x, y * y, x * y], axis=-1)

    B_all = basis(xs, ys).reshape(-1, 6)
    B_border = basis(xs[border], ys[border])

    out = np.empty_like(a)
    for c in range(3):
        target = a[..., c][border]
        # Least squares, robust-ish: drop the brightest 10% of border samples in
        # case the subject bleeds into the ring.
        keep = target <= np.percentile(target, 90)
        coef, *_ = np.linalg.lstsq(B_border[keep], target[keep], rcond=None)
        out[..., c] = (B_all @ coef).reshape(h, w)
    return out


def largest_central_component(mask: np.ndarray) -> np.ndarray:
    """
    Keep the blob that contains the image centre.

    Avoids a scipy dependency: iterative dilation of a seed, intersected with the
    mask, until it stops growing.
    """
    h, w = mask.shape
    seed = np.zeros_like(mask, dtype=bool)
    cy, cx = h // 2, w // 2
    # Seed from the centre column band, where the subject always is.
    seed[cy - h // 8: cy + h // 8, cx - w // 8: cx + w // 8] = True
    seed &= mask
    if not seed.any():
        return mask

    grown = seed
    for _ in range(400):
        nxt = grown.copy()
        nxt[1:, :] |= grown[:-1, :]
        nxt[:-1, :] |= grown[1:, :]
        nxt[:, 1:] |= grown[:, :-1]
        nxt[:, :-1] |= grown[:, 1:]
        nxt &= mask
        if nxt.sum() == grown.sum():
            break
        grown = nxt
    return grown


def cut_out(path: pathlib.Path) -> tuple[Image.Image, dict] | None:
    img = Image.open(path).convert("RGB")
    a = np.asarray(img, dtype=np.float64)
    h, w = a.shape[:2]

    bg = background_surface(a)                              # (h, w, 3)
    dist = np.linalg.norm(a - bg, axis=2)                   # distance per pixel

    # Scale the threshold to how noisy the background actually is.
    edge_noise = np.median(np.abs(dist[:, :16])) + np.median(np.abs(dist[:, -16:]))
    lo = max(18.0, edge_noise * 2.0)
    hi = lo * 2.6

    alpha = np.clip((dist - lo) / (hi - lo), 0.0, 1.0)

    solid = alpha > 0.45
    if solid.sum() < (h * w) * 0.004:
        return None                                         # nothing found

    keep = largest_central_component(solid)

    # Let the component decide the subject, but keep soft edges around it by
    # dilating the keep-mask a little before using it to gate alpha.
    gate = keep.copy()
    for _ in range(6):
        nxt = gate.copy()
        nxt[1:, :] |= gate[:-1, :]
        nxt[:-1, :] |= gate[1:, :]
        nxt[:, 1:] |= gate[:, :-1]
        nxt[:, :-1] |= gate[:, 1:]
        gate = nxt
    alpha = np.where(gate, alpha, 0.0)

    # Contact shadow: in the bottom fifth, keep darkness below the background as
    # partial alpha so the object lands on a surface instead of hovering.
    floor_from = int(h * 0.78)
    darker = (bg[floor_from:] - a[floor_from:]).mean(axis=2)
    shadow = np.clip(darker / 42.0, 0.0, 0.55)
    alpha[floor_from:] = np.maximum(alpha[floor_from:], shadow)

    rgba = np.dstack([a, alpha * 255.0]).astype(np.uint8)
    out = Image.fromarray(rgba, "RGBA")

    # Feather the matte edge.
    ch = list(out.split())
    ch[3] = ch[3].filter(ImageFilter.GaussianBlur(1.1))
    out = Image.merge("RGBA", ch)

    # Trim to content and record where the subject meets the floor.
    bbox = out.getbbox()
    if not bbox:
        return None
    out = out.crop(bbox)

    solid_rows = np.where(keep.any(axis=1))[0]
    contact_y = int(solid_rows[-1]) if len(solid_rows) else h - 1
    meta = {
        "width": out.width,
        "height": out.height,
        # Where the object's feet sit inside the trimmed PNG, 0..1 from the top.
        # The compositor anchors this point to the ground, not the image centre.
        "contact": round(min(1.0, max(0.0, (contact_y - bbox[1]) / max(1, out.height))), 4),
        "coverage": round(float(keep.sum()) / (h * w), 4),
    }
    return out, meta


def main() -> int:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    items = catalogue_items()
    if only:
        items = [i for i in items if i["id"] == only]
        if not items:
            print(f"no catalogue item with id {only}", file=sys.stderr)
            return 1

    manifest, failed = {}, []
    for item in items:
        src = IMAGES / item["imageUrl"].replace("/images/", "")
        if not src.exists():
            failed.append((item["id"], "source missing"))
            continue
        result = cut_out(src)
        if result is None:
            failed.append((item["id"], "no subject found"))
            continue
        png, meta = result
        # Composited at a few hundred pixels on screen; 768 on the long edge is
        # ample and takes these from ~1.5 MB to ~100 KB.
        MAX_EDGE = 768
        if max(png.width, png.height) > MAX_EDGE:
            scale = MAX_EDGE / max(png.width, png.height)
            png = png.resize((max(1, round(png.width * scale)),
                              max(1, round(png.height * scale))), Image.LANCZOS)
            meta["width"], meta["height"] = png.width, png.height
        png = png.quantize(colors=256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).convert("RGBA")
        dest = OUT_DIR / f"{item['id']}.png"
        png.save(dest, "PNG", optimize=True)
        meta["url"] = f"/images/cutouts/{item['id']}.png"
        meta["category"] = item["category"]
        meta["bytes"] = dest.stat().st_size
        manifest[item["id"]] = meta
        print(f"{item['id']:32s} {png.width:4d}x{png.height:<4d} "
              f"contact={meta['contact']:.2f} coverage={meta['coverage']:.3f} "
              f"{meta['bytes']//1024:4d} KB")

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"\n{len(manifest)} cut-outs written to {OUT_DIR.relative_to(ROOT)}")
    for item_id, why in failed:
        print(f"  FAILED {item_id}: {why}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
