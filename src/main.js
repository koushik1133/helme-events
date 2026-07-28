import confetti from 'canvas-confetti';
import { VENUE_ZONES } from './data/zones.js';
import { getItemById } from './data/catalog.js';
import { Viewer360 } from './engine/Viewer360.js';
import { InteractiveMap } from './components/InteractiveMap.js';
import { ItemSwapperModal } from './components/ItemSwapperModal.js';
import { CostCard } from './components/CostCard.js';

class Event360App {
  constructor() {
    this.activeView = 'map'; // 'map' | 'studio360' | 'india'
    this.currentZoneId = 'zone-stage';
    this.indiaMode = 'election'; // 'election' | 'function' | 'meeting'
    this.theme = localStorage.getItem('event360_theme') || 'dark';
    this.activeSelections = {};

    // Initialize default item selections for all slots in all zones
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
    this.canvasHolder = document.getElementById('canvas360Holder');
    this.costCardContainer = document.getElementById('costCardContainer');
    this.swapperContainer = document.getElementById('swapperModalContainer');
    this.indiaSubBar = document.getElementById('indiaSubBar');

    this.tabMapView = document.getElementById('tabMapView');
    this.tab360View = document.getElementById('tab360View');
    this.tabIndiaView = document.getElementById('tabIndiaView');

    this.presetSelect = document.getElementById('presetSelect');
    this.hudZoneTitle = document.getElementById('hudZoneTitle');
    this.hudSlotsList = document.getElementById('hudSlotsList');
    this.btnBackToMap = document.getElementById('btnBackToMap');
    this.btnAutoRotate = document.getElementById('btnAutoRotate');
    this.themeToggleBtn = document.getElementById('themeModeToggle');
  }

  initComponents() {
    // 1. Interactive Aerial Map Component
    this.mapComponent = new InteractiveMap(
      this.mapContainer,
      (zoneId) => this.openStudio360(zoneId),
      this.activeSelections
    );

    // 2. 360 WebGL Engine
    this.viewer360 = new Viewer360(
      this.canvasHolder,
      (slotId) => this.openSwapperForSlot(slotId)
    );

    // 3. Item Swapper Modal
    this.swapperModal = new ItemSwapperModal(
      this.swapperContainer,
      (slotId, newItemId, quantity) => this.handleObjectSwap(slotId, newItemId, quantity)
    );

    // 4. Overall Cost Card
    this.costCard = new CostCard(
      this.costCardContainer,
      this.activeSelections,
      (slotId, newQty) => {}
    );
  }

