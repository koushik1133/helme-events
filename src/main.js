import confetti from 'canvas-confetti';
import { VENUE_ZONES } from './data/zones.js';
import { getItemById } from './data/catalog.js';
import { Viewer360 } from './engine/Viewer360.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { InteractiveMap } from './components/InteractiveMap.js';
import { ItemSwapperModal } from './components/ItemSwapperModal.js';
import { VenueMenuModal } from './components/VenueMenuModal.js';
import { CartPaymentModal } from './components/CartPaymentModal.js';
import { TourWatcher } from './components/TourWatcher.js';
import { FloorPlanEditor } from './components/FloorPlanEditor.js';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.js';
import { ProposalsManager } from './components/ProposalsManager.js';
import { CostCard } from './components/CostCard.js';

class Event360App {
  constructor() {
    this.activeView = 'map';
    this.currentZoneId = 'zone-stage';
    this.indiaMode = 'election';
    this.theme = localStorage.getItem('event360_theme') || 'dark';
    this.activeSelections = {};

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        this.activeSelections[slot.id] = slot.defaultItemId;
      });
    });

    this.applyTheme(this.theme);
    this.initUI();
    this.initComponents();
    this.bindGlobalEvents();
  }

  applyTheme(themeMode) {
    this.theme = themeMode;
    document.documentElement.setAttribute('data-theme', themeMode);
    localStorage.setItem('event360_theme', themeMode);

    const toggleBtnLabel = document.querySelector('.theme-mode-label');
    if (toggleBtnLabel) {
      toggleBtnLabel.textContent = themeMode === 'light' ? 'Light' : 'Dark';
    }
  }

  toggleTheme() {
    const nextTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
    this.showToast(`Switched to Attio ${nextTheme.toUpperCase()} theme!`);
  }

  initUI() {
    this.mapContainer = document.getElementById('mapViewContainer');
    this.studioContainer = document.getElementById('studio360Container');
    this.floorPlanContainer = document.getElementById('floorPlanContainer');
    this.analyticsContainer = document.getElementById('analyticsContainer');
    this.proposalsContainer = document.getElementById('proposalsContainer');

    this.canvasHolder = document.getElementById('canvas360Holder');
    this.costCardContainer = document.getElementById('costCardContainer');
    this.swapperContainer = document.getElementById('swapperModalContainer');
    this.venueMenuContainer = document.getElementById('venueMenuModalContainer');
    this.cartModalContainer = document.getElementById('cartModalContainer');
    this.indiaSubBar = document.getElementById('indiaSubBar');

    this.tabMapView = document.getElementById('tabMapView');
    this.tab360View = document.getElementById('tab360View');
    this.tabIndiaView = document.getElementById('tabIndiaView');
    this.tabFloorPlanView = document.getElementById('tabFloorPlanView');
    this.tabAnalyticsView = document.getElementById('tabAnalyticsView');
    this.tabProposalsView = document.getElementById('tabProposalsView');

    this.btnOpenVenueMenu = document.getElementById('btnOpenVenueMenu');
    this.btnOpenCart = document.getElementById('btnOpenCart');
    this.btnAIBuilder = document.getElementById('btnAIBuilder');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnWatchTour360 = document.getElementById('btnWatchTour360');

    this.presetSelect = document.getElementById('presetSelect');
    this.hudZoneTitle = document.getElementById('hudZoneTitle');
    this.hudSlotsList = document.getElementById('hudSlotsList');
    this.btnBackToMap = document.getElementById('btnBackToMap');
    this.btnAutoRotate = document.getElementById('btnAutoRotate');
    this.themeToggleBtn = document.getElementById('themeModeToggle');
  }

  initComponents() {
    this.audioEngine = new AudioEngine();

    this.mapComponent = new InteractiveMap(
      this.mapContainer,
      (zoneId) => this.openStudio360(zoneId),
      (zoneId, slotId) => {
        this.openStudio360(zoneId);
        setTimeout(() => this.openSwapperForSlot(slotId), 150);
      },
      this.activeSelections
    );

    this.viewer360 = new Viewer360(
      this.canvasHolder,
      (slotId) => this.openSwapperForSlot(slotId)
    );

    this.tourWatcher = new TourWatcher(this.viewer360, () => {
      this.showToast('360° Setup Progress Tour Completed!');
    });

    this.swapperModal = new ItemSwapperModal(
      this.swapperContainer,
      (slotId, newItemId, quantity, customText) => this.handleObjectSwap(slotId, newItemId, quantity, customText)
    );

    this.venueMenuModal = new VenueMenuModal(
      this.venueMenuContainer,
      (zoneId) => this.openStudio360(zoneId),
      this.activeSelections
    );

    this.cartPaymentModal = new CartPaymentModal(
      this.cartModalContainer,
      this.activeSelections,
      () => {
        this.switchView('studio360');
        this.tourWatcher.startTour(this.activeSelections);
      }
    );

    this.floorPlanEditor = new FloorPlanEditor(
      this.floorPlanContainer,
      this.activeSelections,
      (newSel) => this.updateAllComponents(newSel)
    );

    this.analyticsDashboard = new AnalyticsDashboard(
      this.analyticsContainer,
      this.activeSelections
    );

    this.proposalsManager = new ProposalsManager(
      this.proposalsContainer,
      this.activeSelections,
      (selections) => {
        this.activeSelections = { ...selections };
        this.updateAllComponents(this.activeSelections);
        this.showToast('Loaded Proposal Blueprint design!');
      }
    );

    this.costCard = new CostCard(
      this.costCardContainer,
      this.activeSelections,
      (slotId, newQty) => {}
    );
  }

  bindGlobalEvents() {
    this.tabMapView.addEventListener('click', () => this.switchView('map'));
    this.tab360View.addEventListener('click', () => this.switchView('studio360'));
    if (this.tabIndiaView) this.tabIndiaView.addEventListener('click', () => this.switchView('india'));
    if (this.tabFloorPlanView) this.tabFloorPlanView.addEventListener('click', () => this.switchView('floorplan'));
    if (this.tabAnalyticsView) this.tabAnalyticsView.addEventListener('click', () => this.switchView('analytics'));
    if (this.tabProposalsView) this.tabProposalsView.addEventListener('click', () => this.switchView('proposals'));

    if (this.btnOpenVenueMenu) this.btnOpenVenueMenu.addEventListener('click', () => this.venueMenuModal.open());
    if (this.btnOpenCart) this.btnOpenCart.addEventListener('click', () => this.cartPaymentModal.open());

    if (this.btnAIBuilder) {
      this.btnAIBuilder.addEventListener('click', () => this.runAIAutoBuilder());
    }

    if (this.btnSoundToggle) {
      this.btnSoundToggle.addEventListener('click', () => {
        const isPlaying = this.audioEngine.toggleSound(this.currentZoneId);
        const icon = document.getElementById('soundIcon');
        const label = document.getElementById('soundLabel');
        if (icon && label) {
          icon.textContent = isPlaying ? '🔊' : '🔇';
          label.textContent = isPlaying ? 'Sound: ON' : 'Sound: OFF';
        }
        this.showToast(isPlaying ? 'Audio Soundscape Activated!' : 'Audio Soundscape Muted.');
      });
    }

    if (this.btnWatchTour360) {
      this.btnWatchTour360.addEventListener('click', () => {
        this.tourWatcher.startTour(this.activeSelections);
        this.showToast('Starting 360° Setup Progress Tour...');
      });
    }

    const indiaModeBtns = document.querySelectorAll('.india-mode-btn');
    indiaModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        indiaModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        this.switchIndiaMode(mode);
      });
    });

    if (this.themeToggleBtn) this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    if (this.btnBackToMap) this.btnBackToMap.addEventListener('click', () => this.switchView('map'));

    if (this.btnAutoRotate) {
      this.btnAutoRotate.addEventListener('click', () => {
        this.viewer360.autoRotate = !this.viewer360.autoRotate;
        this.btnAutoRotate.classList.toggle('active', this.viewer360.autoRotate);
      });
    }

    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.viewer360.setTimeOfDay(btn.getAttribute('data-time'));
      });
    });

    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => this.applyThemePreset(e.target.value));
    }
  }

  switchView(viewName) {
    this.activeView = viewName;
    const sections = [this.mapContainer, this.studioContainer, this.floorPlanContainer, this.analyticsContainer, this.proposalsContainer];
    sections.forEach(s => { if (s) { s.classList.remove('active'); s.classList.add('hidden'); } });

    const tabs = [this.tabMapView, this.tab360View, this.tabIndiaView, this.tabFloorPlanView, this.tabAnalyticsView, this.tabProposalsView];
    tabs.forEach(t => { if (t) t.classList.remove('active'); });

    if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');

    if (viewName === 'map') {
      this.mapContainer.classList.remove('hidden'); this.mapContainer.classList.add('active');
      this.tabMapView.classList.add('active');
    } else if (viewName === 'india') {
      if (this.indiaSubBar) this.indiaSubBar.classList.remove('hidden');
      this.tabIndiaView.classList.add('active');
      this.switchIndiaMode(this.indiaMode);
    } else if (viewName === 'floorplan') {
      this.floorPlanContainer.classList.remove('hidden'); this.floorPlanContainer.classList.add('active');
      this.tabFloorPlanView.classList.add('active');
      this.floorPlanEditor.updateSelections(this.activeSelections);
    } else if (viewName === 'analytics') {
      this.analyticsContainer.classList.remove('hidden'); this.analyticsContainer.classList.add('active');
      this.tabAnalyticsView.classList.add('active');
      this.analyticsDashboard.updateSelections(this.activeSelections);
    } else if (viewName === 'proposals') {
      this.proposalsContainer.classList.remove('hidden'); this.proposalsContainer.classList.add('active');
      this.tabProposalsView.classList.add('active');
    } else {
      this.openStudio360(this.currentZoneId);
    }
  }

  switchIndiaMode(modeKey) {
    this.indiaMode = modeKey;
    const targetZoneId = `zone-india-${modeKey}`;
    this.currentZoneId = targetZoneId;

    const zone = VENUE_ZONES.find(z => z.id === targetZoneId);
    if (!zone) return;

    this.mapContainer.classList.remove('active'); this.mapContainer.classList.add('hidden');
    this.studioContainer.classList.remove('hidden'); this.studioContainer.classList.add('active');

    if (this.hudZoneTitle) this.hudZoneTitle.textContent = zone.name;
    this.renderInventoryDrawer(zone);
    this.viewer360.loadZone(zone, this.activeSelections);
    if (this.audioEngine.isPlaying) this.audioEngine.playZoneSound(targetZoneId);
    this.showToast(`Loaded ${zone.name} 360° Studio!`);
  }

  openStudio360(zoneId) {
    this.currentZoneId = zoneId;
    const zone = VENUE_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    this.activeView = 'studio360';
    this.mapContainer.classList.remove('active'); this.mapContainer.classList.add('hidden');
    this.studioContainer.classList.remove('hidden'); this.studioContainer.classList.add('active');

    this.tabMapView.classList.remove('active');
    this.tab360View.classList.add('active');

    if (this.hudZoneTitle) this.hudZoneTitle.textContent = zone.name;
    this.renderInventoryDrawer(zone);
    this.viewer360.loadZone(zone, this.activeSelections);
    if (this.audioEngine.isPlaying) this.audioEngine.playZoneSound(zoneId);
  }

  renderInventoryDrawer(zone) {
    if (!this.hudSlotsList) return;

    this.hudSlotsList.innerHTML = zone.slots.map(slot => {
      const selectedItemId = this.activeSelections[slot.id] || slot.defaultItemId;
      const item = getItemById(selectedItemId);
      const customText = this.activeSelections[`custom_text_${slot.id}`];

      return `
        <div class="slot-item-card" data-slot-id="${slot.id}">
          <div class="slot-item-head">
            <span>${slot.label}</span>
            <small>${slot.quantity}x</small>
          </div>
          <div class="slot-item-body">
            <strong>${item ? item.name : 'None'}</strong>
            <span class="slot-item-price">$${item ? item.price * slot.quantity : 0}</span>
          </div>
          ${customText ? `<div class="slot-writing-tag">✍️ "${customText}"</div>` : ''}
        </div>
      `;
    }).join('');

    const cards = this.hudSlotsList.querySelectorAll('.slot-item-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        this.openSwapperForSlot(card.getAttribute('data-slot-id'));
      });
    });
  }

  openSwapperForSlot(slotId) {
    const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
    if (!zone) return;
    const slot = zone.slots.find(s => s.id === slotId);
    if (!slot) return;

    this.swapperModal.open(zone, slot, this.activeSelections);
  }

  handleObjectSwap(slotId, newItemId, quantity, customText) {
    this.activeSelections[slotId] = newItemId;
    if (customText !== undefined) {
      this.activeSelections[`custom_text_${slotId}`] = customText;
    }

    this.viewer360.swapObjectInSlot(slotId, newItemId, customText);
    this.updateAllComponents(this.activeSelections);

    const item = getItemById(newItemId);
    if (item) {
      this.showToast(customText ? `Updated ${item.name} with "${customText}"!` : `Updated to ${item.name}!`);
      confetti({ particleCount: 45, spread: 70, origin: { y: 0.75 } });
    }
  }

  updateAllComponents(newSelections) {
    this.activeSelections = newSelections;

    const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
    if (zone) this.renderInventoryDrawer(zone);

    this.mapComponent.updateSelections(this.activeSelections);
    this.costCard.updateSelections(this.activeSelections);
    this.venueMenuModal.updateSelections(this.activeSelections);
    this.analyticsDashboard.updateSelections(this.activeSelections);
    this.proposalsManager.updateSelections(this.activeSelections);
  }

  runAIAutoBuilder() {
    const presets = ['royal', 'cyber', 'garden'];
    const randomPreset = presets[Math.floor(Math.random() * presets.length)];
    this.applyThemePreset(randomPreset);

    this.activeSelections['custom_text_slot-election-podium'] = 'VISHAL JANSABHA 2026';
    this.activeSelections['custom_text_slot-meeting-podium'] = 'GLOBAL TECH SUMMIT';

    this.updateAllComponents(this.activeSelections);
    this.showToast(`⚡ AI Auto-Builder generated 5,000-Guest Mega Layout (${randomPreset.toUpperCase()})!`);
    confetti({ particleCount: 100, spread: 100, origin: { y: 0.5 } });
  }

  applyThemePreset(presetKey) {
    let presetMap = {};

    switch (presetKey) {
      case 'royal':
        presetMap = {
          'slot-stage-main': 'stage-royal-mandap',
          'slot-stage-seating': 'chair-throne',
          'slot-banquet-chairs': 'chair-chiavari-gold',
          'slot-banquet-lighting': 'lighting-chandeliers',
          'slot-fountain-center': 'fountain-royal-marble'
        };
        break;
      case 'cyber':
        presetMap = {
          'slot-stage-main': 'stage-led-arch',
          'slot-stage-seating': 'chair-ghost',
          'slot-banquet-table': 'table-led-glass',
          'slot-fountain-center': 'fountain-dancing-jets'
        };
        break;
      case 'garden':
        presetMap = {
          'slot-stage-backdrop': 'backdrop-hedge-wall',
          'slot-banquet-table': 'table-rustic-wood',
          'slot-fountain-center': 'fountain-tiered-stone',
          'slot-entrance-arch': 'backdrop-floral-wall'
        };
        break;
    }

    Object.assign(this.activeSelections, presetMap);
    this.updateAllComponents(this.activeSelections);

    if (this.activeView === 'studio360' || this.activeView === 'india') {
      const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
      if (zone) this.viewer360.loadZone(zone, this.activeSelections);
    }
  }

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Toast Styling
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  .toast-container {
    position: fixed;
    top: 4.5rem;
    right: 1.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 300;
    pointer-events: none;
  }
  .toast-msg {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);
    font-weight: 600;
    font-size: 0.8rem;
    padding: 8px 16px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-card);
    opacity: 0;
    transform: translateX(20px);
    transition: all 0.25s ease;
  }
  .toast-msg.show {
    opacity: 1;
    transform: translateX(0);
  }
`;
document.head.appendChild(toastStyle);

// Bootstrap
window.addEventListener('DOMContentLoaded', () => {
  window.app = new Event360App();
});
