/**
 * Zone-locked panorama variants.
 *
 * Each plate keeps the same environment and changes ONLY the named element
 * (podium / screen / chairs / stage / backdrop). On swap we load the plate
 * for the slot that was just changed so the rest of the room stays put.
 */

const V = '/images/variants';

/**
 * SCENE_VARIANTS[zoneId][slotId][itemId] → panorama URL
 */
export const SCENE_VARIANTS = {
  'zone-india-election': {
    'slot-election-podium': {
      'stage-bulletproof-podium': `${V}/zone-india-election/podium_stage-bulletproof-podium.jpg`,
      'stage-digital-podium': `${V}/zone-india-election/podium_stage-digital-podium.jpg`,
      'podium-wooden-presidential': `${V}/zone-india-election/podium_podium-wooden-presidential.jpg`,
      'podium-acrylic-modern': `${V}/zone-india-election/podium_podium-acrylic-modern.jpg`
    },
    'slot-election-hoarding': {
      'backdrop-election-flags': `${V}/zone-india-election/screen_backdrop-election-flags.jpg`,
      'backdrop-seamless-led': `${V}/zone-india-election/screen_backdrop-seamless-led.jpg`,
      'backdrop-floral-wall': `${V}/zone-india-election/screen_backdrop-election-flags.jpg`,
      'backdrop-shimmer-sequin': `${V}/zone-india-election/screen_backdrop-seamless-led.jpg`
    },
    'slot-election-seating': {
      'chair-vvip-executive': `${V}/zone-india-election/chairs_chair-vvip-executive.jpg`,
      'chair-chiavari-gold': `${V}/zone-india-election/chairs_chair-chiavari-gold.jpg`,
      'chair-folding': `${V}/zone-india-election/chairs_chair-folding.jpg`,
      'chair-ghost': `${V}/zone-india-election/chairs_chair-ghost.jpg`,
      'chair-throne': `${V}/zone-india-election/chairs_chair-vvip-executive.jpg`
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
      'backdrop-seamless-led': `${V}/zone-india-meeting/screen_layout-center.jpg`,
      'screen-layout-center': `${V}/zone-india-meeting/screen_layout-center.jpg`,
      'backdrop-election-flags': `${V}/zone-india-meeting/screen_layout-left.jpg`,
      'screen-layout-left': `${V}/zone-india-meeting/screen_layout-left.jpg`,
      'backdrop-shimmer-sequin': `${V}/zone-india-meeting/screen_layout-shimmer.jpg`,
      'screen-layout-shimmer': `${V}/zone-india-meeting/screen_layout-shimmer.jpg`,
      'backdrop-floral-wall': `${V}/zone-india-meeting/screen_layout-dual.jpg`,
      'screen-layout-dual': `${V}/zone-india-meeting/screen_layout-dual.jpg`
    },
    'slot-meeting-desk': {
      'table-summit-desk': '/images/india_meeting_360.jpg',
      'table-led-glass': `${V}/zone-india-meeting/podium_stage-digital-podium.jpg`,
      'table-rustic-wood': `${V}/zone-india-meeting/podium_podium-wooden-presidential.jpg`
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
      'backdrop-floral-wall': `${V}/zone-india-function/backdrop_backdrop-floral-wall.jpg`,
      'backdrop-shimmer-sequin': `${V}/zone-india-function/backdrop_backdrop-floral-wall.jpg`,
      'backdrop-hedge-wall': `${V}/zone-india-function/backdrop_backdrop-marigold-garland.jpg`
    },
    'slot-function-throne': {
      'chair-maharaja-throne': '/images/india_function_360.jpg',
      'chair-gaddi-baithak': '/images/india_function_360.jpg',
      'chair-throne': '/images/india_function_360.jpg',
      'chair-vvip-executive': '/images/india_function_360.jpg'
    }
  },

  'zone-stage': {
    'slot-stage-main': {
      'stage-led-arch': `${V}/zone-stage/stage_stage-led-arch.jpg`,
      'stage-wooden-riser': `${V}/zone-stage/stage_stage-wooden-riser.jpg`,
      'stage-royal-pavilion': `${V}/zone-stage/stage_stage-royal-pavilion.jpg`,
      'stage-royal-mandap': `${V}/zone-stage/stage_stage-royal-pavilion.jpg`
    },
    'slot-stage-backdrop': {
      'backdrop-shimmer-sequin': `${V}/zone-stage/backdrop_backdrop-shimmer-sequin.jpg`,
      'backdrop-hedge-wall': `${V}/zone-stage/backdrop_backdrop-hedge-wall.jpg`,
      'backdrop-floral-wall': `${V}/zone-stage/backdrop_backdrop-floral-wall.jpg`,
      'backdrop-marigold-garland': `${V}/zone-stage/backdrop_backdrop-floral-wall.jpg`
    }
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
      'backdrop-floral-wall': '/images/zone_entrance_360.jpg',
      'backdrop-hedge-wall': '/images/zone_hedge_wall_360.jpg',
      'backdrop-shimmer-sequin': '/images/zone_shimmer_wall_360.jpg',
      'backdrop-marigold-garland': '/images/zone_marigold_wall_360.jpg'
    },
    'slot-entrance-water': {
      'fountain-glass-waterfall': `${V}/zone-fountain/fountain-glass-waterfall.jpg`,
      'fountain-tiered-stone': `${V}/zone-fountain/fountain-tiered-stone.jpg`,
      'fountain-royal-marble': `${V}/zone-fountain/fountain-royal-marble.jpg`,
      'fountain-dancing-jets': `${V}/zone-fountain/fountain-dancing-jets.jpg`,
      'fountain-black-granite': `${V}/zone-fountain/fountain-black-granite.jpg`,
      'fountain-steel-sphere': `${V}/zone-fountain/fountain-steel-sphere.jpg`,
      'fountain-brass-lotus': `${V}/zone-fountain/fountain-brass-lotus.jpg`
    }
  }
};

