import confetti from 'canvas-confetti';
import { VENUE_ZONES } from './data/zones.js';
import { getItemById } from './data/catalog.js';
import { Viewer360 } from './engine/Viewer360.js';
import { AudioEngine } from './engine/AudioEngine.js';

// Original Components
import { InteractiveMap } from './components/InteractiveMap.js';
import { ItemSwapperModal } from './components/ItemSwapperModal.js';
import { VenueMenuModal } from './components/VenueMenuModal.js';
import { CartPaymentModal } from './components/CartPaymentModal.js';
import { TourWatcher } from './components/TourWatcher.js';
import { FloorPlanEditor } from './components/FloorPlanEditor.js';
import { AnalyticsDashboard } from './components/AnalyticsDashboard.js';
import { ProposalsManager } from './components/ProposalsManager.js';
import { CostCard } from './components/CostCard.js';

// Phase 1: Client Experience
import { TimelinePlanner } from './components/TimelinePlanner.js';
import { SeatingChart } from './components/SeatingChart.js';
import { ColorThemeDesigner } from './components/ColorThemeDesigner.js';
import { BeforeAfterCompare } from './components/BeforeAfterCompare.js';
import { CollaborationMode } from './components/CollaborationMode.js';
import { StyleLibrary } from './components/StyleLibrary.js';

// Phase 2: Business Ops
import { VendorManager } from './components/VendorManager.js';
import { InventoryTracker } from './components/InventoryTracker.js';
import { CalendarBooking } from './components/CalendarBooking.js';
import { ZoneNotes } from './components/ZoneNotes.js';
import { RevenueAnalytics } from './components/RevenueAnalytics.js';

// Phase 3: Visual & Experience
import { WeatherSimulator } from './components/WeatherSimulator.js';
import { WalkthroughExporter } from './components/WalkthroughExporter.js';
import { ARQRGenerator } from './components/ARQRGenerator.js';
import { PlaylistBuilder } from './components/PlaylistBuilder.js';
import { MoodBoardMatcher } from './components/MoodBoardMatcher.js';

// Phase 4: Professional
import { TestimonialWall } from './components/TestimonialWall.js';
import { ESignatureFlow } from './components/ESignatureFlow.js';
import { NotificationCenter } from './components/NotificationCenter.js';
import { InvoiceGenerator } from './components/InvoiceGenerator.js';

// Phase 5: AI
import { BudgetOptimizer } from './components/BudgetOptimizer.js';
import { EventBriefGenerator } from './components/EventBriefGenerator.js';
import { CustomEventBriefWizard } from './components/CustomEventBriefWizard.js';

