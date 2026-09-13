/**
 * Overlay geometry for composited element previews.
 *
 * WHAT THIS BUYS US
 * -----------------
 * Pre-rendered panorama variants are keyed on ONE element at a time. The full
 * combination space is 776 distinct configurations across the eight zones and
 * only 36 plates exist, so the overwhelming majority of what a client selects
 * can never have a plate of its own — and generating them is not a budget
 * problem, it is a combinatorial one (see w2 changelog for the table).
 *
 * The fix is layered compositing: ONE base plate carries the room and the
 * highest-priority swapped element photographically, and every other changed
 * element is drawn as a billboard pinned at an angular anchor. Because the 360
 * camera only rotates and never translates, that billboard is geometrically
 * exact at every pan and zoom, not an approximation.
 *
 * HONESTY NOTE ON THE NUMBERS BELOW
 * ---------------------------------
 * `distanceM` is a per-slot CALIBRATION value, not a survey measurement. It sets
 * how large the element reads against the plate. The correct way to set it for a
 * new venue is the single-click method: shoot the plate with the tripod height
 * logged (h_cam, 1.5 m here), click the element's floor-contact point in the
 * plate to read its pitch phi, then D = h_cam / tan(-phi). Until a plate is
 * calibrated that way its entry is marked `calibrated: false` and the viewer
 * labels the overlay as a preview rather than a render. Nothing here claims to
 * be a measured dimension.
 */

/** Tripod / nodal-point height used for every plate in this library, metres. */
export const CAMERA_HEIGHT_M = 1.5;

/** Real-world heights by catalogue category, metres. Used when an item has none. */
export const CATEGORY_HEIGHT_M = {
  podiums: 1.2,
  stages: 2.4,
  chairs: 0.9,
  tables: 0.75,
  backdrops: 3.0,
  fountains: 1.8,
  lighting: 0.6,
  audio: 1.3,
  sofas: 0.8
};

/**
 * Per-slot overlay anchors.
 *   anchorPitch / anchorYaw — where the element's CENTRE sits, degrees.
 *     Defaults to the slot's own pos3D when absent.
 *   distanceM  — calibration distance (see honesty note).
 *   ground     — true when the item's FEET rest on the floor, so the composited
 *                layer is anchored to the floor plane and gets a contact shadow.
 *                false for things that hang or mount on a wall (chandeliers,
 *                LED walls, backdrops, garland arches) — those are centred on
 *                the slot's own pitch and get no floor shadow, because a
 *                contact shadow under a hanging object is the fastest way to
 *                make a composite read as fake.
 *   calibrated — true only once the floor-contact click has been done.
 */
export const SLOT_OVERLAY = {
  'slot-stage-main':        { ground: true, distanceM: 9,  calibrated: false },
  'slot-stage-backdrop':    { ground: false, distanceM: 11, calibrated: false },
  'slot-stage-seating':     { ground: true, distanceM: 3.5, calibrated: false },
  'slot-banquet-table':     { ground: true, distanceM: 4,  calibrated: false },
  'slot-banquet-chairs':    { ground: true, distanceM: 3.5, calibrated: false },
  'slot-banquet-lighting':  { ground: false, distanceM: 5,  calibrated: false },
  'slot-fountain-center':   { ground: true, distanceM: 7,  calibrated: false },
  'slot-fountain-lighting': { ground: false, distanceM: 6,  calibrated: false },
  'slot-lounge-table':      { ground: true, distanceM: 3.5, calibrated: false },
  'slot-lounge-seating':    { ground: true, distanceM: 4,  calibrated: false },
  'slot-lounge-lighting':   { ground: false, distanceM: 4.5, calibrated: false },
  'slot-entrance-arch':     { ground: false, distanceM: 8,  calibrated: false },
  'slot-entrance-water':    { ground: true, distanceM: 9,  calibrated: false },
  'slot-entrance-seating':  { ground: true, distanceM: 3.5, calibrated: false },
  'slot-election-podium':   { ground: true, distanceM: 5,  calibrated: false },
  'slot-election-hoarding': { ground: false, distanceM: 10, calibrated: false },
  'slot-election-audio':    { ground: true, distanceM: 7,  calibrated: false },
  'slot-election-seating':  { ground: true, distanceM: 4.5, calibrated: false },
  'slot-function-mandap':   { ground: true, distanceM: 8,  calibrated: false },
  'slot-function-marigold': { ground: false, distanceM: 9,  calibrated: false },
  'slot-function-throne':   { ground: true, distanceM: 6,  calibrated: false },
  'slot-function-jhula':    { ground: true, distanceM: 6,  calibrated: false },
  'slot-meeting-podium':    { ground: true, distanceM: 4.5, calibrated: false },
  'slot-meeting-screen':    { ground: false, distanceM: 7,  calibrated: false },
  'slot-meeting-desk':      { ground: true, distanceM: 4,  calibrated: false }
};

/**
 * Full overlay spec for one slot + item.
 * @returns {{anchorPitch:number, anchorYaw:number, heightM:number,
 *            distanceM:number, ground:boolean, calibrated:boolean}|null}
 */
export function overlaySpec(slot, item) {
  if (!slot?.pos3D) return null;
  const cfg = SLOT_OVERLAY[slot.id] || {};
  const heightM = item?.heightM || CATEGORY_HEIGHT_M[slot.category] || 1;
  return {
    anchorPitch: cfg.anchorPitch != null ? cfg.anchorPitch : slot.pos3D.pitch,
    anchorYaw:   cfg.anchorYaw   != null ? cfg.anchorYaw   : slot.pos3D.yaw,
    heightM,
    distanceM: cfg.distanceM || 6,
    ground: cfg.ground !== false,
    calibrated: Boolean(cfg.calibrated)
  };
}

/**
 * Cut-out artwork for composited layers.
 *
 * `public/images/cutouts/manifest.json` carries, per catalogue item, the
 * transparent PNG plus its `contact` value — where the object's FEET sit inside
 * the frame, 0..1 from the top. Anchoring that point to the floor (rather than
 * the image centre) is what makes a composited chair stand on the ground
 * instead of hovering above it, so the manifest is not optional decoration.
 */
let _cutoutManifest = null;
let _cutoutPromise = null;

export function cutoutManifest() { return _cutoutManifest; }

export async function loadCutoutManifest(url = '/images/cutouts/manifest.json') {
  if (_cutoutManifest) return _cutoutManifest;
  if (!_cutoutPromise) {
    _cutoutPromise = fetch(url)
      .then(r => (r.ok ? r.json() : {}))
      .then(json => (_cutoutManifest = json || {}))
      .catch(() => (_cutoutManifest = {}));
  }
  return _cutoutPromise;
}

/** Test seam: let a non-browser caller supply the manifest directly. */
export function setCutoutManifest(json) { _cutoutManifest = json || {}; return _cutoutManifest; }

/**
 * @returns {{url:string, contact:number, width:number, height:number}|null}
 */
export function cutoutFor(itemId) {
  const e = _cutoutManifest?.[itemId];
  if (!e || !e.url) return null;
  return { url: e.url, contact: e.contact ?? 0.9, width: e.width, height: e.height };
}
