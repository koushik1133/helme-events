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
 * Real-world height by catalogue item, metres.
 *
 * The category figure is a blunt instrument: `chairs: 0.9` sizes a folding chair
 * correctly and then composites a Maharaja throne PAIR at the same 0.9 m, which
 * is why it read as a miniature against the stage. These are the distinctive
 * items where the category average is simply wrong. Anything absent falls back to
 * its category, which is fine for the ordinary cases.
 *
 * Eyeballed against real product dimensions, not surveyed — the slot still
 * reports `calibrated: false` until someone does the floor-contact click.
 */
export const ITEM_HEIGHT_M = {
  // Seating — a throne is nearly twice a banquet chair, a baithak is floor-level.
  'chair-folding': 0.85,
  'chair-chiavari-gold': 0.92,
  'chair-ghost': 0.95,
  'chair-velvet-armchair': 0.85,
  'chair-vvip-executive': 1.15,
  'chair-throne': 1.35,
  'chair-maharaja-throne': 1.65,
  'chair-gaddi-baithak': 0.45,
  'sofa-velvet-lounge': 0.8,
  'sofa-royal-maharani': 0.95,
  'sofa-modern-chesterfield': 0.8,

  // Tables — a cocktail high-top stands, a jhula hangs from a frame.
  'table-round-standard': 0.76,
  'table-cocktail': 1.1,
  'table-rustic-wood': 0.76,
  'table-summit-desk': 0.76,
  'table-led-glass': 0.76,
  'table-antique-jhula': 2.2,

  // Podiums.
  'stage-digital-podium': 1.25,
  'stage-bulletproof-podium': 1.35,
  'podium-wooden-presidential': 1.25,
  'podium-acrylic-modern': 1.2,

  // Staging — these are architecture, not furniture.
  'stage-led-arch': 6.5,
  'stage-royal-pavilion': 5.5,
  'stage-royal-mandap': 5.0,
  'stage-wooden-riser': 1.0,

  // Fountains.
  'fountain-royal-marble': 2.5,
  'fountain-tiered-stone': 2.2,
  'fountain-dancing-jets': 3.0,
  'fountain-glass-waterfall': 2.6,
  'fountain-black-granite': 1.2,
  'fountain-steel-sphere': 1.5,
  'fountain-brass-lotus': 1.0,
  'fountain-brass-diyas': 0.35,

  // Audio and lighting.
  'audio-line-array': 3.2,
  'fountain-horn-speakers': 2.0,
  'lighting-chandeliers': 1.6,
  'lighting-fairy-canopy': 0.5,
  'lighting-rgb-uplighting': 0.55,
  'lighting-temple-lanterns': 0.6,
  'lighting-rally-highmast': 12.0
};

