/**
 * CustomEventBriefWizard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Four-step event brief wizard:
 *   1. Client & category   2. Specifications   3. 360° concepts   4. Event Brief
 *
 * Everything collected in steps 1–2 is carried through: it drives the concept
 * pricing, the zone-by-zone design spec and the printable brief in step 4.
 * Money is INR integer rupees throughout, via src/utils/format.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import {
  formatMoney, formatNumber, sumLines, computeGst,
  escapeHtml, SELLER_STATE, GST_RATE
} from '../utils/format.js';

/* ───────────────────────────── Reference data ───────────────────────────── */

const SUB_LABELS = {
  reception: 'Luxury Reception & Gala',
  wedding: 'Grand Wedding & Mandap Ceremony',
  anniversary: 'Milestone Anniversary',
  birthday: 'Milestone Birthday Celebration',
  conference: 'National Annual Conference',
  product_launch: 'Keynote Product Launch',
  trade_show: 'B2B Trade Show & Exhibition',
  rally: 'Public Rally & Mass Gathering',
  town_hall: 'Town Hall & Assembly',
  press_conf: 'Press Conference & Media Meet',
  festival: 'Music Festival & Concert',
  charity_run: 'Charity Marathon / Run',
  cultural_fair: 'Cultural Heritage Fair'
};

const CATEGORY_LABELS = {
  social: 'Social & Marriage',
  corporate: 'Corporate & Business',
  political: 'Political & Rallies',
  public: 'Public & Community'
};

const SUBS_BY_CATEGORY = {
  social: ['reception', 'wedding', 'anniversary', 'birthday'],
  corporate: ['conference', 'product_launch', 'trade_show'],
  political: ['rally', 'town_hall', 'press_conf'],
  public: ['festival', 'charity_run', 'cultural_fair']
};

/** Budget brackets in integer rupees. */
const BUDGET_BRACKETS = {
  under_2l: { label: 'Under ₹2,00,000 — Essential', min: 0, max: 200000, tier: 0.60 },
  '2l_10l': { label: '₹2,00,000 – ₹10,00,000 — Standard', min: 200000, max: 1000000, tier: 0.80 },
  '10l_40l': { label: '₹10,00,000 – ₹40,00,000 — Premium', min: 1000000, max: 4000000, tier: 1.00 },
  '40l_plus': { label: '₹40,00,000+ — Grand scale', min: 4000000, max: Infinity, tier: 1.35 }
};

/** Every category-specific select, as data — so options bind to formData and
 *  the brief can print the human label instead of the raw value. */
const OPTIONS = {
  religiousSetup: [
    ['mandap-gold', '👑 Royal Gold Mandap (Indian traditional)'],
    ['floral-altar', '🌸 Floral arch ceremony altar (Western)'],
    ['fire-kund', '🔥 Sacred fire havan kund setup'],
    ['nikah-stage', '🕌 Elegant royal Nikah stage']
  ],
  cateringStyle: [
    ['grand-buffet', '🍲 Grand multi-cuisine live buffet'],
    ['royal-plated', '🍽️ Royal 5-course plated banquet'],
    ['family-style', '🥗 Family-style shared platters'],
    ['food-trucks', '🚚 Artisanal gourmet food trucks']
  ],
  securityLevel: [
    ['secret-service', '🛡️ Close-protection / VIP coordination'],
    ['metal-gates', '🚨 Metal detector gates & bag checks'],
    ['heavy-barricades', '🚧 Heavy reinforced barricade line']
  ],
  pressArea: [
    ['camera-risers', '🎥 Elevated camera risers & audio mult box'],
    ['press-room', '🎙️ Press holding room & media bay'],
    ['satellite-van', '📡 Satellite broadcast truck bay']
  ],
  stagePodium: [
    ['bulletproof-podium', '🎤 Armoured glass podium & teleprompter'],
    ['led-backdrop', '📺 4K LED screen high-visibility backdrop'],
    ['national-flags', '🚩 National & party flag array']
  ],
  avTech: [
    ['dual-led-walls', '📺 Dual 4K LED video walls'],
    ['wireless-mics', '🎙️ Wireless lapel mics & audio array']
  ],
  exhibitionSetup: [
    ['booths-lounge', '🏢 Shell-scheme booths + networking lounge'],
    ['vip-bar', '🍸 Executive VIP lounge & bar']
  ],
  soundSystem: [
    ['line-array-towers', '🔊 Line array sound towers & spotlights'],
    ['pyro-lasers', '🎆 Pyrotechnics & laser light show']
  ],
  crowdFacilities: [
    ['multi-gate-security', '🎟️ Multi-queue entry gates & ticketing'],
    ['first-aid', '🏥 First aid tent & security patrols']
  ]
};

const labelFor = (field, value) => {
  const found = (OPTIONS[field] || []).find(([v]) => v === value);
  return found ? found[1] : value;
};

/* Service pricing — integer rupees. Documented so the brief can show its working. */
const CATERING_PER_HEAD = {
  'grand-buffet': 1800, 'royal-plated': 3200, 'family-style': 1400, 'food-trucks': 1100
};
const DEFAULT_FNB_PER_HEAD = { social: 1800, corporate: 1200, political: 250, public: 150 };
const AV_PACKAGE = {
  'dual-led-walls': 450000, 'wireless-mics': 120000,
  'line-array-towers': 380000, 'pyro-lasers': 650000,
  'bulletproof-podium': 550000, 'led-backdrop': 420000, 'national-flags': 90000
};
const SECURITY_PACKAGE = {
  'secret-service': 600000, 'metal-gates': 350000, 'heavy-barricades': 450000,
  'multi-gate-security': 300000, 'first-aid': 120000
};
const PRESS_PACKAGE = { 'camera-risers': 180000, 'press-room': 120000, 'satellite-van': 260000 };
const EXHIBITION_PACKAGE = { 'booths-lounge': 520000, 'vip-bar': 280000 };
const CREW_HOUR_RATE = 9000; // per crew block of 100 guests, per hour

/* Slot index built from the real zone data, so the design spec can name the
 * zone and slot and pull the right quantity. */
const SLOT_INDEX = (() => {
  const idx = {};
  VENUE_ZONES.forEach(zone => {
    (zone.slots || []).forEach(slot => {
      idx[slot.id] = { zoneName: zone.name, zoneId: zone.id, slot };
    });
  });
  return idx;
})();

/* ────────────────── Keyword Style Matcher vocabulary ───────────────────────
 * This is a deterministic keyword matcher, NOT a language model. It is
 * labelled as such in the UI. Each rule reports back what it matched so the
 * user always gets visible feedback.
 */
