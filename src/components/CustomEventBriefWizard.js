import { VENUE_ZONES } from '../data/zones.js';
import { ITEM_CATALOG, getItemById } from '../data/catalog.js';

export class CustomEventBriefWizard {
  constructor(containerElement, activeSelections, onApplySelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onApplySelections = onApplySelections;
    this.isOpen = false;
    this.currentStep = 1;

    // Form State
    this.formData = {
      category: 'social', // social, corporate, political, public
      subCategory: 'reception',
      // Universal
      eventDate: new Date().toISOString().split('T')[0],
      altDate: '',
      startTime: '10:00',
      endTime: '18:00',
      totalHours: 8,
      guestCount: 250,
      targetBudget: '15k_50k',
      // Category Specific
      // Social
      religiousSetup: 'mandap-gold',
      bridalPartySize: 12,
      cateringStyle: 'grand-buffet',
      // Political
      securityLevel: 'secret-service',
      pressArea: 'camera-risers',
      stagePodium: 'bulletproof-podium',
      // Corporate
      avTech: 'dual-led-walls',
      exhibitionSetup: 'booths-lounge',
      // Public
      soundSystem: 'line-array-towers',
      crowdFacilities: 'multi-gate-security',
      // AI Custom Prompt
      aiPrompt: ''
    };

    this.selectedConceptId = 'concept-1';
  }

  open() {
    this.isOpen = true;
    this.currentStep = 1;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  setStep(stepNum) {
    this.currentStep = stepNum;
    this.render();
  }

  calculateTotalHours() {
    if (!this.formData.startTime || !this.formData.endTime) return 8;
    const [startH, startM] = this.formData.startTime.split(':').map(Number);
    const [endH, endM] = this.formData.endTime.split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff <= 0) diff += 24;
    return Math.round(diff * 10) / 10;
  }

