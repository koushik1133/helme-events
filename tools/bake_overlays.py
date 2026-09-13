#!/usr/bin/env python3
"""
bake_overlays.py — rasterise catalogue cut-outs into EQUIRECTANGULAR overlay
layers, offline.

WHY
---
The 360 plates are equirectangular photographs and there are only 36 of them
against 776 possible decor configurations. Baking a whole plate per combination
is multiplicative and hopeless; baking ONE transparent layer per (zone, slot,
item) is additive — 69 layers covers every combination this catalogue can
produce. At runtime the viewer just blits the layer 1:1 over the plate, so a
swap is a redraw rather than an image load.

WHAT IT PRODUCES
----------------
    public/images/overlays/<zone>/<slot>__<item>.png         colour, RGBA
    public/images/overlays/<zone>/<slot>__<item>.shadow.png  contact shadow, A
    public/images/overlays/manifest.json                     {u,v,w,h,W,H,...}

Both are cropped to the layer's bounding box, so a chair is a ~200x300 PNG, not
a 3072x1536 one.

THE MATHS
---------
Identical to `src/engine/equirectBillboard.js` — deliberately, so a baked layer
and the runtime fallback are the same picture. Inverse map: iterate DESTINATION
equirect pixels, turn each into a view ray, intersect it with a vertical
billboard plane standing in the room, sample the cut-out bilinearly where it
hits. Forward-warping cannot work: a straight billboard edge is a CURVE in
equirect space, and only the inverse map reproduces that (and the near-floor
vertical stretch) for free.

The cut-out's `contact` value from public/images/cutouts/manifest.json says
where the object's FEET sit inside the frame, 0..1 from the top. That point is
anchored to the floor plane — anchoring the image centre instead is what makes
a composited chair hover.

USAGE
    python3 tools/bake_overlays.py --all
    python3 tools/bake_overlays.py --item chair-folding --yaw -15 \
        --distance 3.5 --height 0.9 --out /tmp/chair.png
"""
from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOUT_MANIFEST = os.path.join(ROOT, 'public/images/cutouts/manifest.json')
OUT_DIR = os.path.join(ROOT, 'public/images/overlays')
PLATE_W, PLATE_H = 3072, 1536
CAMERA_HEIGHT_M = 1.5


# --------------------------------------------------------------------- maths

def billboard_frame(yaw_deg, distance_m, height_m, aspect, contact,
                    camera_height_m=CAMERA_HEIGHT_M, ground=True, pitch_deg=0.0):
    """Bottom-centre anchor + span vectors of the billboard. Mirrors JS."""
    lam = math.radians(yaw_deg)
    D = max(0.4, distance_m)
    contact = min(0.995, max(0.05, contact))
    h_m = height_m / contact           # the cut-out frame is taller than the object
    w_m = h_m * aspect

    dir_h = (math.sin(lam), 0.0, -math.cos(lam))
    right = (math.cos(lam), 0.0, math.sin(lam))
    up = (0.0, 1.0, 0.0)

    if ground:
        feet_y = -camera_height_m
    else:
        feet_y = math.tan(math.radians(pitch_deg)) * D - height_m / 2
    base_y = feet_y - (1 - contact) * h_m

    p0 = (D * dir_h[0], base_y, D * dir_h[2])
    contact_c = (D * dir_h[0], feet_y, D * dir_h[2])
    return dict(P0=p0, right=right, up=up, wM=w_m, hM=h_m,
                contact=contact_c, lam=lam, D=D)


def dir_to_uv(p, W, H):
    x, y, z = p
    n = math.sqrt(x * x + y * y + z * z) or 1.0
    x, y, z = x / n, y / n, z / n
    lam = math.atan2(x, -z)
    phi = math.asin(max(-1.0, min(1.0, y)))
    return ((lam + math.pi) / (2 * math.pi) * W, (math.pi / 2 - phi) / math.pi * H)