const STYLE_RULES = [
  { keys: ['violet', 'purple', 'lavender'], note: 'Deep violet ambient LED wash across stage and perimeter.' },
  { keys: ['blue', 'navy', 'sapphire', 'indigo'], note: 'Sapphire-blue uplighting with navy velvet draping.' },
  { keys: ['red', 'crimson', 'maroon', 'scarlet'], note: 'Crimson drape treatment and warm red wash on the backdrop.' },
  { keys: ['gold', 'golden', 'gilded'], note: 'Gilded accents on stage trim, frames and table settings.' },
  { keys: ['silver', 'platinum', 'chrome'], note: 'Brushed silver and chrome hardware across all structures.' },
  { keys: ['white', 'ivory', 'cream'], note: 'Ivory and white palette with matched linen and florals.' },
  { keys: ['green', 'emerald', 'olive'], note: 'Emerald palette with dense foliage styling.' },
  { keys: ['pink', 'blush', 'rose gold'], note: 'Blush-pink and rose-gold accent palette.' },
  { keys: ['black', 'noir', 'monochrome'], note: 'Blackout drape with monochrome styling and hard edge lighting.' },
  { keys: ['orange', 'amber', 'saffron'], note: 'Saffron and amber wash for a warm traditional tone.' },
  { keys: ['teal', 'turquoise', 'aqua'], note: 'Turquoise accent lighting and aqua-toned linen.' },

  { keys: ['marigold', 'garland', 'genda'], note: 'Traditional marigold garland backdrop.', slot: ['slot-stage-backdrop', 'backdrop-marigold-garland'] },
  { keys: ['floral', 'flowers', 'orchid', 'rose wall', 'jasmine'], note: 'Fresh floral wall behind the ceremony position.', slot: ['slot-stage-backdrop', 'backdrop-floral-wall'] },
  { keys: ['hedge', 'greenery', 'botanical', 'foliage', 'garden'], note: 'Living hedge wall and potted greenery framing.', slot: ['slot-stage-backdrop', 'backdrop-hedge-wall'] },
  { keys: ['sequin', 'shimmer', 'sparkle', 'glitter'], note: 'Shimmer sequin backdrop for high-contrast photography.', slot: ['slot-stage-backdrop', 'backdrop-shimmer-sequin'] },

  { keys: ['mandap', 'pavilion', 'canopy'], note: 'Carved pavilion / mandap structure as the stage centrepiece.', slot: ['slot-stage-main', 'stage-royal-pavilion'] },
  { keys: ['led arch', 'led wall', 'screen', 'video wall'], note: 'LED arch and screen surface on the main stage.', slot: ['slot-stage-main', 'stage-led-arch'] },
  { keys: ['rustic', 'wood', 'wooden', 'timber'], note: 'Timber riser staging and rustic wood dining tables.', slot: ['slot-stage-main', 'stage-wooden-riser'] },

  { keys: ['ghost', 'acrylic', 'clear chair', 'transparent'], note: 'Clear acrylic ghost seating for an unobstructed sightline.', slot: ['slot-stage-seating', 'chair-ghost'] },
  { keys: ['chiavari', 'gold chair', 'banquet chair'], note: 'Gold Chiavari seating on the front rows.', slot: ['slot-stage-seating', 'chair-chiavari-gold'] },
  { keys: ['velvet', 'armchair', 'plush'], note: 'Plush velvet lounge seating in the VIP rows.', slot: ['slot-stage-seating', 'chair-velvet-armchair'] },

  { keys: ['cocktail', 'high table', 'standing'], note: 'Cocktail high-tops for a standing reception flow.', slot: ['slot-banquet-table', 'table-cocktail'] },
  { keys: ['glass table', 'led table', 'lit table'], note: 'Illuminated LED glass dining tables.', slot: ['slot-banquet-table', 'table-led-glass'] },

  { keys: ['fountain', 'water feature', 'jets'], note: 'Choreographed dancing-jet water feature at the plaza centre.', slot: ['slot-fountain-center', 'fountain-dancing-jets'] },
  { keys: ['marble', 'stone'], note: 'Carved stone / marble water feature.', slot: ['slot-fountain-center', 'fountain-royal-marble'] },

  { keys: ['crystal', 'chandelier'], note: 'Crystal chandelier cluster over the dining floor.' },
  { keys: ['fairy light', 'string light', 'canopy light'], note: 'Warm fairy-light canopy across the guest area.' },
  { keys: ['lantern', 'diya', 'candle'], note: 'Lantern and diya pathway lighting.' },
  { keys: ['neon', 'laser', 'cyber', 'futuristic'], note: 'Neon and laser effect package with moving heads.' },
  { keys: ['spotlight', 'follow spot', 'uplight'], note: 'Follow-spot and perimeter uplighting package.' },

  { keys: ['sound', 'speaker', 'tower', 'line array', 'dj', 'pa'], note: 'Line-array PA towers with delay stacks for the far field.' },
  { keys: ['red carpet', 'carpet', 'walkway'], note: '100ft VIP red carpet entry aisle with stanchions.' },
  { keys: ['firework', 'pyro', 'sparkler'], note: 'Licensed pyrotechnic finale (subject to venue permit).' },
  { keys: ['drone', 'aerial'], note: 'Aerial drone coverage (subject to airspace clearance).' },
  { keys: ['photo booth', 'selfie', 'photobooth'], note: 'Branded photo booth with instant print.' },

  { keys: ['minimal', 'minimalist', 'clean', 'understated'], note: 'Pared-back minimal styling — fewer, larger statement pieces.' },
  { keys: ['royal', 'regal', 'maharaja', 'palace'], note: 'Regal palace styling with heavy ornamentation.' },
  { keys: ['modern', 'contemporary', 'sleek'], note: 'Contemporary lines with matte finishes.' },
  { keys: ['traditional', 'heritage', 'cultural', 'ethnic'], note: 'Heritage motifs and traditional craft detailing.' },
  { keys: ['luxury', 'opulent', 'lavish', 'premium'], note: 'Upgraded finishes and higher-spec fabrication throughout.' }
];

/* ───────────────────────────── Concept library ──────────────────────────── */

const C = (id, title, badge, panoramaUrl, description, tier, selections) =>
  ({ id, title, badge, panoramaUrl, description, tier, selections });

const S = (main, backdrop, seating, table, fountain) => ({
  'slot-stage-main': main,
  'slot-stage-backdrop': backdrop,
  'slot-stage-seating': seating,
  'slot-banquet-table': table,
  'slot-fountain-center': fountain
});

