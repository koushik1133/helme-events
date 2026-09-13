#!/usr/bin/env python3
"""
Regenerate src/data/panoramaMeta.js from the real files on disk.

Run after adding or reprocessing any panorama plate:
    npm run panorama:manifest
"""
import pathlib
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
IMAGES = ROOT / "public" / "images"
OUT = ROOT / "src" / "data" / "panoramaMeta.js"

HEADER = """/**
 * Panorama source metadata — measured from the actual files.
 *
 * Every plate here is a TRUE 2:1 equirectangular panorama covering the full
 * 360° x 180° sphere, produced by `tools/pano360.py`. That tool resamples each
 * source to 2:1, cross-fades the x = 0 / x = W wrap so the left and right edges
 * meet at one point, and collapses the zenith and nadir toward a single colour
 * so looking straight up or down shows sky and ground rather than a smear.
 *
 * Because every plate is a full sphere, Viewer360 needs no per-plate projection
 * override — this manifest exists so the tests can ASSERT that and catch any
 * future asset added without conversion.
 *
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   npm run panorama:manifest
 *
 * %d plates, all full 360°.
 */
export const PANORAMA_DIMENSIONS = {"""

FOOTER = """};

/** A plate is a usable full sphere only if it is 2:1. */
export function isTrue360(url) {
  const d = PANORAMA_DIMENSIONS[url];
  if (!d) return false;
  return Math.abs(d.w / d.h - 2) < 0.01;
}

/** Every plate that is NOT a full sphere — must always be empty. */
export function nonSphericalPlates() {
  return Object.keys(PANORAMA_DIMENSIONS).filter((url) => !isTrue360(url));
}
"""


def main() -> int:
    if not IMAGES.is_dir():
        print(f"no such directory: {IMAGES}", file=sys.stderr)
        return 1

    rows = []
    for path in sorted(IMAGES.rglob("*.jpg")):
        with Image.open(path) as im:
            # Square files are catalogue thumbnails, never panoramas.
            if im.width == im.height:
                continue
            rows.append((f"/images/{path.relative_to(IMAGES)}", im.width, im.height))

    lines = [HEADER % len(rows)]
    lines += [f"  '{url}': {{ w: {w}, h: {h} }}," for url, w, h in rows]
    lines.append(FOOTER)
    OUT.write_text("\n".join(lines))

    bad = [u for u, w, h in rows if abs(w / h - 2) >= 0.01]
    print(f"{OUT.relative_to(ROOT)}: {len(rows)} plates, {len(rows) - len(bad)} full 360")
    if bad:
        print("NOT 2:1 — run tools/pano360.py on these:", file=sys.stderr)
        for u in bad:
            print(f"  {u}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