  generateSubEventConcepts() {
    const sub = this.formData.subCategory;
    const cat = this.formData.category;
    const guests = this.formData.guestCount;
    const hours = this.calculateTotalHours();
    const promptText = this.formData.aiPrompt.toLowerCase();

    let baseCost = 5000 + (guests * 45) + (hours * 300);

    // Default 3 4K Themes based on Sub-Event
    let concepts = [];

    if (sub === 'reception') {
      concepts = [
        {
          id: 'concept-1',
          title: '👑 Crystal Chandelier Gala Edition',
          badge: '4K Ultra High-Res Luxury',
          panoramaUrl: '/images/reception_crystal_gala_360.jpg',
          description: `Grand ballroom with crystal chandeliers, gold chiavari chairs, tall orchid centerpieces & 5-course banquet.`,
          priceEstimate: Math.round(baseCost * 1.3),
          selections: {
            'slot-stage-main': 'stage-led-arch',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-chiavari-gold',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        },
        {
          id: 'concept-2',
          title: '🌌 Midnight Velvet Starlight Edition',
          badge: '4K Night Sky Ambient',
          panoramaUrl: '/images/reception_midnight_velvet_360.jpg',
          description: `Deep navy blue velvet draping, LED starlight ceiling, silver chiavari seating & illuminated glass bar.`,
          priceEstimate: Math.round(baseCost * 1.15),
          selections: {
            'slot-stage-main': 'stage-truss-canopy',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-ghost-acrylic',
            'slot-banquet-table': 'table-cocktail-high',
            'slot-fountain-center': 'fountain-tiered-stone'
          }
        },
        {
          id: 'concept-3',
          title: '🌿 Enchanted Garden Lawn Edition',
          badge: '4K Scenic Outdoor Lawn',
          panoramaUrl: '/images/zone_lounge_360.jpg',
          description: `Outdoor floral lawn canopy, warm fairy lights, rustic wood dining tables & acoustic lounge music.`,
          priceEstimate: Math.round(baseCost * 0.9),
          selections: {
            'slot-stage-main': 'stage-wooden-rustic',
            'slot-stage-backdrop': 'backdrop-hedge-wall',
            'slot-stage-seating': 'chair-folding-white',
            'slot-banquet-table': 'table-rustic-wood',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        }
      ];
    } else if (sub === 'wedding') {
      concepts = [
        {
          id: 'concept-1',
          title: '👑 Royal Gold Carved Mandap',
          badge: '4K Royal Traditional',
          panoramaUrl: '/images/zone_stage_360.jpg',
          description: `Carved gold mandap pillars, marigold garlands, sacred fire kund & luxury front-row VIP sofa seating.`,
          priceEstimate: Math.round(baseCost * 1.35),
          selections: {
            'slot-stage-main': 'stage-led-arch',
            'slot-stage-backdrop': 'backdrop-flower-marigold',
            'slot-stage-seating': 'chair-chiavari-gold',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        },
        {
          id: 'concept-2',
          title: '🌸 Royal Mughal Palace Setup',
          badge: '4K Heritage Palace',
          panoramaUrl: '/images/india_function_360.jpg',
          description: `Intricate palace backdrop, regal red velvet drapes, traditional shehnai stage & royal guest seating.`,
          priceEstimate: Math.round(baseCost * 1.2),
          selections: {
            'slot-stage-main': 'stage-led-arch',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-chiavari-gold',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-tiered-stone'
          }
        },
        {
          id: 'concept-3',
          title: '🤍 Minimalist Platinum Floral Altar',
          badge: '4K Contemporary White',
          panoramaUrl: '/images/zone_banquet_360.jpg',
          description: `Crisp white floral ceremony arch, ghost acrylic aisle chairs, subtle ambient lighting & grand piano.`,
          priceEstimate: Math.round(baseCost * 0.95),
          selections: {
            'slot-stage-main': 'stage-wooden-rustic',
            'slot-stage-backdrop': 'backdrop-floral-wall',
            'slot-stage-seating': 'chair-ghost-acrylic',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        }
      ];
    } else if (cat === 'political' || sub === 'rally') {
      concepts = [
        {
          id: 'concept-1',
          title: '📢 Presidential Rally Grounds',
          badge: '4K Mass Gathering Scale',
          panoramaUrl: '/images/political_presidential_rally_360.jpg',
          description: `Massive 4K LED screen backdrop, bulletproof glass podium, dual teleprompters, state flags & camera risers.`,
          priceEstimate: Math.round(baseCost * 1.4),
          selections: {
            'slot-stage-main': 'stage-truss-canopy',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-folding-white',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-tiered-stone'
          }
        },
        {
          id: 'concept-2',
          title: '🏛️ National Civic Square Arena',
          badge: '4K High Security Assembly',
          panoramaUrl: '/images/india_election_360.jpg',
          description: `Heavy security barricades, metal detector gates, audio mult-box risers & press broadcast bay.`,
          priceEstimate: Math.round(baseCost * 1.15),
          selections: {
            'slot-stage-main': 'stage-led-arch',
            'slot-stage-backdrop': 'backdrop-flower-marigold',
            'slot-stage-seating': 'chair-folding-white',
            'slot-banquet-table': 'table-cocktail-high',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        },
        {
          id: 'concept-3',
          title: '🎥 Press Broadcast & Media Meet',
          badge: '4K National TV Broadcast',
          panoramaUrl: '/images/india_meeting_360.jpg',
          description: `Executive conference dais, satellite truck bay, high-resolution media backdrop & lapel mic array.`,
          priceEstimate: Math.round(baseCost * 0.95),
          selections: {
            'slot-stage-main': 'stage-wooden-rustic',
            'slot-stage-backdrop': 'backdrop-floral-wall',
            'slot-stage-seating': 'chair-chiavari-gold',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-tiered-stone'
          }
        }
      ];
    } else {
      // General Fallback 3 Themes
      concepts = [
        {
          id: 'concept-1',
          title: '👑 Grand Executive Gold Edition',
          badge: '4K Ultra High-Res',
          panoramaUrl: '/images/zone_stage_360.jpg',
          description: `Luxury LED stage, gold chiavari chairs, illuminated fountain & premium banquet setup.`,
          priceEstimate: Math.round(baseCost * 1.25),
          selections: {
            'slot-stage-main': 'stage-led-arch',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-chiavari-gold',
            'slot-banquet-table': 'table-round-standard',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        },
        {
          id: 'concept-2',
          title: '⚡ Cyber Tech & Neon Gala Edition',
          badge: '4K Futuristic Glow',
          panoramaUrl: '/images/zone_banquet_360.jpg',
          description: `4K Video wall, high-speed truss canopy, acrylic cocktail tables & moving spotlight array.`,
          priceEstimate: Math.round(baseCost * 1.1),
          selections: {
            'slot-stage-main': 'stage-truss-canopy',
            'slot-stage-backdrop': 'backdrop-shimmer-sequin',
            'slot-stage-seating': 'chair-ghost-acrylic',
            'slot-banquet-table': 'table-cocktail-high',
            'slot-fountain-center': 'fountain-tiered-stone'
          }
        },
        {
          id: 'concept-3',
          title: '🌿 Scenic Botanical Lawn Edition',
          badge: '4K Outdoor Eco-Lawn',
          panoramaUrl: '/images/zone_lounge_360.jpg',
          description: `Lush green hedge wall, rustic wooden tables, warm string lights & relaxed seating.`,
          priceEstimate: Math.round(baseCost * 0.85),
          selections: {
            'slot-stage-main': 'stage-wooden-rustic',
            'slot-stage-backdrop': 'backdrop-hedge-wall',
            'slot-stage-seating': 'chair-folding-white',
            'slot-banquet-table': 'table-rustic-wood',
            'slot-fountain-center': 'fountain-dancing-jets'
          }
        }
      ];
    }

    // Apply AI Prompt Overrides if promptText exists
    if (promptText) {
      concepts = concepts.map((c, idx) => {
        let titleSuffix = ' (Custom Prompt Modified)';
        let descAdd = ` Customized via prompt: "${promptText}".`;
        
        if (promptText.includes('purple') || promptText.includes('violet')) {
          c.title = c.title.replace(/Gold|Cyber|Heritage/, 'Royal Violet');
          c.description += ` Updated lighting to deep violet ambient LEDs.`;
        }
        if (promptText.includes('marigold') || promptText.includes('garland')) {
          c.selections['slot-stage-backdrop'] = 'backdrop-flower-marigold';
          c.description += ` Added traditional marigold flower garlands to stage backdrop.`;
        }
        if (promptText.includes('sound') || promptText.includes('speaker') || promptText.includes('tower')) {
          c.description += ` Added 4 high-output line-array sound towers.`;
        }
        if (promptText.includes('red carpet') || promptText.includes('carpet')) {
          c.description += ` Added 100ft VIP red carpet entrance aisle.`;
        }
        return c;
      });
    }

    return concepts;
  }

  applySelectedConcept() {
    const concepts = this.generateSubEventConcepts();
    const chosen = concepts.find(c => c.id === this.selectedConceptId) || concepts[0];
    
    if (this.onApplySelections && chosen.selections) {
      this.onApplySelections(chosen.selections, this.formData);
    }
    this.close();
  }

  bindEvents() {
    // Overlay backdrop click to close
    const overlay = this.container.querySelector('.custom-brief-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    // Close button
    const btnClose = this.container.querySelector('.btn-close-brief-modal');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    // Step 1 Category cards
    const catCards = this.container.querySelectorAll('.cat-select-card');
    catCards.forEach(card => {
      card.addEventListener('click', () => {
        catCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.formData.category = card.getAttribute('data-category');
        // Set default subcategory for category
        if (this.formData.category === 'social') this.formData.subCategory = 'reception';
        if (this.formData.category === 'corporate') this.formData.subCategory = 'conference';
        if (this.formData.category === 'political') this.formData.subCategory = 'rally';
        if (this.formData.category === 'public') this.formData.subCategory = 'festival';
        this.render(); // Re-render to update Step 2 fields
      });
    });

    // Inputs update formData
    const inputs = this.container.querySelectorAll('[data-bind]');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const field = e.target.getAttribute('data-bind');
        this.formData[field] = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
        if (field === 'startTime' || field === 'endTime') {
          this.formData.totalHours = this.calculateTotalHours();
          const hrsEl = this.container.querySelector('#calculatedHoursDisplay');
          if (hrsEl) hrsEl.textContent = `${this.formData.totalHours} Hours`;
        }
        if (field === 'guestCount') {
          const guestEl = this.container.querySelector('#guestCountValDisplay');
          if (guestEl) guestEl.textContent = `${this.formData.guestCount} Guests`;
        }
      });
    });

    // Step Navigation
    const btnStep1Next = this.container.querySelector('#btnStep1Next');
    if (btnStep1Next) btnStep1Next.addEventListener('click', () => this.setStep(2));

    const btnStep2Back = this.container.querySelector('#btnStep2Back');
    if (btnStep2Back) btnStep2Back.addEventListener('click', () => this.setStep(1));

    const btnStep2Next = this.container.querySelector('#btnStep2Next');
    if (btnStep2Next) btnStep2Next.addEventListener('click', () => this.setStep(3));

    const btnStep3Back = this.container.querySelector('#btnStep3Back');
    if (btnStep3Back) btnStep3Back.addEventListener('click', () => this.setStep(2));

    const btnStep3Launch = this.container.querySelector('#btnStep3Launch');
    if (btnStep3Launch) btnStep3Launch.addEventListener('click', () => this.applySelectedConcept());

    // AI Prompt Regeneration Button
    const btnAiRegen = this.container.querySelector('#btnAiRegen');
    if (btnAiRegen) {
      btnAiRegen.addEventListener('click', () => {
        const promptInput = this.container.querySelector('#aiPromptInput');
        if (promptInput) {
          this.formData.aiPrompt = promptInput.value.trim();
          this.render(); // Re-render step 3 with AI regenerated 4K themes
        }
      });
    }

    // Concept Card Selection
    const conceptCards = this.container.querySelectorAll('.concept-showcase-card');
    conceptCards.forEach(card => {
      card.addEventListener('click', () => {
        conceptCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedConceptId = card.getAttribute('data-concept-id');
      });
    });
  }

  renderStep1() {
    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 1: Select Event Category</h3>
        <p class="step-subtitle">Choose the main event type to dynamically generate tailored specifications.</p>
        
        <div class="category-cards-grid">
          <div class="cat-select-card ${this.formData.category === 'social' ? 'selected' : ''}" data-category="social">
            <div class="cat-card-icon">💒</div>
            <div class="cat-card-info">
              <h4>Social & Marriage</h4>
              <p>Weddings, Mandaps, Receptions, Anniversaries & Galas</p>
            </div>
          </div>

          <div class="cat-select-card ${this.formData.category === 'corporate' ? 'selected' : ''}" data-category="corporate">
            <div class="cat-card-icon">💼</div>
            <div class="cat-card-info">
              <h4>Corporate & Business</h4>
              <p>Conferences, Product Launches, Keynotes & Trade Shows</p>
            </div>
          </div>

          <div class="cat-select-card ${this.formData.category === 'political' ? 'selected' : ''}" data-category="political">
            <div class="cat-card-icon">🗳️</div>
            <div class="cat-card-info">
              <h4>Political & Rallies</h4>
              <p>Rallies, Town Halls, Press Conferences & Fundraisers</p>
            </div>
          </div>

          <div class="cat-select-card ${this.formData.category === 'public' ? 'selected' : ''}" data-category="public">
            <div class="cat-card-icon">🎪</div>
            <div class="cat-card-info">
              <h4>Public & Community</h4>
              <p>Festivals, Charity Runs, Live Concerts & Fairs</p>
            </div>
          </div>
        </div>

        <div class="wizard-form-group mt-4">
          <label class="wizard-label">Specific Sub-Event Type</label>
          <select class="wizard-input" data-bind="subCategory">
            ${this.formData.category === 'social' ? `
              <option value="reception" ${this.formData.subCategory === 'reception' ? 'selected' : ''}>🥂 Luxury Reception & Gala (3 4K Themes)</option>
              <option value="wedding" ${this.formData.subCategory === 'wedding' ? 'selected' : ''}>💍 Grand Wedding & Mandap Ceremony (3 4K Themes)</option>
              <option value="anniversary" ${this.formData.subCategory === 'anniversary' ? 'selected' : ''}>✨ Milestone Anniversary (3 4K Themes)</option>
              <option value="birthday" ${this.formData.subCategory === 'birthday' ? 'selected' : ''}>🎂 Milestone Birthday Party (3 4K Themes)</option>
            ` : this.formData.category === 'corporate' ? `
              <option value="conference" ${this.formData.subCategory === 'conference' ? 'selected' : ''}>🎤 National Annual Conference (3 4K Themes)</option>
              <option value="product_launch" ${this.formData.subCategory === 'product_launch' ? 'selected' : ''}>🚀 Keynote Product Launch (3 4K Themes)</option>
              <option value="trade_show" ${this.formData.subCategory === 'trade_show' ? 'selected' : ''}>🏢 B2B Trade Show & Exhibition (3 4K Themes)</option>
            ` : this.formData.category === 'political' ? `
              <option value="rally" ${this.formData.subCategory === 'rally' ? 'selected' : ''}>📢 Public Rally & Mass Gathering (3 4K Themes)</option>
              <option value="town_hall" ${this.formData.subCategory === 'town_hall' ? 'selected' : ''}>🏛️ Town Hall & Assembly (3 4K Themes)</option>
              <option value="press_conf" ${this.formData.subCategory === 'press_conf' ? 'selected' : ''}>🎥 Press Conference & Media Meet (3 4K Themes)</option>
            ` : `
              <option value="festival" ${this.formData.subCategory === 'festival' ? 'selected' : ''}>🎵 Music Festival & Concert (3 4K Themes)</option>
              <option value="charity_run" ${this.formData.subCategory === 'charity_run' ? 'selected' : ''}>🏃 Charity Marathon / Run (3 4K Themes)</option>
              <option value="cultural_fair" ${this.formData.subCategory === 'cultural_fair' ? 'selected' : ''}>🎨 Cultural Heritage Fair (3 4K Themes)</option>
            `}
          </select>
        </div>

        <div class="wizard-footer-actions">
          <div></div>
          <button class="wizard-btn wizard-btn-primary" id="btnStep1Next">
            Next: Fill Event Details ➔
          </button>
        </div>
      </div>
    `;
  }

  renderStep2() {
    const isSocial = this.formData.category === 'social';
    const isPolitical = this.formData.category === 'political';
    const isCorporate = this.formData.category === 'corporate';

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 2: Dynamic Event Specifications</h3>
        <p class="step-subtitle">Specify dynamic details customized for <strong>${this.formData.subCategory.toUpperCase()}</strong> (${this.formData.category.toUpperCase()}).</p>

        <!-- Category Specific Section -->
        <div class="wizard-section-box">
          <h4 class="section-box-title">
            ${isSocial ? '💒 Marriage & Ceremony Requirements' : isPolitical ? '🗳️ Rally & Press Setup Requirements' : isCorporate ? '💼 Corporate AV & Keynote Setup' : '🎪 Festival & Sound Setup'}
          </h4>

          <div class="wizard-grid-2col">
            ${isSocial ? `
              <div class="wizard-form-group">
                <label class="wizard-label">Religious / Cultural Space</label>
                <select class="wizard-input" data-bind="religiousSetup">
                  <option value="mandap-gold">👑 Royal Gold Mandap (Indian Traditional)</option>
                  <option value="floral-altar">🌸 Floral Arch Ceremony Altar (Western)</option>
                  <option value="fire-kund">🔥 Sacred Fire Havan Kund Setup</option>
                  <option value="nikah-stage">🕌 Elegant Royal Nikah Stage</option>
                </select>
              </div>

              <div class="wizard-form-group">
                <label class="wizard-label">Bridal Party & VIP Seating Size</label>
                <input type="number" class="wizard-input" value="${this.formData.bridalPartySize}" min="2" max="100" data-bind="bridalPartySize" />
              </div>

              <div class="wizard-form-group wizard-full-col">
                <label class="wizard-label">Catering & Dining Style</label>
                <select class="wizard-input" data-bind="cateringStyle">
                  <option value="grand-buffet">🍲 Grand Multi-Cuisine Live Buffet</option>
                  <option value="royal-plated">🍽️ Royal 5-Course Plated Banquet</option>
                  <option value="family-style">🥗 Family-Style Shared Platters</option>
                  <option value="food-trucks">🚚 Artisanal Gourmet Food Trucks</option>
                </select>
              </div>
            ` : isPolitical ? `
              <div class="wizard-form-group">
                <label class="wizard-label">Security & Barrier Clearance</label>
                <select class="wizard-input" data-bind="securityLevel">
                  <option value="secret-service">🛡️ Secret Service / VIP Coordination</option>
                  <option value="metal-gates">🚨 Metal Detector Gates & Bag Checks</option>
                  <option value="heavy-barricades">🚧 Heavy Bulletproof Barricades</option>
                </select>
              </div>

              <div class="wizard-form-group">
                <label class="wizard-label">Press & Media Setup</label>
                <select class="wizard-input" data-bind="pressArea">
                  <option value="camera-risers">🎥 Elevated Camera Risers & Audio Mult-Box</option>
                  <option value="press-room">🎙️ Press Holding Room & Media Bay</option>
                  <option value="satellite-van">📡 Satellite Broadcast Truck Bay</option>
                </select>
              </div>

              <div class="wizard-form-group wizard-full-col">
                <label class="wizard-label">Stage & Podium Specifications</label>
                <select class="wizard-input" data-bind="stagePodium">
                  <option value="bulletproof-podium">🎤 Bulletproof Glass Podium & Teleprompter</option>
                  <option value="led-backdrop">📺 4K LED Screen High-Visibility Backdrop</option>
                  <option value="national-flags">🚩 National & Party Flag Array</option>
                </select>
              </div>
            ` : isCorporate ? `
              <div class="wizard-form-group">
                <label class="wizard-label">Presentation AV Tech</label>
                <select class="wizard-input" data-bind="avTech">
                  <option value="dual-led-walls">📺 Dual 4K LED Video Walls</option>
                  <option value="wireless-mics">🎙️ Wireless Lapel Mics & Audio Array</option>
                </select>
              </div>

              <div class="wizard-form-group">
                <label class="wizard-label">Exhibition & Networking</label>
                <select class="wizard-input" data-bind="exhibitionSetup">
                  <option value="booths-lounge">🏢 Standard Shell Scheme Booths + Lounge</option>
                  <option value="vip-bar">🍸 Executive VIP Lounge & Bar</option>
                </select>
              </div>
            ` : `
              <div class="wizard-form-group">
                <label class="wizard-label">Main Stage Sound System</label>
                <select class="wizard-input" data-bind="soundSystem">
                  <option value="line-array-towers">🔊 Line Array Sound Towers & Spotlights</option>
                  <option value="pyro-lasers">🎆 Pyrotechnics & Laser Light Show</option>
                </select>
              </div>

              <div class="wizard-form-group">
                <label class="wizard-label">Crowd Control & Facilities</label>
                <select class="wizard-input" data-bind="crowdFacilities">
                  <option value="multi-gate-security">🎟️ Multi-Queue Entry Gates & Tickets</option>
                  <option value="first-aid">🏥 First Aid Tent & Security Patrols</option>
                </select>
              </div>
            `}
          </div>
        </div>

        <!-- Universal Section -->
        <div class="wizard-section-box mt-3">
          <h4 class="section-box-title">🌐 Universal Schedule & Capacity</h4>
          <div class="wizard-grid-2col">
            <div class="wizard-form-group">
              <label class="wizard-label">Event Start Time</label>
              <input type="time" class="wizard-input" value="${this.formData.startTime}" data-bind="startTime" />
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label">Event End Time</label>
              <input type="time" class="wizard-input" value="${this.formData.endTime}" data-bind="endTime" />
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label">Total Duration</label>
              <div class="wizard-readout-pill" id="calculatedHoursDisplay">${this.calculateTotalHours()} Hours</div>
            </div>

            <div class="wizard-form-group">
              <label class="wizard-label">Target Budget Bracket</label>
              <select class="wizard-input" data-bind="targetBudget">
                <option value="under_5k">Under $5,000 (Budget)</option>
                <option value="5k_15k">$5,000 - $15,000 (Standard)</option>
                <option value="15k_50k" selected>$15,000 - $50,000 (Premium Luxury)</option>
                <option value="50k_plus">$50,000+ (Grand Scale / Presidential)</option>
              </select>
            </div>

            <div class="wizard-form-group wizard-full-col">
              <label class="wizard-label">Estimated Attendance: <span id="guestCountValDisplay" class="text-gold">${this.formData.guestCount} Guests</span></label>
              <input type="range" class="wizard-range-slider" min="50" max="5000" step="50" value="${this.formData.guestCount}" data-bind="guestCount" />
            </div>
          </div>
        </div>

        <div class="wizard-footer-actions">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep2Back">
            ⬅️ Back to Category
          </button>
          <button class="wizard-btn wizard-btn-primary" id="btnStep2Next">
            Next: Generate 360° 4K Concepts ➔
          </button>
        </div>
      </div>
    `;
  }

  renderStep3() {
    const concepts = this.generateSubEventConcepts();

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 3: 3 Distinct 4K 360° Theme Options for ${this.formData.subCategory.toUpperCase()}</h3>
        <p class="step-subtitle">Review the 3 generated high-res concepts below. Don't like them? Use the <strong>AI Prompt Customizer</strong> to instantly regenerate modified 4K themes!</p>

        <!-- AI Prompt Theme Customizer Bar -->
        <div class="ai-prompt-bar-box">
          <div class="ai-prompt-input-row">
            <span class="ai-sparkle-icon">✨</span>
            <input type="text" id="aiPromptInput" class="ai-prompt-input" placeholder="Type prompt to customize 4K themes (e.g. 'Deep violet lighting with marigold entrance & red carpet')..." value="${this.formData.aiPrompt}" />
            <button class="wizard-btn wizard-btn-ai" id="btnAiRegen">
              ✨ Regenerate 4K Themes
            </button>
          </div>
        </div>

        <div class="concepts-grid-3col">
          ${concepts.map((c, idx) => `
            <div class="concept-showcase-card ${this.selectedConceptId === c.id || (idx === 0 && !this.selectedConceptId) ? 'active' : ''}" data-concept-id="${c.id}">
              <div class="concept-badge-pill">${c.badge}</div>
              <div class="concept-img-wrapper">
                <img src="${c.panoramaUrl}" alt="${c.title}" class="concept-img" />
                <span class="view-360-tag">🌀 4K 360° Preview</span>
              </div>
              <div class="concept-card-body">
                <h4 class="concept-title">${c.title}</h4>
                <p class="concept-desc">${c.description}</p>
                <div class="concept-price-row">
                  <span class="price-label">Est. Total:</span>
                  <span class="price-val">$${c.priceEstimate.toLocaleString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="wizard-footer-actions mt-3">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep3Back">
            ⬅️ Back to Form
          </button>
          <button class="wizard-btn wizard-btn-success" id="btnStep3Launch">
            🚀 Apply Theme & Launch 3D Live Editor ➔
          </button>
        </div>
      </div>
    `;
  }

  render() {
    this.container.innerHTML = `
      <div class="custom-brief-modal-overlay">
        <div class="custom-brief-modal-card">
          <div class="wizard-header">
            <div class="wizard-header-title">
              <h2>📋 Custom Event Brief & 4K 360° Studio Setup</h2>
              <span class="wizard-subtitle">Dynamic 4-Step Event Planning Wizard</span>
            </div>
            <button class="btn-close-brief-modal">✕</button>
          </div>

          <!-- Step Progress Tracker -->
          <div class="wizard-progress-tracker">
            <div class="progress-step-item ${this.currentStep >= 1 ? 'active' : ''}">
              <span class="step-num">1</span>
              <span class="step-name">Category</span>
            </div>
            <div class="progress-line ${this.currentStep >= 2 ? 'active' : ''}"></div>
            <div class="progress-step-item ${this.currentStep >= 2 ? 'active' : ''}">
              <span class="step-num">2</span>
              <span class="step-name">Specifications</span>
            </div>
            <div class="progress-line ${this.currentStep >= 3 ? 'active' : ''}"></div>
            <div class="progress-step-item ${this.currentStep >= 3 ? 'active' : ''}">
              <span class="step-num">3</span>
              <span class="step-name">4K 360° Showcase</span>
            </div>
          </div>

          ${this.currentStep === 1 ? this.renderStep1() : this.currentStep === 2 ? this.renderStep2() : this.renderStep3()}
        </div>
      </div>
    `;

    this.bindEvents();
  }
}