const CONCEPT_LIBRARY = {
  reception: [
    C('concept-1', '👑 Crystal Chandelier Gala', 'Luxury ballroom', '/images/reception_crystal_gala_360.jpg',
      'Grand ballroom under crystal chandeliers: gold Chiavari seating, tall orchid centrepieces and a plated five-course service line.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-chiavari-gold', 'table-round-standard', 'fountain-dancing-jets')),
    C('concept-2', '🌌 Midnight Velvet Starlight', 'Night-sky ambient', '/images/reception_midnight_velvet_360.jpg',
      'Deep navy velvet draping with an LED starlight ceiling, clear acrylic seating, cocktail high-tops and an illuminated glass bar.',
      'premium', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-ghost', 'table-cocktail', 'fountain-tiered-stone')),
    C('concept-3', '🌿 Enchanted Garden Lawn', 'Scenic outdoor', '/images/zone_lounge_360.jpg',
      'Open lawn under a floral canopy: warm fairy lights, rustic timber dining, acoustic lounge set and a stone water feature.',
      'essential', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-folding', 'table-rustic-wood', 'fountain-dancing-jets'))
  ],

  wedding: [
    C('concept-1', '👑 Royal Gold Carved Mandap', 'Royal traditional', '/images/zone_stage_360.jpg',
      'Carved gold mandap pillars, marigold garlands, sacred fire kund and a VIP front row in gold Chiavari.',
      'signature', S('stage-royal-pavilion', 'backdrop-marigold-garland', 'chair-chiavari-gold', 'table-round-standard', 'fountain-dancing-jets')),
    C('concept-2', '🌸 Mughal Palace Setup', 'Heritage palace', '/images/india_function_360.jpg',
      'Palace-arch backdrop with regal drapes, a shehnai performance riser and heritage-styled guest seating along the walk.',
      'premium', S('stage-royal-pavilion', 'backdrop-shimmer-sequin', 'chair-chiavari-gold', 'table-rustic-wood', 'fountain-tiered-stone')),
    C('concept-3', '🤍 Platinum Floral Altar', 'Contemporary white', '/images/zone_banquet_360.jpg',
      'Crisp white floral ceremony arch, ghost acrylic aisle chairs, low ambient wash and a grand piano at the aisle head.',
      'essential', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-ghost', 'table-round-standard', 'fountain-dancing-jets'))
  ],

  anniversary: [
    C('concept-1', '💛 Golden Jubilee Ballroom', 'Milestone formal', '/images/zone_banquet_360.jpg',
      'Gold-and-ivory ballroom built around a family timeline wall, a toast riser for speeches and round tables seating extended family together.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-chiavari-gold', 'table-round-standard', 'fountain-royal-marble')),
    C('concept-2', '🕯️ Candlelit Courtyard Dinner', 'Intimate evening', '/images/zone_lounge_360.jpg',
      'Courtyard dinner under a fairy-light canopy with lantern pathways, long rustic tables and an acoustic duo at low volume for conversation.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-velvet-armchair', 'table-rustic-wood', 'fountain-tiered-stone')),
    C('concept-3', '🌺 Heritage Family Mandapam', 'Traditional home-style', '/images/india_function_360.jpg',
      'Traditional pavilion with marigold work and a blessing seat for the couple, floor-level baithak seating and a live sweets counter.',
      'essential', S('stage-royal-pavilion', 'backdrop-marigold-garland', 'chair-folding', 'table-rustic-wood', 'fountain-brass-lotus'))
  ],

  birthday: [
    C('concept-1', '🎆 Neon Night Party Floor', 'High-energy', '/images/zone_stage_360.jpg',
      'LED arch DJ stage with laser and moving-head package, cocktail high-tops around a central dance floor and a neon photo wall.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-ghost', 'table-cocktail', 'fountain-steel-sphere')),
    C('concept-2', '🍭 Pastel Garden Celebration', 'Daytime family', '/images/zone_lounge_360.jpg',
      'Daytime lawn party in a pastel palette: balloon-and-foliage arch, a dessert and cake pavilion and shaded family seating.',
      'premium', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-folding', 'table-rustic-wood', 'fountain-dancing-jets')),
    C('concept-3', '🖤 Black-Tie Milestone Lounge', 'Adult formal', '/images/zone_banquet_360.jpg',
      'Blackout lounge with a mirrored bar back, velvet armchair clusters, a single hard-edge spotlight for the toast and a jazz trio.',
      'essential', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-velvet-armchair', 'table-led-glass', 'fountain-black-granite'))
  ],

  conference: [
    C('concept-1', '🎤 Plenary Main Hall', 'Keynote plenary', '/images/india_meeting_360.jpg',
      'Wide plenary set with a seamless LED backdrop, a panellist front row and theatre seating behind, plus a confidence monitor rig.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-vvip-executive', 'table-round-standard', 'fountain-steel-sphere')),
    C('concept-2', '🤝 Breakout & Networking Commons', 'Multi-track', '/images/zone_lounge_360.jpg',
      'Four breakout pods around a shared networking commons: standing high-tops, a barista counter and a sponsor greenery wall for press photos.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-ghost', 'table-cocktail', 'fountain-glass-waterfall')),
    C('concept-3', '🏛️ Executive Summit Roundtable', 'Closed-door', '/images/zone_banquet_360.jpg',
      'Single closed-door roundtable layout for delegation heads with name blocks, interpreter booths at the perimeter and a controlled press window.',
      'essential', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-vvip-executive', 'table-round-standard', 'fountain-tiered-stone'))
  ],

  product_launch: [
    C('concept-1', '🚀 Reveal Stage & Runway', 'Flagship reveal', '/images/zone_stage_360.jpg',
      'Central reveal plinth on a runway thrust with a seamless LED wall behind, a camera-locked hero angle and a blackout-to-full-wash cue.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-vvip-executive', 'table-cocktail', 'fountain-steel-sphere')),
    C('concept-2', '🧊 Minimal Gallery Launch', 'Product gallery', '/images/zone_banquet_360.jpg',
      'Gallery-style plinth walk with individually lit product stations, an acrylic seating cluster for the press briefing and a quiet demo bar.',
      'premium', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-ghost', 'table-led-glass', 'fountain-glass-waterfall')),
    C('concept-3', '🌆 Rooftop Press & Partner Evening', 'Evening reception', '/images/zone_lounge_360.jpg',
      'Open-air rooftop evening for press and channel partners: greenery backdrop for interviews, high-tops and a compact demo riser.',
      'essential', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-velvet-armchair', 'table-cocktail', 'fountain-dancing-jets'))
  ],

  trade_show: [
    C('concept-1', '🏢 Hall Centre Stage & Booth Grid', 'Exhibition floor', '/images/india_meeting_360.jpg',
      'Shell-scheme booth grid around a central demo stage with an LED header visible down every aisle, plus a lead-capture desk at each gate.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-folding', 'table-round-standard', 'fountain-steel-sphere')),
    C('concept-2', '🍸 Buyer Lounge & Meeting Pods', 'B2B hosted', '/images/zone_lounge_360.jpg',
      'Hosted-buyer lounge with bookable meeting pods, a greenery divider line for acoustic separation and a bar counter for scheduled slots.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-velvet-armchair', 'table-cocktail', 'fountain-glass-waterfall')),
    C('concept-3', '📦 Compact Pavilion Format', 'Regional pavilion', '/images/zone_entrance_360.jpg',
      'Lean regional pavilion: a single branded header, modular tables for co-exhibitors and folding seating for the theatre corner.',
      'essential', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-folding', 'table-round-standard', 'fountain-tiered-stone'))
  ],

  political: [
    C('concept-1', '📢 Presidential Rally Grounds', 'Mass gathering', '/images/political_presidential_rally_360.jpg',
      'Large-format LED backdrop, armoured glass podium with dual teleprompters, flag array and camera risers on the centre line.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-folding', 'table-round-standard', 'fountain-tiered-stone')),
    C('concept-2', '🏛️ Civic Square Assembly', 'High-security assembly', '/images/india_election_360.jpg',
      'Barricaded civic square with metal-detector gates, an audio mult box on the press riser and a broadcast bay behind the camera line.',
      'premium', S('stage-led-arch', 'backdrop-marigold-garland', 'chair-folding', 'table-cocktail', 'fountain-dancing-jets')),
    C('concept-3', '🎥 Press Conference & Media Meet', 'Broadcast set', '/images/india_meeting_360.jpg',
      'Conference dais with a repeat-logo media backdrop, lapel mic array, satellite truck bay and a fixed two-camera locked-off frame.',
      'essential', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-vvip-executive', 'table-round-standard', 'fountain-tiered-stone'))
  ],

  festival: [
    C('concept-1', '🎵 Main Stage Festival Field', 'Headline scale', '/images/zone_stage_360.jpg',
      'Headline stage with an LED arch, line-array towers and delay stacks for the far field, a front-of-house island and a barricaded pit.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-folding', 'table-cocktail', 'fountain-steel-sphere')),
    C('concept-2', '🌳 Second Stage & Food Village', 'Day programme', '/images/zone_lounge_360.jpg',
      'Timber second stage beside a food village: hedge-wall wind break, rustic communal tables and shaded rest bays between sets.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-folding', 'table-rustic-wood', 'fountain-dancing-jets')),
    C('concept-3', '🔥 Night Arena & Light Show', 'Night spectacle', '/images/zone_banquet_360.jpg',
      'Night arena built around a laser and moving-head package, a mirrored bar ring and an illuminated central water feature as the meeting point.',
      'essential', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-ghost', 'table-led-glass', 'fountain-dancing-jets'))
  ],

  charity_run: [
    C('concept-1', '🏁 Start / Finish Arch Village', 'Race day', '/images/zone_entrance_360.jpg',
      'Inflatable-scale start/finish arch with timing mats, a commentary riser, bib collection lanes and a sponsor step-and-repeat.',
      'signature', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-folding', 'table-round-standard', 'fountain-dancing-jets')),
    C('concept-2', '💧 Route Hydration & Medical Village', 'On-course', '/images/zone_fountain_360.jpg',
      'On-course hydration and medical village: shaded stations at each kilometre marker, a physio bay and a marshal briefing point.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-folding', 'table-rustic-wood', 'fountain-glass-waterfall')),
    C('concept-3', '🎉 Finisher Festival & Awards Lawn', 'Post-race', '/images/zone_lounge_360.jpg',
      'Post-race lawn with a podium riser for the awards, a greenery photo wall for finisher shots and long shaded recovery seating.',
      'essential', S('stage-wooden-riser', 'backdrop-floral-wall', 'chair-folding', 'table-rustic-wood', 'fountain-tiered-stone'))
  ],

  cultural_fair: [
    C('concept-1', '🎨 Heritage Craft Bazaar', 'Artisan market', '/images/india_function_360.jpg',
      'Artisan bazaar along a marigold-dressed spine with a carved pavilion performance stage and a brass lotus water feature at the crossing.',
      'signature', S('stage-royal-pavilion', 'backdrop-marigold-garland', 'chair-folding', 'table-rustic-wood', 'fountain-brass-lotus')),
    C('concept-2', '🪔 Lantern Courtyard Evenings', 'Evening cultural', '/images/zone_lounge_360.jpg',
      'Evening courtyard lit by lanterns and diyas, floor seating around a timber performance riser and a regional food row along one edge.',
      'premium', S('stage-wooden-riser', 'backdrop-hedge-wall', 'chair-folding', 'table-rustic-wood', 'fountain-tiered-stone')),
    C('concept-3', '🎭 Amphitheatre Performance Ground', 'Programmed stage', '/images/zone_stage_360.jpg',
      'Tiered amphitheatre seating facing an LED-backed stage for a rolling dance and music programme, with a wings area for troupe changeovers.',
      'essential', S('stage-led-arch', 'backdrop-shimmer-sequin', 'chair-folding', 'table-round-standard', 'fountain-dancing-jets'))
  ]
};

const FABRICATION_TIER = { signature: 1.35, premium: 1.12, essential: 0.88 };

/* ─────────────────────────────── Component ─────────────────────────────── */

