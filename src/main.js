// canvas-confetti is only ever needed after a user action, never at first paint.
let _confetti = null;
async function confetti(options) {
  if (!_confetti) _confetti = (await import('canvas-confetti')).default;
  return _confetti(options);
}
import { VENUE_ZONES } from './data/zones.js';
import { getItemById, allItems } from './data/catalog.js';
import { resolveScenePanorama, hasSceneVariant } from './data/sceneVariants.js';
import { Viewer360 } from './engine/Viewer360.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { ApiService } from './services/apiService.js';
import { K as STORAGE_KEYS, loadRaw, saveRaw } from './services/storage.js';
import { formatMoney, escapeHtml } from './utils/format.js';

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

// Phase 5: AI & Ops Architecture
import { BudgetOptimizer } from './components/BudgetOptimizer.js';
import { EventBriefGenerator } from './components/EventBriefGenerator.js';
import { CustomEventBriefWizard } from './components/CustomEventBriefWizard.js';
import { N8nArchitectureWorkflow } from './components/N8nArchitectureWorkflow.js';

class Event360App {
  constructor() {
    this.activeView = 'map';
    this.currentZoneId = 'zone-stage';
    this.indiaMode = 'election';
    // Migrate legacy localStorage keys BEFORE anything reads storage.
    ApiService.initStorage();
    this.theme = loadRaw(STORAGE_KEYS.theme, 'dark');
    this.activeSelections = {};
    this.featureToolbarOpen = false;

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        this.activeSelections[slot.id] = slot.defaultItemId;
      });
    });
    // Captured before any restore overlays them, so "reset to defaults" stays possible.
    this.defaultSelections = { ...this.activeSelections };

    this.applyTheme(this.theme);
    this.initUI();
    this.initComponents();
    this.bindGlobalEvents();
    this.switchView(this.activeView);

    // Restore asynchronously — first paint must never wait on the API probe.
    this.restoreSavedState();
  }

  /**
   * Restore the user's last session. localStorage is authoritative; the local dev
   * API may upgrade it but can never blank it. Never blocks first paint, never throws:
   * defaults are already on screen by the time this runs.
   */
  async restoreSavedState() {
    try {
      const restored = await ApiService.restoreState(this.defaultSelections);
      if (restored?.currentZoneId && restored.currentZoneId !== this.currentZoneId) {
        this.currentZoneId = restored.currentZoneId;
      }
      const incoming = restored?.activeSelections || {};
      const changed = Object.keys(incoming).some(k => incoming[k] !== this.activeSelections[k]);
      if (!changed) return;
      this.updateAllComponents({ ...this.activeSelections, ...incoming });
      if (restored.source && restored.source !== 'default') {
        this.showToast('Restored your last saved design.');
      }
    } catch (err) {
      console.error('[Helm] state restore failed, continuing with defaults', err);
    }
  }

  applyTheme(themeMode) {
    this.theme = themeMode;
    document.documentElement.setAttribute('data-theme', themeMode);
    saveRaw(STORAGE_KEYS.theme, themeMode);

    const toggleBtnLabel = document.querySelector('.theme-mode-label');
    if (toggleBtnLabel) {
      toggleBtnLabel.textContent = themeMode === 'light' ? 'Light' : 'Dark';
    }
  }

  toggleTheme() {
    const nextTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(nextTheme);
    this.showToast(`Switched to Helm Events ${nextTheme.toUpperCase()} theme!`);
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
    this.n8nOpsContainer = document.getElementById('n8nOpsContainer');

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
    this.threeDEditorContainer = document.getElementById('threeDEditorContainer');

    // Original tabs
    this.tabMapView = document.getElementById('tabMapView');
    this.tab360View = document.getElementById('tab360View');
    this.tabN8nOpsView = document.getElementById('tabN8nOpsView');
    this.tabIndiaView = document.getElementById('tabIndiaView');
    this.tabFloorPlanView = document.getElementById('tabFloorPlanView');
    this.tabAnalyticsView = document.getElementById('tabAnalyticsView');
    this.tabProposalsView = document.getElementById('tabProposalsView');

    // New tabs & search
    this.tabTimelineView = document.getElementById('tabTimelineView');
    this.tabSeatingView = document.getElementById('tabSeatingView');
    this.globalNavSearch = document.getElementById('globalNavSearch');

    // Original buttons
    this.btnOpenVenueMenu = document.getElementById('btnOpenVenueMenu');
    this.btnOpenCart = document.getElementById('btnOpenCart');
    this.btnAIBuilder = document.getElementById('btnAIBuilder');
    this.btnCustomBrief = document.getElementById('btnCustomBrief');
    this.btnOpen3DEditor = document.getElementById('btnOpen3DEditor');
    this.btnSoundToggle = document.getElementById('btnSoundToggle');
    this.btnWatchTour360 = document.getElementById('btnWatchTour360');
    this.btnPresetDropdown = document.getElementById('btnPresetDropdown');
    this.presetPopoverMenu = document.getElementById('presetPopoverMenu');
    this.presetCurrentName = document.getElementById('presetCurrentName');
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
      (slotId) => this.openSwapperForSlot(slotId),
      (targetZoneId) => this.openStudio360(targetZoneId)
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
        this.updateAllComponents(selections);
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
        this.updateAllComponents(selections);
        this.showToast('Loaded day configuration from timeline!');
      }
    );

    this.seatingChart = new SeatingChart(
      this.seatingContainer,
      this.activeSelections
    );

    this.colorThemeDesigner = new ColorThemeDesigner(this.colorThemeContainer, (result) => {
      if (result?.saved) {
        this.showToast('Palette saved to your library!');
      } else if (result?.primary) {
        this.showToast(`🎨 Theme applied — Primary ${result.primary}`);
        confetti({ particleCount: 40, spread: 60, origin: { y: 0.35 } });
      }
    });

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

    // Built on first open — see the #btnOpen3DEditor handler. Keeping this lazy is
    // what keeps three.js (121 kB gzip) off the critical path for first paint.
    this.threeDLiveSpaceEditor = null;

    this.customEventBriefWizard = new CustomEventBriefWizard(
      this.customBriefWizardContainer,
      this.activeSelections,
      (selections, formData) => {
        Object.assign(this.activeSelections, selections);
        this.updateAllComponents(this.activeSelections);

        // Prefer launching into the concept's 360 plate when provided
        const themePano = selections.theme_panorama || selections.panoramaUrl;
        let targetZoneId = this.currentZoneId;
        if (formData?.category === 'political' || formData?.subCategory === 'rally') {
          targetZoneId = 'zone-india-election';
        } else if (formData?.subCategory === 'wedding' || formData?.subCategory === 'mandap') {
          targetZoneId = 'zone-india-function';
        } else if (formData?.subCategory === 'conference' || formData?.subCategory === 'summit') {
          targetZoneId = 'zone-india-meeting';
        } else if (selections['slot-function-mandap']) {
          targetZoneId = 'zone-india-function';
        } else if (selections['slot-meeting-podium']) {
          targetZoneId = 'zone-india-meeting';
        } else if (selections['slot-election-podium']) {
          targetZoneId = 'zone-india-election';
        } else {
          targetZoneId = 'zone-stage';
        }

        this.openStudio360(targetZoneId);
        if (themePano && this.viewer360?.updatePanorama) {
          setTimeout(() => this.viewer360.updatePanorama(themePano, { ...this.activeSelections }), 200);
        }

        this.showToast(`📋 Custom ${formData.category.toUpperCase()} event setup generated & applied!`);
        confetti({ particleCount: 80, spread: 90, origin: { y: 0.5 } });
        setTimeout(() => this.open3DEditor(), 350);
      }
    );

    // Phase 5: AI & Ops Architecture
    this.n8nArchitecture = new N8nArchitectureWorkflow(this.n8nOpsContainer);

    // Update notification badge
    this.updateNotifBadge();
  }

  bindGlobalEvents() {
    // Original tab events
    this.tabMapView.addEventListener('click', () => this.switchView('map'));
    this.tab360View.addEventListener('click', () => this.switchView('studio360'));
    if (this.tabN8nOpsView) this.tabN8nOpsView.addEventListener('click', () => this.switchView('n8n-ops'));
    if (this.tabIndiaView) this.tabIndiaView.addEventListener('click', () => this.switchView('india'));
    if (this.tabFloorPlanView) this.tabFloorPlanView.addEventListener('click', () => this.switchView('floorplan'));
    if (this.tabAnalyticsView) this.tabAnalyticsView.addEventListener('click', () => this.switchView('analytics'));
    if (this.tabProposalsView) this.tabProposalsView.addEventListener('click', () => this.switchView('proposals'));

    // New tab & search events
    if (this.tabTimelineView) this.tabTimelineView.addEventListener('click', () => this.switchView('timeline'));
    if (this.tabSeatingView) this.tabSeatingView.addEventListener('click', () => this.switchView('seating'));
    if (this.globalNavSearch) {
      this.globalNavSearch.setAttribute('role', 'combobox');
      this.globalNavSearch.setAttribute('aria-autocomplete', 'list');
      this.globalNavSearch.setAttribute('aria-expanded', 'false');
      this.globalNavSearch.setAttribute('aria-controls', 'navSearchResults');
      this.globalNavSearch.addEventListener('input', (e) => this.handleGlobalSearch(e.target.value));
      this.globalNavSearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); this.moveSearchSelection(1); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); this.moveSearchSelection(-1); }
        else if (e.key === 'Enter') { e.preventDefault(); this.runSearchResult(this._searchActiveIndex); }
        else if (e.key === 'Escape') { e.stopPropagation(); this.closeSearchPanel(); }
      });
      // Clicking elsewhere dismisses the results.
      document.addEventListener('click', (e) => {
        if (!this._searchPanel || this._searchPanel.hidden) return;
        if (e.target === this.globalNavSearch || this._searchPanel.contains(e.target)) return;
        this._searchPanel.hidden = true;
      });
      // ⌘K / Ctrl-K focuses search.
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          this.globalNavSearch.focus();
          this.globalNavSearch.select();
        }
      });
    }

    // Original button events
    if (this.btnOpenVenueMenu) this.btnOpenVenueMenu.addEventListener('click', () => this.venueMenuModal.open());
    if (this.btnOpenCart) this.btnOpenCart.addEventListener('click', () => this.cartPaymentModal.open());

    if (this.btnAIBuilder) {
      this.btnAIBuilder.addEventListener('click', () => this.runAIAutoBuilder());
    }

    if (this.btnCustomBrief) {
      this.btnCustomBrief.addEventListener('click', () => this.customEventBriefWizard.open());
    }

    if (this.btnOpen3DEditor) {
      this.btnOpen3DEditor.addEventListener('click', () => this.open3DEditor());
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
        const on = this.viewer360.toggleAutoRotate();
        this.btnAutoRotate.classList.toggle('active', on);
        this.showToast(on ? 'Auto-rotate ON' : 'Auto-rotate OFF');
      });
    }

    const timeBtns = document.querySelectorAll('.time-btn');
    timeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        timeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (this.viewer360?.setTimeOfDay) {
          this.viewer360.setTimeOfDay(btn.getAttribute('data-time'));
        }
      });
    });

    if (this.btnPresetDropdown && this.presetPopoverMenu) {
      const positionThemeMenu = () => {
        const rect = this.btnPresetDropdown.getBoundingClientRect();
        const menu = this.presetPopoverMenu;
        const width = menu.offsetWidth || 240;
        let left = rect.right - width;
        if (left < 8) left = 8;
        if (left + width > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - width - 8);
        }
        menu.style.top = `${Math.round(rect.bottom + 6)}px`;
        menu.style.left = `${Math.round(left)}px`;
        menu.style.right = 'auto';
      };

      const closeThemeMenu = () => {
        this.presetPopoverMenu.classList.add('hidden');
        this.btnPresetDropdown.setAttribute('aria-expanded', 'false');
      };

      const openThemeMenu = () => {
        this.presetPopoverMenu.classList.remove('hidden');
        this.btnPresetDropdown.setAttribute('aria-expanded', 'true');
        positionThemeMenu();
      };

      this.btnPresetDropdown.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.presetPopoverMenu.classList.contains('hidden')) openThemeMenu();
        else closeThemeMenu();
      });

      const menuItems = this.presetPopoverMenu.querySelectorAll('.preset-menu-item');
      menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          menuItems.forEach(m => {
            m.classList.remove('active');
            const check = m.querySelector('.item-check');
            if (check) check.textContent = '';
          });

          item.classList.add('active');
          const check = item.querySelector('.item-check');
          if (check) check.textContent = '✓';

          const val = item.getAttribute('data-value');
          const icon = item.querySelector('.item-icon')?.textContent || '';
          const name = item.querySelector('.item-name')?.textContent || '';

          if (this.presetCurrentName) {
            const parts = name.split(' ');
            this.presetCurrentName.textContent = `${icon} ${parts[0]} ${parts[1] || ''}`.trim();
          }

          closeThemeMenu();
          this.applyThemePreset(val);
        });
      });

      document.addEventListener('click', (e) => {
        if (this.presetPopoverMenu.classList.contains('hidden')) return;
        if (!this.btnPresetDropdown.contains(e.target) && !this.presetPopoverMenu.contains(e.target)) {
          closeThemeMenu();
        }
      });

      window.addEventListener('resize', () => {
        if (!this.presetPopoverMenu.classList.contains('hidden')) positionThemeMenu();
      });
      window.addEventListener('scroll', () => {
        if (!this.presetPopoverMenu.classList.contains('hidden')) positionThemeMenu();
      }, true);
    }

    // Escape closes the TOP-MOST modal only. It used to fire close() on all 17
    // modals at once, so Escape inside a text field tore down the whole session.
    window.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (this.closeTopModal()) e.preventDefault();
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

    // Human-readable names — the toast used to leak the internal key ("Opened colorTheme").
    const featureLabels = {
      colorTheme: 'Colour & Theme Designer',
      compare: 'Before / After Comparison',
      collab: 'Collaboration',
      styles: 'Floral & Decor Style Library',
      notes: 'Zone Notes',
      weather: 'Weather Simulator',
      videoExport: 'Walkthrough Video Export',
      arQR: 'AR Preview Code',
      moodBoard: 'Mood Board Matcher',
      contract: 'Service Agreement',
      invoice: 'Tax Invoice',
      budgetAI: 'Budget Optimiser',
      briefGen: 'Event Brief',
      vendors: 'Vendor Directory',
      inventory: 'Inventory Tracker',
      calendar: 'Booking Calendar',
      revenue: 'Revenue Analytics',
      testimonials: 'Client Reviews',
      playlist: 'Playlist Builder'
    };

    const modalKeyByFeature = {
      colorTheme: 'colorThemeDesigner', compare: 'beforeAfterCompare', collab: 'collaborationMode',
      styles: 'styleLibrary', notes: 'zoneNotes', weather: 'weatherSimulator',
      videoExport: 'walkthroughExporter', arQR: 'arQRGenerator', moodBoard: 'moodBoardMatcher',
      contract: 'eSignatureFlow', invoice: 'invoiceGenerator', budgetAI: 'budgetOptimizer',
      briefGen: 'eventBriefGenerator'
    };

    const action = featureMap[feature];
    if (!action) {
      this.showToast(`"${feature}" isn't available yet.`);
      return;
    }

    this._lastTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    try {
      action();
    } catch (err) {
      console.error('[Helm] failed to open feature', feature, err);
      this.showToast(`Couldn't open ${featureLabels[feature] || feature}.`);
      return;
    }
    if (modalKeyByFeature[feature]) this.noteModalOpened(modalKeyByFeature[feature]);

    // Auto-collapse toolbar after pick
    this.featureToolbarOpen = false;
    if (this.featureToolbar) this.featureToolbar.classList.add('hidden');
    if (this.btnToggleFeatures) {
      this.btnToggleFeatures.classList.remove('active');
      this.btnToggleFeatures.setAttribute('aria-expanded', 'false');
    }
    this.showToast(`Opened ${featureLabels[feature] || feature}`);
  }

  /**
   * Hide every view section. Anything that reveals a view must call this first,
   * otherwise the previously active section keeps `.active` and the later DOM
   * sibling simply paints on top of it.
   */
  hideAllSections() {
    const sections = [
      this.mapContainer, this.studioContainer, this.floorPlanContainer,
      this.analyticsContainer, this.proposalsContainer,
      this.timelineContainer, this.seatingContainer,
      this.vendorContainer, this.inventoryContainer, this.calendarContainer,
      this.revenueContainer, this.testimonialContainer, this.playlistContainer,
      this.n8nOpsContainer
    ];
    sections.forEach(s => { if (s) { s.classList.remove('active'); s.classList.add('hidden'); } });
  }

  switchView(viewName) {
    this.activeView = viewName;

    this.hideAllSections();

    // All tab buttons
    const tabs = [
      this.tabMapView, this.tab360View, this.tabN8nOpsView, this.tabIndiaView,
      this.tabFloorPlanView, this.tabAnalyticsView, this.tabProposalsView,
      this.tabTimelineView, this.tabSeatingView
    ];
    tabs.forEach(t => { if (t) t.classList.remove('active'); });

    if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');

    switch (viewName) {
      case 'map':
        this.activateSection(this.mapContainer, this.tabMapView);
        break;

      case 'n8n-ops':
        this.activateSection(this.n8nOpsContainer, this.tabN8nOpsView);
        if (this.n8nArchitecture?.render) this.n8nArchitecture.render();
        break;

      // FIXED: explicit studio360 case — just shows the container,
      // does NOT reload the zone (preventing double renders)
      case 'studio360': {
        this.activateSection(this.studioContainer, this.tab360View);
        // Only load zone if we don't already have one loaded
        if (!this.viewer360.currentZone || this.viewer360.currentZone.id !== this.currentZoneId) {
          this.openStudio360(this.currentZoneId);
        } else {
          // Just re-render the inventory drawer to keep it in sync
          const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
          if (zone) this.renderInventoryDrawer(zone);
        }
        break;
      }

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
    const targetZoneId = `zone-india-${modeKey}`;
    const zone = VENUE_ZONES.find(z => z.id === targetZoneId);
    // Bail BEFORE touching the DOM — bailing afterwards left every section hidden
    // and the viewport blank.
    if (!zone) {
      this.showToast(`No 360° set is configured for "${modeKey}" yet.`);
      return;
    }

    this.indiaMode = modeKey;
    this.currentZoneId = targetZoneId;

    this.hideAllSections();
    this.activateSection(this.studioContainer, null);

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
    this.hideAllSections();
    this.activateSection(this.studioContainer, null);

    // Reset every tab, not just the map tab — this method is reachable from any view
    // (map hotspots, AI builder, venue menu, quick search).
    [this.tabMapView, this.tabN8nOpsView, this.tabIndiaView, this.tabFloorPlanView,
     this.tabAnalyticsView, this.tabProposalsView, this.tabTimelineView, this.tabSeatingView]
      .forEach(t => { if (t) t.classList.remove('active'); });
    if (this.indiaSubBar) this.indiaSubBar.classList.add('hidden');
    if (this.tab360View) this.tab360View.classList.add('active');

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
      const qty = slot.quantityByItem?.[selectedItemId] ?? slot.quantity;

      const itemName = item ? item.name : 'None selected';
      const lineTotal = item ? Math.round(item.price * qty) : 0;
      return `
        <button type="button" class="slot-item-card" data-slot-id="${slot.id}"
                aria-label="Change ${escapeHtml(slot.label)} — currently ${escapeHtml(itemName)}, ${qty} at ${formatMoney(lineTotal)}">
          <div class="slot-item-head">
            <span>${escapeHtml(slot.label)}</span>
            <small>${qty}x</small>
          </div>
          <div class="slot-item-body">
            <strong>${escapeHtml(itemName)}</strong>
            <span class="slot-item-price">${formatMoney(lineTotal)}</span>
          </div>
          ${customText ? `<div class="slot-writing-tag">✍️ "${escapeHtml(customText)}"</div>` : ''}
        </button>
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
    // 1. Update state
    this.activeSelections[slotId] = newItemId;
    if (customText !== undefined) {
      this.activeSelections[`custom_text_${slotId}`] = customText;
    }

    const item = getItemById(newItemId);
    const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
    const slot = zone?.slots.find(s => s.id === slotId);

    // Apply quantity presets (e.g. chair count on stage)
    if (quantity != null && slot) {
      slot.quantity = quantity;
    } else if (slot?.quantityByItem?.[newItemId] != null) {
      slot.quantity = slot.quantityByItem[newItemId];
    }

    ApiService.recordSwap({
      slotId,
      itemId: newItemId,
      itemTitle: item ? item.name : newItemId,
      zoneId: this.currentZoneId,
      category: slot ? slot.category : 'furniture'
    });

    // 2. Load environment-locked variant plate for THIS slot when available.
    //    Falls back to zone-local backdrop plate; never jumps to another venue.
    let panoramaChanged = false;
    if (zone && this.viewer360?.updatePanorama) {
      const nextPano = resolveScenePanorama(
        this.currentZoneId,
        zone,
        this.activeSelections,
        slotId
      );
      const currentPanorama = this.viewer360._currentPanorama || zone.panoramaUrl;
      if (nextPano && nextPano !== currentPanorama) {
        this.viewer360.updatePanorama(nextPano, { ...this.activeSelections });
        panoramaChanged = true;
      } else if (
        !hasSceneVariant(this.currentZoneId, slotId, newItemId) &&
        slot?.category === 'backdrops' &&
        item?.panoramaUrl &&
        item.panoramaUrl !== currentPanorama &&
        // Only accept backdrop plates that belong to this zone family
        this._isZoneLocalPanorama(item.panoramaUrl, zone)
      ) {
        this.viewer360.updatePanorama(item.panoramaUrl, { ...this.activeSelections });
        panoramaChanged = true;
      }
    }

    // 3. Hotspot card + live prop overlay (always — even when plate reloads)
    if (this.viewer360?.updateSlotDisplay) {
      this.viewer360.updateSlotDisplay(slotId, newItemId, customText);
    }

    if (customText !== undefined && this.threeDLiveSpaceEditor?.updateSloganText) {
      this.threeDLiveSpaceEditor.updateSloganText(customText);
    }

    if (zone) this.renderInventoryDrawer(zone);
    this.updateAllComponents(this.activeSelections);

    if (item) {
      const label = customText ? `${item.name} — "${customText}"` : item.name;
      const hint = panoramaChanged
        ? ' · 360° scene updated (element only)'
        : hasSceneVariant(this.currentZoneId, slotId, newItemId)
          ? ' · already showing this look'
          : ' · selection saved';
      this.showToast(`✅ Swapped to ${label}${hint}`);
      confetti({ particleCount: 55, spread: 75, origin: { y: 0.75 }, colors: ['#f59e0b', '#a855f7', '#06b6d4'] });
    }
  }

  /** Keep backdrop swaps inside the current venue instead of teleporting zones. */
  _isZoneLocalPanorama(url, zone) {
    if (!url || !zone) return false;
    if (url === zone.panoramaUrl) return true;
    const zoneFamily = {
      // Only plates that actually show the outdoor stage lawn. The wall/foyer plates
      // are a different venue — loading one is a teleport, not a swap.
      'zone-stage': ['zone_stage', 'variants/zone-stage'],
      'zone-banquet': ['zone_banquet'],
      'zone-fountain': ['zone_fountain', 'zone_stone', 'zone_dancing', 'variants/zone-fountain'],
      'zone-lounge': ['zone_lounge'],
      // zone_marigold_wall is a palace hall and variants/zone-fountain is the outdoor
      // plaza — neither is the entrance foyer.
      'zone-entrance': ['zone_entrance', 'zone_hedge', 'zone_shimmer'],
      'zone-india-election': ['india_election', 'variants/zone-india-election', 'political_presidential'],
      'zone-india-function': ['india_function', 'variants/zone-india-function'],
      'zone-india-meeting': ['india_meeting', 'variants/zone-india-meeting']
    };
    const keys = zoneFamily[zone.id] || [];
    return keys.some(k => url.includes(k));
  }


  /**
   * Single fan-out point for a design change.
   *
   * `activeSelections` is mutated IN PLACE and never reassigned: ~19 components are
   * constructed with a reference to this object, and replacing it silently froze
   * every component that wasn't in the hand-maintained list below (load a proposal,
   * then open the Cart and it still quoted the previous design).
   */
  updateAllComponents(newSelections) {
    if (newSelections && newSelections !== this.activeSelections) {
      const normalized = this.normalizeSelections(newSelections);
      for (const key of Object.keys(this.activeSelections)) delete this.activeSelections[key];
      Object.assign(this.activeSelections, normalized);
    }

    ApiService.syncState(this.activeSelections, this.currentZoneId);

    const zone = VENUE_ZONES.find(z => z.id === this.currentZoneId);
    if (zone) this.renderInventoryDrawer(zone);

    // Push to every component that can take a selection update. Iterating the
    // instances means a new component is wired up just by exposing the method.
    for (const component of this.statefulComponents()) {
      if (typeof component?.updateSelections !== 'function') continue;
      try {
        component.updateSelections(this.activeSelections);
      } catch (err) {
        console.error('[Helm] updateSelections failed for', component?.constructor?.name, err);
      }
    }
  }

  /**
   * Coerce an incoming selection map to the canonical shape: slotId -> itemId string.
   *
   * Some producers used to emit `{ itemId, quantity }` objects. `getItemById(<object>)`
   * returns null, which silently zeroed the entire quote and emptied the 360 view with
   * no error. Normalising at the one funnel makes that class of bug unreachable.
   */
  normalizeSelections(selections) {
    const out = {};
    for (const [slotId, value] of Object.entries(selections || {})) {
      if (typeof value === 'string') {
        out[slotId] = value;
      } else if (value && typeof value === 'object' && typeof value.itemId === 'string') {
        out[slotId] = value.itemId;
        const zone = VENUE_ZONES.find(z => z.slots.some(sl => sl.id === slotId));
        const slot = zone?.slots.find(sl => sl.id === slotId);
        if (slot && Number.isFinite(Number(value.quantity)) && Number(value.quantity) > 0) {
          slot.quantity = Number(value.quantity);
        }
      } else if (value != null) {
        console.warn('[Helm] ignoring malformed selection for', slotId, value);
      }
    }
    return out;
  }

  /**
   * Modal registry. Each entry pairs a component with the container it renders into;
   * a container with children means that modal is on screen. `openedAt` gives us a
   * stack order so Escape closes only the top-most one.
   */
  modalRegistry() {
    return [
      ['notificationCenter', this.notificationCenter, this.notificationContainer],
      ['colorThemeDesigner', this.colorThemeDesigner, this.colorThemeContainer],
      ['beforeAfterCompare', this.beforeAfterCompare, this.compareContainer],
      ['collaborationMode', this.collaborationMode, this.collabContainer],
      ['styleLibrary', this.styleLibrary, this.styleLibraryContainer],
      ['zoneNotes', this.zoneNotes, this.zoneNotesContainer],
      ['weatherSimulator', this.weatherSimulator, this.weatherSimContainer],
      ['walkthroughExporter', this.walkthroughExporter, this.videoExportContainer],
      ['arQRGenerator', this.arQRGenerator, this.arQRContainer],
      ['moodBoardMatcher', this.moodBoardMatcher, this.moodBoardContainer],
      ['eSignatureFlow', this.eSignatureFlow, this.eSignatureContainer],
      ['invoiceGenerator', this.invoiceGenerator, this.invoiceContainer],
      ['budgetOptimizer', this.budgetOptimizer, this.budgetOptContainer],
      ['eventBriefGenerator', this.eventBriefGenerator, this.briefGenContainer],
      ['customEventBriefWizard', this.customEventBriefWizard, this.customBriefWizardContainer],
      ['threeDLiveSpaceEditor', this.threeDLiveSpaceEditor, this.threeDEditorContainer],
      ['swapperModal', this.swapperModal, this.swapperContainer],
      ['venueMenuModal', this.venueMenuModal, this.venueMenuContainer],
      ['cartPaymentModal', this.cartPaymentModal, this.cartModalContainer]
    ].filter(([, component]) => component);
  }

  /**
   * Open the 3D editor, importing it on first use.
   *
   * three.js is 121 kB gzipped and the editor sits behind a button, so it is kept
   * off the critical path and pulled in here. Every entry point (the toolbar button
   * and the brief wizard's hand-off) must come through this method.
   */
  async open3DEditor() {
    const btn = this.btnOpen3DEditor;
    if (btn?.dataset.loading === '1') return;

    if (!this.threeDLiveSpaceEditor) {
      const label = btn?.textContent;
      if (btn) {
        btn.dataset.loading = '1';
        btn.disabled = true;
        btn.setAttribute('aria-busy', 'true');
        btn.textContent = 'Loading 3D editor…';
      }
      try {
        const { ThreeDLiveSpaceEditor } = await import('./components/ThreeDLiveSpaceEditor.js');
        this.threeDLiveSpaceEditor = new ThreeDLiveSpaceEditor(
          this.threeDEditorContainer,
          this.activeSelections,
          (selections) => this.updateAllComponents(selections)
        );
        // The 3D floor plan is a SEPARATE costing surface from the zone catalogue.
        // Record the layout for proposals and exports, but do NOT fold its total
        // into the venue subtotal — the zones already price tables, chairs and
        // staging, so counting both would double-charge the client.
        this.threeDLiveSpaceEditor.onLayoutChange = (layout) => {
          this.floorPlanLayout = layout;
        };
      } catch (err) {
        console.error('[Helm] 3D editor failed to load', err);
        this.showToast('The 3D editor could not load. Check your connection and try again.');
        return;
      } finally {
        if (btn) {
          btn.dataset.loading = '0';
          btn.disabled = false;
          btn.removeAttribute('aria-busy');
          btn.textContent = label;
        }
      }
    }

    this._lastTrigger = btn || null;
    this.noteModalOpened('threeDLiveSpaceEditor');
    this.threeDLiveSpaceEditor.open();
  }

  /** Record that a modal was opened, so Escape knows which one is on top. */
  noteModalOpened(key) {
    this._modalOrder = this._modalOrder || {};
    this._modalOrder[key] = Date.now();
  }

  /** Close the top-most open modal. Returns true if one was closed. */
  closeTopModal() {
    const order = this._modalOrder || {};
    const open = this.modalRegistry()
      .filter(([, , container]) => container && container.childElementCount > 0)
      .sort((a, b) => (order[b[0]] || 0) - (order[a[0]] || 0));

    if (!open.length) return false;
    const [key, component] = open[0];
    if (typeof component.close === 'function') {
      try {
        component.close();
      } catch (err) {
        console.error('[Helm] close failed for', key, err);
      }
    }
    delete (this._modalOrder || {})[key];
    // Return focus to whatever opened the modal.
    if (this._lastTrigger && document.contains(this._lastTrigger)) {
      this._lastTrigger.focus();
      this._lastTrigger = null;
    }
    return true;
  }

  /** Every component that may hold a copy of the current design. */
  statefulComponents() {
    return [
      this.mapComponent, this.costCard, this.venueMenuModal, this.analyticsDashboard,
      this.proposalsManager, this.timelinePlanner, this.seatingChart, this.floorPlanEditor,
      this.cartPaymentModal, this.invoiceGenerator, this.eSignatureFlow, this.budgetOptimizer,
      this.inventoryTracker, this.revenueAnalytics, this.moodBoardMatcher, this.briefGenerator,
      this.eventBriefGenerator, this.threeDEditor, this.compareTool, this.zoneNotes
    ].filter(Boolean);
  }

  updateNotifBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge || !this.notificationCenter) return;
    const count = this.notificationCenter.getUnreadCount();
    badge.textContent = count > 0 ? String(count) : '';
    // `hidden` rather than inline display, so the stylesheet keeps control of layout
    // and screen readers don't announce an empty badge.
    badge.hidden = count === 0;
    const bell = document.getElementById('btnNotifications');
    if (bell) {
      bell.setAttribute('aria-label',
        count > 0 ? `Notifications, ${count} unread` : 'Notifications');
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
          'theme_panorama': '/images/zone_stage_360.jpg',
          'slot-stage-main': 'stage-royal-pavilion',
          'slot-stage-backdrop': 'backdrop-marigold-garland',
          'slot-stage-seating': 'chair-chiavari-gold',
          'slot-banquet-table': 'table-round-standard',
          'slot-banquet-chairs': 'chair-chiavari-gold',
          'slot-banquet-lighting': 'lighting-chandeliers',
          'slot-fountain-center': 'fountain-royal-marble',
          'slot-function-mandap': 'stage-royal-mandap',
          'slot-function-marigold': 'backdrop-marigold-garland',
          'slot-function-throne': 'chair-maharaja-throne'
        };
        break;
      case 'cyber':
        presetMap = {
          'theme_panorama': '/images/reception_midnight_velvet_360.jpg',
          'slot-stage-main': 'stage-led-arch',
          'slot-stage-backdrop': 'backdrop-shimmer-sequin',
          'slot-stage-seating': 'chair-ghost',
          'slot-banquet-table': 'table-cocktail',
          'slot-banquet-chairs': 'chair-ghost',
          'slot-fountain-center': 'fountain-dancing-jets',
          'slot-meeting-podium': 'stage-digital-podium',
          'slot-meeting-screen': 'screen-layout-dual'
        };
        break;
      case 'garden':
        presetMap = {
          'theme_panorama': '/images/zone_lounge_360.jpg',
          'slot-stage-main': 'stage-wooden-riser',
          'slot-stage-backdrop': 'backdrop-hedge-wall',
          'slot-stage-seating': 'chair-folding',
          'slot-banquet-table': 'table-rustic-wood',
          'slot-fountain-center': 'fountain-tiered-stone',
          'slot-entrance-arch': 'backdrop-floral-wall'
        };
        break;
      case 'minimal':
        presetMap = {
          'theme_panorama': '/images/reception_crystal_gala_360.jpg',
          'slot-stage-main': 'stage-led-arch',
          'slot-stage-backdrop': 'backdrop-floral-wall',
          'slot-stage-seating': 'chair-ghost',
          'slot-banquet-table': 'table-round-standard',
          'slot-meeting-screen': 'screen-layout-center'
        };
        break;
    }

    Object.assign(this.activeSelections, presetMap);
    this.updateAllComponents(this.activeSelections);

    // Open 360 studio so the theme is visibly applied
    const preferredZone =
      (presetKey === 'royal' && 'zone-india-function') ||
      (presetKey === 'cyber' && 'zone-india-meeting') ||
      (presetKey === 'garden' && 'zone-lounge') ||
      'zone-stage';

    this.openStudio360(preferredZone);
    const zone = VENUE_ZONES.find(z => z.id === preferredZone);
    const pano = presetMap.theme_panorama;
    if (pano && this.viewer360?.updatePanorama) {
      setTimeout(() => this.viewer360.updatePanorama(pano, { ...this.activeSelections }), 180);
    } else if (zone && this.viewer360) {
      this.viewer360.loadZone(zone, this.activeSelections);
    }

    this.showToast(`✨ Applied ${presetKey.toUpperCase()} Theme Preset!`);
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

  /**
   * Quick search.
   *
   * The previous version navigated on every keystroke with a 2-character minimum,
   * so typing "vendor" matched a zone subtitle at "ve" and did a full panorama
   * reload before you finished the word. Now it shows ranked results and only
   * navigates when you pick one (click, Enter, or arrow keys).
   */
  handleGlobalSearch(rawQuery) {
    clearTimeout(this._searchDebounce);
    this._searchDebounce = setTimeout(() => this.renderSearchResults(rawQuery), 160);
  }

  searchIndex() {
    if (this._searchIndexCache) return this._searchIndexCache;

    const entries = [];

    VENUE_ZONES.forEach(zone => {
      entries.push({
        kind: 'Zone',
        label: zone.name,
        detail: zone.subtitle || '360° studio',
        keywords: `${zone.name} ${zone.subtitle || ''}`,
        run: () => this.openStudio360(zone.id)
      });
      zone.slots.forEach(slot => {
        entries.push({
          kind: 'Item slot',
          label: slot.label,
          detail: `in ${zone.name}`,
          keywords: `${slot.label} ${slot.category || ''} ${zone.name}`,
          run: () => {
            this.openStudio360(zone.id);
            setTimeout(() => this.openSwapperForSlot(slot.id), 200);
          }
        });
      });
    });

    allItems().forEach(item => {
      entries.push({
        kind: 'Catalog',
        label: item.name,
        detail: formatMoney(item.price),
        keywords: `${item.name} ${item.category || ''} ${item.description || ''}`,
        run: () => {
          const hit = VENUE_ZONES.flatMap(z => z.slots.map(sl => ({ z, sl })))
            .find(({ sl }) => (sl.allowedItemIds || []).includes(item.id) || sl.defaultItemId === item.id);
          if (!hit) { this.showToast(`${item.name} isn't placed in this venue yet.`); return; }
          this.openStudio360(hit.z.id);
          setTimeout(() => this.openSwapperForSlot(hit.sl.id), 200);
        }
      });
    });

    const views = [
      ['Aerial venue map', 'map'], ['360° Studio', 'studio360'], ['n8n AI Ops architecture', 'n8n-ops'],
      ['India events', 'india'], ['Floor plan', 'floorplan'], ['Analytics', 'analytics'],
      ['Proposals', 'proposals'], ['Timeline', 'timeline'], ['Seating chart', 'seating'],
      ['Vendors', 'vendors'], ['Inventory', 'inventory'], ['Booking calendar', 'calendar'],
      ['Revenue analytics', 'revenue'], ['Client reviews', 'testimonials'], ['Playlist', 'playlist']
    ];
    views.forEach(([label, view]) => entries.push({
      kind: 'Go to', label, detail: 'View', keywords: label, run: () => this.switchView(view)
    }));

    this._searchIndexCache = entries;
    return entries;
  }

  /** Simple scorer: prefix match beats word-start beats substring. */
  scoreEntry(entry, q) {
    const hay = entry.keywords.toLowerCase();
    const label = entry.label.toLowerCase();
    if (label.startsWith(q)) return 100;
    if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(label)) return 70;
    if (label.includes(q)) return 50;
    if (hay.includes(q)) return 20;
    return 0;
  }

  renderSearchResults(rawQuery) {
    const q = String(rawQuery || '').toLowerCase().trim();
    const panel = this.ensureSearchPanel();

    if (q.length < 2) {
      panel.hidden = true;
      this._searchResults = [];
      if (this.globalNavSearch) this.globalNavSearch.setAttribute('aria-expanded', 'false');
      return;
    }

    const results = this.searchIndex()
      .map(entry => ({ entry, score: this.scoreEntry(entry, q) }))
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(r => r.entry);

    this._searchResults = results;
    this._searchActiveIndex = results.length ? 0 : -1;

    if (!results.length) {
      panel.innerHTML = `<div class="nav-search-empty">No matches for "${escapeHtml(rawQuery)}"</div>`;
    } else {
      panel.innerHTML = results.map((entry, i) => `
        <button type="button" class="nav-search-result${i === 0 ? ' is-active' : ''}"
                role="option" aria-selected="${i === 0}" data-index="${i}">
          <span class="nsr-kind">${escapeHtml(entry.kind)}</span>
          <span class="nsr-label">${escapeHtml(entry.label)}</span>
          <span class="nsr-detail">${escapeHtml(entry.detail)}</span>
        </button>`).join('');
      panel.querySelectorAll('.nav-search-result').forEach(btn => {
        btn.addEventListener('click', () => this.runSearchResult(Number(btn.dataset.index)));
      });
    }

    panel.hidden = false;
    if (this.globalNavSearch) this.globalNavSearch.setAttribute('aria-expanded', 'true');
  }

  ensureSearchPanel() {
    if (this._searchPanel && document.contains(this._searchPanel)) return this._searchPanel;
    const panel = document.createElement('div');
    panel.className = 'nav-search-results';
    panel.id = 'navSearchResults';
    panel.setAttribute('role', 'listbox');
    panel.hidden = true;
    (this.globalNavSearch?.parentElement || document.body).appendChild(panel);
    this._searchPanel = panel;
    return panel;
  }

  moveSearchSelection(delta) {
    const results = this._searchResults || [];
    if (!results.length) return;
    const count = results.length;
    this._searchActiveIndex = ((this._searchActiveIndex + delta) % count + count) % count;
    this._searchPanel?.querySelectorAll('.nav-search-result').forEach((btn, i) => {
      const active = i === this._searchActiveIndex;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', String(active));
      if (active) btn.scrollIntoView({ block: 'nearest' });
    });
  }

  runSearchResult(index) {
    const entry = (this._searchResults || [])[index];
    if (!entry) return;
    this.closeSearchPanel();
    try {
      entry.run();
      this.showToast(`${entry.kind}: ${entry.label}`);
    } catch (err) {
      console.error('[Helm] search navigation failed', err);
      this.showToast(`Couldn't open ${entry.label}.`);
    }
  }

  closeSearchPanel() {
    if (this._searchPanel) this._searchPanel.hidden = true;
    this._searchResults = [];
    this._searchActiveIndex = -1;
    if (this.globalNavSearch) {
      this.globalNavSearch.value = '';
      this.globalNavSearch.setAttribute('aria-expanded', 'false');
      this.globalNavSearch.blur();
    }
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
//
// A single corrupt localStorage value used to throw out of a component constructor
// and leave a blank white page with one console error and no way to recover. Boot
// defensively and always give the user a way out.
window.addEventListener('DOMContentLoaded', () => {
  try {
    window.app = new Event360App();
  } catch (err) {
    console.error('[Helm] startup failed', err);
    renderStartupFailure(err);
  }
});

function renderStartupFailure(err) {
  const panel = document.createElement('div');
  panel.setAttribute('role', 'alert');
  panel.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999', 'display:flex',
    'align-items:center', 'justify-content:center', 'padding:24px',
    'background:#0b0b0f', 'color:#f5f5f7',
    'font:400 15px/1.6 Inter,-apple-system,BlinkMacSystemFont,sans-serif'
  ].join(';');
  panel.innerHTML = `
    <div style="max-width:520px;text-align:center">
      <h1 style="font-size:1.4rem;margin:0 0 12px">Helm Events couldn't start</h1>
      <p style="opacity:.75;margin:0 0 8px">
        Something in your saved session data is unreadable. Resetting it will clear saved
        proposals, bookings and notes on this device, then reload the studio.
      </p>
      <pre style="text-align:left;overflow:auto;max-height:140px;background:#16161c;padding:12px;
                  border-radius:10px;font-size:12px;opacity:.7">${String(err && err.message || err)}</pre>
      <button id="helmResetBtn" style="margin-top:16px;padding:10px 20px;border:0;border-radius:999px;
              background:#e5a93b;color:#1d1d1f;font-weight:600;cursor:pointer">
        Reset saved data and reload
      </button>
    </div>`;
  document.body.appendChild(panel);
  panel.querySelector('#helmResetBtn')?.addEventListener('click', () => {
    try { localStorage.clear(); } catch { /* storage unavailable */ }
    location.reload();
  });
}