/** Slot swap priority when resolving a full selection set (higher = more visual weight). */
const SLOT_PRIORITY = [
  'slot-election-podium',
  'slot-meeting-podium',
  'slot-function-mandap',
  'slot-stage-main',
  'slot-fountain-center',
  'slot-election-hoarding',
  'slot-meeting-screen',
  'slot-function-marigold',
  'slot-stage-backdrop',
  'slot-election-seating',
  'slot-meeting-desk',
  'slot-function-throne',
  'slot-stage-seating',
  'slot-entrance-water'
];

/**
 * Resolve the panorama URL for a zone given current selections.
 * @param {string} zoneId
 * @param {object} zone — zone object with panoramaUrl + slots
 * @param {Record<string,string>} selections — activeSelections
 * @param {string|null} preferredSlotId — slot that was just swapped (wins)
 */
export function resolveScenePanorama(zoneId, zone, selections = {}, preferredSlotId = null) {
  const zoneMap = SCENE_VARIANTS[zoneId];
  if (!zoneMap) return zone?.panoramaUrl || null;

  if (preferredSlotId && zoneMap[preferredSlotId]) {
    const itemId = selections[preferredSlotId];
    const url = itemId && zoneMap[preferredSlotId][itemId];
    if (url) return url;
  }

  // Prefer a non-default selection that has a plate
  const slots = zone?.slots || [];
  const ordered = [
    ...SLOT_PRIORITY.filter(id => zoneMap[id]),
    ...Object.keys(zoneMap).filter(id => !SLOT_PRIORITY.includes(id))
  ];

  for (const slotId of ordered) {
    const slot = slots.find(s => s.id === slotId);
    const itemId = selections[slotId] || slot?.defaultItemId;
    if (!itemId) continue;
    const url = zoneMap[slotId]?.[itemId];
    if (!url) continue;
    // Skip if it's the default and we haven't preferred this slot — keep scanning
    // for any swapped (non-default) plate first
    if (slot && itemId !== slot.defaultItemId) return url;
  }

  // Fall back to default plate for primary slot, else zone base
  for (const slotId of ordered) {
    const slot = slots.find(s => s.id === slotId);
    const itemId = selections[slotId] || slot?.defaultItemId;
    const url = itemId && zoneMap[slotId]?.[itemId];
    if (url) return url;
  }

  return zone?.panoramaUrl || null;
}

/** True if this slot+item has a stored environment-locked plate. */
export function hasSceneVariant(zoneId, slotId, itemId) {
  return Boolean(SCENE_VARIANTS[zoneId]?.[slotId]?.[itemId]);
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
