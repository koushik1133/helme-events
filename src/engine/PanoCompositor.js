import {
  billboardFrame, frameBBox, rasteriseBillboard, rasteriseContactShadow,
  arrangementPlacements, rasteriseBlockShadow, unionBBox, blitOver, cutoutOccupancy
} from './equirectBillboard.js';
import { arrangementFor } from '../data/propOverlays.js';
import { VENUE_ZONES } from '../data/zones.js';

/**
 * Slot lookup by id. The compositor is handed `slotId`/`itemId` by the viewer
 * and needs the slot's QUANTITY to know whether a layer is one object or a
 * block of twenty, so it resolves the slot itself rather than requiring every
 * caller to thread quantity through.
 */
const SLOT_BY_ID = new Map();
for (const z of VENUE_ZONES) for (const s of z.slots) SLOT_BY_ID.set(s.id, s);

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

/** One separable 3x3 binomial blur pass over an RGBA patch, alpha included. */
function blur3(patch, w, h) {
  const D = patch.data;
  const tmp = new Uint8ClampedArray(D.length);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      const a = (i > 0 ? o - 4 : o), b = (i < w - 1 ? o + 4 : o);
      for (let c = 0; c < 4; c++) tmp[o + c] = (D[a + c] + 2 * D[o + c] + D[b + c]) / 4;
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const o = (j * w + i) * 4;
      const a = (j > 0 ? o - w * 4 : o), b = (j < h - 1 ? o + w * 4 : o);
      for (let c = 0; c < 4; c++) D[o + c] = (tmp[a + c] + 2 * tmp[o + c] + tmp[b + c]) / 4;
    }
  }
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
    return [s.baked?.colour || s.cutoutUrl, s.slotId, s.itemId, s.yawDeg, s.pitchDeg,
      s.distanceM, s.heightM, s.ground ? 1 : 0, this.width, this.height].join('|');
  }

  /**
   * A layer that was baked offline needs no maths at all — it is already in
   * equirectangular space and blits 1:1 at its stored (u, v).
   */
  async _bakedPatch(spec) {
    const baked = spec.baked;
    const bbox = { x: baked.u, y: baked.v, w: baked.w, h: baked.h };
    const read = async url => {
      const img = await loadImage(url);
      const c = document.createElement('canvas');
      c.width = bbox.w; c.height = bbox.h;
      const cx = c.getContext('2d', { willReadFrequently: true });
      cx.drawImage(img, 0, 0);
      return cx.getImageData(0, 0, bbox.w, bbox.h);
    };
    const colour = await read(baked.colour);
    const shadow = baked.shadow ? await read(baked.shadow).catch(() => null) : null;
    return { bbox, colour, shadow };
  }

  async _patch(spec) {
    const key = this._key(spec);
    if (this._patchCache.has(key)) return this._patchCache.get(key);
    const p = (async () => {
      // A baked layer is only usable at the resolution it was baked for.
      if (spec.baked && spec.baked.W === this.width && spec.baked.H === this.height) {
        try { return await this._bakedPatch(spec); }
        catch (e) { /* fall through to the runtime rasteriser */ }
      }
      const cut = await loadPixels(spec.cutoutUrl);
      const base = {
        yawDeg: spec.yawDeg,
        pitchDeg: spec.pitchDeg,
        distanceM: spec.distanceM,
        heightM: spec.heightM,
        aspect: cut.width / cut.height,
        contact: spec.contact,
        cameraHeightM: spec.cameraHeightM ?? 1.5,
        ground: spec.ground !== false
      };
      const plan = base.ground
        ? arrangementFor(SLOT_BY_ID.get(spec.slotId), spec.itemId)
        : null;
      if (plan) return this._blockPatch(cut, base, plan, spec);

      const frame = billboardFrame(base);
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
   * A slot that represents MANY objects: draw the SET, not one cut-out.
   *
   * `slot-stage-seating` is twenty VIP chairs. Drawing one cut-out for it is
   * what made the concert lawn show a single chair — or, with a throne pair
   * selected, two thrones standing alone in a field. Here the block is laid out
   * on the ground plane (see arrangementPlacements), each instance rasterised
   * through the same exact inverse map at ITS OWN ground distance so the
   * perspective falls out rather than being faked, composited back-to-front
   * into ONE patch, and given ONE merged floor shadow.
   *
   * Merging into a single patch matters beyond tidiness: the exposure and
   * sharpness match in `render()` then runs once for the whole block against
   * the untouched plate, so every chair is graded identically instead of each
   * one drifting toward whatever the previous chair left behind it.
   */
  _blockPatch(cut, base, plan, spec) {
    const W = this.width, H = this.height;
    // One reference frame gives us the object's true metric width, which is what
    // the lateral pitch is expressed in.
    const ref = billboardFrame(base);
    const places = arrangementPlacements({
      yawDeg: base.yawDeg, distanceM: base.distanceM, wM: ref.wM,
      occupancy: cutoutOccupancy(cut), plan
    });

    const frames = [], boxes = [];
    for (const p of places) {
      const f = billboardFrame({ ...base, yawDeg: p.yawDeg, distanceM: p.distanceM });
      frames.push(f);
      boxes.push(frameBBox(f, W, H));
    }
    const bbox = unionBBox(boxes, W, H);
    const colour = {
      data: new Uint8ClampedArray(bbox.w * bbox.h * 4),
      width: bbox.w, height: bbox.h
    };
    // places is already sorted far -> near, so a nearer chair overwrites the
    // one behind it and the block occludes itself correctly.
    for (let i = 0; i < frames.length; i++) {
      const patch = rasteriseBillboard(cut, frames[i], boxes[i], W, H);
      blitOver(colour, bbox, patch, boxes[i]);
    }
    const shadow = spec.shadow === false
      ? null
      : rasteriseBlockShadow(frames, bbox, W, H);
    return { bbox, colour, shadow };
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

    // Grade every layer against the plate BEFORE anything is drawn, so a layer
    // is matched to the untouched photograph rather than to another layer's
    // shadow. Shadows go down first (they must darken the plate, and must sit
    // under every layer's geometry), then the colour passes.
    const gains = patches.map(([, p]) => this._matchExposure(p.bbox, p.colour));
    patches.forEach(([, p]) => this._matchSharpness(p.bbox, p.colour));
    for (const [, p] of patches) if (p.shadow) this._blend(p.bbox, p.shadow, 'multiply');
    patches.forEach(([, p], i) => this._blend(p.bbox, p.colour, 'over', gains[i]));

    this.revision++;
    if (this.onChange) this.onChange();
  }

  /**
   * Von Kries-style exposure and white-balance match (research §2.3).
   *
   * A catalogue cut-out is a studio photograph: white-balanced, evenly lit,
   * bright. Dropped unmodified onto a night lawn or a warm banquet hall it
   * reads as a sticker before anything else about it registers. So: take the
   * mean linear RGB of the PLATE immediately around the layer's footprint, take
   * the mean linear RGB of the layer's own opaque pixels, and scale per channel
   * toward the plate.
   *
   * The gain is deliberately softened (`^0.7`) and clamped. A full correction
   * makes a white chair literally the colour of the grass behind it; the point
   * is to put the object in the same exposure and colour cast as the room, not
   * to erase it. Nothing here claims to be a relight — it is a grade, and the
   * viewer labels the result as a composited layer.
   *
   * @returns {number[]} per-channel linear gain
   */
  _matchExposure(bbox, patch) {
    if (!bbox.w || !bbox.h) return [1, 1, 1];
    const dst = this.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const D = dst.data, S = patch.data;
    const plate = [0, 0, 0], layer = [0, 0, 0];
    let np = 0, nl = 0;
    for (let i = 0; i < D.length; i += 4) {
      const a = S[i + 3];
      if (a < 24) {                       // surrounding photograph
        plate[0] += SRGB_TO_LIN[D[i]]; plate[1] += SRGB_TO_LIN[D[i + 1]];
        plate[2] += SRGB_TO_LIN[D[i + 2]]; np++;
      } else if (a > 224) {               // the object itself
        layer[0] += SRGB_TO_LIN[S[i]]; layer[1] += SRGB_TO_LIN[S[i + 1]];
        layer[2] += SRGB_TO_LIN[S[i + 2]]; nl++;
      }
    }
    // Too little of either to measure — leave the artwork alone rather than
    // grade it against noise.
    if (np < 64 || nl < 64) return [1, 1, 1];
    // Split the correction into EXPOSURE and COLOUR CAST and weight them very
    // differently. Exposure is what sells the composite — a studio-bright chair
    // on a night lawn is wrong at a glance. Colour cast must stay a whisper:
    // a green hedge wall graded all the way onto a magenta LED plate stops
    // being a green hedge wall, and then the picture is lying about what the
    // client is buying. So: most of the luminance ratio, a third of the chroma.
    const LUM = [0.2126, 0.7152, 0.0722];
    let srcL = 0, tgtL = 0;
    for (let c = 0; c < 3; c++) { srcL += LUM[c] * layer[c] / nl; tgtL += LUM[c] * plate[c] / np; }
    const expo = srcL > 1e-4 ? Math.pow(tgtL / srcL, 0.7) : 1;
    const g = [0, 0, 0];
    for (let c = 0; c < 3; c++) {
      const src = layer[c] / nl, tgt = plate[c] / np;
      const raw = src > 1e-4 ? tgt / src : 1;
      const cast = expo > 1e-4 ? Math.pow(raw / expo, 0.3) : 1;
      g[c] = Math.min(1.9, Math.max(0.28, expo * Math.min(1.35, Math.max(0.74, cast))));
    }
    return g;
  }

  /**
   * Match the layer's sharpness to the plate's (research §2.5).
   *
   * The plates are photographic and soft — upscaled, JPEG-compressed, shot on a
   * 360 rig. Catalogue cut-outs are crisp studio product shots. A razor-sharp
   * object on a soft photograph reads as fake even when its geometry, scale and
   * exposure are all correct, so measure both and soften the layer until they
   * agree. Measured, not guessed: one 3x3 binomial pass per step, at most two,
   * and none at all when the plate is already as sharp as the artwork.
   */
  _matchSharpness(bbox, patch) {
    if (bbox.w < 8 || bbox.h < 8) return;
    const dst = this.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const edge = (data, alphaGate) => {
      let sum = 0, n = 0;
      for (let j = 1; j < bbox.h - 1; j++) {
        for (let i = 1; i < bbox.w - 1; i++) {
          const o = (j * bbox.w + i) * 4;
          if (alphaGate && patch.data[o + 3] < 240) continue;
          sum += Math.abs(data[o] - data[o + 4]) + Math.abs(data[o] - data[o + bbox.w * 4]);
          n++;
        }
      }
      return n ? sum / n : 0;
    };
    const plate = edge(dst.data, false);
    const layer = edge(patch.data, true);
    if (!plate || !layer || layer < plate * 1.6) return;
    const passes = layer > plate * 3 ? 2 : 1;
    for (let k = 0; k < passes; k++) blur3(patch, bbox.w, bbox.h);
  }

  /** Blend one patch into the canvas in linear light. */
  _blend(bbox, patch, mode, gain) {
    if (!bbox.w || !bbox.h) return;
    const dst = this.ctx.getImageData(bbox.x, bbox.y, bbox.w, bbox.h);
    const D = dst.data, S = patch.data;
    const g0 = gain ? gain[0] : 1, g1 = gain ? gain[1] : 1, g2 = gain ? gain[2] : 1;
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
        D[i]     = encode(SRGB_TO_LIN[S[i]] * g0 * a + SRGB_TO_LIN[D[i]] * ia);
        D[i + 1] = encode(SRGB_TO_LIN[S[i + 1]] * g1 * a + SRGB_TO_LIN[D[i + 1]] * ia);
        D[i + 2] = encode(SRGB_TO_LIN[S[i + 2]] * g2 * a + SRGB_TO_LIN[D[i + 2]] * ia);
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
