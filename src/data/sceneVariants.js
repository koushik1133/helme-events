/**
 * Zone-locked panorama variants.
 *
 * HARD RULE FOR THIS FILE: a plate may only be listed under a slot if it shows
 * THE SAME ROOM as that zone's base panorama with ONLY the named element
 * changed. If the plate shows a different venue, a different element, or is
 * byte-identical to another item's plate, it does NOT belong here — leave the
 * slot/item unmapped and the viewer will draw a live prop sprite instead, which
 * is honest about what it is.
 *
 * Entries removed during the production-hardening pass (do not re-add without
 * new artwork):
 *   - zone-stage / slot-stage-backdrop  — all three plates are md5-identical to
 *     indoor foyer/ballroom panoramas. The stage zone is an outdoor night lawn.
 *   - zone-entrance / slot-entrance-water — mapped to the outdoor fountain plaza.
 *   - zone-entrance / slot-entrance-arch / backdrop-marigold-garland — a palace
 *     hall, not the marble foyer.
 *   - zone-india-function / slot-function-throne — all four options mapped to
 *     the zone base plate, so nothing changed AND the prop sprite was suppressed.
 *   - ~26 aliased combos where the plate was named for a different item
 *     (meeting-desk swaps loading podium plates, etc).
 *   - pixel-identical no-ops (chiavari≡vvip, folding≡ghost in the rally zone).
 */

const V = '/images/variants';

/**
 * SCENE_VARIANTS[zoneId][slotId][itemId] → panorama URL
 */