  bindGlobalEvents() {
    // Nav view tabs
    this.tabMapView.addEventListener('click', () => this.switchView('map'));
    this.tab360View.addEventListener('click', () => this.switchView('studio360'));
    if (this.tabIndiaView) {
      this.tabIndiaView.addEventListener('click', () => this.switchView('india'));
    }

    // India Sub-Bar Mode Switcher (Election | Function | Meeting)
    const indiaModeBtns = document.querySelectorAll('.india-mode-btn');
    indiaModeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        indiaModeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-mode');
        this.switchIndiaMode(mode);
      });
    });

    // Light / Dark Theme toggle button
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    // Back to map button
    if (this.btnBackToMap) {
      this.btnBackToMap.addEventListener('click', () => this.switchView('map'));
    }

    // Auto rotate toggle
    if (this.btnAutoRotate) {
      this.btnAutoRotate.addEventListener('click', () => {
        this.viewer360.autoRotate = !this.viewer360.autoRotate;
        this.btnAutoRotate.classList.toggle('active', this.viewer360.autoRotate);
      });
    }

    // Time of day buttons
    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mode = btn.getAttribute('data-time');
        this.viewer360.setTimeOfDay(mode);
      });
    });

    // Theme Preset dropdown
    if (this.presetSelect) {
      this.presetSelect.addEventListener('change', (e) => {
        this.applyThemePreset(e.target.value);
      });
    }
  }

  switchView(viewName) {
    this.activeView = viewName;
    if (viewName === 'map') {
      this.mapContainer.classList.remove('hidden');
      this.mapContainer.classList.add('active');
      this.studioContainer.classList.remove('active');
      this.studioContainer.classList.add('hidden');
      if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');

      this.tabMapView.classList.add('active');
      this.tab360View.classList.remove('active');
      if (this.tabIndiaView) this.tabIndiaView.classList.remove('active');
    } else if (viewName === 'india') {
      if (this.indiaSubBar) this.indiaSubBar.classList.remove('hidden');
      this.tabMapView.classList.remove('active');
      this.tab360View.classList.remove('active');
      if (this.tabIndiaView) this.tabIndiaView.classList.add('active');

      this.switchIndiaMode(this.indiaMode);
    } else {
      if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');
      this.openStudio360(this.currentZoneId);
    }
  }

  switchIndiaMode(modeKey) {
    this.indiaMode = modeKey;
    const targetZoneId = `zone-india-${modeKey}`;
    this.currentZoneId = targetZoneId;

    const zone = VENUE_ZONES.find(z => z.id === targetZoneId);
    if (!zone) return;

    this.mapContainer.classList.remove('active');
    this.mapContainer.classList.add('hidden');
    this.studioContainer.classList.remove('hidden');
    this.studioContainer.classList.add('active');

    if (this.hudZoneTitle) {
      this.hudZoneTitle.textContent = zone.name;
    }

    this.renderInventoryDrawer(zone);
    this.viewer360.loadZone(zone, this.activeSelections);

    this.showToast(`Loaded ${zone.name} 360° Studio!`);
  }

  openStudio360(zoneId) {
    this.currentZoneId = zoneId;
    const zone = VENUE_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    this.activeView = 'studio360';
    this.mapContainer.classList.remove('active');
    this.mapContainer.classList.add('hidden');
    this.studioContainer.classList.remove('hidden');
    this.studioContainer.classList.add('active');

    this.tabMapView.classList.remove('active');
    this.tab360View.classList.add('active');
    if (this.tabIndiaView) this.tabIndiaView.classList.remove('active');

    if (this.hudZoneTitle) {
      this.hudZoneTitle.textContent = zone.name;
    }

    this.renderInventoryDrawer(zone);
    this.viewer360.loadZone(zone, this.activeSelections);
  }

  renderInventoryDrawer(zone) {
    if (!this.hudSlotsList) return;

    this.hudSlotsList.innerHTML = zone.slots.map(slot => {
      const selectedItemId = this.activeSelections[slot.id] || slot.defaultItemId;
      const item = getItemById(selectedItemId);

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
        </div>
      `;
    }).join('');

    const cards = this.hudSlotsList.querySelectorAll('.slot-item-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const slotId = card.getAttribute('data-slot-id');
        this.openSwapperForSlot(slotId);
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

  handleObjectSwap(slotId, newItemId, quantity) {
    this.activeSelections[slotId] = newItemId;
    this.viewer360.swapObjectInSlot(slotId, newItemId);

    const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
    if (zone) this.renderInventoryDrawer(zone);

    this.mapComponent.updateSelections(this.activeSelections);
    this.costCard.updateSelections(this.activeSelections);

    const item = getItemById(newItemId);
    if (item) {
      this.showToast(`Interchanged item to ${item.name}!`);
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 }
      });
    }
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

      case 'minimal':
        presetMap = {
          'slot-stage-main': 'stage-wooden-riser',
          'slot-stage-seating': 'chair-folding',
          'slot-banquet-table': 'table-round-standard',
          'slot-lounge-table': 'table-cocktail'
        };
        break;
    }

    Object.assign(this.activeSelections, presetMap);

    if (this.activeView === 'studio360' || this.activeView === 'india') {
      const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
      if (zone) this.viewer360.loadZone(zone, this.activeSelections);
    }

    this.mapComponent.updateSelections(this.activeSelections);
    this.costCard.updateSelections(this.activeSelections);

    this.showToast(`Applied ${presetKey.toUpperCase()} preset across all zones!`);
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
