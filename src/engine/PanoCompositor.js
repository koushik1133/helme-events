import {
  billboardFrame, frameBBox, rasteriseBillboard, rasteriseContactShadow
} from './equirectBillboard.js';

/**
 * PanoCompositor — builds the equirectangular image the 360 sphere is textured
 * with: the base photographic plate, plus one transparent layer per decor slot
 * the plate does not already depict.
 *
 * WHY A CANVAS AND NOT A DOM OVERLAY
 * ----------------------------------
 * The previous build drew swapped items as absolutely-positioned <img> elements
 * over the viewer. The panorama pixels never changed, so a swap was literally
 * invisible to anything that looks at the picture — screenshots, exports, and
 * (as the owner found) the eye, once the sprite failed to appear. Compositing
 * into the texture means a swap is a redraw of a few hundred kilopixels plus
 * `texture.needsUpdate = true`: no image fetch, no viewer rebuild, no flash.
 *
 * COMPOSITING IS DONE IN LINEAR LIGHT
 * -----------------------------------
 * sRGB-space alpha blending produces dark fringes and grey, lifeless shadows.
 * Both plate and layer are decoded to linear, blended premultiplied, and
 * re-encoded. Only the dirty rectangle of each layer is touched, so the cost of
 * the conversion is a few hundred thousand pixels, not the full 4.7 M.
 */

