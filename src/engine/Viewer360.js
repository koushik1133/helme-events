import { getItemById } from '../data/catalog.js';

/**
 * Viewer360
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads a Pannellum equirectangular panorama and overlays clickable hotspot
 * "item cards" at each slot position using rectilinear pitch/yaw projection.
 * Also renders Google Earth / Street View style 3D Navigation Arrow Hotspots
 * on the floor to navigate between connected rooms with smooth zoom transitions.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class Viewer360 {
  constructor(containerEl, onSelectSlot, onNavigateZone = null) {
    this.container      = containerEl;
    this.onSelectSlot   = onSelectSlot;   // (slotId) => void
    this.onNavigateZone = onNavigateZone; // (targetZoneId) => void
    this.currentZone    = null;
    this.viewer         = null;
    this.autoRotate     = false;

    // slotId → selected itemId
    this.activeSelections = new Map();
    this.customWriting    = new Map();

    // DOM overlay
    this._overlayEl          = null;
    this._loopId             = null;
    this._positionLoopActive = false;
    this._overlayBuilt       = false;
    this._loadGeneration     = 0;
  }

  loadZone(zoneData, activeSelectionsObj = {}, overridePanoramaUrl = null) {
    this.currentZone = zoneData;

    const myGen = ++this._loadGeneration;

    // Sync selections map
    zoneData.slots.forEach(slot => {
      const id = activeSelectionsObj[slot.id] || slot.defaultItemId;
      this.activeSelections.set(slot.id, id);
      const ck = `custom_text_${slot.id}`;
      if (activeSelectionsObj[ck]) this.customWriting.set(slot.id, activeSelectionsObj[ck]);
    });

    let panoramaUrl = overridePanoramaUrl || zoneData.panoramaUrl;
    if (!overridePanoramaUrl) {
      zoneData.slots.forEach(slot => {
        const selId = activeSelectionsObj[slot.id] || slot.defaultItemId;
        const item = getItemById(selId);
        if (item && item.panoramaUrl && item.panoramaUrl !== zoneData.panoramaUrl && slot.category === 'backdrops') {
          panoramaUrl = item.panoramaUrl;
        }
      });
    }
    this._currentPanorama = panoramaUrl;

    this._stopLoop();
    this._destroyViewer();
    this._overlayBuilt = false;

    if (!window.pannellum) {
      this._loadFallback(panoramaUrl, zoneData);
      return;
    }

    this.container.innerHTML = '';
    this.container.style.position = 'relative';

    this.viewer = window.pannellum.viewer(this.container, {
      type: 'equirectangular',
      panorama: panoramaUrl,
      autoLoad: true,
      showZoomCtrl: false,
      showFullscreenCtrl: false,
      showControls: false,
      autoRotate: this.autoRotate ? -2 : 0,
      mouseZoom: true,
      hfov: 100,
      minHfov: 50,
      maxHfov: 130,
      pitch: 0,
      yaw: 0
    });

    const buildOverlay = () => {
      if (myGen !== this._loadGeneration) return;
      if (this._overlayBuilt) return;
      this._overlayBuilt = true;
      if (this._overlayEl?.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
      this._overlayEl = this._buildOverlay(zoneData);
      this.container.appendChild(this._overlayEl);
      this._startLoop();
    };

    try {
      this.viewer.on('load', buildOverlay);
    } catch(e) {}
    setTimeout(buildOverlay, 900);
  }

  updatePanorama(newPanoramaUrl) {
    if (!this.viewer || !newPanoramaUrl || this._currentPanorama === newPanoramaUrl) return;

    let currentPitch = 0, currentYaw = 0, currentHfov = 100;
    try {
      if (typeof this.viewer.getPitch === 'function') currentPitch = this.viewer.getPitch();
      if (typeof this.viewer.getYaw === 'function')   currentYaw   = this.viewer.getYaw();
      if (typeof this.viewer.getHfov === 'function')  currentHfov  = this.viewer.getHfov();
    } catch(e) {}

    if (this.currentZone) {
      const activeObj = {};
      this.activeSelections.forEach((val, key) => { activeObj[key] = val; });
      this.customWriting.forEach((val, key) => { activeObj[`custom_text_${key}`] = val; });
      this.loadZone(this.currentZone, activeObj, newPanoramaUrl);

      setTimeout(() => {
        try {
          if (this.viewer?.setPitch) this.viewer.setPitch(currentPitch);
          if (this.viewer?.setYaw)   this.viewer.setYaw(currentYaw);
          if (this.viewer?.setHfov)  this.viewer.setHfov(currentHfov);
        } catch(e) {}
      }, 100);
    }
  }

  updateSlotDisplay(slotId, newItemId, writingText) {
    this.activeSelections.set(slotId, newItemId);
    if (writingText !== undefined) this.customWriting.set(slotId, writingText);

    if (!this._overlayEl) return;
    const card = this._overlayEl.querySelector(`.hs-card[data-slot-id="${slotId}"]`);
    if (!card) return;

    const item = getItemById(newItemId);
    const slot = this.currentZone?.slots.find(s => s.id === slotId);
    const isSwapped = slot && newItemId !== slot.defaultItemId;

    const img = card.querySelector('.hs-card-img');
    if (img && item?.imageUrl) { img.src = item.imageUrl; img.alt = item.name; }

    const nameEl = card.querySelector('.hs-card-name');
    if (nameEl && item) nameEl.textContent = item.name;

    const priceEl = card.querySelector('.hs-card-price');
    if (priceEl && item && slot) priceEl.textContent = `$${(item.price * slot.quantity).toLocaleString()}`;

    const beacon = card.querySelector('.hs-beacon');
    if (beacon) beacon.className = `hs-beacon${isSwapped ? ' hs-beacon-swapped' : ''}`;

    card.classList.add('hs-card-flash');
    setTimeout(() => card.classList.remove('hs-card-flash'), 600);
  }

  /**
   * Google Earth / Street View style camera zoom into arrow before room navigation
   */
  navigateToZoneWithZoom(targetZoneId, targetPitch, targetYaw) {
    if (!this.viewer) {
      if (this.onNavigateZone) this.onNavigateZone(targetZoneId);
      return;
    }

    try {
      if (typeof this.viewer.setPitch === 'function') this.viewer.setPitch(targetPitch, 400);
      if (typeof this.viewer.setYaw === 'function')   this.viewer.setYaw(targetYaw, 400);
      if (typeof this.viewer.setHfov === 'function')  this.viewer.setHfov(60, 400);
    } catch(e) {}

    setTimeout(() => {
      if (this.onNavigateZone) {
        this.onNavigateZone(targetZoneId);
      }
    }, 420);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build the overlay DOM (Item Cards + Google Earth 3D Navigation Arrows)
  // ─────────────────────────────────────────────────────────────────────────
  _buildOverlay(zoneData) {
    const overlay = document.createElement('div');
    overlay.className = 'hs-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;';

    // 1. Item Slot Cards
    zoneData.slots.forEach(slot => {
      const selId   = this.activeSelections.get(slot.id);
      const item    = getItemById(selId);
      const swapped = selId !== slot.defaultItemId;
      const writing = this.customWriting.get(slot.id);
      const price   = item ? (item.price * slot.quantity).toLocaleString() : '0';

      const card = document.createElement('div');
      card.className  = 'hs-card';
      card.setAttribute('data-slot-id', slot.id);
      card.setAttribute('data-pitch', slot.pos3D.pitch);
      card.setAttribute('data-yaw',   slot.pos3D.yaw);
      card.style.cssText = 'display:none;position:absolute;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;';

      card.innerHTML = `
        <div class="hs-beacon${swapped ? ' hs-beacon-swapped' : ''}"></div>
        <div class="hs-card-inner">
          <img class="hs-card-img" src="${item?.imageUrl || ''}" alt="${slot.label}" />
          <div class="hs-card-info">
            <span class="hs-card-label">${slot.label}</span>
            <strong class="hs-card-name">${item?.name || '—'}</strong>
            ${writing ? `<em class="hs-card-writing">✍️ "${writing}"</em>` : ''}
          </div>
          <div class="hs-card-price">$${price}</div>
        </div>
        <span class="hs-swap-badge">Tap to swap ↕</span>
      `;

      card.addEventListener('click', e => {
        e.stopPropagation();
        if (this.onSelectSlot) this.onSelectSlot(slot.id);
      });

      overlay.appendChild(card);
    });

    // 2. Google Earth / Street View style 3D Navigation Arrows
    if (zoneData.navLinks && zoneData.navLinks.length) {
      zoneData.navLinks.forEach(link => {
        const arrow = document.createElement('div');
        arrow.className = 'nav-arrow-hotspot';
        arrow.setAttribute('data-target-zone', link.targetZoneId);
        arrow.setAttribute('data-pitch', link.pitch);
        arrow.setAttribute('data-yaw',   link.yaw);
        arrow.style.cssText = 'display:none;position:absolute;transform:translate(-50%,-50%);pointer-events:auto;cursor:pointer;';

        arrow.innerHTML = `
          <div class="nav-arrow-pulse"></div>
          <div class="nav-arrow-disc">
            <span class="nav-arrow-symbol">▲</span>
            <span class="nav-arrow-icon">${link.icon || '➜'}</span>
          </div>
          <div class="nav-arrow-tooltip">
            <span class="nav-tooltip-tag">NAVIGATE ROOM</span>
            <strong class="nav-tooltip-name">${link.label}</strong>
          </div>
        `;

        arrow.addEventListener('click', e => {
          e.stopPropagation();
          this.navigateToZoneWithZoom(link.targetZoneId, link.pitch, link.yaw);
        });

        overlay.appendChild(arrow);
      });
    }

    return overlay;
  }

  _updateCardPositions() {
    if (!this.viewer || !this._overlayEl) return;

    const W = this.container.clientWidth  || 1;
    const H = this.container.clientHeight || 1;

    let camYaw, camPitch, hfov;
    try {
      camYaw   = this.viewer.getYaw()   ?? 0;
      camPitch = this.viewer.getPitch() ?? 0;
      hfov     = this.viewer.getHfov()  ?? 100;
    } catch { return; }

    const halfH = hfov / 2;
    const halfV = (hfov * H / W) / 2;

    this._overlayEl.querySelectorAll('.hs-card, .nav-arrow-hotspot').forEach(el => {
      const hp = parseFloat(el.getAttribute('data-pitch'));
      const hy = parseFloat(el.getAttribute('data-yaw'));

      let dYaw = hy - camYaw;
      while (dYaw >  180) dYaw -= 360;
      while (dYaw < -180) dYaw += 360;
      const dPitch = hp - camPitch;

      if (Math.abs(dYaw) <= halfH + 25 && Math.abs(dPitch) <= halfV + 25) {
        const x = W * 0.5 + (dYaw   / halfH) * (W * 0.5);
        const y = H * 0.5 - (dPitch / halfV) * (H * 0.5);
        el.style.display = 'block';
        el.style.left    = `${x}px`;
        el.style.top     = `${y}px`;
      } else {
        el.style.display = 'none';
      }
    });
  }

  _startLoop() {
    if (this._positionLoopActive) return;
    this._positionLoopActive = true;
    const loop = () => {
      if (!this._positionLoopActive) return;
      this._updateCardPositions();
      this._loopId = requestAnimationFrame(loop);
    };
    this._loopId = requestAnimationFrame(loop);
  }

  _stopLoop() {
    this._positionLoopActive = false;
    if (this._loopId) {
      cancelAnimationFrame(this._loopId);
      this._loopId = null;
    }
  }

  _destroyViewer() {
    this._stopLoop();
    if (this._overlayEl?.parentNode) {
      this._overlayEl.parentNode.removeChild(this._overlayEl);
      this._overlayEl = null;
    }
    if (this.viewer) {
      try { this.viewer.destroy(); } catch(e) {}
      this.viewer = null;
    }
  }

  toggleAutoRotate() {
    this.autoRotate = !this.autoRotate;
    if (this.viewer && typeof this.viewer.startAutoRotate === 'function') {
      if (this.autoRotate) this.viewer.startAutoRotate(-2);
      else this.viewer.stopAutoRotate();
    }
    return this.autoRotate;
  }

  _loadFallback(panoramaUrl, zoneData) {
    this.container.innerHTML = `
      <div style="position:relative;width:100%;height:100%;background:#090a0f;">
        <img src="${panoramaUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${zoneData.name}" />
      </div>
    `;
  }
}
