/**
 * Palette comparison between a client's INSPIRATION IMAGE and the live 360 view.
 *
 * WHY THIS EXISTS
 * ---------------
 * "Compare inspiration images" was not a feature. The Compare tab in the studio
 * Edit panel is `BeforeAfterCompare`, which wipes the zone's FACTORY DEFAULT
 * plate against the plate the client's current selections resolve to — a useful
 * thing, but it has nothing to do with an inspiration image, and on most zones
 * both halves are the same picture because no separate plate exists.
 *
 * This module supplies the missing half: read the dominant colours out of an
 * image the client supplies, read them out of the 360 view as it is composited
 * RIGHT NOW (the compositor canvas, not the base plate — so a swap moves the
 * numbers), and report how the two palettes differ.
 *
 * WHAT IT HONESTLY CLAIMS, AND WHAT IT DOES NOT
 * ---------------------------------------------
 * It claims: these are the dominant colours of each image, here is the nearest
 * pairing between them, and here is how far apart they are in lightness,
 * saturation and hue. That is arithmetic on pixels and it is exactly true.
 *
 * It does NOT claim to judge style, layout, mood, formality, or whether the
 * venue "matches the vibe". No colour histogram can do that, and a percentage
 * presented as a style score would be a number we invented. The one aggregate
 * it reports is `coverage` — the share of the inspiration image's colour mass
 * that finds a close counterpart in the view — and it is named and described
 * as a colour figure, nothing more.
 *
 * The extraction is the SAME coarse 32-level RGB bucketing that
 * `MoodBoardMatcher.extractPalette()` already uses in production, including its
 * near-black / near-white rejection, so the two features cannot disagree about
 * what colour an image is. (MoodBoardMatcher should call this instead of
 * keeping its own copy — see the request filed for that file.)
 */

export const SAMPLE_EDGE = 64;
export const PALETTE_SIZE = 6;

/** sRGB 0..255 triple → "#rrggbb". */
export function rgbToHex({ r, g, b }) {
  const f = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}

/** "#rgb" / "#rrggbb" → {r,g,b}, or null. */
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Plain Euclidean RGB distance. Max is √(3·255²) ≈ 441.67. */
export const MAX_DISTANCE = Math.sqrt(3 * 255 * 255);
export function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/** sRGB → HSL, h in degrees 0..360, s and l in 0..1. */
export function rgbToHsl({ r, g, b }) {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  const d = max - min;
  if (d < 1e-9) return { h: 0, s: 0, l };
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0));
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return { h: h * 60, s, l };
}

/** Shortest signed angular difference between two hues, degrees, -180..180. */
export function hueDelta(a, b) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return d;
}

/**
 * Dominant colours of one RGBA buffer.
 *
 * Near-black and near-white are rejected: they dominate almost every photograph
 * (shadow, sky, tablecloth, blown highlight) without describing the palette
 * anybody is actually choosing.
 *
 * @param {Uint8ClampedArray|Uint8Array} data  RGBA pixels
 * @param {number} size  how many colours to return
 * @returns {Array<{hex:string, rgb:{r,g,b}, share:number}>} sorted by share
 */
export function extractPaletteFromPixels(data, size = PALETTE_SIZE) {
  const buckets = new Map();
  let counted = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max < 24 || min > 238) continue;
    const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
    const e = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
    e.r += r; e.g += g; e.b += b; e.n += 1;
    buckets.set(key, e);
    counted++;
  }
  if (!counted) return [];
  return [...buckets.values()]
    .sort((a, b) => b.n - a.n)
    .slice(0, size)
    .map(e => ({
      hex: rgbToHex({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }),
      rgb: { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n },
      share: e.n / counted
    }));
}

/**
 * Downsample any drawable source to SAMPLE_EDGE² and read its palette.
 *
 * Works on an <img>, a <canvas> or an ImageBitmap — which is the point: the
 * LIVE 360 view is `viewer360._compositor.canvas`, an equirectangular canvas
 * whose pixels already include every composited swap. Sampling the base plate
 * URL instead would report the same colours no matter what the client picked.
 *
 * An equirect's top and bottom rows are the sky and the floor directly under
 * the tripod, hugely over-represented by the projection; `bandOnly` crops to
 * the middle half, which is the part of the room a person looks at.
 *
 * @returns {Array} palette, or [] when the source cannot be read (tainted
 *          canvas, decode failure) — never a fabricated result.
 */
export function paletteFromSource(source, { size = PALETTE_SIZE, bandOnly = false } = {}) {
  const sw = source.naturalWidth || source.width;
  const sh = source.naturalHeight || source.height;
  if (!sw || !sh) return [];
  const sy = bandOnly ? Math.round(sh * 0.25) : 0;
  const sHeight = bandOnly ? Math.round(sh * 0.5) : sh;

  const canvas = document.createElement('canvas');
  canvas.width = SAMPLE_EDGE;
  canvas.height = SAMPLE_EDGE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
  try {
    ctx.drawImage(source, 0, sy, sw, sHeight, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
    return extractPaletteFromPixels(
      ctx.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data, size);
  } catch {
    return [];
  }
}

/** Decode a File / data URL / object URL into an <img>. */
export function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Inspiration image could not be decoded'));
    img.src = src;
  });
}

