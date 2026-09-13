/**
 * Rasterise a 2D cut-out into EQUIRECTANGULAR space.
 *
 * WHY THIS EXISTS
 * ---------------
 * The 360 plates are equirectangular photographs. A decor item we have no
 * photographic plate for still has to appear IN the photograph, not floating in
 * a DOM layer above it — otherwise the pixels of the panorama never change and
 * the swap is invisible the moment the user pans, screenshots or exports.
 *
 * So we draw the item into the panorama itself. The correct way to do that is
 * the INVERSE map: iterate DESTINATION pixels of the equirect, turn each one
 * into a view ray, intersect that ray with a vertical billboard plane standing
 * in the room, and sample the cut-out where it hits. Forward-warping the cut-out
 * cannot work — a straight edge of the billboard is a CURVE in equirect space,
 * and only the inverse map reproduces that curvature (and the near-floor
 * vertical stretch) automatically.
 *
 * Conventions match panoProjection.js and the plates:
 *   yaw   λ degrees, 0 straight ahead, +ve right
 *   pitch φ degrees, 0 horizon, +ve up
 *   direction d = ( cosφ·sinλ, sinφ, −cosφ·cosλ )   (Y up, camera looks −Z)
 * Camera is at the origin; the floor is the plane y = −cameraHeight.
 *
 * Everything here is pure and framework-free so `tools/bake_overlays.py` can
 * implement the identical maths offline and produce byte-comparable layers.
 */

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** Equirect pixel (u,v) → unit direction. */
export function uvToDir(u, v, W, H) {
  const lam = (u / W) * TAU - Math.PI;
  const phi = Math.PI / 2 - (v / H) * Math.PI;
  const cp = Math.cos(phi);
  return [cp * Math.sin(lam), Math.sin(phi), -cp * Math.cos(lam)];
}

/** Unit direction → equirect pixel (u,v). */
export function dirToUv([x, y, z], W, H) {
  const lam = Math.atan2(x, -z);
  const phi = Math.asin(Math.max(-1, Math.min(1, y)));
  return [((lam + Math.PI) / TAU) * W, ((Math.PI / 2 - phi) / Math.PI) * H];
}

/**
 * Geometry of one billboard standing in the room.
 *
 * @param {object} o
 * @param {number} o.yawDeg        azimuth of the item's centre
 * @param {number} o.distanceM     ground distance from the camera
 * @param {number} o.heightM       real height of the OBJECT (feet → top)
 * @param {number} o.aspect        cut-out pixel width / pixel height
 * @param {number} o.contact       0..1 from the TOP of the cut-out, where the
 *                                 object's feet are (manifest.json)
 * @param {number} o.cameraHeightM tripod height
 * @param {boolean} o.ground       true: feet on the floor. false: the item hangs
 *                                 or is wall-mounted, centred on `pitchDeg`.
 * @param {number} o.pitchDeg      centre pitch, used only when ground === false
 * @returns {{P0:number[], right:number[], up:number[], wM:number, hM:number,
 *            baseY:number, contactC:number[]}}
 *   P0 is the BOTTOM-CENTRE of the billboard rectangle; `right`/`up` span it;
 *   `contactC` is the world point where the object actually touches the floor.
 */
export function billboardFrame(o) {
  const lam = o.yawDeg * DEG;
  const D = Math.max(0.4, o.distanceM);
  const contact = Math.min(0.995, Math.max(0.05, o.contact ?? 0.9));
  // The cut-out's full frame is taller than the object: rows below `contact`
  // are the preserved ground shadow. Scale the whole frame off the object part.
  const hM = o.heightM / contact;
  const wM = hM * (o.aspect || 1);

  const dirH = [Math.sin(lam), 0, -Math.cos(lam)];          // horizontal bearing
  const right = [Math.cos(lam), 0, Math.sin(lam)];           // plane tangent
  const up = [0, 1, 0];                                      // kept vertical

  const feetY = o.ground ? -o.cameraHeightM
    : (o.pitchDeg * DEG ? Math.tan(o.pitchDeg * DEG) * D - o.heightM / 2 : -o.heightM / 2);
  const baseY = feetY - (1 - contact) * hM;                  // bottom of the frame

  const P0 = [D * dirH[0], baseY, D * dirH[2]];
  const contactC = [D * dirH[0], feetY, D * dirH[2]];
  return { P0, right, up, wM, hM, baseY, contactC, D, lam };
}