def frame_bbox(fr, W, H, pad=3):
    us, vs = [], []
    for sx in (-0.5, 0.5):
        for sy in (0.0, 0.5, 1.0):
            p = tuple(fr['P0'][i] + fr['right'][i] * sx * fr['wM'] + fr['up'][i] * sy * fr['hM']
                      for i in range(3))
            u, v = dir_to_uv(p, W, H)
            us.append(u); vs.append(v)
    u0, u1 = min(us), max(us)
    if (u1 - u0) > W / 2:          # straddles the lambda = +-pi seam
        u0, u1 = 0, W
    x0 = max(0, int(math.floor(u0)) - pad)
    x1 = min(W, int(math.ceil(u1)) + pad)
    y0 = max(0, int(math.floor(min(vs))) - pad)
    y1 = min(H, int(math.ceil(max(vs))) + pad)
    return x0, y0, max(1, x1 - x0), max(1, y1 - y0)


def _rays(x0, y0, w, h, W, H):
    """Unit directions for every pixel centre in the bbox. Vectorised."""
    u = (np.arange(x0, x0 + w) + 0.5)[None, :]
    v = (np.arange(y0, y0 + h) + 0.5)[:, None]
    lam = u / W * 2 * math.pi - math.pi
    phi = math.pi / 2 - v / H * math.pi
    cp = np.cos(phi)
    return (cp * np.sin(lam), np.broadcast_to(np.sin(phi), (h, w)).copy(), -cp * np.cos(lam))


def _bilinear(src, sx, sy, valid):
    """src: (ch, cw, 4) float. sx/sy: float pixel coords. Returns (h, w, 4)."""
    ch, cw = src.shape[:2]
    x = np.clip(sx, 0, cw - 1.001)
    y = np.clip(sy, 0, ch - 1.001)
    x0 = x.astype(np.int32); y0 = y.astype(np.int32)
    x1 = np.minimum(x0 + 1, cw - 1); y1 = np.minimum(y0 + 1, ch - 1)
    tx = (x - x0)[..., None]; ty = (y - y0)[..., None]
    out = (src[y0, x0] * (1 - tx) * (1 - ty) + src[y0, x1] * tx * (1 - ty)
           + src[y1, x0] * (1 - tx) * ty + src[y1, x1] * tx * ty)
    out[~valid] = 0
    return out


MATTE_LO, MATTE_HI = 0.42, 0.86


def dematte(alpha):
    """
    Suppress the cut-out's soft matte.

    make_cutouts.py preserves each product photo's own contact shadow, which
    survives as a wide skirt of semi-transparent STUDIO-COLOURED pixels (light
    grey on a white seamless). Composited onto a night lawn that skirt reads as
    a pale halo — the single most obvious tell that something was pasted in.
    The real shadow is a separate multiply pass against the actual plate, so
    this fringe is redundant as well as harmful. Mirrors demat() in
    src/engine/equirectBillboard.js exactly.
    """
    a = alpha / 255.0
    t = np.clip((a - MATTE_LO) / (MATTE_HI - MATTE_LO), 0, 1)
    return np.where(a <= MATTE_LO, 0.0, a * (t * t * (3 - 2 * t))) * 255.0


def rasterise(cut_rgba, fr, bbox, W, H):
    """Inverse-map the cut-out into the bbox of a W x H equirect."""
    x0, y0, w, h = bbox
    dx, dy, dz = _rays(x0, y0, w, h, W, H)
    r = fr['right']; up = fr['up']; p0 = fr['P0']
    n = (r[1] * up[2] - r[2] * up[1], r[2] * up[0] - r[0] * up[2], r[0] * up[1] - r[1] * up[0])

    dn = dx * n[0] + dy * n[1] + dz * n[2]
    denom = p0[0] * n[0] + p0[1] * n[1] + p0[2] * n[2]
    with np.errstate(divide='ignore', invalid='ignore'):
        t = np.where(np.abs(dn) < 1e-9, -1.0, denom / dn)
    hit = t > 0
    Xx = t * dx - p0[0]; Xy = t * dy - p0[1]; Xz = t * dz - p0[2]
    s = (Xx * r[0] + Xy * r[1] + Xz * r[2]) / fr['wM'] + 0.5
    q = (Xx * up[0] + Xy * up[1] + Xz * up[2]) / fr['hM']
    valid = hit & (s >= 0) & (s <= 1) & (q >= 0) & (q <= 1)

    ch, cw = cut_rgba.shape[:2]
    px = _bilinear(cut_rgba, np.where(valid, s, 0) * (cw - 1),
                   (1 - np.where(valid, q, 0)) * (ch - 1), valid)
    px[..., 3] = dematte(px[..., 3])
    return np.clip(px, 0, 255).astype(np.uint8)