export const SCENE_VARIANTS = {
  'zone-india-election': {
    'slot-election-podium': {
      // The default plate IS the zone base render — the podium is already in it.
      'stage-bulletproof-podium': `${V}/zone-india-election/podium_stage-bulletproof-podium.jpg`,
      'stage-digital-podium': `${V}/zone-india-election/podium_stage-digital-podium.jpg`,
      'podium-wooden-presidential': `${V}/zone-india-election/podium_podium-wooden-presidential.jpg`,
      'podium-acrylic-modern': `${V}/zone-india-election/podium_podium-acrylic-modern.jpg`
    },
    'slot-election-hoarding': {
      'backdrop-election-flags': `${V}/zone-india-election/screen_backdrop-election-flags.jpg`,
      'backdrop-seamless-led': `${V}/zone-india-election/screen_backdrop-seamless-led.jpg`
      // backdrop-floral-wall / backdrop-shimmer-sequin: no plate — prop sprite.
    },
    'slot-election-seating': {
      // chair-chiavari-gold is byte-identical to the vvip plate and
      // chair-ghost to the folding plate, so only one of each pair is mapped.
      'chair-vvip-executive': `${V}/zone-india-election/chairs_chair-vvip-executive.jpg`,
      'chair-folding': `${V}/zone-india-election/chairs_chair-folding.jpg`
    }
  },

  'zone-india-meeting': {
    'slot-meeting-podium': {
      'stage-digital-podium': `${V}/zone-india-meeting/podium_stage-digital-podium.jpg`,
      'stage-bulletproof-podium': `${V}/zone-india-meeting/podium_stage-bulletproof-podium.jpg`,
      'podium-wooden-presidential': `${V}/zone-india-meeting/podium_podium-wooden-presidential.jpg`,
      'podium-acrylic-modern': `${V}/zone-india-meeting/podium_podium-acrylic-modern.jpg`
    },
    'slot-meeting-screen': {
      // backdrop-seamless-led and screen-layout-center are the same look by design.
      'backdrop-seamless-led': `${V}/zone-india-meeting/screen_layout-center.jpg`,
      'screen-layout-center': `${V}/zone-india-meeting/screen_layout-center.jpg`,
      'screen-layout-left': `${V}/zone-india-meeting/screen_layout-left.jpg`,
      'screen-layout-shimmer': `${V}/zone-india-meeting/screen_layout-shimmer.jpg`,
      'screen-layout-dual': `${V}/zone-india-meeting/screen_layout-dual.jpg`
    },
    'slot-meeting-desk': {
      // Only the default is baked into the room; the other desks have no plate,
      // so they render as prop sprites rather than loading a podium plate.
      'table-summit-desk': '/images/india_meeting_360.jpg'
    }
  },

  'zone-india-function': {
    'slot-function-mandap': {
      'stage-royal-mandap': `${V}/zone-india-function/mandap_stage-royal-mandap.jpg`,
      'stage-royal-pavilion': `${V}/zone-india-function/mandap_stage-royal-pavilion.jpg`,
      'stage-led-arch': `${V}/zone-india-function/mandap_stage-led-arch.jpg`,
      'stage-wooden-riser': `${V}/zone-india-function/mandap_stage-wooden-riser.jpg`
    },
    'slot-function-marigold': {
      'backdrop-marigold-garland': `${V}/zone-india-function/backdrop_backdrop-marigold-garland.jpg`,
      'backdrop-floral-wall': `${V}/zone-india-function/backdrop_backdrop-floral-wall.jpg`
      // backdrop-shimmer-sequin / backdrop-hedge-wall: no plate — prop sprite.
    }
    // slot-function-throne: intentionally unmapped, see file header.
  },

  'zone-stage': {
    'slot-stage-main': {
      'stage-led-arch': `${V}/zone-stage/stage_stage-led-arch.jpg`,
      'stage-wooden-riser': `${V}/zone-stage/stage_stage-wooden-riser.jpg`,
      'stage-royal-pavilion': `${V}/zone-stage/stage_stage-royal-pavilion.jpg`
    }
    // slot-stage-backdrop: intentionally unmapped, see file header.
  },

  'zone-fountain': {
    'slot-fountain-center': {
      'fountain-royal-marble': `${V}/zone-fountain/fountain-royal-marble.jpg`,
      'fountain-tiered-stone': `${V}/zone-fountain/fountain-tiered-stone.jpg`,
      'fountain-dancing-jets': `${V}/zone-fountain/fountain-dancing-jets.jpg`,
      'fountain-glass-waterfall': `${V}/zone-fountain/fountain-glass-waterfall.jpg`,
      'fountain-black-granite': `${V}/zone-fountain/fountain-black-granite.jpg`,
      'fountain-steel-sphere': `${V}/zone-fountain/fountain-steel-sphere.jpg`,
      'fountain-brass-lotus': `${V}/zone-fountain/fountain-brass-lotus.jpg`
    }
  },

  'zone-entrance': {
    'slot-entrance-arch': {
      // All three are the same marble red-carpet foyer with a different wall.
      'backdrop-floral-wall': '/images/zone_entrance_360.jpg',
      'backdrop-hedge-wall': '/images/zone_hedge_wall_360.jpg',
      'backdrop-shimmer-sequin': '/images/zone_shimmer_wall_360.jpg'
    }
    // slot-entrance-water: intentionally unmapped, see file header.
  }
};

/**
 * Slot swap priority when resolving a full selection set.
 *
 * The order matters twice over: it decides which swapped slot wins when several
 * are non-default, AND which slot supplies the DEFAULT plate for a freshly
 * opened zone. Every slot that appears in SCENE_VARIANTS must be listed here,
 * and within a zone the slot that defines the room (stage / mandap / podium /
 * arch / fountain) must come before its secondary slots — otherwise the zone
 * opens showing another zone's plate.
 */
const SLOT_PRIORITY = [
  // Primary / room-defining slots, one per zone.
  'slot-election-podium',
  'slot-meeting-podium',
  'slot-function-mandap',
  'slot-stage-main',
  'slot-fountain-center',
  'slot-entrance-arch',
  // Secondary slots.
  'slot-election-hoarding',
  'slot-meeting-screen',
  'slot-function-marigold',
  'slot-election-seating',
  'slot-meeting-desk'
];

/** Ordered list of the variant-bearing slots for one zone. */
function orderedSlotIds(zoneMap) {
  return [
    ...SLOT_PRIORITY.filter(id => zoneMap[id]),
    ...Object.keys(zoneMap).filter(id => !SLOT_PRIORITY.includes(id))
  ];
}