/** Integer equirect bounding box of a billboard frame, seam-safe. */
export function frameBBox(frame, W, H, pad = 3) {
  const { P0, right, up, wM, hM } = frame;
  const us = [], vs = [];
  for (const sx of [-0.5, 0.5]) {
    for (const sy of [0, 0.5, 1]) {
      const p = [
        P0[0] + right[0] * sx * wM + up[0] * sy * hM,
        P0[1] + right[1] * sx * wM + up[1] * sy * hM,
        P0[2] + right[2] * sx * wM + up[2] * sy * hM
      ];
      const len = Math.hypot(p[0], p[1], p[2]) || 1;
      const [u, v] = dirToUv([p[0] / len, p[1] / len, p[2] / len], W, H);
      us.push(u); vs.push(v);
    }
  }
  let u0 = Math.min(...us), u1 = Math.max(...us);
  // A frame straddling λ=±π wraps; widen to the whole row rather than emit two
  // boxes — these frames are small and a full row is still only H*W/… cheap.
  const wrapped = (u1 - u0) > W / 2;
  if (wrapped) { u0 = 0; u1 = W; }
  const x0 = Math.max(0, Math.floor(u0) - pad);
  const x1 = Math.min(W, Math.ceil(u1) + pad);
  const y0 = Math.max(0, Math.floor(Math.min(...vs)) - pad);
  const y1 = Math.min(H, Math.ceil(Math.max(...vs)) + pad);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

/**
 * Suppress the cut-out's soft matte.
 *
 * `make_cutouts.py` deliberately preserves each product photo's own contact
 * shadow, which survives as a wide skirt of semi-transparent, STUDIO-COLOURED
 * pixels — light grey against a white seamless. Composited onto a night lawn
 * that skirt becomes a pale halo, and a halo is the single most obvious tell
 * that something was pasted in. The layer's shadow is drawn separately, as a
 * multiply pass against the actual plate (see `rasteriseContactShadow`), so
 * this fringe is redundant as well as harmful: fade it out with a smoothstep
 * and keep the object's real silhouette.
 */
const MATTE_LO = 0.42, MATTE_HI = 0.86;
function demat(a255) {
  const a = a255 / 255;
  if (a <= MATTE_LO) return 0;
  if (a >= MATTE_HI) return a255;
  const t = (a - MATTE_LO) / (MATTE_HI - MATTE_LO);
  return 255 * a * t * t * (3 - 2 * t);
}

/** Bilinear sample of an RGBA Uint8ClampedArray. Returns premultiplied-safe RGBA. */
function sampleBilinear(src, cw, ch, fx, fy, out) {
  const x = Math.min(cw - 1.001, Math.max(0, fx));
  const y = Math.min(ch - 1.001, Math.max(0, fy));
  const x0 = x | 0, y0 = y | 0;
  const x1 = Math.min(cw - 1, x0 + 1), y1 = Math.min(ch - 1, y0 + 1);
  const tx = x - x0, ty = y - y0;
  const i00 = (y0 * cw + x0) * 4, i10 = (y0 * cw + x1) * 4;
  const i01 = (y1 * cw + x0) * 4, i11 = (y1 * cw + x1) * 4;
  const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty, w11 = tx * ty;
  for (let c = 0; c < 4; c++) {
    out[c] = src[i00 + c] * w00 + src[i10 + c] * w10 + src[i01 + c] * w01 + src[i11 + c] * w11;
  }
  return out;
}

/**
 * Rasterise the cut-out into an RGBA patch covering `bbox` of a W×H equirect.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} cut  cut-out RGBA
 * @param {object} frame  from billboardFrame()
 * @param {{x,y,w,h}} bbox
 * @param {number} W @param {number} H
 * @returns {ImageDataLike} `{data, width, height}` straight (non-premultiplied) RGBA
 */
export function rasteriseBillboard(cut, frame, bbox, W, H) {
  const { P0, right, up, wM, hM } = frame;
  const n = cross(right, up);                       // plane normal
  const denomBase = dot(P0, n);
  const out = new Uint8ClampedArray(bbox.w * bbox.h * 4);
  const px = new Float32Array(4);
  const cw = cut.width, ch = cut.height, src = cut.data;

  for (let j = 0; j < bbox.h; j++) {
    const v = bbox.y + j + 0.5;
    for (let i = 0; i < bbox.w; i++) {
      const u = bbox.x + i + 0.5;
      const d = uvToDir(u, v, W, H);
      const dn = dot(d, n);
      if (Math.abs(dn) < 1e-9) continue;
      const t = denomBase / dn;                     // camera at origin
      if (t <= 0) continue;
      const X = [t * d[0] - P0[0], t * d[1] - P0[1], t * d[2] - P0[2]];
      const s = dot(X, right) / wM + 0.5;
      if (s < 0 || s > 1) continue;
      const q = dot(X, up) / hM;
      if (q < 0 || q > 1) continue;
      sampleBilinear(src, cw, ch, s * (cw - 1), (1 - q) * (ch - 1), px);
      const o = (j * bbox.w + i) * 4;
      out[o] = px[0]; out[o + 1] = px[1]; out[o + 2] = px[2];
      out[o + 3] = demat(px[3]);
    }
  }
  return { data: out, width: bbox.w, height: bbox.h };
}

/**
 * Soft elliptical contact shadow on the floor plane, as an ALPHA-only patch.
 *
 * Kept separate from the colour layer on purpose: a shadow must darken the
 * PLATE (a multiply pass), never ride inside the object's own alpha. This is
 * the single cue that stops a composited item reading as a floating sticker.
 *
 * @returns {{data:Uint8ClampedArray,width,height}} RGBA where alpha = darkening
 */
export function rasteriseContactShadow(frame, bbox, W, H, opts = {}) {
  const strength = opts.strength ?? 0.72;
  const rx = (frame.wM / 2) * (opts.spread ?? 1.04);
  const rz = rx * (opts.squash ?? 0.42);
  const cy = frame.contactC[1];                    // floor height (= −cameraHeight)
  const out = new Uint8ClampedArray(bbox.w * bbox.h * 4);
  const cx = frame.contactC[0], cz = frame.contactC[2];
  const cosL = Math.cos(frame.lam), sinL = Math.sin(frame.lam);

  for (let j = 0; j < bbox.h; j++) {
    const v = bbox.y + j + 0.5;
    for (let i = 0; i < bbox.w; i++) {
      const u = bbox.x + i + 0.5;
      const d = uvToDir(u, v, W, H);
      if (d[1] >= -1e-6) continue;                 // ray never reaches the floor
      const t = cy / d[1];
      if (t <= 0) continue;
      const dx = t * d[0] - cx, dz = t * d[2] - cz;
      // Rotate into the billboard's own frame so the ellipse follows the item.
      const a = dx * cosL + dz * sinL;
      const b = -dx * sinL + dz * cosL;
      const r = Math.hypot(a / rx, b / rz);
      if (r >= 1) continue;
      // Dense at the contact line, feathering out — roughly the AO falloff a
      // renderer would give, without pretending to be a real shadow solve.
      const f = Math.pow(1 - r, 1.6);
      const o = (j * bbox.w + i) * 4;
      out[o + 3] = Math.round(255 * strength * f);
    }
  }
  return { data: out, width: bbox.w, height: bbox.h };
}

/**
 * Fraction of a cut-out's FRAME width that the object actually occupies.
 *
 * The billboard's `wM` is the width of the whole cut-out frame, and a product
 * photo carries a lot of transparent margin. Spacing a row of chairs by the
 * frame width therefore leaves a chair-sized hole between every chair, which is
 * exactly how the first attempt read — a scatter, not a row. Measure the alpha
 * bounding box once and space by the object's REAL width.
 *
 * @param {{data:Uint8ClampedArray,width:number,height:number}} cut
 * @returns {number} 0..1
 */
export function cutoutOccupancy(cut) {
  const { data, width, height } = cut;
  let minX = width, maxX = -1;
  const step = Math.max(1, Math.floor(height / 160));
  for (let y = 0; y < height; y += step) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3] > 96) { if (x < minX) minX = x; if (x > maxX) maxX = x; }
    }
  }
  if (maxX < minX) return 1;
  return Math.min(1, Math.max(0.12, (maxX - minX + 1) / width));
}