class Event360App {
  constructor() {
    this.activeView = 'map';
    this.currentZoneId = 'zone-stage';
    this.indiaMode = 'election';
    this.theme = localStorage.getItem('event360_theme') || 'dark';
    this.activeSelections = {};
    this.featureToolbarOpen = false;

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        this.activeSelections[slot.id] = slot.defaultItemId;
      });
    });

    this.applyTheme(this.theme);
    this.initUI();
    this.initComponents();
    this.bindGlobalEvents();
    this.switchView(this.activeView);
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
    this.showToast(`Switched to Helme Events ${nextTheme.toUpperCase()} theme!`);
  }

  initUI() {
    // Original containers
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

    // New view containers
    this.timelineContainer = document.getElementById('timelineContainer');
    this.seatingContainer = document.getElementById('seatingContainer');
    this.vendorContainer = document.getElementById('vendorContainer');
    this.inventoryContainer = document.getElementById('inventoryContainer');
    this.calendarContainer = document.getElementById('calendarContainer');
    this.revenueContainer = document.getElementById('revenueContainer');
    this.testimonialContainer = document.getElementById('testimonialContainer');
    this.playlistContainer = document.getElementById('playlistContainer');

    // New modal containers
    this.colorThemeContainer = document.getElementById('colorThemeContainer');
    this.compareContainer = document.getElementById('compareContainer');
    this.collabContainer = document.getElementById('collabContainer');
    this.styleLibraryContainer = document.getElementById('styleLibraryContainer');
    this.zoneNotesContainer = document.getElementById('zoneNotesContainer');
    this.weatherSimContainer = document.getElementById('weatherSimContainer');
    this.videoExportContainer = document.getElementById('videoExportContainer');
    this.arQRContainer = document.getElementById('arQRContainer');
    this.moodBoardContainer = document.getElementById('moodBoardContainer');
    this.eSignatureContainer = document.getElementById('eSignatureContainer');
    this.notificationContainer = document.getElementById('notificationContainer');
    this.invoiceContainer = document.getElementById('invoiceContainer');
    this.budgetOptContainer = document.getElementById('budgetOptContainer');
    this.briefGenContainer = document.getElementById('briefGenContainer');
    this.customBriefWizardContainer = document.getElementById('customBriefWizardContainer');

    // Original tabs
    this.tabMapView = document.getElementById('tabMapView');
    this.tab360View = document.getElementById('tab360View');
    this.tabIndiaView = document.getElementById('tabIndiaView');
    this.tabFloorPlanView = document.getElementById('tabFloorPlanView');
    this.tabAnalyticsView = document.getElementById('tabAnalyticsView');
    this.tabProposalsView = document.getElementById('tabProposalsView');

    // New tabs
    this.tabTimelineView = document.getElementById('tabTimelineView');
    this.tabSeatingView = document.getElementById('tabSeatingView');

    // Original buttons
    this.btnOpenVenueMenu = document.getElementById('btnOpenVenueMenu');
    this.btnOpenCart = document.getElementById('btnOpenCart');
    this.btnAIBuilder = document.getElementById('btnAIBuilder');
    this.btnCustomBrief = document.getElementById('btnCustomBrief');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnWatchTour360 = document.getElementById('btnWatchTour360');
    this.presetSelect = document.getElementById('presetSelect');
    this.hudZoneTitle = document.getElementById('hudZoneTitle');
    this.hudSlotsList = document.getElementById('hudSlotsList');
    this.btnBackToMap = document.getElementById('btnBackToMap');
    this.btnAutoRotate = document.getElementById('btnAutoRotate');
    this.themeToggleBtn = document.getElementById('themeModeToggle');

    // New buttons
    this.btnToggleFeatures = document.getElementById('btnToggleFeatures');
    this.btnNotifications = document.getElementById('btnNotifications');
    this.featureToolbar = document.getElementById('featureToolbar');
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
        if (this.notificationCenter) {
          this.notificationCenter.addNotification('Payment Confirmed', 'Your event order has been confirmed and receipt generated.', '✅');
          this.updateNotifBadge();
        }
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
        if (this.notificationCenter) {
          this.notificationCenter.addNotification('Proposal Loaded', 'A saved proposal has been applied to the venue.', '📁');
          this.updateNotifBadge();
        }
      }
    );

    this.costCard = new CostCard(
      this.costCardContainer,
      this.activeSelections,
      (slotId, newQty) => {}
    );

    // Phase 1: Client Experience
    this.timelinePlanner = new TimelinePlanner(
      this.timelineContainer,
      this.activeSelections,
      (selections) => {
        this.activeSelections = { ...selections };
        this.updateAllComponents(this.activeSelections);
        this.showToast('Loaded day configuration from timeline!');
      }
    );

    this.seatingChart = new SeatingChart(
      this.seatingContainer,
      this.activeSelections
    );

    this.colorThemeDesigner = new ColorThemeDesigner(this.colorThemeContainer);

    this.beforeAfterCompare = new BeforeAfterCompare(
      this.compareContainer,
      this.activeSelections
    );

    this.collaborationMode = new CollaborationMode(
      this.collabContainer,
      this.activeSelections
    );

    this.styleLibrary = new StyleLibrary(
      this.styleLibraryContainer,
      this.activeSelections,
      (selections) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);
        this.showToast('Style preset applied to all zones!');
        confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
      }
    );

    // Phase 2: Business Ops
    this.vendorManager = new VendorManager(this.vendorContainer);
    this.inventoryTracker = new InventoryTracker(this.inventoryContainer);
    this.calendarBooking = new CalendarBooking(this.calendarContainer);
    this.zoneNotes = new ZoneNotes(this.zoneNotesContainer);
    this.revenueAnalytics = new RevenueAnalytics(this.revenueContainer);

    // Phase 3: Visual & Experience
    this.weatherSimulator = new WeatherSimulator(
      this.weatherSimContainer,
      this.studioContainer
    );

    this.walkthroughExporter = new WalkthroughExporter(this.videoExportContainer);

    this.arQRGenerator = new ARQRGenerator(
      this.arQRContainer,
      this.activeSelections
    );

    this.playlistBuilder = new PlaylistBuilder(this.playlistContainer);

    this.moodBoardMatcher = new MoodBoardMatcher(
      this.moodBoardContainer,
      this.activeSelections,
      (selections) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);
        this.showToast('Mood board style matched and applied!');
      }
    );

    // Phase 4: Professional
    this.testimonialWall = new TestimonialWall(this.testimonialContainer);

    this.eSignatureFlow = new ESignatureFlow(
      this.eSignatureContainer,
      this.activeSelections
    );

    this.notificationCenter = new NotificationCenter(this.notificationContainer);

    this.invoiceGenerator = new InvoiceGenerator(
      this.invoiceContainer,
      this.activeSelections
    );

    // Phase 5: AI
    this.budgetOptimizer = new BudgetOptimizer(
      this.budgetOptContainer,
      this.activeSelections,
      (selections) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);
        this.showToast('🤖 AI-Optimized budget configuration applied!');
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
      }
    );

    this.eventBriefGenerator = new EventBriefGenerator(
      this.briefGenContainer,
      this.activeSelections,
      (selections) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);
        this.showToast('📝 AI Event Brief recommendations applied!');
        confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      }
    );

    this.customEventBriefWizard = new CustomEventBriefWizard(
      this.customBriefWizardContainer,
      this.activeSelections,
      (selections, formData) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);
        this.showToast(`📋 Custom ${formData.category.toUpperCase()} event setup generated & applied!`);
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
        this.switchView('studio360');
      }
    );

    // Update notification badge
    this.updateNotifBadge();
  }

  bindGlobalEvents() {
    // Original tab events
    this.tabMapView.addEventListener('click', () => this.switchView('map'));
    this.tab360View.addEventListener('click', () => this.switchView('studio360'));
    if (this.tabIndiaView) this.tabIndiaView.addEventListener('click', () => this.switchView('india'));
    if (this.tabFloorPlanView) this.tabFloorPlanView.addEventListener('click', () => this.switchView('floorplan'));
    if (this.tabAnalyticsView) this.tabAnalyticsView.addEventListener('click', () => this.switchView('analytics'));
    if (this.tabProposalsView) this.tabProposalsView.addEventListener('click', () => this.switchView('proposals'));

    // New tab events
    if (this.tabTimelineView) this.tabTimelineView.addEventListener('click', () => this.switchView('timeline'));
    if (this.tabSeatingView) this.tabSeatingView.addEventListener('click', () => this.switchView('seating'));

    // Original button events
    if (this.btnOpenVenueMenu) this.btnOpenVenueMenu.addEventListener('click', () => this.venueMenuModal.open());
    if (this.btnOpenCart) this.btnOpenCart.addEventListener('click', () => this.cartPaymentModal.open());

    if (this.btnAIBuilder) {
      this.btnAIBuilder.addEventListener('click', () => this.runAIAutoBuilder());
    }

    if (this.btnCustomBrief) {
      this.btnCustomBrief.addEventListener('click', () => this.customEventBriefWizard.open());
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

    // Global Escape key modal close handler
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.notificationCenter) this.notificationCenter.close();
        if (this.colorThemeDesigner) this.colorThemeDesigner.close();
        if (this.beforeAfterCompare) this.beforeAfterCompare.close();
        if (this.collaborationMode) this.collaborationMode.close();
        if (this.styleLibrary) this.styleLibrary.close();
        if (this.zoneNotes) this.zoneNotes.close();
        if (this.weatherSimulator) this.weatherSimulator.close();
        if (this.walkthroughExporter) this.walkthroughExporter.close();
        if (this.arQRGenerator) this.arQRGenerator.close();
        if (this.moodBoardMatcher) this.moodBoardMatcher.close();
        if (this.eSignatureFlow) this.eSignatureFlow.close();
        if (this.invoiceGenerator) this.invoiceGenerator.close();
        if (this.budgetOptimizer) this.budgetOptimizer.close();
        if (this.eventBriefGenerator) this.eventBriefGenerator.close();
        if (this.customEventBriefWizard) this.customEventBriefWizard.close();
        if (this.swapperModal && this.swapperModal.close) this.swapperModal.close();
        if (this.venueMenuModal && this.venueMenuModal.close) this.venueMenuModal.close();
        if (this.cartPaymentModal && this.cartPaymentModal.close) this.cartPaymentModal.close();
      }
    });

    // Feature toolbar toggle
    if (this.btnToggleFeatures) {
      this.btnToggleFeatures.addEventListener('click', () => {
        this.featureToolbarOpen = !this.featureToolbarOpen;
        if (this.featureToolbar) {
          this.featureToolbar.classList.toggle('hidden', !this.featureToolbarOpen);
        }
        this.btnToggleFeatures.classList.toggle('active', this.featureToolbarOpen);
      });
    }

    // Notification bell
    if (this.btnNotifications) {
      this.btnNotifications.addEventListener('click', () => {
        this.notificationCenter.toggle();
        this.updateNotifBadge();
      });
    }

    // Feature toolbar button routing
    this.bindFeatureToolbarEvents();
  }

  bindFeatureToolbarEvents() {
    const featureBtns = document.querySelectorAll('.feature-btn');
    featureBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const feature = btn.getAttribute('data-feature');
        this.openFeature(feature);
      });
    });
  }

  openFeature(feature) {
    const featureMap = {
      // Modals
      colorTheme: () => this.colorThemeDesigner.open(),
      compare: () => this.beforeAfterCompare.open(),
      collab: () => this.collaborationMode.open(),
      styles: () => this.styleLibrary.open(),
      notes: () => this.zoneNotes.open(),
      weather: () => this.weatherSimulator.open ? this.weatherSimulator.open() : this.weatherSimulator.render(),
      videoExport: () => this.walkthroughExporter.open(),
      arQR: () => this.arQRGenerator.open(),
      moodBoard: () => this.moodBoardMatcher.open(),
      contract: () => this.eSignatureFlow.open(),
      invoice: () => this.invoiceGenerator.open(),
      budgetAI: () => this.budgetOptimizer.open(),
      briefGen: () => this.eventBriefGenerator.open(),
      // Views
      vendors: () => this.switchView('vendors'),
      inventory: () => this.switchView('inventory'),
      calendar: () => this.switchView('calendar'),
      revenue: () => this.switchView('revenue'),
      testimonials: () => this.switchView('testimonials'),
      playlist: () => this.switchView('playlist'),
    };

    const action = featureMap[feature];
    if (action) action();
  }

  switchView(viewName) {
    this.activeView = viewName;

    // All view section containers
    const sections = [
      this.mapContainer, this.studioContainer, this.floorPlanContainer,
      this.analyticsContainer, this.proposalsContainer,
      this.timelineContainer, this.seatingContainer,
      this.vendorContainer, this.inventoryContainer, this.calendarContainer,
      this.revenueContainer, this.testimonialContainer, this.playlistContainer
    ];
    sections.forEach(s => { if (s) { s.classList.remove('active'); s.classList.add('hidden'); } });

    // All tab buttons
    const tabs = [
      this.tabMapView, this.tab360View, this.tabIndiaView,
      this.tabFloorPlanView, this.tabAnalyticsView, this.tabProposalsView,
      this.tabTimelineView, this.tabSeatingView
    ];
    tabs.forEach(t => { if (t) t.classList.remove('active'); });

    if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');

    switch (viewName) {
      case 'map':
        this.activateSection(this.mapContainer, this.tabMapView);
        break;
      case 'india':
        if (this.indiaSubBar) this.indiaSubBar.classList.remove('hidden');
        if (this.tabIndiaView) this.tabIndiaView.classList.add('active');
        this.switchIndiaMode(this.indiaMode);
        break;
      case 'floorplan':
        this.activateSection(this.floorPlanContainer, this.tabFloorPlanView);
        this.floorPlanEditor.updateSelections(this.activeSelections);
        break;
      case 'analytics':
        this.activateSection(this.analyticsContainer, this.tabAnalyticsView);
        this.analyticsDashboard.updateSelections(this.activeSelections);
        break;
      case 'proposals':
        this.activateSection(this.proposalsContainer, this.tabProposalsView);
        break;
      case 'timeline':
        this.activateSection(this.timelineContainer, this.tabTimelineView);
        if (this.timelinePlanner.updateSelections) this.timelinePlanner.updateSelections(this.activeSelections);
        break;
      case 'seating':
        this.activateSection(this.seatingContainer, this.tabSeatingView);
        if (this.seatingChart.updateSelections) this.seatingChart.updateSelections(this.activeSelections);
        break;
      case 'vendors':
        this.activateSection(this.vendorContainer);
        if (this.vendorManager.render) this.vendorManager.render();
        break;
      case 'inventory':
        this.activateSection(this.inventoryContainer);
        if (this.inventoryTracker.render) this.inventoryTracker.render();
        break;
      case 'calendar':
        this.activateSection(this.calendarContainer);
        if (this.calendarBooking.render) this.calendarBooking.render();
        break;
      case 'revenue':
        this.activateSection(this.revenueContainer);
        if (this.revenueAnalytics.render) this.revenueAnalytics.render();
        break;
      case 'testimonials':
        this.activateSection(this.testimonialContainer);
        if (this.testimonialWall.render) this.testimonialWall.render();
        break;
      case 'playlist':
        this.activateSection(this.playlistContainer);
        if (this.playlistBuilder.render) this.playlistBuilder.render();
        break;
      default:
        this.openStudio360(this.currentZoneId);
        break;
    }
  }

  activateSection(container, tab) {
    if (container) {
      container.classList.remove('hidden');
      container.classList.add('active');
    }
    if (tab) tab.classList.add('active');
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

    // Original component updates
    this.mapComponent.updateSelections(this.activeSelections);
    this.costCard.updateSelections(this.activeSelections);
    this.venueMenuModal.updateSelections(this.activeSelections);
    this.analyticsDashboard.updateSelections(this.activeSelections);
    this.proposalsManager.updateSelections(this.activeSelections);

    // New component updates (only if they have updateSelections)
    if (this.timelinePlanner && this.timelinePlanner.updateSelections) {
      this.timelinePlanner.updateSelections(this.activeSelections);
    }
    if (this.seatingChart && this.seatingChart.updateSelections) {
      this.seatingChart.updateSelections(this.activeSelections);
    }
  }

  updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (badge && this.notificationCenter) {
      const count = this.notificationCenter.getUnreadCount();
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
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

    if (this.notificationCenter) {
      this.notificationCenter.addNotification('AI Builder Complete', `Generated ${randomPreset} preset for 5,000 guests.`, '⚡');
      this.updateNotifBadge();
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