export class CustomEventBriefWizard {
  constructor(containerElement, activeSelections, onApplySelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onApplySelections = onApplySelections;
    this.isOpen = false;
    this.currentStep = 1;
    this.errors = {};
    this.promptFeedback = null;
    this.formData = this.blankForm();
    this.selectedConceptId = 'concept-1';
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  blankForm() {
    const today = new Date().toISOString().split('T')[0];
    return {
      clientName: '',
      category: 'social',
      subCategory: 'reception',
      eventDate: today,
      altDate: '',
      venueState: SELLER_STATE,
      startTime: '10:00',
      endTime: '18:00',
      guestCount: 250,
      targetBudget: '10l_40l',
      religiousSetup: 'mandap-gold',
      bridalPartySize: 12,
      cateringStyle: 'grand-buffet',
      securityLevel: 'secret-service',
      pressArea: 'camera-risers',
      stagePodium: 'bulletproof-podium',
      avTech: 'dual-led-walls',
      exhibitionSetup: 'booths-lounge',
      soundSystem: 'line-array-towers',
      crowdFacilities: 'multi-gate-security',
      styleKeywords: ''
    };
  }

  open({ fresh = false } = {}) {
    this.isOpen = true;
    this.currentStep = 1;
    this.errors = {};
    this.promptFeedback = null;
    if (fresh) {
      this.formData = this.blankForm();
      this.selectedConceptId = 'concept-1';
    }
    document.addEventListener('keydown', this.onKeyDown);
    this.render();
  }

  close() {
    this.isOpen = false;
    document.removeEventListener('keydown', this.onKeyDown);
    this.container.innerHTML = '';
  }

  onKeyDown(e) {
    if (e.key === 'Escape' && this.isOpen) this.close();
  }

  setStep(stepNum) {
    this.currentStep = stepNum;
    this.errors = {};
    this.render();
  }

  // ── Derived values ───────────────────────────────────────────────────────

  calculateTotalHours() {
    const { startTime, endTime } = this.formData;
    if (!startTime || !endTime) return 0;
    const [sH, sM] = startTime.split(':').map(Number);
    const [eH, eM] = endTime.split(':').map(Number);
    if (![sH, sM, eH, eM].every(Number.isFinite)) return 0;
    let diff = (eH + eM / 60) - (sH + sM / 60);
    if (diff < 0) diff += 24;       // crosses midnight
    if (diff === 0) return 0;       // identical times are an error, not 24h
    return Math.round(diff * 10) / 10;
  }

  hoursLabel() {
    const h = this.calculateTotalHours();
    return h > 0 ? `${h} Hours` : '— set start & end';
  }

  bracket() {
    return BUDGET_BRACKETS[this.formData.targetBudget] || BUDGET_BRACKETS['10l_40l'];
  }

  /** The zone/slot/qty/price lines for a concept's selections. */
  designLines(selections) {
    const guests = Math.max(1, Number(this.formData.guestCount) || 1);
    return Object.entries(selections).map(([slotId, itemId]) => {
      const entry = SLOT_INDEX[slotId];
      const item = getItemById(itemId);
      if (!entry || !item) return null;
      const { slot, zoneName } = entry;
      let quantity = slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1;
      // Guest count drives the quantities that legitimately scale with headcount.
      if (slot.category === 'tables') quantity = Math.max(quantity, Math.ceil(guests / 10));
      return {
        slotId, zoneName, slotLabel: slot.label,
        itemId, itemName: item.name, unitPrice: Number(item.price) || 0,
        quantity
      };
    }).filter(Boolean);
  }

  /** Guest seating derived directly from headcount, using the concept's chair. */
  guestSeatingLine(selections) {
    const chairId = selections['slot-stage-seating'];
    const item = getItemById(chairId);
    if (!item) return null;
    const guests = Math.max(1, Number(this.formData.guestCount) || 1);
    return {
      zoneName: 'Guest floor', slotLabel: 'General guest seating',
      itemName: item.name, unitPrice: Number(item.price) || 0, quantity: guests
    };
  }

  /** Services & staffing, driven by hours, headcount, the spec answers and the budget tier. */
  serviceLines() {
    const f = this.formData;
    const guests = Math.max(1, Number(f.guestCount) || 1);
    const hours = Math.max(1, this.calculateTotalHours() || 1);
    const tier = this.bracket().tier;
    const crewBlocks = Math.max(1, Math.ceil(guests / 100));
    const lines = [];

    const perHead = f.category === 'social'
      ? (CATERING_PER_HEAD[f.cateringStyle] ?? DEFAULT_FNB_PER_HEAD.social)
      : DEFAULT_FNB_PER_HEAD[f.category];
    lines.push({
      label: f.category === 'social'
        ? `Catering — ${labelFor('cateringStyle', f.cateringStyle)}`
        : 'Food & beverage service',
      basis: `${formatNumber(guests)} guests × ${formatMoney(Math.round(perHead * tier))}/head`,
      unitPrice: Math.round(perHead * tier), quantity: guests
    });

    lines.push({
      label: 'Event crew & production staffing',
      basis: `${crewBlocks} crew block${crewBlocks > 1 ? 's' : ''} × ${hours}h × ${formatMoney(Math.round(CREW_HOUR_RATE * tier))}/h`,
      unitPrice: Math.round(CREW_HOUR_RATE * tier * crewBlocks), quantity: hours
    });

    const avKey = f.category === 'corporate' ? f.avTech
      : f.category === 'political' ? f.stagePodium
        : f.category === 'public' ? f.soundSystem : null;
    if (avKey) {
      const field = f.category === 'corporate' ? 'avTech' : f.category === 'political' ? 'stagePodium' : 'soundSystem';
      lines.push({
        label: `AV & staging — ${labelFor(field, avKey)}`,
        basis: 'Package rate, budget tier applied',
        unitPrice: Math.round((AV_PACKAGE[avKey] || 200000) * tier), quantity: 1
      });
    } else {
      lines.push({
        label: 'AV, sound & show lighting package',
        basis: 'Standard social package, budget tier applied',
        unitPrice: Math.round(200000 * tier), quantity: 1
      });
    }

    const secKey = f.category === 'political' ? f.securityLevel
      : f.category === 'public' ? f.crowdFacilities : null;
    if (secKey) {
      const field = f.category === 'political' ? 'securityLevel' : 'crowdFacilities';
      lines.push({
        label: `Security & crowd control — ${labelFor(field, secKey)}`,
        basis: 'Package rate, budget tier applied',
        unitPrice: Math.round((SECURITY_PACKAGE[secKey] || 250000) * tier), quantity: 1
      });
    } else {
      lines.push({
        label: 'Security, marshals & access control',
        basis: `${formatNumber(guests)} guests × ${formatMoney(Math.round(350 * tier))}/guest`,
        unitPrice: Math.round(350 * tier), quantity: guests
      });
    }

    if (f.category === 'political') {
      lines.push({
        label: `Press & media — ${labelFor('pressArea', f.pressArea)}`,
        basis: 'Package rate, budget tier applied',
        unitPrice: Math.round((PRESS_PACKAGE[f.pressArea] || 150000) * tier), quantity: 1
      });
    }
    if (f.category === 'corporate') {
      lines.push({
        label: `Exhibition & networking — ${labelFor('exhibitionSetup', f.exhibitionSetup)}`,
        basis: 'Package rate, budget tier applied',
        unitPrice: Math.round((EXHIBITION_PACKAGE[f.exhibitionSetup] || 300000) * tier), quantity: 1
      });
    }
    if (f.category === 'social') {
      const party = Math.max(0, Number(f.bridalPartySize) || 0);
      if (party > 0) {
        lines.push({
          label: `Bridal party & VIP hospitality — ${labelFor('religiousSetup', f.religiousSetup)}`,
          basis: `${party} VIP places × ${formatMoney(Math.round(6500 * tier))}`,
          unitPrice: Math.round(6500 * tier), quantity: party
        });
      }
    }

    return lines;
  }

  /** Full costing for one concept. Concept cards and the brief use this same call. */
  costConcept(concept) {
    const design = this.designLines(concept.selections);
    const seating = this.guestSeatingLine(concept.selections);
    const fabMult = FABRICATION_TIER[concept.tier] ?? 1;

    const designPriced = [...design, ...(seating ? [seating] : [])].map(l => ({
      ...l, unitPrice: Math.round(l.unitPrice * fabMult)
    }));
    const designSubtotal = sumLines(designPriced);

    const services = this.serviceLines();
    const servicesSubtotal = sumLines(services);

    const subtotal = designSubtotal + servicesSubtotal;
    const gst = computeGst(subtotal, this.formData.venueState);
    const grandTotal = subtotal + gst.total;

    const b = this.bracket();
    const fit = grandTotal > b.max ? 'over' : grandTotal < b.min ? 'under' : 'in';

    return { designPriced, designSubtotal, services, servicesSubtotal, subtotal, gst, grandTotal, fit, fabMult };
  }

  // ── Concept generation + keyword style matcher ───────────────────────────

  conceptKey() {
    const { subCategory, category } = this.formData;
    if (CONCEPT_LIBRARY[subCategory]) return subCategory;
    if (category === 'political') return 'political';
    if (CONCEPT_LIBRARY[category]) return category;
    return 'reception';
  }

  /** The three political concepts are shared; lead with the one that matches
   *  the chosen sub-type so the heading and the first card agree. */
  orderConcepts(list) {
    if (this.conceptKey() !== 'political') return list;
    const lead = { rally: 0, town_hall: 1, press_conf: 2 }[this.formData.subCategory] ?? 0;
    if (lead === 0) return list;
    const reordered = [list[lead], ...list.filter((_, i) => i !== lead)];
    // Keep concept-1 / -2 / -3 as the positional ids the selection state uses.
    return reordered.map((c, i) => ({ ...c, id: `concept-${i + 1}` }));
  }

  /**
   * Zone data is owned elsewhere and its allow-lists can change. Never hand
   * the editor an item a slot will not accept — fall back to the slot default.
   */
  sanitizeSelections(selections) {
    const out = {};
    Object.entries(selections).forEach(([slotId, itemId]) => {
      const entry = SLOT_INDEX[slotId];
      if (!entry) return;
      const allowed = entry.slot.allowedItemIds;
      const ok = getItemById(itemId) && (!allowed || allowed.includes(itemId));
      out[slotId] = ok ? itemId : (entry.slot.defaultItemId || allowed?.[0] || itemId);
    });
    return out;
  }

  generateSubEventConcepts() {
    const key = this.conceptKey();
    // Deep-ish clone so keyword overrides never mutate the library.
    const concepts = this.orderConcepts(CONCEPT_LIBRARY[key]).map(c => ({ ...c, selections: { ...c.selections } }));

    const raw = String(this.formData.styleKeywords || '').trim();
    if (!raw) {
      this.promptFeedback = null;
      concepts.forEach(c => { c.selections = this.sanitizeSelections(c.selections); });
      return concepts;
    }

    const text = raw.toLowerCase();
    const matched = [];
    STYLE_RULES.forEach(rule => {
      const hit = rule.keys.find(k => text.includes(k));
      if (!hit) return;
      matched.push({ keyword: hit, note: rule.note });
      concepts.forEach(c => {
        c.description += ` ${rule.note}`;
        if (rule.slot) c.selections[rule.slot[0]] = rule.slot[1];
      });
    });

    this.promptFeedback = { prompt: raw, matched };
    concepts.forEach(c => { c.selections = this.sanitizeSelections(c.selections); });
    return concepts;
  }

  // ── Validation ───────────────────────────────────────────────────────────

  validateStep1() {
    const e = {};
    if (!String(this.formData.clientName).trim()) e.clientName = 'Client or organisation name is required.';
    if (!this.formData.eventDate) e.eventDate = 'Pick an event date.';
    if (this.formData.altDate && this.formData.altDate === this.formData.eventDate) {
      e.altDate = 'The alternate date must differ from the primary date.';
    }
    this.errors = e;
    return Object.keys(e).length === 0;
  }

  validateStep2() {
    const e = {};
    const f = this.formData;
    if (!f.startTime) e.startTime = 'Start time is required.';
    if (!f.endTime) e.endTime = 'End time is required.';
    if (f.startTime && f.endTime && f.startTime === f.endTime) {
      e.endTime = 'Start and end time are identical — set a real duration.';
    } else if (f.startTime && f.endTime && this.calculateTotalHours() <= 0) {
      e.endTime = 'That schedule does not produce a positive duration.';
    }
    const guests = Number(f.guestCount);
    if (!Number.isFinite(guests) || guests < 50 || guests > 5000) {
      e.guestCount = 'Attendance must be between 50 and 5,000.';
    }
    if (f.category === 'social') {
      const party = Number(f.bridalPartySize);
      if (!String(f.bridalPartySize).trim() || !Number.isFinite(party) || party < 2 || party > 100) {
        e.bridalPartySize = 'Bridal / VIP party size must be between 2 and 100.';
      }
    }
    if (!String(f.venueState).trim()) e.venueState = 'Venue state is required for the GST split.';
    this.errors = e;
    return Object.keys(e).length === 0;
  }

  err(field) {
    return this.errors[field]
      ? `<div class="wizard-field-error" role="alert" style="color:#dc2626;font-size:.8rem;margin-top:.3rem;">⚠ ${escapeHtml(this.errors[field])}</div>`
      : '';
  }

  errorSummary() {
    const keys = Object.keys(this.errors);
    if (!keys.length) return '';
    return `
      <div role="alert" style="margin:.9rem 0;padding:.75rem .9rem;border-radius:10px;
             border:1px solid #dc2626;background:rgba(220,38,38,.08);font-size:.86rem;">
        <strong>Fix ${keys.length} field${keys.length > 1 ? 's' : ''} before continuing:</strong>
        <ul style="margin:.4rem 0 0;padding-left:1.1rem;">
          ${keys.map(k => `<li>${escapeHtml(this.errors[k])}</li>`).join('')}
        </ul>
      </div>`;
  }

  // ── Apply / handoff ──────────────────────────────────────────────────────

  applySelectedConcept() {
    const concepts = this.generateSubEventConcepts();
    const chosen = concepts.find(c => c.id === this.selectedConceptId) || concepts[0];

    if (this.onApplySelections && chosen.selections) {
      // theme_panorama travels with the selections so the 360 viewer actually
      // switches to this concept's plate (main.js reads selections.theme_panorama).
      this.onApplySelections(
        { ...chosen.selections, theme_panorama: chosen.panoramaUrl },
        { ...this.formData, totalHours: this.calculateTotalHours(), conceptTitle: chosen.title }
      );
    }
    this.close();
  }

  // ── Event binding ────────────────────────────────────────────────────────

  bindEvents() {
    const overlay = this.container.querySelector('.custom-brief-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => { if (e.target === overlay) this.close(); });
    }

    const btnClose = this.container.querySelector('.btn-close-brief-modal');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    const catCards = this.container.querySelectorAll('.cat-select-card');
    catCards.forEach(card => {
      const choose = () => {
        this.formData.category = card.getAttribute('data-category');
        this.formData.subCategory = SUBS_BY_CATEGORY[this.formData.category][0];
        this.render();
      };
      card.addEventListener('click', choose);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
      });
    });

