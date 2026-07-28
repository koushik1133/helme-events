import { getItemById } from '../data/catalog.js';

export class Viewer360 {
  constructor(containerElement, onSelectSlot) {
    this.container = containerElement;
    this.onSelectSlot = onSelectSlot;
    this.currentZone = null;
    this.activeSelections = new Map();
    this.customWriting = new Map();
    this.viewer = null;
    this.autoRotate = false;
  }

  loadZone(zoneData, activeSelectionsMap = {}) {
    this.currentZone = zoneData;

    // Set active selections
    zoneData.slots.forEach(slot => {
      const itemId = activeSelectionsMap[slot.id] || slot.defaultItemId;
      this.activeSelections.set(slot.id, itemId);

      const customTextKey = `custom_text_${slot.id}`;
      if (activeSelectionsMap[customTextKey]) {
        this.customWriting.set(slot.id, activeSelectionsMap[customTextKey]);
      }
    });

    // Determine background panorama URL based on active theme or selected item
    let basePanoramaUrl = activeSelectionsMap.theme_panorama;

    if (!basePanoramaUrl) {
      for (const slot of zoneData.slots) {
        const selectedItemId = this.activeSelections.get(slot.id);
        const item = getItemById(selectedItemId);
        if (item && item.panoramaUrl && selectedItemId !== slot.defaultItemId) {
          basePanoramaUrl = item.panoramaUrl;
          break;
        }
      }
    }

    if (!basePanoramaUrl) {
      basePanoramaUrl = zoneData.panoramaUrl;
    }

    // Destroy existing Pannellum instance if present
    if (this.viewer) {
      try {
        this.viewer.destroy();
      } catch (e) {
        // ignore
      }
      this.viewer = null;
    }

    // Build Hotspots Configuration for Pannellum anchored at exact spatial coordinates
    const hotSpotsConfig = zoneData.slots.map(slot => {
      const selectedItemId = this.activeSelections.get(slot.id);
      const item = getItemById(selectedItemId);
      const writingText = this.customWriting.get(slot.id);
      const isCustomized = selectedItemId !== slot.defaultItemId;

      return {
        pitch: slot.pos3D.pitch,
        yaw: slot.pos3D.yaw,
        cssClass: `custom-pannellum-hotspot ${isCustomized ? 'hotspot-customized' : ''}`,
        createTooltipFunc: (hotSpotDiv) => {
          this.createHotspotOverlay(hotSpotDiv, slot, item, writingText, isCustomized);
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
        panorama: basePanoramaUrl,
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
          <img src="${basePanoramaUrl}" class="fallback-panorama-img" alt="${zoneData.name}" />
        </div>
      `;
    }
  }

  createHotspotOverlay(hotSpotDiv, slot, item, writingText, isCustomized) {
    hotSpotDiv.innerHTML = `
      <div class="hotspot-target-pill ${isCustomized ? 'pill-active-glow' : ''}" data-slot-id="${slot.id}">
        <span class="pulse-beacon ${isCustomized ? 'beacon-emerald' : ''}"></span>
        
        <div class="hotspot-badge-card ${isCustomized ? 'badge-customized' : ''}">
          <div class="hotspot-media-wrap">
            <img src="${item ? item.imageUrl : ''}" class="hotspot-thumb" alt="${item ? item.name : ''}" />
            ${isCustomized ? `<span class="badge-swapped-tag">Swapped</span>` : ''}
          </div>
          <div class="hotspot-text">
            <span class="slot-label">${slot.label} (${slot.quantity}x)</span>
            <strong class="item-name">${item ? item.name : 'None'}</strong>
            ${writingText ? `<span class="writing-badge">✍️ "${writingText}"</span>` : ''}
            <span class="item-price">$${item ? item.price * slot.quantity : 0}</span>
          </div>
          <button class="btn-quick-swap-icon" title="Swap Item">✏️</button>
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

  swapObjectInSlot(slotId, newItemId, writingText) {
    if (!this.currentZone) return;
    this.activeSelections.set(slotId, newItemId);
    if (writingText !== undefined) {
      this.customWriting.set(slotId, writingText);
    }
    
    // Save current camera view orientation
    const currentYaw = this.viewer ? this.viewer.getYaw() : 0;
    const currentPitch = this.viewer ? this.viewer.getPitch() : 0;
    const currentFov = this.viewer ? this.viewer.getHfov() : 70;

    const selectionsObj = {};
    this.activeSelections.forEach((val, key) => selectionsObj[key] = val);
    this.customWriting.forEach((val, key) => selectionsObj[`custom_text_${key}`] = val);

    // Reload scene in the SAME room space with updated in-place item visual badges
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