const SRGB_TO_LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_TO_LIN[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
const LIN_STEPS = 4096;
const LIN_TO_SRGB = new Uint8ClampedArray(LIN_STEPS + 1);
for (let i = 0; i <= LIN_STEPS; i++) {
  const c = i / LIN_STEPS;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  LIN_TO_SRGB[i] = Math.round(s * 255);
}
function encode(lin) {
  const i = lin <= 0 ? 0 : lin >= 1 ? LIN_STEPS : (lin * LIN_STEPS) | 0;
  return LIN_TO_SRGB[i];
}

/** Fetch an image as a decoded bitmap, once. */
const IMAGE_CACHE = new Map();
export function loadImage(url) {
  if (IMAGE_CACHE.has(url)) return IMAGE_CACHE.get(url);
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image failed to load: ${url}`));
    img.src = url;
  });
  IMAGE_CACHE.set(url, p);
  return p;
}

/** Read an image into raw RGBA. Cut-outs are small (<=768px), so this is cheap. */
const PIXEL_CACHE = new Map();
async function loadPixels(url) {
  if (PIXEL_CACHE.has(url)) return PIXEL_CACHE.get(url);
  const p = loadImage(url).then(img => {
    const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    return cx.getImageData(0, 0, w, h);
  });
  PIXEL_CACHE.set(url, p);
  return p;
}

export class PanoCompositor {
  /**
   * @param {number} width  equirect width  (plates are 3072×1536)
   * @param {number} height equirect height
   */
  constructor(width = 3072, height = 1536) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.width = width;
    this.height = height;
    this._baseUrl = null;
    this._layers = [];          // resolved layer descriptors, back to front
    this._patchCache = new Map();
    this.onChange = null;       // called after every successful render
    this.revision = 0;
  }

  /**
   * Point the compositor at a new base plate. Resolves once decoded.
   * The canvas is resized to the plate so the texture is never resampled.
   */
  async setBase(url) {
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (w && h && (w !== this.width || h !== this.height)) {
      this.canvas.width = this.width = w;
      this.canvas.height = this.height = h;
      this._patchCache.clear();       // geometry is resolution-dependent
    }
    this._baseUrl = url;
    this._baseImg = img;
    return img;
  }

  /**
   * Declare the full set of composited layers for the current configuration.
   * `specs` are sorted back-to-front here, so callers may pass them in any order.
   *
   * @param {Array<{slotId, itemId, cutoutUrl, yawDeg, pitchDeg, distanceM,
   *                heightM, contact, ground, shadow}>} specs
   */
  setLayers(specs) {
    this._layers = (specs || [])
      .filter(s => s && s.cutoutUrl)
      .slice()
      .sort((a, b) => (b.distanceM || 0) - (a.distanceM || 0));
  }

  /** Stable cache key: identical geometry never re-rasterises. */
  _key(s) {
    return [s.cutoutUrl, s.yawDeg, s.pitchDeg, s.distanceM, s.heightM,
      s.ground ? 1 : 0, this.width, this.height].join('|');
  }

  async _patch(spec) {
    const key = this._key(spec);
    if (this._patchCache.has(key)) return this._patchCache.get(key);
    const p = (async () => {
      const cut = await loadPixels(spec.cutoutUrl);
      const frame = billboardFrame({
        yawDeg: spec.yawDeg,
        pitchDeg: spec.pitchDeg,
        distanceM: spec.distanceM,
        heightM: spec.heightM,
        aspect: cut.width / cut.height,
        contact: spec.contact,
        cameraHeightM: spec.cameraHeightM ?? 1.5,
        ground: spec.ground !== false
      });
      const bbox = frameBBox(frame, this.width, this.height);
      const colour = rasteriseBillboard(cut, frame, bbox, this.width, this.height);
      const shadow = (spec.shadow !== false && spec.ground !== false)
        ? rasteriseContactShadow(frame, bbox, this.width, this.height)
        : null;
      return { bbox, colour, shadow };
    })();
    this._patchCache.set(key, p);
    return p;
  }

  /**
   * Redraw base + every layer. Awaiting this guarantees the canvas pixels are
   * final, which is what the swap-audit script hashes.
   */
  async render() {
    if (!this._baseImg) return;
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.ctx.drawImage(this._baseImg, 0, 0, this.width, this.height);

    const patches = [];
    for (const spec of this._layers) {
      try { patches.push([spec, await this._patch(spec)]); }
      catch (e) { /* a missing cut-out must not blank the panorama */ }
    }

    // Shadows first (multiply onto the plate), then colour over — every layer's
    // shadow must sit under every layer's geometry.
    for (const [, p] of patches) if (p.shadow) this._blend(p.bbox, p.shadow, 'multiply');
    for (const [, p] of patches) this._blend(p.bbox, p.colour, 'over');

    this.revision++;
    if (this.onChange) this.onChange();
  }

  /** Blend one patch into the canvas in linear light. */
  _blend(bbox, patch, mode) {
    if (!bbox.w || !bbox.h) return;
    const dst = this.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const D = dst.data, S = patch.data;
    for (let i = 0; i < D.length; i += 4) {
      const a = S[i + 3] / 255;
      if (a <= 0) continue;
      if (mode === 'multiply') {
        // Shadow: darken the plate. dst *= (1 − alpha), in linear light.
        const k = 1 - a;
        D[i]     = encode(SRGB_TO_LIN[D[i]] * k);
        D[i + 1] = encode(SRGB_TO_LIN[D[i + 1]] * k);
        D[i + 2] = encode(SRGB_TO_LIN[D[i + 2]] * k);
      } else {
        const ia = 1 - a;
        D[i]     = encode(SRGB_TO_LIN[S[i]] * a + SRGB_TO_LIN[D[i]] * ia);
        D[i + 1] = encode(SRGB_TO_LIN[S[i + 1]] * a + SRGB_TO_LIN[D[i + 1]] * ia);
        D[i + 2] = encode(SRGB_TO_LIN[S[i + 2]] * a + SRGB_TO_LIN[D[i + 2]] * ia);
      }
    }
    this.ctx.putImageData(dst, bbox.x, bbox.y);
  }

  /**
   * Cheap deterministic hash of the composited pixels. Used by the swap audit
   * to prove that every swap genuinely changes the picture.
   */
  hash(step = 7) {
    const d = this.ctx.getImageData(0, 0, this.width, this.height).data;
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const stride = step * 4;
    for (let i = 0; i < d.length; i += stride) {
      h1 = ((h1 ^ d[i]) * 16777619) >>> 0;
      h2 = ((h2 + d[i + 1] * 31 + d[i + 2] * 7 + d[i + 3]) * 2654435761) >>> 0;
    }
    return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0'));
  }

  dispose() {
    this._patchCache.clear();
    this._layers = [];
    this._baseImg = null;
    this.canvas.width = this.canvas.height = 1;
  }
}
