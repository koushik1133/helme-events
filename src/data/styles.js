export const STYLE_PRESETS = [
  {
    id: 'style-rustic',
    name: 'Rustic Boho',
    emoji: '🌾',
    description: 'Natural woods, pampas grass, and warm earthy tones.',
    colorPalette: { primary: '#D4B895', secondary: '#8A9A5B', accent: '#C86558' },
    selections: {
      'slot-stage-main': 'stage-wood-rustic',
      'slot-stage-backdrop': 'backdrop-macrame',
      'slot-stage-seating': 'chair-crossback-wood'
    }
  },
  {
    id: 'style-mughal',
    name: 'Royal Mughal',
    emoji: '🕌',
    description: 'Grand arches, deep reds, gold accents, and marigolds.',
    colorPalette: { primary: '#8B0000', secondary: '#FFD700', accent: '#FF8C00' },
    selections: {
      'slot-function-mandap': 'stage-royal-mandap',
      'slot-function-marigold': 'backdrop-marigold-garland',
      'slot-function-throne': 'chair-maharaja-throne'
    }
  },
  {
    id: 'style-minimalist',
    name: 'Minimalist Modern',
    emoji: '🤍',
    description: 'Clean lines, acrylics, white florals, and sleek furniture.',
    colorPalette: { primary: '#FFFFFF', secondary: '#F0F0F0', accent: '#333333' },
    selections: {
      'slot-entrance-arch': 'backdrop-acrylic-arch',
      'slot-entrance-seating': 'chair-ghost',
      'slot-banquet-table': 'table-glass-modern'
    }
  },
  {
    id: 'style-tropical',
    name: 'Tropical Paradise',
    emoji: '🌴',
    description: 'Lush greens, bright pinks, monstera leaves and bamboo.',
    colorPalette: { primary: '#006400', secondary: '#FF1493', accent: '#00FFFF' },
    selections: {
      'slot-fountain-center': 'fountain-bamboo',
      'slot-lounge-table': 'table-tiki',
      'slot-lounge-lighting': 'lighting-tiki-torch'
    }
  },
  {
    id: 'style-vintage',
    name: 'Vintage Victorian',
    emoji: '🕰️',
    description: 'Lace, antique gold, crystal chandeliers, and soft pastels.',
    colorPalette: { primary: '#F5DEB3', secondary: '#D8BFD8', accent: '#B8860B' },
    selections: {
      'slot-banquet-chairs': 'chair-vintage-velvet',
      'slot-banquet-lighting': 'lighting-chandeliers',
      'slot-entrance-seating': 'chair-vintage-sofa'
    }
  },
  {
    id: 'style-cyber',
    name: 'Cyber Neon',
    emoji: '⚡',
    description: 'Neon lights, LED screens, and futuristic tech vibes.',
    colorPalette: { primary: '#000000', secondary: '#00FF00', accent: '#FF00FF' },
    selections: {
      'slot-meeting-podium': 'stage-digital-podium',
      'slot-meeting-screen': 'backdrop-seamless-led',
      'slot-lounge-lighting': 'lighting-rgb-uplighting'
    }
  }
];
