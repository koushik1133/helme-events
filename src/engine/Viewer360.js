import { getItemById } from '../data/catalog.js';

/**
 * Viewer360
 * ─────────────────────────────────────────────────────────────────────────────
 * Loads a Pannellum equirectangular panorama and overlays clickable hotspot
 * "item cards" at each slot position using rectilinear pitch/yaw projection.
 *
 * KEY DESIGN: Swapping an item NEVER reloads the panorama.
 *             updateSlotDisplay() only updates the card's image + label.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class Viewer360 {
  constructor(containerEl, onSelectSlot) {
    this.container    = containerEl;
    this.onSelectSlot = onSelectSlot;   // (slotId) => void
    this.currentZone  = null;
    this.viewer       = null;
    this.autoRotate   = false;

    // slotId → selected itemId
    this.activeSelections = new Map();
    this.customWriting    = new Map();

    // DOM overlay
    this._overlayEl          = null;
    this._loopId             = null;
    this._positionLoopActive = false;
    this._overlayBuilt       = false;
    // Per-load generation counter — prevents stale async callbacks from earlier loads
    this._loadGeneration     = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: load a zone (creates Pannellum viewer + injects hotspot overlay)
  // ONLY called when changing zone/scene — NOT called on item swap
  // ─────────────────────────────────────────────────────────────────────────
  loadZone(zoneData, activeSelectionsObj = {}, overridePanoramaUrl = null) {
    this.currentZone = zoneData;

    // Bump generation so any pending async callbacks from the previous load are ignored
    const myGen = ++this._loadGeneration;

    // Sync selections map
    zoneData.slots.forEach(slot => {
      const id = activeSelectionsObj[slot.id] || slot.defaultItemId;
      this.activeSelections.set(slot.id, id);
      const ck = `custom_text_${slot.id}`;
      if (activeSelectionsObj[ck]) this.customWriting.set(slot.id, activeSelectionsObj[ck]);
    });

    // Check if any active selection in this zone has a custom 360 panorama (e.g. wall/backdrop swap)
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
      // Ignore if a newer loadZone() call has already taken over
      if (myGen !== this._loadGeneration) return;
      if (this._overlayBuilt) return;
      this._overlayBuilt = true;
      if (this._overlayEl?.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
      this._overlayEl = this._buildOverlay(zoneData);
      this.container.appendChild(this._overlayEl);
      this._startLoop();
    };

    this.viewer.on('load', () => setTimeout(buildOverlay, 80));
    setTimeout(buildOverlay, 900);   // fallback if load fired before subscription
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public: update background panorama image (for wall/backdrop swaps)
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // Public: update ONE slot's card — no panorama reload, just DOM swap
  // ─────────────────────────────────────────────────────────────────────────
  updateSlotDisplay(slotId, newItemId, writingText) {
    this.activeSelections.set(slotId, newItemId);
    if (writingText !== undefined) this.customWriting.set(slotId, writingText);

    if (!this._overlayEl) return;
    const card = this._overlayEl.querySelector(`.hs-card[data-slot-id="${slotId}"]`);
    if (!card) return;

    const item = getItemById(newItemId);
    const slot = this.currentZone?.slots.find(s => s.id === slotId);
    const isSwapped = slot && newItemId !== slot.defaultItemId;

    // Update thumbnail
    const img = card.querySelector('.hs-card-img');
    if (img && item?.imageUrl) { img.src = item.imageUrl; img.alt = item.name; }

    // Update label
    const nameEl = card.querySelector('.hs-card-name');
    if (nameEl && item) nameEl.textContent = item.name;

    // Update price
    const priceEl = card.querySelector('.hs-card-price');
    if (priceEl && item && slot) priceEl.textContent = `$${(item.price * slot.quantity).toLocaleString()}`;

    // Update beacon colour
    const beacon = card.querySelector('.hs-beacon');
    if (beacon) beacon.className = `hs-beacon${isSwapped ? ' hs-beacon-swapped' : ''}`;

    // Flash effect
    card.classList.add('hs-card-flash');
    setTimeout(() => card.classList.remove('hs-card-flash'), 600);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Build the overlay DOM
  // ─────────────────────────────────────────────────────────────────────────
  _buildOverlay(zoneData) {
    const overlay = document.createElement('div');
    overlay.className = 'hs-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;';

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
      // starts hidden; rAF positions it
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

    return overlay;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Rectilinear projection: pitch/yaw (degrees) → screen (px)
  // Works with Pannellum v2.5.6 API: getYaw / getPitch / getHfov
  // ─────────────────────────────────────────────────────────────────────────
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

    this._overlayEl.querySelectorAll('.hs-card').forEach(card => {
      const hp = parseFloat(card.getAttribute('data-pitch'));
      const hy = parseFloat(card.getAttribute('data-yaw'));

      let dYaw = hy - camYaw;
      while (dYaw >  180) dYaw -= 360;
      while (dYaw < -180) dYaw += 360;
      const dPitch = hp - camPitch;

      if (Math.abs(dYaw) <= halfH + 25 && Math.abs(dPitch) <= halfV + 25) {
        const x = W * 0.5 + (dYaw   / halfH) * (W * 0.5);
        const y = H * 0.5 - (dPitch / halfV) * (H * 0.5);
        card.style.display = 'block';
        card.style.left    = `${x}px`;
        card.style.top     = `${y}px`;
      } else {
        card.style.display = 'none';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // rAF sync loop
  // ─────────────────────────────────────────────────────────────────────────
  _startLoop() {
    if (this._positionLoopActive) return;
    this._positionLoopActive = true;
    const tick = () => {
      if (!this._positionLoopActive) return;
      this._updateCardPositions();
      this._loopId = requestAnimationFrame(tick);
    };
    this._loopId = requestAnimationFrame(tick);
  }

  _stopLoop() {
    this._positionLoopActive = false;
    if (this._loopId) { cancelAnimationFrame(this._loopId); this._loopId = null; }
  }

  _destroyViewer() {
    if (this._overlayEl?.parentNode) { this._overlayEl.parentNode.removeChild(this._overlayEl); this._overlayEl = null; }
    if (this.viewer) { try { this.viewer.destroy(); } catch {} this.viewer = null; }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Fallback: static image with percentage-based dots
  // ─────────────────────────────────────────────────────────────────────────
  _loadFallback(panoramaUrl, zoneData) {
    this.container.innerHTML = `
      <div style="position:relative;width:100%;height:100%;overflow:hidden;">
        <img src="${panoramaUrl}" alt="${zoneData.name}" style="width:100%;height:100%;object-fit:cover;" />
        <div style="position:absolute;inset:0;pointer-events:none;">
          ${zoneData.slots.map((slot, i) => {
            const item = getItemById(this.activeSelections.get(slot.id));
            const lx = [20, 50, 78][i] || 30 + i * 20;
            const ly = [45, 35, 55][i] || 40;
            return `
              <div class="hs-card fallback-card" data-slot-id="${slot.id}"
                   style="position:absolute;left:${lx}%;top:${ly}%;pointer-events:auto;cursor:pointer;transform:translate(-50%,-50%);">
                <div class="hs-beacon"></div>
                <div class="hs-card-inner">
                  <img class="hs-card-img" src="${item?.imageUrl||''}" alt="${slot.label}"/>
                  <div class="hs-card-info">
                    <span class="hs-card-label">${slot.label}</span>
                    <strong class="hs-card-name">${item?.name||'—'}</strong>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;

    this.container.querySelectorAll('.fallback-card').forEach(card => {
      card.addEventListener('click', e => {
        e.stopPropagation();
        if (this.onSelectSlot) this.onSelectSlot(card.getAttribute('data-slot-id'));
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public helpers
  // ─────────────────────────────────────────────────────────────────────────
  setAutoRotate(enabled) {
    this.autoRotate = enabled;
    if (!this.viewer) return;
    enabled ? this.viewer.startAutoRotate(-2) : this.viewer.stopAutoRotate();
  }

  setTimeOfDay(mode) {
    const fx = { day: 'brightness(1.1)', sunset: 'sepia(0.25) saturate(1.4) brightness(0.9)', night: 'brightness(0.75) contrast(1.15)' };
    if (this.container) this.container.style.filter = fx[mode] || '';
  }

  destroy() {
    this._stopLoop();
    this._destroyViewer();
  }
}