    this.container.querySelectorAll('[data-bind]').forEach(input => {
      const evt = input.type === 'range' ? 'input' : 'change';
      input.addEventListener(evt, (e) => {
        const field = e.target.getAttribute('data-bind');
        const raw = e.target.value;
        this.formData[field] = e.target.type === 'number' || e.target.type === 'range'
          ? (String(raw).trim() === '' ? '' : Number(raw))
          : raw;

        if (field === 'startTime' || field === 'endTime') {
          const hrsEl = this.container.querySelector('#calculatedHoursDisplay');
          if (hrsEl) hrsEl.textContent = this.hoursLabel();
        }
        if (field === 'guestCount') {
          const guestEl = this.container.querySelector('#guestCountValDisplay');
          if (guestEl) guestEl.textContent = `${formatNumber(this.formData.guestCount || 0)} Guests`;
        }
      });
    });

    const on = (id, fn) => {
      const el = this.container.querySelector(id);
      if (el) el.addEventListener('click', fn);
    };

    on('#btnStep1Next', () => { if (this.validateStep1()) this.setStep(2); else this.render(); });
    on('#btnStep2Back', () => this.setStep(1));
    on('#btnStep2Next', () => { if (this.validateStep2()) this.setStep(3); else this.render(); });
    on('#btnStep3Back', () => this.setStep(2));
    on('#btnStep3Next', () => this.setStep(4));
    on('#btnStep4Back', () => this.setStep(3));
    on('#btnStep4Launch', () => this.applySelectedConcept());
    on('#btnStartFresh', () => { this.formData = this.blankForm(); this.selectedConceptId = 'concept-1'; this.setStep(1); });
    on('#btnPrintBrief', () => this.printBrief());
    on('#btnCopyBrief', () => this.copyBrief());

    const btnMatch = this.container.querySelector('#btnStyleMatch');
    if (btnMatch) {
      btnMatch.addEventListener('click', () => {
        const promptInput = this.container.querySelector('#styleKeywordsInput');
        if (promptInput) this.formData.styleKeywords = promptInput.value.trim();
        this.render();
      });
    }