/**
 * Ground-plane layout for a slot that represents MANY objects.
 *
 * The camera never translates, so every instance is exactly the same billboard
 * maths at its own ground point — which means per-instance perspective is
 * correct by construction rather than faked: an instance two rows back has a
 * larger `distanceM`, so `billboardFrame` gives it a smaller angular height AND
 * a shallower (higher in the frame) base pitch automatically. No scale hacks.
 *
 * Returns instances sorted BACK TO FRONT, which is the order they must be drawn
 * in for the nearer chairs to occlude the further ones.
 *
 * @param {object} o
 * @param {number} o.yawDeg     azimuth of the block's centre
 * @param {number} o.distanceM  ground distance to the FRONT row
 * @param {number} o.wM         one object's billboard width, metres
 * @param {object} o.plan       from arrangementFor()
 * @returns {Array<{yawDeg:number, distanceM:number, col:number, row:number}>}
 */
export function arrangementPlacements(o) {
  const { plan } = o;
  const lam = o.yawDeg * DEG;
  const D0 = Math.max(0.4, o.distanceM);
  const pitchX = Math.max(0.25, o.wM * (o.occupancy ?? 1) * plan.gapX);
  const pitchZ = plan.gapZ;

  // Deterministic jitter: the same slot+item must bake and re-render identically,
  // so this is a hash of the index, never Math.random().
  const jit = (i, salt) => {
    const x = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return (x - Math.floor(x)) * 2 - 1;                 // -1..1
  };

  const sinL = Math.sin(lam), cosL = Math.cos(lam);
  const right = [cosL, sinL];                            // ground (x, z=+sinL? ) see below
  // right  = ( cos λ, ·, sin λ ), forward (away from camera) = ( sin λ, ·, −cos λ )
  const ax = D0 * sinL, az = -D0 * cosL;                 // block centre on the floor

  const out = [];
  let n = 0;
  for (let r = 0; r < plan.rows && n < plan.count; r++) {
    const inRow = Math.min(plan.cols, plan.count - n);
    const offset = (r % 2) ? plan.stagger * pitchX : 0;
    for (let c = 0; c < inRow; c++, n++) {
      const ox = (c - (inRow - 1) / 2) * pitchX + offset
        + jit(n, 1) * plan.jitterX * pitchX;
      const oz = r * pitchZ + jit(n, 2) * 0.06 * (pitchZ || 1);
      const px = ax + right[0] * ox + sinL * oz;
      const pz = az + right[1] * ox - cosL * oz;
      out.push({
        yawDeg: Math.atan2(px, -pz) / DEG,
        distanceM: Math.hypot(px, pz),
        col: c, row: r
      });
    }
  }
  return out.sort((a, b) => b.distanceM - a.distanceM);
}