/** Read a File into a data URL, so the canvas is never tainted. */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('File could not be read'));
    fr.readAsDataURL(file);
  });
}

/**
 * Plain-English description of one pairing. Deliberately about COLOUR only.
 */
function describe(insp, near) {
  const a = rgbToHsl(insp.rgb), b = rgbToHsl(near.rgb);
  const dl = b.l - a.l, ds = b.s - a.s, dh = hueDelta(a.h, b.h);
  const bits = [];
  if (Math.abs(dl) > 0.09) bits.push(dl > 0 ? 'lighter in the venue' : 'darker in the venue');
  if (Math.abs(ds) > 0.12) bits.push(ds > 0 ? 'more saturated' : 'more muted');
  if (Math.abs(dh) > 18 && a.s > 0.12 && b.s > 0.12) {
    bits.push(`hue shifted ${Math.round(Math.abs(dh))}° ${dh > 0 ? 'warmer-to-cooler' : 'cooler-to-warmer'}`);
  }
  return bits.length ? bits.join(', ') : 'close match';
}

/**
 * Compare an inspiration palette against the view's palette.
 *
 * For every inspiration colour, find its nearest colour in the view and report
 * the gap. `coverage` weights each pairing by how much of the inspiration image
 * that colour covers, so a dominant colour with no counterpart costs far more
 * than an accent that is slightly off.
 *
 * @param {Array} inspiration  from extractPaletteFromPixels / paletteFromSource
 * @param {Array} view         likewise, from the composited 360 canvas
 * A colour further than TWICE `nearEnough` from anything in the view counts
 * for nothing at all; between the two thresholds it earns squared partial
 * credit. Those are chosen cutoffs, not measurements.
 *
 * @param {number} nearEnough  RGB distance counted as "present in the view".
 *        90 of a 442 maximum — about the point where two swatches stop reading
 *        as the same colour side by side. It is a threshold we chose, not a
 *        measured constant, and the UI should say so.
 * @returns {{pairs:Array, coverage:number|null, matched:number, total:number}}
 *   coverage is null when either palette is empty — never 0, because "we could
 *   not read this image" and "nothing matches" are different answers.
 */
export function comparePalettes(inspiration, view, nearEnough = 90) {
  if (!inspiration?.length || !view?.length) {
    return { pairs: [], coverage: null, matched: 0, total: inspiration?.length || 0 };
  }
  let weighted = 0, weight = 0, matched = 0;
  const pairs = inspiration.map(insp => {
    let near = view[0], best = Infinity;
    for (const v of view) {
      const d = colorDistance(insp.rgb, v.rgb);
      if (d < best) { best = d; near = v; }
    }
    const ok = best <= nearEnough;
    if (ok) matched++;
    // Partial credit for a near miss, falling to ZERO at twice the threshold
    // and squared so a badly missed colour costs nearly its full weight. A
    // linear decay over the whole 0..442 range flattered everything: a
    // dominant blue answered only by green still scored 0.8.
    const credit = ok ? 1 : Math.max(0, 1 - (best - nearEnough) / nearEnough) ** 2;
    weighted += credit * insp.share;
    weight += insp.share;
    return {
      inspiration: insp,
      nearest: near,
      distance: best,
      present: ok,
      note: describe(insp, near)
    };
  });
  return {
    pairs,
    coverage: weight > 0 ? weighted / weight : null,
    matched,
    total: inspiration.length
  };
}

/**
 * One call for the UI: inspiration source + live compositor canvas → verdict.
 *
 * Returns `{ok:false, reason}` rather than a made-up result whenever either
 * side cannot be read.
 */
export async function compareInspirationToView(inspirationSrc, viewCanvas, opts = {}) {
  let img;
  try { img = await loadImageElement(inspirationSrc); }
  catch (e) { return { ok: false, reason: 'The inspiration image could not be decoded.' }; }

  const inspiration = paletteFromSource(img, { size: opts.size ?? PALETTE_SIZE });
  if (!inspiration.length) {
    return { ok: false, reason: 'No usable colour in the inspiration image — it is almost entirely black or white.' };
  }
  if (!viewCanvas || !viewCanvas.width) {
    return { ok: false, reason: 'The 360 view has not finished compositing yet.' };
  }
  const view = paletteFromSource(viewCanvas, { size: opts.size ?? PALETTE_SIZE, bandOnly: true });
  if (!view.length) {
    return { ok: false, reason: 'The 360 view could not be sampled in this browser.' };
  }
  return { ok: true, inspiration, view, ...comparePalettes(inspiration, view, opts.nearEnough) };
}