    const conceptCards = this.container.querySelectorAll('.concept-showcase-card');
    conceptCards.forEach(card => {
      const pick = () => {
        conceptCards.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
        card.classList.add('active');
        card.setAttribute('aria-pressed', 'true');
        this.selectedConceptId = card.getAttribute('data-concept-id');
      };
      card.addEventListener('click', pick);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
      });
    });
  }

  // ── Shared field helpers ─────────────────────────────────────────────────

  select(field, extra = '') {
    return `
      <select class="wizard-input" data-bind="${field}" ${extra}>
        ${OPTIONS[field].map(([v, l]) =>
          `<option value="${escapeHtml(v)}" ${this.formData[field] === v ? 'selected' : ''}>${escapeHtml(l)}</option>`
        ).join('')}
      </select>`;
  }

  // ── Step 1 ───────────────────────────────────────────────────────────────

  renderStep1() {
    const cats = [
      ['social', '💒', 'Social & Marriage', 'Weddings, mandaps, receptions, anniversaries & milestone parties'],
      ['corporate', '💼', 'Corporate & Business', 'Conferences, product launches, keynotes & trade shows'],
      ['political', '🗳️', 'Political & Rallies', 'Rallies, town halls, press conferences & fundraisers'],
      ['public', '🎪', 'Public & Community', 'Festivals, charity runs, live concerts & cultural fairs']
    ];

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 1: Client &amp; event category</h3>
        <p class="step-subtitle">Who the brief is for, when it runs, and which category drives the specification fields.</p>

        ${this.errorSummary()}

        <div class="wizard-section-box">
          <div class="wizard-grid-2col">
            <div class="wizard-form-group wizard-full-col">
              <label class="wizard-label" for="fldClientName">Client / organisation name <span aria-hidden="true">*</span></label>
              <input id="fldClientName" type="text" class="wizard-input" data-bind="clientName"
                     value="${escapeHtml(this.formData.clientName)}" placeholder="e.g. Reddy family · Aurex Technologies Pvt Ltd"
                     ${this.errors.clientName ? 'aria-invalid="true"' : ''} />
              ${this.err('clientName')}
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="fldEventDate">Primary event date <span aria-hidden="true">*</span></label>
              <input id="fldEventDate" type="date" class="wizard-input" data-bind="eventDate"
                     value="${escapeHtml(this.formData.eventDate)}" />
              ${this.err('eventDate')}
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="fldAltDate">Alternate / hold date</label>
              <input id="fldAltDate" type="date" class="wizard-input" data-bind="altDate"
                     value="${escapeHtml(this.formData.altDate)}" />
              ${this.err('altDate')}
            </div>
          </div>
        </div>

        <div class="category-cards-grid mt-3">
          ${cats.map(([key, icon, title, blurb]) => `
            <div class="cat-select-card ${this.formData.category === key ? 'selected' : ''}"
                 data-category="${key}" role="radio" tabindex="0"
                 aria-checked="${this.formData.category === key}" aria-label="${title}">
              <div class="cat-card-icon" aria-hidden="true">${icon}</div>
              <div class="cat-card-info"><h4>${title}</h4><p>${blurb}</p></div>
            </div>
          `).join('')}
        </div>

        <div class="wizard-form-group mt-4">
          <label class="wizard-label" for="fldSubCategory">Specific sub-event type</label>
          <select id="fldSubCategory" class="wizard-input" data-bind="subCategory">
            ${SUBS_BY_CATEGORY[this.formData.category].map(sub =>
              `<option value="${sub}" ${this.formData.subCategory === sub ? 'selected' : ''}>${escapeHtml(SUB_LABELS[sub])} — 3 concepts</option>`
            ).join('')}
          </select>
        </div>

        <div class="wizard-footer-actions">
          <button class="wizard-btn wizard-btn-secondary" id="btnStartFresh" type="button">↺ Start fresh</button>
          <button class="wizard-btn wizard-btn-primary" id="btnStep1Next" type="button">
            Next: event details ➔
          </button>
        </div>
      </div>
    `;
  }

  // ── Step 2 ───────────────────────────────────────────────────────────────

  renderStep2() {
    const f = this.formData;
    const isSocial = f.category === 'social';
    const isPolitical = f.category === 'political';
    const isCorporate = f.category === 'corporate';

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 2: Event specifications</h3>
        <p class="step-subtitle">
          Details for <strong>${escapeHtml(SUB_LABELS[f.subCategory] || f.subCategory)}</strong>
          (${escapeHtml(CATEGORY_LABELS[f.category])}). Every field here appears in the brief and priced quote.
        </p>

        ${this.errorSummary()}

        <div class="wizard-section-box">
          <h4 class="section-box-title">
            ${isSocial ? '💒 Ceremony & hospitality requirements'
              : isPolitical ? '🗳️ Rally, security & press requirements'
              : isCorporate ? '💼 Corporate AV & exhibition setup'
              : '🎪 Festival sound & crowd setup'}
          </h4>

          <div class="wizard-grid-2col">
            ${isSocial ? `
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldReligiousSetup">Ceremony / cultural space</label>
                ${this.select('religiousSetup', 'id="fldReligiousSetup"')}
              </div>
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldBridalParty">Bridal party &amp; VIP seating size</label>
                <input id="fldBridalParty" type="number" class="wizard-input"
                       value="${escapeHtml(f.bridalPartySize)}" min="2" max="100" step="1"
                       data-bind="bridalPartySize" ${this.errors.bridalPartySize ? 'aria-invalid="true"' : ''} />
                ${this.err('bridalPartySize')}
              </div>
              <div class="wizard-form-group wizard-full-col">
                <label class="wizard-label" for="fldCatering">Catering &amp; dining style</label>
                ${this.select('cateringStyle', 'id="fldCatering"')}
              </div>
            ` : isPolitical ? `
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldSecurity">Security &amp; barrier clearance</label>
                ${this.select('securityLevel', 'id="fldSecurity"')}
              </div>
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldPress">Press &amp; media setup</label>
                ${this.select('pressArea', 'id="fldPress"')}
              </div>
              <div class="wizard-form-group wizard-full-col">
                <label class="wizard-label" for="fldPodium">Stage &amp; podium specification</label>
                ${this.select('stagePodium', 'id="fldPodium"')}
              </div>
            ` : isCorporate ? `
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldAv">Presentation AV tech</label>
                ${this.select('avTech', 'id="fldAv"')}
              </div>
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldExhibition">Exhibition &amp; networking</label>
                ${this.select('exhibitionSetup', 'id="fldExhibition"')}
              </div>
            ` : `
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldSound">Main stage sound system</label>
                ${this.select('soundSystem', 'id="fldSound"')}
              </div>
              <div class="wizard-form-group">
                <label class="wizard-label" for="fldCrowd">Crowd control &amp; facilities</label>
                ${this.select('crowdFacilities', 'id="fldCrowd"')}
              </div>
            `}
          </div>
        </div>

        <div class="wizard-section-box mt-3">
          <h4 class="section-box-title">🌐 Schedule, capacity &amp; budget</h4>
          <div class="wizard-grid-2col">
            <div class="wizard-form-group">
              <label class="wizard-label" for="fldStart">Event start time <span aria-hidden="true">*</span></label>
              <input id="fldStart" type="time" class="wizard-input" value="${escapeHtml(f.startTime)}" data-bind="startTime" />
              ${this.err('startTime')}
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="fldEnd">Event end time <span aria-hidden="true">*</span></label>
              <input id="fldEnd" type="time" class="wizard-input" value="${escapeHtml(f.endTime)}" data-bind="endTime" />
              ${this.err('endTime')}
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="calculatedHoursDisplay">Total duration</label>
              <div class="wizard-readout-pill" id="calculatedHoursDisplay">${this.hoursLabel()}</div>
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label" for="fldVenueState">Venue state (sets the GST split)</label>
              <input id="fldVenueState" type="text" class="wizard-input" value="${escapeHtml(f.venueState)}"
                     data-bind="venueState" placeholder="e.g. Telangana" />
              ${this.err('venueState')}
            </div>

            <div class="wizard-form-group wizard-full-col">
              <label class="wizard-label" for="fldBudget">Target budget bracket</label>
              <select id="fldBudget" class="wizard-input" data-bind="targetBudget">
                ${Object.entries(BUDGET_BRACKETS).map(([v, b]) =>
                  `<option value="${v}" ${f.targetBudget === v ? 'selected' : ''}>${escapeHtml(b.label)}</option>`
                ).join('')}
              </select>
              <p style="font-size:.78rem;opacity:.75;margin:.35rem 0 0;">
                The bracket sets the specification tier — catering, staffing, AV and security rates all scale with it,
                and any concept that lands outside the bracket is flagged on its card.
              </p>
            </div>

            <div class="wizard-form-group wizard-full-col">
              <label class="wizard-label" for="fldGuests">
                Estimated attendance:
                <span id="guestCountValDisplay" class="text-gold">${formatNumber(f.guestCount || 0)} Guests</span>
              </label>
              <input id="fldGuests" type="range" class="wizard-range-slider" min="50" max="5000" step="50"
                     value="${Number(f.guestCount) || 50}" data-bind="guestCount"
                     aria-describedby="guestCountValDisplay" />
              ${this.err('guestCount')}
            </div>
          </div>
        </div>

        <div class="wizard-footer-actions">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep2Back" type="button">⬅️ Back to category</button>
          <button class="wizard-btn wizard-btn-primary" id="btnStep2Next" type="button">Next: 360° concepts ➔</button>
        </div>
      </div>
    `;
  }

  // ── Step 3 ───────────────────────────────────────────────────────────────

  renderStep3() {
    const f = this.formData;
    const concepts = this.generateSubEventConcepts();
    if (!concepts.some(c => c.id === this.selectedConceptId)) this.selectedConceptId = concepts[0].id;
    const b = this.bracket();

    const fb = this.promptFeedback;
    const feedbackHtml = !fb ? '' : (fb.matched.length ? `
      <div style="margin-top:.7rem;font-size:.83rem;" role="status">
        <strong>Matched ${fb.matched.length} style keyword${fb.matched.length > 1 ? 's' : ''}</strong>
        in “${escapeHtml(fb.prompt)}” — applied to all three concepts:
        <div style="display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.45rem;">
          ${fb.matched.map(m => `
            <span style="padding:.2rem .55rem;border-radius:999px;border:1px solid currentColor;
                         opacity:.85;font-size:.78rem;" title="${escapeHtml(m.note)}">
              ${escapeHtml(m.keyword)}
            </span>`).join('')}
        </div>
      </div>` : `
      <div style="margin-top:.7rem;font-size:.83rem;color:#b45309;" role="status">
        No style keyword matched “${escapeHtml(fb.prompt)}”. This matcher understands colours
        (violet, emerald, blush), florals (marigold, orchid, hedge), materials (velvet, crystal,
        acrylic, timber), lighting (chandelier, fairy lights, laser, lanterns), structures
        (mandap, LED wall), sound (line array, DJ) and extras (red carpet, fountain, pyro, photo booth).
      </div>`);

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 3: Three 360° concepts for ${escapeHtml(SUB_LABELS[f.subCategory] || f.subCategory)}</h3>
        <p class="step-subtitle">
          Priced against your ${formatNumber(f.guestCount)} guests, ${this.calculateTotalHours()}h schedule and
          <strong>${escapeHtml(b.label)}</strong> bracket. Totals include ${Math.round(GST_RATE * 100)}% GST and
          match the brief in step 4 exactly.
        </p>

        <div class="ai-prompt-bar-box">
          <div class="ai-prompt-input-row">
            <span class="ai-sparkle-icon" aria-hidden="true">🎨</span>
            <label style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;" for="styleKeywordsInput">Style keywords</label>
            <input type="text" id="styleKeywordsInput" class="ai-prompt-input"
                   placeholder="Style keywords, e.g. 'deep violet lighting, marigold entrance, red carpet'"
                   value="${escapeHtml(f.styleKeywords)}" />
            <button class="wizard-btn wizard-btn-ai" id="btnStyleMatch" type="button">
              🎨 Apply style keywords
            </button>
          </div>
          <p style="font-size:.78rem;opacity:.75;margin:.5rem 0 0;">
            <strong>Keyword Style Matcher</strong> — a deterministic colour / material / mood keyword match
            against the item catalogue. Not a language model; it only recognises the vocabulary listed below.
          </p>
          ${feedbackHtml}
        </div>

        <div class="concepts-grid-3col">
          ${concepts.map(c => {
            const cost = this.costConcept(c);
            const flag = cost.fit === 'over'
              ? `<span style="color:#dc2626;font-size:.76rem;">⚠ Over your ${escapeHtml(b.label)} bracket</span>`
              : cost.fit === 'under'
                ? `<span style="color:#0369a1;font-size:.76rem;">↓ Below bracket — room to upgrade</span>`
                : `<span style="color:#15803d;font-size:.76rem;">✓ Within your budget bracket</span>`;
            return `
            <div class="concept-showcase-card ${this.selectedConceptId === c.id ? 'active' : ''}"
                 data-concept-id="${c.id}" role="button" tabindex="0"
                 aria-pressed="${this.selectedConceptId === c.id}"
                 aria-label="${escapeHtml(c.title)}, estimated ${formatMoney(cost.grandTotal)}">
              <div class="concept-badge-pill">${escapeHtml(c.badge)}</div>
              <div class="concept-img-wrapper">
                <img src="${escapeHtml(c.panoramaUrl)}" alt="360° preview plate for ${escapeHtml(c.title)}" class="concept-img" loading="lazy" />
                <span class="view-360-tag">🌀 360° preview</span>
              </div>
              <div class="concept-card-body">
                <h4 class="concept-title">${escapeHtml(c.title)}</h4>
                <p class="concept-desc">${escapeHtml(c.description)}</p>
                <div class="concept-price-row">
                  <span class="price-label">Est. total (incl. GST):</span>
                  <span class="price-val">${formatMoney(cost.grandTotal)}</span>
                </div>
                <div style="margin-top:.35rem;">${flag}</div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <div class="wizard-footer-actions mt-3">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep3Back" type="button">⬅️ Back to details</button>
          <button class="wizard-btn wizard-btn-primary" id="btnStep3Next" type="button">Next: generate event brief ➔</button>
        </div>
      </div>
    `;
  }

  // ── Step 4: the Event Brief document ─────────────────────────────────────

  chosenConcept() {
    const concepts = this.generateSubEventConcepts();
    return concepts.find(c => c.id === this.selectedConceptId) || concepts[0];
  }

  /** Inline styles only — this markup is also written into a print iframe. */
  buildBriefHtml() {
    const f = this.formData;
    const concept = this.chosenConcept();
    const cost = this.costConcept(concept);
    const hours = this.calculateTotalHours();
    const b = this.bracket();
    const gst = cost.gst;

    const th = 'text-align:left;padding:8px 10px;border-bottom:2px solid #999;font-size:12px;text-transform:uppercase;letter-spacing:.04em;';
    const td = 'padding:8px 10px;border-bottom:1px solid #ddd;font-size:13px;vertical-align:top;';
    const tdN = td + 'text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;';
    const h2 = 'font-size:15px;margin:22px 0 8px;padding-bottom:5px;border-bottom:1px solid #bbb;text-transform:uppercase;letter-spacing:.06em;';
    const dt = 'font-size:11px;text-transform:uppercase;letter-spacing:.05em;opacity:.6;';
    const dd = 'font-size:14px;font-weight:600;margin:2px 0 12px;';

    const field = (label, value) => `<div><div style="${dt}">${escapeHtml(label)}</div><div style="${dd}">${escapeHtml(value)}</div></div>`;

    const specRows = cost.designPriced.map(l => `
      <tr>
        <td style="${td}">${escapeHtml(l.zoneName)}</td>
        <td style="${td}">${escapeHtml(l.slotLabel)}</td>
        <td style="${td}">${escapeHtml(l.itemName)}</td>
        <td style="${tdN}">${formatNumber(l.quantity)}</td>
        <td style="${tdN}">${formatMoney(l.unitPrice)}</td>
        <td style="${tdN}">${formatMoney(Math.round(l.unitPrice * l.quantity))}</td>
      </tr>`).join('');

    const serviceRows = cost.services.map(l => `
      <tr>
        <td style="${td}" colspan="3"><strong>${escapeHtml(l.label)}</strong><br>
          <span style="font-size:11.5px;opacity:.65;">${escapeHtml(l.basis)}</span></td>
        <td style="${tdN}">${formatNumber(l.quantity)}</td>
        <td style="${tdN}">${formatMoney(l.unitPrice)}</td>
        <td style="${tdN}">${formatMoney(Math.round(l.unitPrice * l.quantity))}</td>
      </tr>`).join('');

    // Category-specific requirement list, so nothing collected is discarded.
    const reqs = [];
    if (f.category === 'social') {
      reqs.push(['Ceremony space', labelFor('religiousSetup', f.religiousSetup)]);
      reqs.push(['Catering style', labelFor('cateringStyle', f.cateringStyle)]);
      reqs.push(['Bridal / VIP party', `${formatNumber(f.bridalPartySize)} places`]);
      reqs.push(['Security', `Marshals & access control sized for ${formatNumber(f.guestCount)} guests`]);
      reqs.push(['AV & sound', 'Standard social package — show lighting, PA, wireless handhelds']);
    } else if (f.category === 'political') {
      reqs.push(['Security clearance', labelFor('securityLevel', f.securityLevel)]);
      reqs.push(['Press & media', labelFor('pressArea', f.pressArea)]);
      reqs.push(['Stage & podium', labelFor('stagePodium', f.stagePodium)]);
      reqs.push(['Catering', `Water & light refreshment for ${formatNumber(f.guestCount)} attendees`]);
    } else if (f.category === 'corporate') {
      reqs.push(['Presentation AV', labelFor('avTech', f.avTech)]);
      reqs.push(['Exhibition & networking', labelFor('exhibitionSetup', f.exhibitionSetup)]);
      reqs.push(['Catering', `Delegate F&B for ${formatNumber(f.guestCount)} — arrival tea, lunch, evening service`]);
      reqs.push(['Security', 'Badge-controlled access with marshals at each hall entrance']);
    } else {
      reqs.push(['Main stage sound', labelFor('soundSystem', f.soundSystem)]);
      reqs.push(['Crowd control & facilities', labelFor('crowdFacilities', f.crowdFacilities)]);
      reqs.push(['Catering', `Food court concessions sized for ${formatNumber(f.guestCount)} attendees`]);
      reqs.push(['Security', 'Perimeter marshals, gate screening and a medical post']);
    }

    const promptLine = this.promptFeedback?.matched?.length
      ? `<p style="font-size:13px;margin:6px 0 0;"><strong>Client style notes applied:</strong>
           ${escapeHtml(this.promptFeedback.matched.map(m => m.keyword).join(', '))}</p>`
      : '';

    const budgetVerdict = cost.fit === 'over'
      ? `This estimate sits above the stated ${b.label} bracket. Options to bring it in range are listed under Assumptions.`
      : cost.fit === 'under'
        ? `This estimate sits below the stated ${b.label} bracket, leaving headroom for upgrades.`
        : `This estimate sits within the stated ${b.label} bracket.`;

    return `
      <div style="font-family:Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fff;
                  max-width:820px;margin:0 auto;padding:28px 32px;line-height:1.5;">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;
                    border-bottom:3px solid #1a1a1a;padding-bottom:10px;">
          <div>
            <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;opacity:.65;">Helm Events</div>
            <h1 style="font-size:26px;margin:4px 0 0;">Event Brief &amp; Preliminary Estimate</h1>
          </div>
          <div style="text-align:right;font-size:11.5px;opacity:.7;">
            Prepared ${escapeHtml(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }))}<br>
            Ref HE-${escapeHtml(String(f.eventDate).replace(/-/g, ''))}-${escapeHtml(String(f.subCategory).slice(0, 4).toUpperCase())}
          </div>
        </div>

        <h2 style="${h2}">1 · Client &amp; event</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 20px;">
          ${field('Client', f.clientName || '—')}
          ${field('Category', CATEGORY_LABELS[f.category])}
          ${field('Event type', SUB_LABELS[f.subCategory] || f.subCategory)}
          ${field('Primary date', f.eventDate || '—')}
          ${field('Alternate / hold date', f.altDate || 'Not held')}
          ${field('Venue state', f.venueState)}
        </div>

        <h2 style="${h2}">2 · Schedule &amp; capacity</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0 20px;">
          ${field('Start', f.startTime)}
          ${field('End', f.endTime)}
          ${field('Total duration', `${hours} hours`)}
          ${field('Expected attendance', `${formatNumber(f.guestCount)} guests`)}
          ${field('Budget bracket', b.label)}
          ${field('Specification tier', `${Math.round(b.tier * 100)}% of standard rates`)}
        </div>

        <h2 style="${h2}">3 · Selected design concept</h2>
        <p style="font-size:15px;font-weight:700;margin:0;">${escapeHtml(concept.title)}
          <span style="font-size:12px;font-weight:400;opacity:.65;">· ${escapeHtml(concept.badge)}</span></p>
        <p style="font-size:13.5px;margin:6px 0 0;">${escapeHtml(concept.description)}</p>
        ${promptLine}

        <h2 style="${h2}">4 · Zone-by-zone design specification</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${th}">Zone</th><th style="${th}">Position</th><th style="${th}">Specified item</th>
            <th style="${th}text-align:right;">Qty</th><th style="${th}text-align:right;">Unit</th>
            <th style="${th}text-align:right;">Line total</th>
          </tr></thead>
          <tbody>
            ${specRows}
            <tr><td style="${td}" colspan="5"><strong>Design, rentals &amp; fabrication subtotal</strong>
              <br><span style="font-size:11.5px;opacity:.65;">Includes the ${escapeHtml(concept.tier)}-tier fabrication factor of ×${cost.fabMult}</span></td>
              <td style="${tdN}"><strong>${formatMoney(cost.designSubtotal)}</strong></td></tr>
          </tbody>
        </table>

        <h2 style="${h2}">5 · Services, staffing &amp; requirements</h2>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${th}" colspan="3">Service line</th>
            <th style="${th}text-align:right;">Qty</th><th style="${th}text-align:right;">Unit</th>
            <th style="${th}text-align:right;">Line total</th>
          </tr></thead>
          <tbody>
            ${serviceRows}
            <tr><td style="${td}" colspan="5"><strong>Services subtotal</strong></td>
              <td style="${tdN}"><strong>${formatMoney(cost.servicesSubtotal)}</strong></td></tr>
          </tbody>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tbody>
            ${reqs.map(([k, v]) => `<tr>
              <td style="${td}width:32%;"><strong>${escapeHtml(k)}</strong></td>
              <td style="${td}" colspan="5">${escapeHtml(v)}</td></tr>`).join('')}
          </tbody>
        </table>

        <h2 style="${h2}">6 · Estimate summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tbody>
            <tr><td style="${td}">Design, rentals &amp; fabrication</td><td style="${tdN}">${formatMoney(cost.designSubtotal)}</td></tr>
            <tr><td style="${td}">Services &amp; staffing</td><td style="${tdN}">${formatMoney(cost.servicesSubtotal)}</td></tr>
            <tr><td style="${td}"><strong>Taxable subtotal</strong></td><td style="${tdN}"><strong>${formatMoney(cost.subtotal)}</strong></td></tr>
            ${gst.intraState
              ? `<tr><td style="${td}">CGST @ ${(GST_RATE * 50).toFixed(0)}%</td><td style="${tdN}">${formatMoney(gst.cgst)}</td></tr>
                 <tr><td style="${td}">SGST @ ${(GST_RATE * 50).toFixed(0)}%</td><td style="${tdN}">${formatMoney(gst.sgst)}</td></tr>`
              : `<tr><td style="${td}">IGST @ ${(GST_RATE * 100).toFixed(0)}%</td><td style="${tdN}">${formatMoney(gst.igst)}</td></tr>`}
            <tr><td style="${td}font-size:16px;"><strong>Estimated total payable</strong></td>
                <td style="${tdN}font-size:16px;"><strong>${formatMoney(cost.grandTotal)}</strong></td></tr>
          </tbody>
        </table>
        <p style="font-size:13px;margin-top:8px;">${escapeHtml(budgetVerdict)}</p>

        <h2 style="${h2}">7 · Assumptions &amp; exclusions</h2>
        <ul style="font-size:13px;margin:0;padding-left:18px;">
          <li>Preliminary estimate based on the details captured in this wizard. Not a contract, quotation or tax invoice.</li>
          <li>Quantities scale with the ${formatNumber(f.guestCount)}-guest figure; dining tables are sized at ten covers each and confirmed against the final floor plan.</li>
          <li>Rates reflect the ${escapeHtml(b.label)} specification tier (${Math.round(b.tier * 100)}% of standard). Changing the bracket re-prices services and staffing.</li>
          <li>GST is charged at ${(GST_RATE * 100).toFixed(0)}%, split ${gst.intraState ? 'CGST/SGST (intra-state supply)' : 'as IGST (inter-state supply)'} based on the venue state of ${escapeHtml(f.venueState)}.</li>
          <li>Excluded unless separately agreed: venue hire and municipal charges, statutory permits and licences (including any pyrotechnic or drone clearance), performer and artist fees, alcohol and its licensing, guest travel and accommodation, and overtime beyond the ${hours}-hour window.</li>
          <li>Panorama plates are representative renders of the concept; final finishes depend on stock and supplier availability at the time of confirmation.</li>
          <li>The estimate is valid for 14 days and is subject to a site survey.</li>
        </ul>

        <p style="font-size:11.5px;opacity:.6;margin-top:22px;border-top:1px solid #ccc;padding-top:8px;">
          Helm Events · Prepared for ${escapeHtml(f.clientName || 'the client')} · All amounts in Indian rupees.
        </p>
      </div>`;
  }

  /** Plain-text mirror of the brief, for the clipboard. */
  buildBriefText() {
    const f = this.formData;
    const concept = this.chosenConcept();
    const cost = this.costConcept(concept);
    const b = this.bracket();
    const L = [];
    L.push('HELM EVENTS — EVENT BRIEF & PRELIMINARY ESTIMATE');
    L.push('='.repeat(56));
    L.push(`Client: ${f.clientName || '—'}`);
    L.push(`Event: ${SUB_LABELS[f.subCategory] || f.subCategory} (${CATEGORY_LABELS[f.category]})`);
    L.push(`Date: ${f.eventDate}${f.altDate ? `  |  Alternate: ${f.altDate}` : ''}`);
    L.push(`Schedule: ${f.startTime}–${f.endTime} (${this.calculateTotalHours()} hours)`);
    L.push(`Attendance: ${formatNumber(f.guestCount)} guests`);
    L.push(`Venue state: ${f.venueState}   Budget bracket: ${b.label}`);
    L.push('');
    L.push(`CONCEPT: ${concept.title} — ${concept.badge}`);
    L.push(concept.description);
    L.push('');
    L.push('DESIGN SPECIFICATION');
    cost.designPriced.forEach(l => {
      L.push(`  ${l.zoneName} / ${l.slotLabel}: ${l.itemName} × ${formatNumber(l.quantity)} @ ${formatMoney(l.unitPrice)} = ${formatMoney(Math.round(l.unitPrice * l.quantity))}`);
    });
    L.push(`  Design subtotal: ${formatMoney(cost.designSubtotal)}`);
    L.push('');
    L.push('SERVICES & STAFFING');
    cost.services.forEach(l => {
      L.push(`  ${l.label} (${l.basis}) = ${formatMoney(Math.round(l.unitPrice * l.quantity))}`);
    });
    L.push(`  Services subtotal: ${formatMoney(cost.servicesSubtotal)}`);
    L.push('');
    L.push(`Taxable subtotal: ${formatMoney(cost.subtotal)}`);
    L.push(cost.gst.intraState
      ? `CGST: ${formatMoney(cost.gst.cgst)}   SGST: ${formatMoney(cost.gst.sgst)}`
      : `IGST: ${formatMoney(cost.gst.igst)}`);
    L.push(`ESTIMATED TOTAL PAYABLE: ${formatMoney(cost.grandTotal)}`);
    L.push('');
    L.push('Preliminary estimate — not a contract or tax invoice. Excludes venue hire,');
    L.push('permits, artist fees, alcohol licensing, guest travel and overtime.');
    return L.join('\n');
  }

  renderStep4() {
    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 4: Event brief</h3>
        <p class="step-subtitle">
          Generated from everything captured in steps 1–3. Copy it into an email, print it to PDF,
          or apply the concept and continue into the 3D editor.
        </p>

        <div class="wizard-footer-actions" style="justify-content:flex-start;gap:.6rem;margin-bottom:1rem;">
          <button class="wizard-btn wizard-btn-secondary" id="btnCopyBrief" type="button">📋 Copy brief text</button>
          <button class="wizard-btn wizard-btn-secondary" id="btnPrintBrief" type="button">🖨️ Print / save as PDF</button>
          <span id="briefActionStatus" role="status" aria-live="polite" style="font-size:.83rem;opacity:.8;"></span>
        </div>

        <div id="briefDocument" style="max-height:58vh;overflow:auto;border:1px solid rgba(128,128,128,.35);
             border-radius:12px;background:#fff;color:#1a1a1a;">
          ${this.buildBriefHtml()}
        </div>

        <div class="wizard-footer-actions mt-3">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep4Back" type="button">⬅️ Back to concepts</button>
          <button class="wizard-btn wizard-btn-success" id="btnStep4Launch" type="button">
            🚀 Apply concept &amp; open the 3D editor ➔
          </button>
        </div>
      </div>
    `;
  }

  setBriefStatus(msg) {
    const el = this.container.querySelector('#briefActionStatus');
    if (el) el.textContent = msg;
  }

  async copyBrief() {
    const text = this.buildBriefText();
    try {
      await navigator.clipboard.writeText(text);
      this.setBriefStatus('✅ Brief copied to the clipboard.');
    } catch {
      this.setBriefStatus('Clipboard unavailable — select the brief below and copy manually.');
    }
  }

  /** Print through a throwaway iframe inside our own container — document.body untouched. */
  printBrief() {
    const host = this.container.querySelector('.custom-brief-modal-card') || this.container;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.setAttribute('title', 'Event brief print view');
    frame.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;';
    host.appendChild(frame);

    const cleanup = () => { if (frame.parentNode) frame.parentNode.removeChild(frame); };

    try {
      const doc = frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html><head><meta charset="utf-8">
        <title>Helm Events — Event Brief</title>
        <style>@page{margin:14mm;} body{margin:0;background:#fff;} table{page-break-inside:auto;} tr{page-break-inside:avoid;}</style>
        </head><body>${this.buildBriefHtml()}</body></html>`);
      doc.close();
      const win = frame.contentWindow;
      win.focus();
      win.print();
      this.setBriefStatus('🖨️ Print dialog opened.');
      setTimeout(cleanup, 1500);
    } catch {
      cleanup();
      this.setBriefStatus('Printing was blocked by the browser — use the copy button instead.');
    }
  }

  // ── Shell ────────────────────────────────────────────────────────────────

  render() {
    const steps = [
      [1, 'Client & category'],
      [2, 'Specifications'],
      [3, '360° concepts'],
      [4, 'Event brief']
    ];

    const body = this.currentStep === 1 ? this.renderStep1()
      : this.currentStep === 2 ? this.renderStep2()
        : this.currentStep === 3 ? this.renderStep3()
          : this.renderStep4();

    this.container.innerHTML = `
      <div class="custom-brief-modal-overlay">
        <div class="custom-brief-modal-card" role="dialog" aria-modal="true" aria-label="Custom event brief wizard">
          <div class="wizard-header">
            <div class="wizard-header-title">
              <h2>📋 Custom event brief &amp; 360° studio setup</h2>
              <span class="wizard-subtitle">4-step planning wizard — ends in a printable brief</span>
            </div>
            <button class="btn-close-brief-modal" type="button" aria-label="Close wizard">✕</button>
          </div>

          <div class="wizard-progress-tracker">
            ${steps.map(([n, name], i) => `
              ${i > 0 ? `<div class="progress-line ${this.currentStep >= n ? 'active' : ''}"></div>` : ''}
              <div class="progress-step-item ${this.currentStep >= n ? 'active' : ''}"
                   aria-current="${this.currentStep === n ? 'step' : 'false'}">
                <span class="step-num">${n}</span>
                <span class="step-name">${name}</span>
              </div>
            `).join('')}
          </div>

          ${body}
        </div>
      </div>
    `;

    this.bindEvents();

    const firstInvalid = this.container.querySelector('[aria-invalid="true"]');
    if (firstInvalid) firstInvalid.focus();
  }
}
