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
 *   calibrated — true only once the floor-contact click has been done.
 */
export const SLOT_OVERLAY = {
  'slot-stage-main':        { distanceM: 9,  calibrated: false },
  'slot-stage-backdrop':    { distanceM: 11, calibrated: false },
  'slot-stage-seating':     { distanceM: 3.5, calibrated: false },
  'slot-banquet-table':     { distanceM: 4,  calibrated: false },
  'slot-banquet-chairs':    { distanceM: 3.5, calibrated: false },
  'slot-banquet-lighting':  { distanceM: 5,  calibrated: false },
  'slot-fountain-center':   { distanceM: 7,  calibrated: false },
  'slot-fountain-lighting': { distanceM: 6,  calibrated: false },
  'slot-lounge-table':      { distanceM: 3.5, calibrated: false },
  'slot-lounge-seating':    { distanceM: 4,  calibrated: false },
  'slot-lounge-lighting':   { distanceM: 4.5, calibrated: false },
  'slot-entrance-arch':     { distanceM: 8,  calibrated: false },
  'slot-entrance-water':    { distanceM: 9,  calibrated: false },
  'slot-entrance-seating':  { distanceM: 3.5, calibrated: false },
  'slot-election-podium':   { distanceM: 5,  calibrated: false },
  'slot-election-hoarding': { distanceM: 10, calibrated: false },
  'slot-election-audio':    { distanceM: 7,  calibrated: false },
  'slot-election-seating':  { distanceM: 4.5, calibrated: false },
  'slot-function-mandap':   { distanceM: 8,  calibrated: false },
  'slot-function-marigold': { distanceM: 9,  calibrated: false },
  'slot-function-throne':   { distanceM: 6,  calibrated: false },
  'slot-function-jhula':    { distanceM: 6,  calibrated: false },
  'slot-meeting-podium':    { distanceM: 4.5, calibrated: false },
  'slot-meeting-screen':    { distanceM: 7,  calibrated: false },
  'slot-meeting-desk':      { distanceM: 4,  calibrated: false }
};

/**
 * Full overlay spec for one slot + item.
 * @returns {{anchorPitch:number, anchorYaw:number, heightM:number,
 *            distanceM:number, calibrated:boolean}|null}
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
    calibrated: Boolean(cfg.calibrated)
  };
}