/**
 * Merged contact shadow for a whole block.
 *
 * One ellipse per chair rubber-stamped across the lawn is exactly the "visible
 * repetition" tell the research warns about, and it also double-darkens where
 * the ellipses overlap. Instead take the MAX darkening over all instances —
 * a union, not a sum — so the block reads as one shadowed area of floor.
 *
 * @param {Array} frames  billboardFrame() results, one per instance
 */
export function rasteriseBlockShadow(frames, bbox, W, H, opts = {}) {
  const strength = opts.strength ?? 0.6;
  const out = new Uint8ClampedArray(bbox.w * bbox.h * 4);
  const ells = frames.map(f => ({
    cx: f.contactC[0], cy: f.contactC[1], cz: f.contactC[2],
    rx: (f.wM / 2) * (opts.spread ?? 1.25),
    rz: (f.wM / 2) * (opts.spread ?? 1.25) * (opts.squash ?? 0.5),
    cosL: Math.cos(f.lam), sinL: Math.sin(f.lam)
  }));
  if (!ells.length) return { data: out, width: bbox.w, height: bbox.h };
  const floorY = ells[0].cy;

  for (let j = 0; j < bbox.h; j++) {
    const v = bbox.y + j + 0.5;
    for (let i = 0; i < bbox.w; i++) {
      const u = bbox.x + i + 0.5;
      const d = uvToDir(u, v, W, H);
      if (d[1] >= -1e-6) continue;
      const t = floorY / d[1];
      if (t <= 0) continue;
      const fx = t * d[0], fz = t * d[2];
      let best = 0;
      for (const e of ells) {
        const dx = fx - e.cx, dz = fz - e.cz;
        const a = dx * e.cosL + dz * e.sinL;
        const b = -dx * e.sinL + dz * e.cosL;
        const r = Math.hypot(a / e.rx, b / e.rz);
        if (r >= 1) continue;
        const f = Math.pow(1 - r, 1.5);
        if (f > best) best = f;
      }
      if (best <= 0) continue;
      out[(j * bbox.w + i) * 4 + 3] = Math.round(255 * strength * best);
    }
  }
  return { data: out, width: bbox.w, height: bbox.h };
}

/** Union of several bboxes, clamped to the equirect. */
export function unionBBox(boxes, W, H) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const b of boxes) {
    x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y);
    x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h);
  }
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  x1 = Math.min(W, x1); y1 = Math.min(H, y1);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Alpha-over blit of one RGBA patch into another at (dx, dy). Straight alpha. */
export function blitOver(dst, dstBox, src, srcBox) {
  const D = dst.data, S = src.data;
  const ox = srcBox.x - dstBox.x, oy = srcBox.y - dstBox.y;
  for (let j = 0; j < srcBox.h; j++) {
    const dj = j + oy;
    if (dj < 0 || dj >= dstBox.h) continue;
    for (let i = 0; i < srcBox.w; i++) {
      const di = i + ox;
      if (di < 0 || di >= dstBox.w) continue;
      const so = (j * srcBox.w + i) * 4;
      const sa = S[so + 3] / 255;
      if (sa <= 0) continue;
      const dOff = (dj * dstBox.w + di) * 4;
      const da = D[dOff + 3] / 255;
      const oa = sa + da * (1 - sa);
      if (oa <= 0) continue;
      for (let c = 0; c < 3; c++) {
        D[dOff + c] = (S[so + c] * sa + D[dOff + c] * da * (1 - sa)) / oa;
      }
      D[dOff + 3] = Math.round(oa * 255);
    }
  }
}
