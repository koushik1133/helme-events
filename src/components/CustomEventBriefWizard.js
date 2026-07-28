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
      subCategory: 'wedding',
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
      // Custom Preference Text
      customPreferences: ''
    };

    this.selectedConceptId = 'concept-royal';
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

  generateConcepts() {
    const cat = this.formData.category;
    const guests = this.formData.guestCount;
    const hours = this.calculateTotalHours();

    let baseCost = 5000 + (guests * 45) + (hours * 300);
    if (cat === 'political') baseCost += 4000;
    if (cat === 'corporate') baseCost += 3000;

    return [
      {
        id: 'concept-royal',
        title: '👑 Royal Gold & Grand Stage Edition',
        badge: 'Top Pick for Grand Events',
        panoramaUrl: '/images/zone_stage_360.jpg',
        description: `Grand LED setup, velvet seating for ${guests} guests, high-output sound & luxury decor.`,
        priceEstimate: Math.round(baseCost * 1.2),
        selections: {
          'slot-stage-main': 'stage-led-arch',
          'slot-stage-backdrop': 'backdrop-shimmer-sequin',
          'slot-stage-seating': 'chair-chiavari-gold',
          'slot-banquet-table': 'table-round-standard',
          'slot-fountain-water': 'fountain-dancing-jets'
        }
      },
      {
        id: 'concept-tech',
        title: '⚡ Cyber Tech & Press Production Edition',
        badge: 'High-Tech & Broadcast Ready',
        panoramaUrl: '/images/zone_banquet_360.jpg',
        description: `4K Video Wall, digital poding, teleprompters, camera risers & line array sound towers.`,
        priceEstimate: Math.round(baseCost * 1.05),
        selections: {
          'slot-stage-main': 'stage-truss-canopy',
          'slot-stage-backdrop': 'backdrop-flower-marigold',
          'slot-stage-seating': 'chair-folding-white',
          'slot-banquet-table': 'table-cocktail-high',
          'slot-fountain-water': 'fountain-stone-tiered'
        }
      },
      {
        id: 'concept-heritage',
        title: '🌿 Heritage Garden & Open Lawn Edition',
        badge: 'Scenic Outdoor Aesthetic',
        panoramaUrl: '/images/zone_lounge_360.jpg',
        description: `Natural floral arches, ambient warm fairy lights, wood accents & relaxed seating.`,
        priceEstimate: Math.round(baseCost * 0.85),
        selections: {
          'slot-stage-main': 'stage-wooden-rustic',
          'slot-stage-backdrop': 'backdrop-hedge-greenery',
          'slot-stage-seating': 'chair-ghost-acrylic',
          'slot-banquet-table': 'table-round-standard',
          'slot-fountain-water': 'fountain-dancing-jets'
        }
      }
    ];
  }

  applySelectedConcept() {
    const concepts = this.generateConcepts();
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
              <p>Weddings, Mandaps, Anniversaries, Galas & Receptions</p>
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
              <option value="wedding">💍 Grand Wedding & Mandap Ceremony</option>
              <option value="reception">🥂 Luxury Reception & Gala</option>
              <option value="anniversary">✨ Milestone Anniversary</option>
              <option value="birthday">🎂 Milestone Birthday Party</option>
            ` : this.formData.category === 'corporate' ? `
              <option value="conference">🎤 National Annual Conference</option>
              <option value="product_launch">🚀 Keynote Product Launch</option>
              <option value="trade_show">🏢 B2B Trade Show & Exhibition</option>
            ` : this.formData.category === 'political' ? `
              <option value="rally">📢 Public Rally & Mass Gathering</option>
              <option value="town_hall">🏛️ Town Hall & Debates</option>
              <option value="press_conf">🎥 Press Conference & Media Meet</option>
            ` : `
              <option value="festival">🎵 Music Festival & Concert</option>
              <option value="charity_run">🏃 Charity Marathon / Run</option>
              <option value="cultural_fair">🎨 Cultural Heritage Fair</option>
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
    const isPublic = this.formData.category === 'public';

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 2: Dynamic Event Specifications</h3>
        <p class="step-subtitle">Specify dynamic details customized for your <strong>${this.formData.category.toUpperCase()}</strong> event.</p>

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
    const concepts = this.generateConcepts();

    return `
      <div class="wizard-step-body">
        <h3 class="step-title">Step 3: Interactive 360° 4K Concept Showcase</h3>
        <p class="step-subtitle">Review generated 4K panoramic concepts tailored for <strong>${this.formData.guestCount} guests</strong> over <strong>${this.formData.totalHours} hours</strong>.</p>

        <div class="concepts-grid-3col">
          ${concepts.map(c => `
            <div class="concept-showcase-card ${this.selectedConceptId === c.id ? 'active' : ''}" data-concept-id="${c.id}">
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

        <!-- Custom Preference Overlay Input -->
        <div class="wizard-section-box mt-3">
          <h4 class="section-box-title">🎨 Add Custom Preferences & Modifications</h4>
          <p class="section-box-desc">Type any specific custom instructions (e.g. "Add 4 more microphones on stage", "Change table linens to navy blue velvet").</p>
          <textarea class="wizard-textarea" placeholder="Type custom client preferences here..." data-bind="customPreferences">${this.formData.customPreferences}</textarea>
        </div>

        <div class="wizard-footer-actions">
          <button class="wizard-btn wizard-btn-secondary" id="btnStep3Back">
            ⬅️ Back to Form
          </button>
          <button class="wizard-btn wizard-btn-success" id="btnStep3Launch">
            🚀 Confirm Theme & Launch 3D Live Editor ➔
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
              <span class="step-name">360° Showcase</span>
            </div>
          </div>

          ${this.currentStep === 1 ? this.renderStep1() : this.currentStep === 2 ? this.renderStep2() : this.renderStep3()}
        </div>
      </div>
    `;

    this.bindEvents();
  }
}