/**
 * Resolve the panorama URL for a zone given current selections.
 * @param {string} zoneId
 * @param {object} zone — zone object with panoramaUrl + slots
 * @param {Record<string,string>} selections — activeSelections (slotId -> itemId)
 * @param {string|null} preferredSlotId — slot that was just swapped (wins)
 * @returns {string|null}
 */
export function resolveScenePanorama(zoneId, zone, selections = {}, preferredSlotId = null) {
  const zoneMap = SCENE_VARIANTS[zoneId];
  if (!zoneMap) return zone?.panoramaUrl || null;

  // A swap was just made: either this slot+item has its own plate, or the scene
  // does not change at all. Falling through to the generic scan here used to
  // load an UNRELATED slot's plate, so swapping a desk visibly reloaded the
  // podium. `null` tells the caller "keep the current panorama, use the prop".
  if (preferredSlotId) {
    const itemId = selections[preferredSlotId];
    return (itemId && zoneMap[preferredSlotId]?.[itemId]) || null;
  }

  const slots = zone?.slots || [];
  const ordered = orderedSlotIds(zoneMap);

  // 1. Any slot that has actually been swapped away from its default and has a plate.
  for (const slotId of ordered) {
    const slot = slots.find(s => s.id === slotId);
    const itemId = selections[slotId] || slot?.defaultItemId;
    if (!itemId) continue;
    const url = zoneMap[slotId]?.[itemId];
    if (!url) continue;
    if (slot && itemId !== slot.defaultItemId) return url;
  }

  // 2. Nothing swapped: the highest-priority slot in THIS zone supplies the
  //    default plate. `ordered` only ever contains slots of this zone, so this
  //    can never return another zone's panorama.
  for (const slotId of ordered) {
    const slot = slots.find(s => s.id === slotId);
    const itemId = selections[slotId] || slot?.defaultItemId;
    const url = itemId && zoneMap[slotId]?.[itemId];
    if (url) return url;
  }

  // 3. The zone's own base plate.
  return zone?.panoramaUrl || null;
}

/**
 * True if this slot+item has a stored environment-locked plate that genuinely
 * shows THIS element in THIS room.
 *
 * The viewer uses this to decide whether to suppress the live prop sprite, so a
 * false positive leaves the slot completely inert: no baked change and no
 * sprite. Only real, verified plates are listed in SCENE_VARIANTS, so a plain
 * lookup is now the correct answer.
 */
export function hasSceneVariant(zoneId, slotId, itemId) {
  if (!zoneId || !slotId || !itemId) return false;
  return Boolean(SCENE_VARIANTS[zoneId]?.[slotId]?.[itemId]);
}

/**
 * How a swap will actually appear, so the UI can say so instead of guessing.
 * @returns {'scene'|'prop'} 'scene' = a new 360 plate of the same room loads.
 *                           'prop'  = the room stays, a labelled prop preview updates.
 */
export function describeSwapEffect(zoneId, slotId, itemId) {
  return hasSceneVariant(zoneId, slotId, itemId) ? 'scene' : 'prop';
}

/** How many of a slot's options have a real 360 plate — used for honest badges. */
export function sceneVariantCoverage(zoneId, slotId, itemIds = []) {
  const withPlate = itemIds.filter(id => hasSceneVariant(zoneId, slotId, id)).length;
  return { withPlate, total: itemIds.length };
}

/** Prop overlay image for live element preview (optional). */
export const PROP_IMAGES = {
  'stage-digital-podium': '/images/props/stage-digital-podium.jpg',
  'stage-bulletproof-podium': '/images/props/stage-bulletproof-podium.jpg',
  'podium-wooden-presidential': '/images/props/podium-wooden-presidential.png',
  'podium-acrylic-modern': '/images/props/podium-acrylic-modern.png'
};

export function getPropImage(itemId, fallbackImageUrl) {
  return PROP_IMAGES[itemId] || fallbackImageUrl || null;
}
