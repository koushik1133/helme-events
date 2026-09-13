/**
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
 * 64 plates, all full 360°.
 */
export const PANORAMA_DIMENSIONS = {
  '/images/india_election_360.jpg': { w: 3072, h: 1536 },
  '/images/india_function_360.jpg': { w: 3072, h: 1536 },
  '/images/india_meeting_360.jpg': { w: 3072, h: 1536 },
  '/images/political_presidential_rally_360.jpg': { w: 3072, h: 1536 },
  '/images/reception_crystal_gala_360.jpg': { w: 3072, h: 1536 },
  '/images/reception_midnight_velvet_360.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-black-granite.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-brass-lotus.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-dancing-jets.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-glass-waterfall.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-plaza-default.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-royal-marble.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-steel-sphere.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-fountain/fountain-tiered-stone.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/chairs_chair-chiavari-gold.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/chairs_chair-folding.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/chairs_chair-ghost.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/chairs_chair-vvip-executive.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/podium_podium-acrylic-modern.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/podium_podium-wooden-presidential.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/podium_stage-bulletproof-podium.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/podium_stage-digital-podium.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/screen_backdrop-election-flags.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-election/screen_backdrop-seamless-led.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/backdrop_backdrop-floral-wall.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/backdrop_backdrop-marigold-garland.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/mandap_stage-led-arch.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/mandap_stage-royal-mandap.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/mandap_stage-royal-pavilion.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-function/mandap_stage-wooden-riser.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/chairs_chair-ghost.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/chairs_chair-vvip-executive.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/podium_podium-acrylic-modern.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/podium_podium-wooden-presidential.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/podium_stage-bulletproof-podium.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/podium_stage-digital-podium.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_backdrop-election-flags.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_backdrop-floral-wall.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_backdrop-seamless-led.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_backdrop-shimmer-sequin.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_layout-center.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_layout-dual.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_layout-left.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-india-meeting/screen_layout-shimmer.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/backdrop_backdrop-floral-wall.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/backdrop_backdrop-hedge-wall.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/backdrop_backdrop-shimmer-sequin.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/stage_stage-led-arch.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/stage_stage-royal-pavilion.jpg': { w: 3072, h: 1536 },
  '/images/variants/zone-stage/stage_stage-wooden-riser.jpg': { w: 3072, h: 1536 },
  '/images/venue_map_aerial.jpg': { w: 3072, h: 1536 },
  '/images/zone_banquet_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_bedroom_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_dancing_jets_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_entrance_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_fountain_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_hedge_wall_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_kitchen_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_living_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_lounge_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_marigold_wall_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_shimmer_wall_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_stage_360.jpg': { w: 3072, h: 1536 },
  '/images/zone_stone_fountain_360.jpg': { w: 3072, h: 1536 },
};

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
