/**
 * Panorama source metadata.
 *
 * Measured from the actual files. Half of our plates are true equirectangular
 * 360° captures (2:1); the rest are wide-angle photographs. Wrapping a flat
 * photo around a full sphere produces a hard seam where its left and right
 * edges meet and smears both poles, so the viewer renders those as a PARTIAL
 * panorama instead — a limited field of view that pans and zooms correctly.
 *
 * Regenerate after adding assets:
 *   find public/images -name '*.jpg' -exec sips -g pixelWidth -g pixelHeight {} +
 *
 * 32 plates are true 360°; 32 are wide-angle stills awaiting a real capture.
 */
export const PANORAMA_DIMENSIONS = {
  '/images/india_election_360.jpg': { w: 1376, h: 768 },
  '/images/india_function_360.jpg': { w: 1376, h: 768 },
  '/images/india_meeting_360.jpg': { w: 1376, h: 768 },
  '/images/political_presidential_rally_360.jpg': { w: 1376, h: 768 },
  '/images/reception_crystal_gala_360.jpg': { w: 1376, h: 768 },
  '/images/reception_midnight_velvet_360.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-fountain/fountain-black-granite.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-fountain/fountain-brass-lotus.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-fountain/fountain-dancing-jets.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-fountain/fountain-glass-waterfall.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-fountain/fountain-plaza-default.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-fountain/fountain-royal-marble.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-fountain/fountain-steel-sphere.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-fountain/fountain-tiered-stone.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-election/chairs_chair-chiavari-gold.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/chairs_chair-folding.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/chairs_chair-ghost.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/chairs_chair-vvip-executive.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/podium_podium-acrylic-modern.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/podium_podium-wooden-presidential.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/podium_stage-bulletproof-podium.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-election/podium_stage-digital-podium.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-election/screen_backdrop-election-flags.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-election/screen_backdrop-seamless-led.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-function/backdrop_backdrop-floral-wall.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-function/backdrop_backdrop-marigold-garland.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-function/mandap_stage-led-arch.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-function/mandap_stage-royal-mandap.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-function/mandap_stage-royal-pavilion.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-function/mandap_stage-wooden-riser.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/chairs_chair-ghost.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-india-meeting/chairs_chair-vvip-executive.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/podium_podium-acrylic-modern.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/podium_podium-wooden-presidential.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/podium_stage-bulletproof-podium.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/podium_stage-digital-podium.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_backdrop-election-flags.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_backdrop-floral-wall.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_backdrop-seamless-led.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_backdrop-shimmer-sequin.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_layout-center.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_layout-dual.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_layout-left.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-india-meeting/screen_layout-shimmer.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-stage/backdrop_backdrop-floral-wall.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-stage/backdrop_backdrop-hedge-wall.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-stage/backdrop_backdrop-shimmer-sequin.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-stage/stage_stage-led-arch.jpg': { w: 1376, h: 768 },
  '/images/variants/zone-stage/stage_stage-royal-pavilion.jpg': { w: 2048, h: 1024 },
  '/images/variants/zone-stage/stage_stage-wooden-riser.jpg': { w: 2048, h: 1024 },
  '/images/venue_map_aerial.jpg': { w: 1376, h: 768 },
  '/images/zone_banquet_360.jpg': { w: 1376, h: 768 },
  '/images/zone_bedroom_360.jpg': { w: 1376, h: 768 },
  '/images/zone_dancing_jets_360.jpg': { w: 1376, h: 768 },
  '/images/zone_entrance_360.jpg': { w: 1376, h: 768 },
  '/images/zone_fountain_360.jpg': { w: 1376, h: 768 },
  '/images/zone_hedge_wall_360.jpg': { w: 1376, h: 768 },
  '/images/zone_kitchen_360.jpg': { w: 1376, h: 768 },
  '/images/zone_living_360.jpg': { w: 1376, h: 768 },
  '/images/zone_lounge_360.jpg': { w: 1376, h: 768 },
  '/images/zone_marigold_wall_360.jpg': { w: 1376, h: 768 },
  '/images/zone_shimmer_wall_360.jpg': { w: 1376, h: 768 },
  '/images/zone_stage_360.jpg': { w: 1376, h: 768 },
  '/images/zone_stone_fountain_360.jpg': { w: 1376, h: 768 },
};

/** True 360° plates, for the "full 360°" badge in the UI. */
export function isTrue360(url) {
  const d = PANORAMA_DIMENSIONS[url];
  if (!d) return false;
  return Math.abs(d.w / d.h - 2) < 0.06;
}