/**
 * Per-slot overlay anchors.
 *   anchorPitch / anchorYaw — where the element's CENTRE sits, degrees.
 *     Defaults to the slot's own pos3D when absent.
 *   distanceM  — calibration distance (see honesty note).
 *   heightM    — per-slot real height override, metres. The catalogue height is
 *                a generic category figure (a "backdrop" is 3 m), but a main
 *                stage backdrop on a concert lawn is nearer 7 m and a rally
 *                hoarding nearer 6 m. Without this a backdrop composites at a
 *                fraction of the size of the thing it is meant to replace. Like
 *                distanceM these are eyeballed against the plate, not surveyed,
 *                which is exactly what `calibrated: false` is saying.
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
  'slot-stage-backdrop':    { heightM: 7, ground: false, distanceM: 11, calibrated: false },
  // 2.6 m, not 3.5: at 3.5 the front row lands INSIDE the plate's crowd and the
  // chairs read as hovering at head height. 2.6 puts them on the visible lawn
  // in front of it, which is where VIP front-row seating actually goes.
  'slot-stage-seating':     { ground: true, distanceM: 2.6, calibrated: false },
  'slot-banquet-table':     { ground: true, distanceM: 3,  calibrated: false },
  'slot-banquet-chairs':    { ground: true, distanceM: 2.2, calibrated: false },
  'slot-banquet-lighting':  { heightM: 1.1, ground: false, distanceM: 5,  calibrated: false },
  'slot-fountain-center':   { ground: true, distanceM: 7,  calibrated: false },
  'slot-fountain-lighting': { heightM: 1.1, ground: false, distanceM: 6,  calibrated: false },
  // The lounge slots' own pos3D yaws point at the GLASS — a table anchored there
  // stands on the city skyline. Re-aimed at the carpet on either side of the bar.
  'slot-lounge-table':      { anchorYaw: -70, ground: true, distanceM: 2.6, calibrated: false },
  'slot-lounge-seating':    { anchorYaw: 110, ground: true, distanceM: 3,  calibrated: false },
  'slot-lounge-lighting':   { heightM: 1.1, ground: false, distanceM: 4.5, calibrated: false },
  'slot-entrance-arch':     { heightM: 4.5, ground: false, distanceM: 8,  calibrated: false },
  'slot-entrance-water':    { ground: true, distanceM: 9,  calibrated: false },
  'slot-entrance-seating':  { ground: true, distanceM: 2.8, calibrated: false },
  'slot-election-podium':   { ground: true, distanceM: 5,  calibrated: false },
  'slot-election-hoarding': { heightM: 6, ground: false, distanceM: 10, calibrated: false },
  'slot-election-audio':    { ground: true, distanceM: 7,  calibrated: false },
  'slot-election-seating':  { ground: true, distanceM: 3.2, calibrated: false },
  'slot-function-mandap':   { ground: true, distanceM: 8,  calibrated: false },
  'slot-function-marigold': { heightM: 4.5, ground: false, distanceM: 9,  calibrated: false },
  // 6 m put the thrones in the air above the mandap; 3 m stands them on the
  // floor beside the couple, which is where thrones go.
  'slot-function-throne':   { ground: true, distanceM: 3,  calibrated: false },
  'slot-function-jhula':    { ground: true, distanceM: 6,  calibrated: false },
  'slot-meeting-podium':    { ground: true, distanceM: 4.5, calibrated: false },
  'slot-meeting-screen':    { heightM: 3.2, ground: false, distanceM: 7,  calibrated: false },
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
  // Per-item beats per-slot beats per-category. A slot override still wins for
  // things whose size is set by the ROOM rather than the product — a main stage
  // backdrop is 7 m regardless of which backdrop you pick.
  const heightM = item?.heightM
    || cfg.heightM
    || ITEM_HEIGHT_M[item?.id]
    || CATEGORY_HEIGHT_M[slot.category]
    || 1;
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

/**
 * Pre-baked equirectangular overlay layers.
 *
 * `tools/bake_overlays.py --all` rasterises every (zone, slot, item) that has
 * no photographic plate into a cropped RGBA layer plus a separate contact
 * shadow, using the same inverse map the runtime uses. Preferring the baked
 * layer means a swap is a 1:1 blit of a ~200x300 PNG instead of a per-pixel
 * ray cast, and the picture is identical either way — the runtime rasteriser
 * stays as the fallback for anything the bake has not covered (a new catalogue
 * item, a re-calibrated slot) so no swap can ever silently do nothing.
 */
let _overlayManifest = null;
let _overlayPromise = null;

export function overlayManifest() { return _overlayManifest; }

export async function loadOverlayManifest(url = '/images/overlays/manifest.json') {
  if (_overlayManifest) return _overlayManifest;
  if (!_overlayPromise) {
    _overlayPromise = fetch(url)
      .then(r => (r.ok ? r.json() : {}))
      .then(json => (_overlayManifest = json || {}))
      .catch(() => (_overlayManifest = {}));
  }
  return _overlayPromise;
}

/** Test seam: let a non-browser caller supply the manifest directly. */
export function setOverlayManifest(json) { _overlayManifest = json || {}; return _overlayManifest; }

/**
 * @returns {{u,v,w,h,W,H,colour:string,shadow:string|null}|null}
 */
export function bakedOverlay(zoneId, slotId, itemId) {
  return _overlayManifest?.[`${zoneId}/${slotId}/${itemId}`] || null;
}