def contact_shadow(fr, bbox, W, H, strength=0.72, spread=1.04, squash=0.42):
    """Soft elliptical floor shadow as an alpha-only RGBA patch."""
    x0, y0, w, h = bbox
    dx, dy, dz = _rays(x0, y0, w, h, W, H)
    cy = fr['contact'][1]
    cx, cz = fr['contact'][0], fr['contact'][2]
    rx = (fr['wM'] / 2) * spread
    rz = rx * squash
    with np.errstate(divide='ignore', invalid='ignore'):
        t = np.where(dy < -1e-6, cy / dy, -1.0)
    ok = t > 0
    ax = t * dx - cx; az = t * dz - cz
    cl, sl = math.cos(fr['lam']), math.sin(fr['lam'])
    a = ax * cl + az * sl
    b = -ax * sl + az * cl
    rr = np.sqrt((a / rx) ** 2 + (b / rz) ** 2)
    f = np.where(ok & (rr < 1), np.power(np.clip(1 - rr, 0, 1), 1.6), 0.0)
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 3] = np.clip(f * 255 * strength, 0, 255).astype(np.uint8)
    return out


# ------------------------------------------------------------------ driver

def load_cutout(item_id, manifest):
    entry = manifest.get(item_id)
    if not entry:
        return None, None
    path = os.path.join(ROOT, 'public', entry['url'].lstrip('/'))
    if not os.path.exists(path):
        return None, None
    img = Image.open(path).convert('RGBA')
    return np.asarray(img).astype(np.float32), entry


