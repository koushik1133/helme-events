export const VENUE_ZONES = [
  {
    id: 'zone-stage',
    name: 'Main Stage Lawn',
    subtitle: 'Concert & Keynote Stage Setup',
    mapPos: { x: 52, y: 44 },
    panoramaUrl: '/images/zone_stage_360.jpg',
    thumbnailUrl: '/images/zone_stage_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-fountain', label: 'Garden Fountain Plaza', icon: '⛲', yaw: 180, pitch: -28 },
      { targetZoneId: 'zone-banquet', label: 'Royal Banquet Ballroom', icon: '🏰', yaw: 135, pitch: -28 },
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: -135, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-stage-main',
        label: 'Stage Setup',
        category: 'stages',
        quantity: 1,
        defaultItemId: 'stage-led-arch',
        pos3D: { pitch: -5, yaw: 0 }
      },
      {
        id: 'slot-stage-backdrop',
        label: 'Stage Backdrop',
        category: 'backdrops',
        quantity: 1,
        defaultItemId: 'backdrop-shimmer-sequin',
        pos3D: { pitch: 10, yaw: 0 }
      },
      {
        id: 'slot-stage-seating',
        label: 'VIP Front Row Seating',
        category: 'chairs',
        quantity: 20,
        defaultItemId: 'chair-chiavari-gold',
        pos3D: { pitch: -25, yaw: -15 }
      }
    ]
  },
  {
    id: 'zone-banquet',
    name: 'Royal Banquet Ballroom',
    subtitle: 'Dining & Gala Reception',
    mapPos: { x: 82, y: 78 },
    panoramaUrl: '/images/zone_banquet_360.jpg',
    thumbnailUrl: '/images/zone_banquet_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-stage', label: 'Main Stage Lawn', icon: '🎭', yaw: -45, pitch: -28 },
      { targetZoneId: 'zone-kitchen', label: 'Gourmet Chef Kitchen', icon: '🍳', yaw: 90, pitch: -28 },
      { targetZoneId: 'zone-entrance', label: 'Entrance Arch Foyer', icon: '⛩️', yaw: -135, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-banquet-table',
        label: 'Guest Dining Tables',
        category: 'tables',
        quantity: 12,
        defaultItemId: 'table-round-standard',
        pos3D: { pitch: -18, yaw: 45 }
      },
      {
        id: 'slot-banquet-chairs',
        label: 'Guest Chairs',
        category: 'chairs',
        quantity: 120,
        defaultItemId: 'chair-chiavari-gold',
        pos3D: { pitch: -22, yaw: -45 }
      },
      {
        id: 'slot-banquet-lighting',
        label: 'Overhead Lighting',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-chandeliers',
        pos3D: { pitch: 35, yaw: 0 }
      }
    ]
  },
  {
    id: 'zone-fountain',
    name: 'Garden Fountain Plaza',
    subtitle: 'Outdoor Cocktail & Water Feature',
    mapPos: { x: 58, y: 72 },
    panoramaUrl: '/images/zone_fountain_360.jpg',
    thumbnailUrl: '/images/zone_fountain_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-stage', label: 'Main Stage Lawn', icon: '🎭', yaw: 0, pitch: -28 },
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: 90, pitch: -28 },
      { targetZoneId: 'zone-lounge', label: 'VIP Lounge Terrace', icon: '🍷', yaw: -90, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-fountain-center',
        label: 'Center Fountain Feature',
        category: 'fountains',
        quantity: 1,
        defaultItemId: 'fountain-royal-marble',
        pos3D: { pitch: -10, yaw: 0 }
      },
      {
        id: 'slot-fountain-lighting',
        label: 'Plaza Atmosphere Lighting',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-fairy-canopy',
        pos3D: { pitch: 25, yaw: 90 }
      }
    ]
  },
  {
    id: 'zone-lounge',
    name: 'VIP Lounge Terrace',
    subtitle: 'Executive Outdoor Cocktail Bar',
    mapPos: { x: 18, y: 64 },
    panoramaUrl: '/images/zone_lounge_360.jpg',
    thumbnailUrl: '/images/zone_lounge_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: 70, pitch: -28 },
      { targetZoneId: 'zone-fountain', label: 'Garden Fountain Plaza', icon: '⛲', yaw: -110, pitch: -28 },
      { targetZoneId: 'zone-bedroom', label: 'Master Bedroom Suite', icon: '🛏️', yaw: 160, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-lounge-table',
        label: 'High-Top Cocktail Tables',
        category: 'tables',
        quantity: 8,
        defaultItemId: 'table-cocktail',
        pos3D: { pitch: -15, yaw: -30 }
      },
      {
        id: 'slot-lounge-seating',
        label: 'Lounge Armchairs',
        category: 'chairs',
        quantity: 16,
        defaultItemId: 'chair-velvet-armchair',
        pos3D: { pitch: -20, yaw: 30 }
      },
      {
        id: 'slot-lounge-lighting',
        label: 'Ambient Uplighting',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-rgb-uplighting',
        pos3D: { pitch: 15, yaw: -120 }
      }
    ]
  },
  {
    id: 'zone-entrance',
    name: 'Entrance Arch & Photo Wall',
    subtitle: 'Red Carpet Welcome Foyer',
    mapPos: { x: 32, y: 26 },
    panoramaUrl: '/images/zone_entrance_360.jpg',
    thumbnailUrl: '/images/zone_entrance_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: 0, pitch: -28 },
      { targetZoneId: 'zone-banquet', label: 'Royal Banquet Ballroom', icon: '🏰', yaw: 120, pitch: -28 },
      { targetZoneId: 'zone-fountain', label: 'Garden Fountain Plaza', icon: '⛲', yaw: -120, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-entrance-arch',
        label: 'Welcome Floral Arch Wall',
        category: 'backdrops',
        quantity: 1,
        defaultItemId: 'backdrop-floral-wall',
        pos3D: { pitch: 2, yaw: -65 }
      },
      {
        id: 'slot-entrance-water',
        label: 'Foyer Water Feature',
        category: 'fountains',
        quantity: 1,
        defaultItemId: 'fountain-glass-waterfall',
        pos3D: { pitch: -4, yaw: 60 }
      },
      {
        id: 'slot-entrance-seating',
        label: 'Reception Ghost Chairs',
        category: 'chairs',
        quantity: 8,
        defaultItemId: 'chair-ghost',
        pos3D: { pitch: -25, yaw: -140 }
      }
    ]
  },

  // 🏡 NEW ROOMS: BEDROOM, LIVING ROOM, KITCHEN
  {
    id: 'zone-living',
    name: 'Executive Living Room',
    subtitle: 'Modern Open-Concept Lounge & Fireplace Suite',
    mapPos: { x: 42, y: 55 },
    panoramaUrl: '/images/zone_living_360.jpg',
    thumbnailUrl: '/images/zone_living_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-bedroom', label: 'Master Bedroom Suite', icon: '🛏️', yaw: 45, pitch: -30 },
      { targetZoneId: 'zone-kitchen', label: 'Gourmet Chef Kitchen', icon: '🍳', yaw: -45, pitch: -30 },
      { targetZoneId: 'zone-entrance', label: 'Entrance Arch Foyer', icon: '⛩️', yaw: 180, pitch: -28 },
      { targetZoneId: 'zone-lounge', label: 'VIP Lounge Terrace', icon: '🍷', yaw: -110, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-living-sofa',
        label: 'Living Room Sofa',
        category: 'sofas',
        quantity: 1,
        defaultItemId: 'sofa-modern-chesterfield',
        pos3D: { pitch: -16, yaw: 0 }
      },
      {
        id: 'slot-living-table',
        label: 'Coffee & Cocktail Table',
        category: 'tables',
        quantity: 1,
        defaultItemId: 'table-rustic-wood',
        pos3D: { pitch: -25, yaw: 0 }
      },
      {
        id: 'slot-living-lighting',
        label: 'Fireplace & Ceiling Lighting',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-rgb-uplighting',
        pos3D: { pitch: 20, yaw: 90 }
      }
    ]
  },
  {
    id: 'zone-bedroom',
    name: 'Master Bedroom Suite',
    subtitle: 'Luxury Panoramic Lakeview Bed & Lounge Suite',
    mapPos: { x: 28, y: 75 },
    panoramaUrl: '/images/zone_bedroom_360.jpg',
    thumbnailUrl: '/images/zone_bedroom_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: -135, pitch: -30 },
      { targetZoneId: 'zone-kitchen', label: 'Gourmet Chef Kitchen', icon: '🍳', yaw: 90, pitch: -30 }
    ],
    slots: [
      {
        id: 'slot-bedroom-sofa',
        label: 'Master Bedroom Armchair',
        category: 'chairs',
        quantity: 2,
        defaultItemId: 'chair-velvet-armchair',
        pos3D: { pitch: -20, yaw: 110 }
      },
      {
        id: 'slot-bedroom-throne',
        label: 'Royal Maharaja Bedroom Chair',
        category: 'chairs',
        quantity: 1,
        defaultItemId: 'chair-throne',
        pos3D: { pitch: -18, yaw: -15 }
      },
      {
        id: 'slot-bedroom-lighting',
        label: 'Chandelier Pendant Lights',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-chandeliers',
        pos3D: { pitch: 30, yaw: 0 }
      }
    ]
  },
  {
    id: 'zone-kitchen',
    name: 'Gourmet Chef Kitchen',
    subtitle: 'Executive Marble Island & Culinary Suite',
    mapPos: { x: 68, y: 55 },
    panoramaUrl: '/images/zone_kitchen_360.jpg',
    thumbnailUrl: '/images/zone_kitchen_360.jpg',
    navLinks: [
      { targetZoneId: 'zone-living', label: 'Executive Living Room', icon: '🛋️', yaw: 135, pitch: -30 },
      { targetZoneId: 'zone-banquet', label: 'Royal Banquet Ballroom', icon: '🏰', yaw: -90, pitch: -30 },
      { targetZoneId: 'zone-bedroom', label: 'Master Bedroom Suite', icon: '🛏️', yaw: -180, pitch: -30 }
    ],
    slots: [
      {
        id: 'slot-kitchen-barstools',
        label: 'Kitchen Island Stools',
        category: 'chairs',
        quantity: 4,
        defaultItemId: 'chair-chiavari-gold',
        pos3D: { pitch: -22, yaw: 35 }
      },
      {
        id: 'slot-kitchen-table',
        label: 'Executive Marble Island Table',
        category: 'tables',
        quantity: 1,
        defaultItemId: 'table-led-glass',
        pos3D: { pitch: -18, yaw: 0 }
      },
      {
        id: 'slot-kitchen-lighting',
        label: 'Pendant Brass Globe Lights',
        category: 'lighting',
        quantity: 1,
        defaultItemId: 'lighting-fairy-canopy',
        pos3D: { pitch: 28, yaw: 0 }
      }
    ]
  },

  // 🇮🇳 INDIA EVENTS STUDIO ZONES
  {
    id: 'zone-india-election',
    name: '🇮🇳 Election Rally (Jansabha)',
    subtitle: 'Massive Political Rally Ground & Bulletproof Stage',
    mapPos: { x: 50, y: 35 },
    panoramaUrl: '/images/india_election_360.jpg',
    thumbnailUrl: '/images/india_election_360.jpg',
    isIndiaMode: true,
    navLinks: [
      { targetZoneId: 'zone-india-function', label: 'Grand Function Mandap', icon: '👑', yaw: 90, pitch: -28 },
      { targetZoneId: 'zone-india-meeting', label: 'Public Summit Hall', icon: '🎙️', yaw: -90, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-election-podium',
        label: 'Rally Stage & Bulletproof Glass Podium',
        category: 'stages',
        quantity: 1,
        defaultItemId: 'stage-bulletproof-podium',
        pos3D: { pitch: -5, yaw: 0 }
      },
      {
        id: 'slot-election-hoarding',
        label: 'Tricolor Campaign Flag & Banner Wall',
        category: 'backdrops',
        quantity: 1,
        defaultItemId: 'backdrop-election-flags',
        pos3D: { pitch: 12, yaw: -15 }
      },
      {
        id: 'slot-election-audio',
        label: 'High-Output Rally Horn Speaker Towers',
        category: 'fountains',
        quantity: 4,
        defaultItemId: 'fountain-horn-speakers',
        pos3D: { pitch: 8, yaw: 85 }
      },
      {
        id: 'slot-election-seating',
        label: 'VVIP Dignitary Stage Armchairs',
        category: 'chairs',
        quantity: 12,
        defaultItemId: 'chair-vvip-executive',
        pos3D: { pitch: -18, yaw: -45 }
      }
    ]
  },
  {
    id: 'zone-india-function',
    name: '🇮🇳 Grand Function (Royal Mandap)',
    subtitle: 'Traditional Indian Wedding & Reception Mandap',
    mapPos: { x: 75, y: 65 },
    panoramaUrl: '/images/india_function_360.jpg',
    thumbnailUrl: '/images/india_function_360.jpg',
    isIndiaMode: true,
    navLinks: [
      { targetZoneId: 'zone-india-election', label: 'Election Rally Jansabha', icon: '🗳️', yaw: -90, pitch: -28 },
      { targetZoneId: 'zone-india-meeting', label: 'Public Summit Hall', icon: '🎙️', yaw: 180, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-function-mandap',
        label: 'Carved Pillar Royal Wedding Mandap',
        category: 'stages',
        quantity: 1,
        defaultItemId: 'stage-royal-mandap',
        pos3D: { pitch: -4, yaw: 0 }
      },
      {
        id: 'slot-function-marigold',
        label: 'Fresh Marigold & Jasmine Backdrop',
        category: 'backdrops',
        quantity: 1,
        defaultItemId: 'backdrop-marigold-garland',
        pos3D: { pitch: 10, yaw: -30 }
      },
      {
        id: 'slot-function-throne',
        label: 'Royal Maharaja Gold Throne Pair',
        category: 'chairs',
        quantity: 2,
        defaultItemId: 'chair-maharaja-throne',
        pos3D: { pitch: -14, yaw: -10 }
      },
      {
        id: 'slot-function-jhula',
        label: 'Carved Royal Wooden Swing Setup',
        category: 'tables',
        quantity: 1,
        defaultItemId: 'table-antique-jhula',
        pos3D: { pitch: -12, yaw: 65 }
      }
    ]
  },
  {
    id: 'zone-india-meeting',
    name: '🇮🇳 Public Meeting / Summit',
    subtitle: 'High-Tech Digital Conference & Ministerial Summit',
    mapPos: { x: 25, y: 45 },
    panoramaUrl: '/images/india_meeting_360.jpg',
    thumbnailUrl: '/images/india_meeting_360.jpg',
    isIndiaMode: true,
    navLinks: [
      { targetZoneId: 'zone-india-election', label: 'Election Rally Jansabha', icon: '🗳️', yaw: 90, pitch: -28 },
      { targetZoneId: 'zone-india-function', label: 'Grand Function Mandap', icon: '👑', yaw: -180, pitch: -28 }
    ],
    slots: [
      {
        id: 'slot-meeting-podium',
        label: 'Acrylic LED Digital Summit Podium',
        category: 'stages',
        quantity: 1,
        defaultItemId: 'stage-digital-podium',
        pos3D: { pitch: -5, yaw: 0 }
      },
      {
        id: 'slot-meeting-screen',
        label: 'Curved 4K Seamless Video Screen Wall',
        category: 'backdrops',
        quantity: 1,
        defaultItemId: 'backdrop-seamless-led',
        pos3D: { pitch: 12, yaw: 0 }
      },
      {
        id: 'slot-meeting-desk',
        label: 'Curved International Summit Desk',
        category: 'tables',
        quantity: 1,
        defaultItemId: 'table-summit-desk',
        pos3D: { pitch: -15, yaw: -30 }
      }
    ]
  }
];
