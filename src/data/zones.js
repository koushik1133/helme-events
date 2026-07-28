export const VENUE_ZONES = [
  // --- Standard Venue Zones ---
  {
    id: 'zone-stage',
    name: 'Main Stage & Performance Lawn',
    subtitle: 'Outdoor amphi lawn for keynotes, concerts, & inaugurations',
    panoramaUrl: '/images/zone_stage_360.jpg',
    thumbnailUrl: '/images/zone_stage_360.jpg',
    mapPos: { x: 74, y: 55 },
    categoryType: 'venue',
    slots: [
      {
        id: 'slot-stage-main',
        label: 'Stage Setup',
        category: 'stages',
        defaultItemId: 'stage-led-arch',
        quantity: 1,
        pos3D: { pitch: -2, yaw: 0 }
      },
      {
        id: 'slot-stage-lighting',
        label: 'Lighting Rig',
        category: 'lighting',
        defaultItemId: 'lighting-fairy-canopy',
        quantity: 1,
        pos3D: { pitch: 22, yaw: 12 }
      },
      {
        id: 'slot-stage-seating',
        label: 'Front Row Seating',
        category: 'chairs',
        defaultItemId: 'chair-throne',
        quantity: 10,
        pos3D: { pitch: -16, yaw: -28 }
      },
      {
        id: 'slot-stage-backdrop',
        label: 'Stage Backdrop',
        category: 'backdrops',
        defaultItemId: 'backdrop-shimmer-sequin',
        quantity: 1,
        pos3D: { pitch: 4, yaw: 170 }
      }
    ]
  },
  {
    id: 'zone-banquet',
    name: 'Royal Banquet Ballroom',
    subtitle: 'Grand hall for fine dining, galas, and awards ceremonies',
    panoramaUrl: '/images/zone_banquet_360.jpg',
    thumbnailUrl: '/images/zone_banquet_360.jpg',
    mapPos: { x: 38, y: 28 },
    categoryType: 'venue',
    slots: [
      {
        id: 'slot-banquet-table',
        label: 'Banquet Dining Tables',
        category: 'tables',
        defaultItemId: 'table-round-standard',
        quantity: 8,
        pos3D: { pitch: -18, yaw: 0 }
      },
      {
        id: 'slot-banquet-chairs',
        label: 'Chiavari Guest Chairs',
        category: 'chairs',
        defaultItemId: 'chair-chiavari-gold',
        quantity: 64,
        pos3D: { pitch: -14, yaw: -42 }
      },
      {
        id: 'slot-banquet-lighting',
        label: 'Ballroom Chandeliers',
        category: 'lighting',
        defaultItemId: 'lighting-chandeliers',
        quantity: 3,
        pos3D: { pitch: 32, yaw: 15 }
      }
    ]
  },
  {
    id: 'zone-fountain',
    name: 'Garden Fountain Plaza',
    subtitle: 'Open-air courtyard with central marble fountain feature',
    panoramaUrl: '/images/zone_fountain_360.jpg',
    thumbnailUrl: '/images/zone_fountain_360.jpg',
    mapPos: { x: 32, y: 62 },
    categoryType: 'venue',
    slots: [
      {
        id: 'slot-fountain-center',
        label: 'Central Water Feature',
        category: 'fountains',
        defaultItemId: 'fountain-royal-marble',
        quantity: 1,
        pos3D: { pitch: -10, yaw: 0 }
      },
      {
        id: 'slot-fountain-tables',
        label: 'Cocktail Tables',
        category: 'tables',
        defaultItemId: 'table-cocktail',
        quantity: 12,
        pos3D: { pitch: -12, yaw: -65 }
      },
      {
        id: 'slot-fountain-lights',
        label: 'Perimeter Mood Lights',
        category: 'lighting',
        defaultItemId: 'lighting-rgb-uplighting',
        quantity: 12,
        pos3D: { pitch: 18, yaw: 75 }
      }
    ]
  },
  {
    id: 'zone-lounge',
    name: 'VIP Lounge Terrace',
    subtitle: 'Exclusive rooftop deck with velvet sofas and skyline views',
    panoramaUrl: '/images/zone_lounge_360.jpg',
    thumbnailUrl: '/images/zone_lounge_360.jpg',
    mapPos: { x: 62, y: 20 },
    categoryType: 'venue',
    slots: [
      {
        id: 'slot-lounge-sofa',
        label: 'VIP Lounge Armchairs',
        category: 'chairs',
        defaultItemId: 'chair-velvet-armchair',
        quantity: 16,
        pos3D: { pitch: -16, yaw: -35 }
      },
      {
        id: 'slot-lounge-table',
        label: 'LED Center Tables',
        category: 'tables',
        defaultItemId: 'table-led-glass',
        quantity: 4,
        pos3D: { pitch: -20, yaw: 15 }
      },
      {
        id: 'slot-lounge-backdrop',
        label: 'Greenery Wall Backdrop',
        category: 'backdrops',
        defaultItemId: 'backdrop-hedge-wall',
        quantity: 2,
        pos3D: { pitch: 8, yaw: -110 }
      }
    ]
  },
  {
    id: 'zone-entrance',
    name: 'Entrance Arch & Photo Wall',
    subtitle: 'Welcome foyer, red carpet reception, and floral photo area',
    panoramaUrl: '/images/zone_entrance_360.jpg',
    thumbnailUrl: '/images/zone_entrance_360.jpg',
    mapPos: { x: 90, y: 44 },
    categoryType: 'venue',
    slots: [
      {
        id: 'slot-entrance-arch',
        label: 'Welcome Floral Arch Wall',
        category: 'backdrops',
        defaultItemId: 'backdrop-floral-wall',
        quantity: 1,
        pos3D: { pitch: 5, yaw: 0 }
      },
      {
        id: 'slot-entrance-water',
        label: 'Foyer Water Feature',
        category: 'fountains',
        defaultItemId: 'fountain-glass-waterfall',
        quantity: 1,
        pos3D: { pitch: -8, yaw: 45 }
      },
      {
        id: 'slot-entrance-seating',
        label: 'Reception Ghost Chairs',
        category: 'chairs',
        defaultItemId: 'chair-ghost',
        quantity: 8,
        pos3D: { pitch: -14, yaw: -75 }
      }
    ]
  },

  // --- Indian Specific Event Zones ---
  {
    id: 'zone-india-election',
    name: 'Indian Election Rally (Jansabha)',
    subtitle: 'Massive political rally grounds with stage podium, crowd barricades, & campaign flags',
    panoramaUrl: '/images/india_election_360.jpg',
    thumbnailUrl: '/images/india_election_360.jpg',
    mapPos: { x: 74, y: 55 },
    categoryType: 'india',
    subType: 'election',
    slots: [
      {
        id: 'slot-elec-podium',
        label: 'Rally Stage & Podium',
        category: 'stages',
        defaultItemId: 'stage-bulletproof-podium',
        quantity: 1,
        pos3D: { pitch: -4, yaw: 0 }
      },
      {
        id: 'slot-elec-flags',
        label: 'Campaign Flags & Wall',
        category: 'backdrops',
        defaultItemId: 'backdrop-election-flags',
        quantity: 1,
        pos3D: { pitch: 10, yaw: 45 }
      },
      {
        id: 'slot-elec-audio',
        label: 'Crowd Loudspeaker Array',
        category: 'fountains',
        defaultItemId: 'fountain-horn-speakers',
        quantity: 8,
        pos3D: { pitch: 18, yaw: -60 }
      },
      {
        id: 'slot-elec-vvip',
        label: 'Stage VVIP Chairs',
        category: 'chairs',
        defaultItemId: 'chair-vvip-executive',
        quantity: 12,
        pos3D: { pitch: -12, yaw: 25 }
      }
    ]
  },
  {
    id: 'zone-india-function',
    name: 'Indian Royal Function & Mandap',
    subtitle: 'Grand Indian wedding mandap decorated with marigolds, silk drapes, & Jhula swing',
    panoramaUrl: '/images/india_function_360.jpg',
    thumbnailUrl: '/images/india_function_360.jpg',
    mapPos: { x: 38, y: 28 },
    categoryType: 'india',
    subType: 'function',
    slots: [
      {
        id: 'slot-func-mandap',
        label: 'Royal Mandap Stage',
        category: 'stages',
        defaultItemId: 'stage-royal-mandap',
        quantity: 1,
        pos3D: { pitch: -2, yaw: 0 }
      },
      {
        id: 'slot-func-jhula',
        label: 'Carved Wooden Jhula Swing',
        category: 'tables',
        defaultItemId: 'table-antique-jhula',
        quantity: 1,
        pos3D: { pitch: -12, yaw: -55 }
      },
      {
        id: 'slot-func-flowers',
        label: 'Marigold Floral Wall',
        category: 'backdrops',
        defaultItemId: 'backdrop-marigold-garland',
        quantity: 1,
        pos3D: { pitch: 8, yaw: 110 }
      },
      {
        id: 'slot-func-thrones',
        label: 'Maharaja Wedding Thrones',
        category: 'chairs',
        defaultItemId: 'chair-maharaja-throne',
        quantity: 2,
        pos3D: { pitch: -10, yaw: 20 }
      }
    ]
  },
  {
    id: 'zone-india-meeting',
    name: 'Indian Corporate & Summit Meeting',
    subtitle: 'High-tech international summit hall with digital LED podiums & 4K video screens',
    panoramaUrl: '/images/india_meeting_360.jpg',
    thumbnailUrl: '/images/india_meeting_360.jpg',
    mapPos: { x: 62, y: 20 },
    categoryType: 'india',
    subType: 'meeting',
    slots: [
      {
        id: 'slot-meet-podium',
        label: 'Summit Digital Podium',
        category: 'stages',
        defaultItemId: 'stage-digital-podium',
        quantity: 1,
        pos3D: { pitch: -4, yaw: 0 }
      },
      {
        id: 'slot-meet-screen',
        label: '4K Seamless LED Video Wall',
        category: 'backdrops',
        defaultItemId: 'backdrop-seamless-led',
        quantity: 1,
        pos3D: { pitch: 12, yaw: -20 }
      },
      {
        id: 'slot-meet-table',
        label: 'Curved Summit Table',
        category: 'tables',
        defaultItemId: 'table-summit-desk',
        quantity: 1,
        pos3D: { pitch: -18, yaw: -45 }
      },
      {
        id: 'slot-meet-lighting',
        label: 'DMX Summit Spotlight Array',
        category: 'lighting',
        defaultItemId: 'lighting-rgb-uplighting',
        quantity: 16,
        pos3D: { pitch: 25, yaw: 60 }
      }
    ]
  }
];