def targets_from_app():
    """
    Single source of truth: ask the app's own data modules which (zone, slot,
    item) combinations have NO baked plate and what each slot's geometry is.
    Duplicating zones.js/propOverlays.js in Python would drift immediately.
    """
    script = r"""
import {VENUE_ZONES} from './src/data/zones.js';
import {SCENE_VARIANTS} from './src/data/sceneVariants.js';
import {ITEM_CATALOG, getItemById} from './src/data/catalog.js';
import {overlaySpec, CAMERA_HEIGHT_M} from './src/data/propOverlays.js';
const out = [];
for (const z of VENUE_ZONES) for (const s of z.slots) {
  let ids = s.allowedItemIds || [];
  if (!ids.length) {
    const cats = s.swapCategories || [s.category];
    ids = cats.flatMap(c => (ITEM_CATALOG[c] || []).map(i => i.id));
  }
  for (const id of [...new Set(ids)]) {
    if (SCENE_VARIANTS[z.id]?.[s.id]?.[id]) continue;   // a real plate exists
    const spec = overlaySpec(s, getItemById(id));
    if (!spec) continue;
    out.push({zone: z.id, slot: s.id, item: id, yaw: spec.anchorYaw,
              pitch: spec.anchorPitch, distance: spec.distanceM,
              height: spec.heightM, ground: spec.ground,
              cameraHeight: CAMERA_HEIGHT_M});
  }
}
process.stdout.write(JSON.stringify(out));
"""
    res = subprocess.run(['node', '--input-type=module', '-e', script],
                         cwd=ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit('node failed while enumerating targets:\n' + res.stderr)
    return json.loads(res.stdout)


def bake_one(t, manifest, W, H, force=False):
    cut, entry = load_cutout(t['item'], manifest)
    if cut is None:
        return None, f"no cut-out for {t['item']}"
    fr = billboard_frame(t['yaw'], t['distance'], t['height'],
                         cut.shape[1] / cut.shape[0], entry.get('contact', 0.9),
                         t.get('cameraHeight', CAMERA_HEIGHT_M),
                         ground=t.get('ground', True), pitch_deg=t.get('pitch', 0))
    bbox = frame_bbox(fr, W, H)
    colour = rasterise(cut, fr, bbox, W, H)
    if colour[..., 3].max() == 0:
        return None, 'billboard projects to nothing (check yaw/distance)'

    zdir = os.path.join(OUT_DIR, t['zone'])
    os.makedirs(zdir, exist_ok=True)
    stem = f"{t['slot']}__{t['item']}"
    cpath = os.path.join(zdir, stem + '.png')
    Image.fromarray(colour, 'RGBA').save(cpath, optimize=True)

    spath = None
    if t.get('ground', True):
        sh = contact_shadow(fr, bbox, W, H)
        if sh[..., 3].max() > 0:
            spath = os.path.join(zdir, stem + '.shadow.png')
            Image.fromarray(sh, 'RGBA').save(spath, optimize=True)

    x, y, w, h = bbox
    return {
        'u': x, 'v': y, 'w': w, 'h': h, 'W': W, 'H': H,
        'colour': '/images/overlays/%s/%s.png' % (t['zone'], stem),
        'shadow': ('/images/overlays/%s/%s.shadow.png' % (t['zone'], stem)) if spath else None,
        'yaw': t['yaw'], 'distanceM': t['distance'], 'heightM': t['height'],
        'ground': bool(t.get('ground', True)),
    }, None


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--all', action='store_true',
                    help='bake every (zone, slot, item) that has no baked plate')
    ap.add_argument('--item', help='single cut-out id')
    ap.add_argument('--yaw', type=float, default=0.0)
    ap.add_argument('--pitch', type=float, default=0.0)
    ap.add_argument('--distance', type=float, default=6.0)
    ap.add_argument('--height', type=float, default=1.0, help='object height, metres')
    ap.add_argument('--floating', action='store_true',
                    help='the item hangs or is wall-mounted: no floor anchor, no contact shadow')
    ap.add_argument('--out', help='output PNG for single-item mode')
    ap.add_argument('--width', type=int, default=PLATE_W)
    ap.add_argument('--height-px', type=int, default=PLATE_H, dest='height_px')
    args = ap.parse_args()

    with open(CUTOUT_MANIFEST) as f:
        manifest = json.load(f)

    if args.item and not args.all:
        t = dict(zone='_adhoc', slot='_adhoc', item=args.item, yaw=args.yaw,
                 pitch=args.pitch, distance=args.distance, height=args.height,
                 ground=not args.floating)
        meta, err = bake_one(t, manifest, args.width, args.height_px)
        if err:
            sys.exit(err)
        if args.out:
            src = os.path.join(ROOT, 'public', meta['colour'].lstrip('/'))
            os.replace(src, args.out)
            meta['colour'] = args.out
        print(json.dumps(meta, indent=2))
        return

    if not args.all:
        ap.error('pass --all, or --item with placement flags')

    targets = targets_from_app()
    out = {}
    skipped = []
    for i, t in enumerate(targets, 1):
        meta, err = bake_one(t, manifest, args.width, args.height_px)
        key = '%s/%s/%s' % (t['zone'], t['slot'], t['item'])
        if err:
            skipped.append((key, err))
        else:
            out[key] = meta
        print('[%3d/%d] %s %s' % (i, len(targets), key, err or 'ok'), file=sys.stderr)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'manifest.json'), 'w') as f:
        json.dump(out, f, indent=2, sort_keys=True)
    total = sum(os.path.getsize(os.path.join(dp, fn))
                for dp, _, fns in os.walk(OUT_DIR) for fn in fns)
    print('\nbaked %d layers, skipped %d, %.1f MB total'
          % (len(out), len(skipped), total / 1e6))
    for k, e in skipped:
        print('  skipped %s — %s' % (k, e))


if __name__ == '__main__':
    main()
