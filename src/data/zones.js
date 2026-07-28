export const VENUE_ZONES = [
  {
    id: 'zone-stage',
    name: 'Main Stage Lawn',
    subtitle: 'Concert & Keynote Stage Setup',
    mapPos: { x: 52, y: 44 },
    panoramaUrl: '/images/zone_stage_360.jpg',
    thumbnailUrl: '/images/zone_stage_360.jpg',
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

  // 🇮🇳 INDIA EVENTS STUDIO ZONES
  {
    id: 'zone-india-election',
    name: '🇮🇳 Election Rally (Jansabha)',
    subtitle: 'Massive Political Rally Ground & Bulletproof Stage',
    mapPos: { x: 50, y: 35 },
    panoramaUrl: '/images/india_election_360.jpg',
    thumbnailUrl: '/images/india_election_360.jpg',
    isIndiaMode: true,
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