/**
 * QUANTITY-AWARE ARRANGEMENTS
 * ==========================================================================
 * A slot is not always one object. `slot-stage-seating` is "VIP Front Row
 * Seating" with a quantity of 20 chairs, and until now the compositor drew ONE
 * cut-out for it — so twenty chairs rendered as a single chair, and a throne
 * PAIR rendered as two gold thrones sitting alone on a festival lawn. The
 * owner was right that it looked wrong.
 *
 * The research (§3) is explicit about the fix and about what NOT to do: never
 * instance N cut-outs as independent sprites, because mutual occlusion,
 * per-instance grading and visible repetition all compound. Render the SET as
 * one layer: laid out on the ground plane with correct per-instance
 * perspective (each instance gets its own ground distance, so it is smaller and
 * higher in the frame the further back it sits), drawn back-to-front into ONE
 * patch, graded once, and carrying ONE merged contact shadow under the whole
 * block rather than a rubber-stamped ellipse per chair.
 *
 * We do not pretend to draw 120 chairs. A believable front row plus a
 * suggestion of depth behind it is what a client reads as "seating"; drawing
 * the literal count would be both slower and less honest, because the plate's
 * lawn does not extend that far. `drawn` below is capped and the viewer keeps
 * reporting the real quantity in the price line.
 */

/**
 * Per-category block rules.
 *   cols      max instances across the front row
 *   rows      max rows of depth
 *   gapX      lateral pitch as a multiple of the object's own width
 *   gapZ      row pitch in metres (floor, so a wide object still gets room)
 *   jitterX   lateral jitter as a fraction of the lateral pitch
 *   stagger   fraction of the lateral pitch that odd rows are offset by, so
 *             the back row is visible BETWEEN the front row rather than behind
 *   maxDrawn  hard cap on rasterised instances
 */
export const ARRANGEMENT_RULES = {
  chairs:  { cols: 8, rows: 2, gapX: 1.02, gapZ: 0.95, jitterX: 0.05, stagger: 0.5, maxDrawn: 14 },
  sofas:   { cols: 3, rows: 1, gapX: 1.35, gapZ: 1.6,  jitterX: 0.03, stagger: 0,   maxDrawn: 3 },
  tables:  { cols: 3, rows: 2, gapX: 1.9,  gapZ: 2.4,  jitterX: 0.04, stagger: 0.5, maxDrawn: 5 },
  audio:   { cols: 2, rows: 1, gapX: 3.2,  gapZ: 0,    jitterX: 0,    stagger: 0,   maxDrawn: 2 }
};

/**
 * Cut-outs that already depict MORE THAN ONE object.
 *
 * `chair-maharaja-throne` and `sofa-royal-maharani` are photographed as a PAIR,
 * so a slot with a quantity of 2 is already satisfied by one cut-out. Laying
 * two of them out puts four thrones on the mandap. Verified by looking at the
 * artwork, not assumed — every other seating cut-out is a single object.
 */
export const UNITS_PER_CUTOUT = {
  'chair-maharaja-throne': 2,
  'sofa-royal-maharani': 2
};

/** Quantity a given slot/item pair actually represents. */
export function slotQuantity(slot, itemId) {
  if (!slot) return 1;
  const q = slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1;
  return Math.max(1, Math.round(q));
}

/** How many CUT-OUTS that quantity corresponds to. */
export function cutoutCount(slot, itemId) {
  return Math.max(1, Math.round(slotQuantity(slot, itemId) / (UNITS_PER_CUTOUT[itemId] || 1)));
}

/**
 * Block plan for a slot + item, or null when the slot is a single object
 * (a podium, a fountain, a mandap — those stay exactly as they are).
 *
 * @returns {{count:number, cols:number, rows:number, gapX:number, gapZ:number,
 *            jitterX:number, stagger:number}|null}
 */
export function arrangementFor(slot, itemId) {
  const qty = cutoutCount(slot, itemId);
  if (qty < 2) return null;
  // The SLOT's category is the seating bucket ("chairs"), but the lounge's
  // seating slot also offers sofas — and fourteen sofas in a row is not a
  // lounge. Let the item's own family pick the rule when it differs.
  const family = /^sofa-/.test(itemId || '') ? 'sofas' : slot?.category;
  const rule = ARRANGEMENT_RULES[family];
  if (!rule) return null;
  const cfg = SLOT_OVERLAY[slot.id] || {};
  if (cfg.ground === false) return null;      // hanging things are never a block

  const count = Math.min(qty, rule.maxDrawn);
  const cols = Math.min(count, rule.cols);
  const rows = Math.min(rule.rows, Math.ceil(count / cols));
  return {
    count, cols, rows,
    gapX: rule.gapX, gapZ: rule.gapZ,
    jitterX: rule.jitterX, stagger: rule.stagger
  };
}
