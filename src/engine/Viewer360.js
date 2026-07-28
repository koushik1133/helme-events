import { getItemById } from '../data/catalog.js';

export class Viewer360 {
  constructor(containerElement, onSelectSlot) {
    this.container = containerElement;
    this.onSelectSlot = onSelectSlot;
    this.currentZone = null;
    this.activeSelections = new Map();
    this.viewer = null;
    this.autoRotate = false;
  }

  loadZone(zoneData, activeSelectionsMap = {}) {
    this.currentZone = zoneData;

    // Destroy existing Pannellum instance if present
    if (this.viewer) {
      try {
        this.viewer.destroy();
      } catch (e) {
        // ignore
      }
      this.viewer = null;
    }

    // Set active selections
    zoneData.slots.forEach(slot => {
      const itemId = activeSelectionsMap[slot.id] || slot.defaultItemId;
      this.activeSelections.set(slot.id, itemId);
    });

    // Build Hotspots Configuration for Pannellum
    const hotSpotsConfig = zoneData.slots.map(slot => {
      const selectedItemId = this.activeSelections.get(slot.id);
      const item = getItemById(selectedItemId);

      return {
        pitch: slot.pos3D.pitch,
        yaw: slot.pos3D.yaw,
        cssClass: 'custom-pannellum-hotspot',
        createTooltipFunc: (hotSpotDiv) => {
          this.createHotspotOverlay(hotSpotDiv, slot, item);
        },
        clickHandlerFunc: () => {
          if (this.onSelectSlot) {
            this.onSelectSlot(slot.id);
          }
        }
      };
    });

    // Check if global pannellum is available
    if (window.pannellum) {
      this.container.innerHTML = '';

      this.viewer = window.pannellum.viewer(this.container, {
        type: 'equirectangular',
        panorama: zoneData.panoramaUrl,
        autoLoad: true,
        showZoomCtrl: true,
        showFullscreenCtrl: false,
        autoRotate: this.autoRotate ? -2 : 0,
        hotSpots: hotSpotsConfig
      });
    } else {
      // Fallback Photo Panorama Viewer
      this.container.innerHTML = `
        <div class="fallback-panorama-wrapper">
          <img src="${zoneData.panoramaUrl}" class="fallback-panorama-img" alt="${zoneData.name}" />
        </div>
      `;
    }
  }

  createHotspotOverlay(hotSpotDiv, slot, item) {
    hotSpotDiv.innerHTML = `
      <div class="hotspot-target-pill" data-slot-id="${slot.id}">
        <span class="pulse-beacon"></span>
        <div class="hotspot-badge-card">
          <img src="${item ? item.imageUrl : ''}" class="hotspot-thumb" alt="${item ? item.name : ''}" />
          <div class="hotspot-text">
            <span class="slot-label">${slot.label} (${slot.quantity}x)</span>
            <strong class="item-name">${item ? item.name : 'None'}</strong>
            <span class="item-price">$${item ? item.price * slot.quantity : 0}</span>
          </div>
        </div>
      </div>
    `;

    hotSpotDiv.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onSelectSlot) {
        this.onSelectSlot(slot.id);
      }
    });
  }

  swapObjectInSlot(slotId, newItemId) {
    if (!this.currentZone) return;
    this.activeSelections.set(slotId, newItemId);
    
    // Reload scene with updated hotspot item badges
    const currentYaw = this.viewer ? this.viewer.getYaw() : 0;
    const currentPitch = this.viewer ? this.viewer.getPitch() : 0;
    const currentFov = this.viewer ? this.viewer.getHfov() : 70;

    const selectionsObj = {};
    this.activeSelections.forEach((val, key) => selectionsObj[key] = val);

    this.loadZone(this.currentZone, selectionsObj);

    if (this.viewer) {
      this.viewer.setYaw(currentYaw);
      this.viewer.setPitch(currentPitch);
      this.viewer.setHfov(currentFov);
    }
  }

  setTimeOfDay(mode) {
    if (!this.container) return;
    if (mode === 'day') {
      this.container.style.filter = 'brightness(1.1) contrast(1.05)';
    } else if (mode === 'sunset') {
      this.container.style.filter = 'sepia(0.2) saturate(1.3) brightness(0.95)';
    } else { // night
      this.container.style.filter = 'brightness(0.9) contrast(1.1)';
    }
  }

  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    if (this.viewer) {
      if (enabled) {
        this.viewer.startAutoRotate(-2);
      } else {
        this.viewer.stopAutoRotate();
      }
    }
  }
}
