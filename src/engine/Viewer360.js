import { getItemById } from '../data/catalog.js';
import { resolveScenePanorama, getPropImage, hasSceneVariant } from '../data/sceneVariants.js';
import { formatMoney, escapeHtml } from '../utils/format.js';

/**
 * Viewer360 — Pannellum equirectangular viewer with hotspot cards
 * and live prop overlays that reflect the currently selected furniture.
 */
export class Viewer360 {
  constructor(containerEl, onSelectSlot, onNavigateZone = null) {
    this.container      = containerEl;
    this.onSelectSlot   = onSelectSlot;
    this.onNavigateZone = onNavigateZone;
    this.currentZone    = null;
    this.viewer         = null;
    this.autoRotate     = false;

    this.activeSelections = new Map();
    this.customWriting    = new Map();

    this._overlayEl          = null;
    this._loopId             = null;
    this._positionLoopActive = false;
    this._overlayBuilt       = false;
    this._loadGeneration     = 0;
    this._currentPanorama    = null;
    this._overlayTimer       = null;
    this._timeKey            = 'day';
    this._engineFailed       = false;
  }

  loadZone(zoneData, activeSelectionsObj = {}, overridePanoramaUrl = null) {
    this.currentZone = zoneData;

    const myGen = ++this._loadGeneration;

    zoneData.slots.forEach(slot => {
      const id = activeSelectionsObj[slot.id] || slot.defaultItemId;
      this.activeSelections.set(slot.id, id);
      const ck = `custom_text_${slot.id}`;
      if (activeSelectionsObj[ck]) this.customWriting.set(slot.id, activeSelectionsObj[ck]);
      else this.customWriting.delete(slot.id);
    });

    let panoramaUrl = overridePanoramaUrl;
    if (!panoramaUrl) {
      panoramaUrl = resolveScenePanorama(zoneData.id, zoneData, activeSelectionsObj, null)
        || zoneData.panoramaUrl;
    }
    this._currentPanorama = panoramaUrl;

    this._destroyViewer();
    this._overlayBuilt = false;

    if (!window.pannellum) {
      this._loadFallback(panoramaUrl, zoneData);
      return;
    }
    this._engineFailed = false;

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
      yaw: 0,
      compass: false
    });

    const buildOverlay = () => {
      if (myGen !== this._loadGeneration) return;
      if (this._overlayBuilt) return;
      this._overlayBuilt = true;
      if (this._overlayEl?.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
      this._overlayEl = this._buildOverlay(zoneData);
      this.container.appendChild(this._overlayEl);
      this._applyTimeOfDay();
      this._startLoop();
    };

    try {
      this.viewer.on('load', buildOverlay);
      this.viewer.on('error', msg => {
        if (myGen !== this._loadGeneration) return;
        this._showEngineError(
          'This 360° view could not be loaded.',
          String(msg || 'The panorama image failed to decode.'),
          panoramaUrl,
          zoneData
        );
      });
    } catch (e) { /* older Pannellum builds may not expose .on */ }

    // Safety net: some builds never fire 'load'. Tracked so it can be cancelled
    // on the next zone load instead of leaking a pending timer per swap.
    if (this._overlayTimer) clearTimeout(this._overlayTimer);
    this._overlayTimer = setTimeout(() => {
      this._overlayTimer = null;
      buildOverlay();
    }, 900);
  }

  updatePanorama(newPanoramaUrl, selectionsOverride = null) {
    if (!newPanoramaUrl || this._currentPanorama === newPanoramaUrl) return;

    let currentPitch = 0, currentYaw = 0, currentHfov = 100;
    try {
      if (typeof this.viewer?.getPitch === 'function') currentPitch = this.viewer.getPitch();
      if (typeof this.viewer?.getYaw === 'function')   currentYaw   = this.viewer.getYaw();
      if (typeof this.viewer?.getHfov === 'function')  currentHfov  = this.viewer.getHfov();
    } catch (e) {}

    if (this.currentZone) {
      const activeObj = {};
      if (selectionsOverride && typeof selectionsOverride === 'object') {
        Object.assign(activeObj, selectionsOverride);
        // Keep Map in sync so overlays match the new plate
        Object.keys(selectionsOverride).forEach(key => {
          if (key.startsWith('custom_text_')) {
            this.customWriting.set(key.replace('custom_text_', ''), selectionsOverride[key]);
          } else {
            this.activeSelections.set(key, selectionsOverride[key]);
          }
        });
      } else {
        Object.assign(activeObj, this._selectionsAsObject());
      }
      this.loadZone(this.currentZone, activeObj, newPanoramaUrl);

      setTimeout(() => {
        try {
          if (this.viewer?.setPitch) this.viewer.setPitch(currentPitch);
          if (this.viewer?.setYaw)   this.viewer.setYaw(currentYaw);
          if (this.viewer?.setHfov)  this.viewer.setHfov(currentHfov);
        } catch (e) {}
      }, 120);
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
    if (priceEl && item && slot) priceEl.textContent = formatMoney(Math.round(item.price * slot.quantity));

    const writingEl = card.querySelector('.hs-card-writing');
    if (writingText) {
      if (writingEl) {
        writingEl.textContent = `✍️ "${writingText}"`;
      } else {
        const info = card.querySelector('.hs-card-info');
        if (info) {
          const em = document.createElement('em');
          em.className = 'hs-card-writing';
          em.textContent = `✍️ "${writingText}"`;
          info.appendChild(em);
        }
      }
    }

    const beacon = card.querySelector('.hs-beacon');
    if (beacon) beacon.className = `hs-beacon${isSwapped ? ' hs-beacon-swapped' : ''}`;

    // Live prop ghost image near the hotspot. It may not exist yet: the overlay
    // omits a sprite for items whose look is baked into the panorama, so
    // swapping from a baked item to an unbaked one has to create it on the fly,
    // otherwise the swap produces no visible change at all.
    let prop = this._overlayEl.querySelector(`.hs-prop[data-slot-id="${slotId}"]`);
    if (!prop && item && slot && !hasSceneVariant(this.currentZone?.id, slotId, newItemId)) {
      prop = this._createProp(slot, item, newItemId);
      if (prop) this._overlayEl.appendChild(prop);
    }
    if (prop && item && hasSceneVariant(this.currentZone?.id, slotId, newItemId)) {
      // Now baked into the plate — don't draw it twice.
      prop.remove();
      prop = null;
    }
    if (prop && item) {
      const propSrc = getPropImage(newItemId, item.imageUrl);
      const propImg = prop.querySelector('img');
      if (propImg && propSrc) {
        propImg.src = propSrc;
        propImg.alt = item.name;
      }
      prop.classList.toggle('hs-prop-swapped', Boolean(isSwapped));
      prop.classList.add('hs-prop-flash');
      setTimeout(() => prop.classList.remove('hs-prop-flash'), 700);
    }

    card.classList.add('hs-card-flash');
    setTimeout(() => card.classList.remove('hs-card-flash'), 600);
  }

  navigateToZoneWithZoom(targetZoneId, targetPitch, targetYaw) {
    if (!this.viewer) {
      if (this.onNavigateZone) this.onNavigateZone(targetZoneId);
      return;
    }

    try {
      if (typeof this.viewer.setPitch === 'function') this.viewer.setPitch(targetPitch, 400);
      if (typeof this.viewer.setYaw === 'function')   this.viewer.setYaw(targetYaw, 400);
      if (typeof this.viewer.setHfov === 'function')  this.viewer.setHfov(60, 400);
    } catch (e) {}

    setTimeout(() => {
      if (this.onNavigateZone) this.onNavigateZone(targetZoneId);
    }, 420);
  }

  _buildOverlay(zoneData) {
    const overlay = document.createElement('div');
    overlay.className = 'hs-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;';

    // Live prop sprites only for slots without a baked 360 plate (avoid double-draw)
    // Every swappable category gets a live prop sprite. `lighting` and `audio`
    // were missing, which is why zone-banquet and zone-lounge had slots where
    // nothing at all changed on swap.
    const PROP_CATEGORIES = new Set([
      'podiums', 'stages', 'chairs', 'tables', 'backdrops', 'fountains', 'lighting', 'audio', 'sofas'
    ]);
    zoneData.slots.forEach(slot => {
      if (!PROP_CATEGORIES.has(slot.category)) return;
      const selId = this.activeSelections.get(slot.id);
      const item = getItemById(selId);
      if (!item) return;
      // Baked variant already encodes this element in the panorama
      if (hasSceneVariant(zoneData.id, slot.id, selId)) return;
      const prop = this._createProp(slot, item, selId);
      if (prop) overlay.appendChild(prop);
    });

    // Item slot cards
    zoneData.slots.forEach(slot => {
      const selId   = this.activeSelections.get(slot.id);
      const item    = getItemById(selId);
      const swapped = selId !== slot.defaultItemId;
      const writing = this.customWriting.get(slot.id);
      const price   = formatMoney(item ? Math.round(item.price * slot.quantity) : 0);

      const card = document.createElement('div');
      card.className  = 'hs-card';
      card.setAttribute('data-slot-id', slot.id);
      card.setAttribute('data-pitch', slot.pos3D.pitch);
      card.setAttribute('data-yaw',   slot.pos3D.yaw);
      card.style.cssText = 'display:none;position:absolute;transform:translate(-50%,-100%);pointer-events:auto;cursor:pointer;';

      card.innerHTML = `
        <div class="hs-beacon${swapped ? ' hs-beacon-swapped' : ''}"></div>
        <div class="hs-card-inner">
          <img class="hs-card-img" src="${escapeHtml(item?.imageUrl || '')}" alt="${escapeHtml(slot.label)}" loading="lazy" />
          <div class="hs-card-info">
            <span class="hs-card-label">${escapeHtml(slot.label)}</span>
            <strong class="hs-card-name">${escapeHtml(item?.name || '—')}</strong>
            ${writing ? `<em class="hs-card-writing">✍️ "${escapeHtml(writing)}"</em>` : ''}
          </div>
          <div class="hs-card-price">${price}</div>
        </div>
        <span class="hs-swap-badge">Tap to swap ↕</span>
      `;

      card.addEventListener('click', e => {
        e.stopPropagation();
        if (this.onSelectSlot) this.onSelectSlot(slot.id);
      });

      overlay.appendChild(card);
    });

    // Navigation arrows
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

  /** Build one positioned prop sprite for a slot, or null if it has no artwork. */
  _createProp(slot, item, itemId) {
    const propSrc = getPropImage(itemId, item?.imageUrl);
    if (!propSrc || !slot?.pos3D) return null;
    const swapped = itemId !== slot.defaultItemId;
    const scale = slot.propScale || 1;
    const prop = document.createElement('div');
    prop.className = `hs-prop${swapped ? ' hs-prop-swapped' : ''}`;
    prop.setAttribute('data-slot-id', slot.id);
    prop.setAttribute('data-pitch', slot.pos3D.pitch - 4);
    prop.setAttribute('data-yaw', slot.pos3D.yaw);
    prop.setAttribute('data-scale', String(scale));
    prop.style.cssText = 'display:none;position:absolute;transform:translate(-50%,-70%);pointer-events:none;';
    prop.innerHTML = `<img src="${escapeHtml(propSrc)}" alt="${escapeHtml(item.name)}" loading="lazy" />`;
    return prop;
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

    this._overlayEl.querySelectorAll('.hs-card, .nav-arrow-hotspot, .hs-prop').forEach(el => {
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

        if (el.classList.contains('hs-prop')) {
          const scale = parseFloat(el.getAttribute('data-scale') || '1');
          const depth = 1 - Math.min(1, Math.hypot(dYaw / halfH, dPitch / halfV) * 0.35);
          el.style.transform = `translate(-50%, -70%) scale(${(0.85 + depth * 0.25) * scale})`;
          el.style.opacity = String(0.55 + depth * 0.35);
        }
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
    if (this._overlayTimer) {
      clearTimeout(this._overlayTimer);
      this._overlayTimer = null;
    }
    if (this._overlayEl?.parentNode) {
      this._overlayEl.parentNode.removeChild(this._overlayEl);
      this._overlayEl = null;
    }
    if (this.viewer) {
      try { this.viewer.destroy(); } catch (e) {}
      this.viewer = null;
    }
  }

  /**
   * Explicitly set auto-rotation. The guided tour needs to turn rotation ON
   * regardless of the current state, which `toggleAutoRotate()` cannot do.
   * @param {boolean} on
   * @returns {boolean} the resulting state
   */
  setAutoRotate(on) {
    this.autoRotate = Boolean(on);
    if (!this.viewer) return this.autoRotate;
    try {
      if (this.autoRotate) {
        if (typeof this.viewer.startAutoRotate === 'function') this.viewer.startAutoRotate(-2);
      } else if (typeof this.viewer.stopAutoRotate === 'function') {
        this.viewer.stopAutoRotate();
      }
    } catch (e) { /* viewer torn down mid-flight */ }
    return this.autoRotate;
  }

  toggleAutoRotate() {
    return this.setAutoRotate(!this.autoRotate);
  }

  /**
   * Soft day/night grade over the panorama canvas (CSS filter).
   * The key is remembered and re-applied after every zone load / element swap,
   * because Pannellum builds a brand new <canvas> each time.
   */
  setTimeOfDay(timeKey = 'day') {
    this._timeKey = timeKey || 'day';
    this._applyTimeOfDay();
    return this._timeKey;
  }

  /** Current time-of-day key, so callers can restore UI state. */
  getTimeOfDay() {
    return this._timeKey;
  }

  _applyTimeOfDay() {
    const timeKey = this._timeKey;
    const canvas = this.container?.querySelector('canvas')
      || this.container?.querySelector('.v360-fallback-img')
      || this.container;
    if (!canvas) return;
    const filters = {
      dawn: 'brightness(0.95) saturate(1.15) hue-rotate(-8deg)',
      day: 'none',
      dusk: 'brightness(0.85) saturate(1.25) hue-rotate(12deg)',
      night: 'brightness(0.55) saturate(0.85) contrast(1.1)'
    };
    canvas.style.filter = filters[timeKey] || filters.day;
    canvas.style.transition = 'filter 0.6s ease';
  }

  /**
   * Pannellum is loaded from a CDN. When that fails (blocked network, CSP,
   * offline demo) we still show the venue photo, but we say plainly that this
   * is a flat still and not the interactive 360 view — silently degrading to a
   * photo while the UI still promises "360°" is exactly the kind of claim this
   * product cannot afford to get caught making.
   */
  _loadFallback(panoramaUrl, zoneData) {
    this._engineFailed = true;
    this._showEngineError(
      '360° engine unavailable — showing a flat still',
      'The Pannellum viewer could not be loaded (network, firewall or ad-blocker). '
        + 'Panning, hotspots and live swaps are disabled until it loads. Reconnect and reload to restore them.',
      panoramaUrl,
      zoneData
    );
  }

  /** Visible, accessible failure state layered over the still image. */
  _showEngineError(title, detail, panoramaUrl, zoneData) {
    this._stopLoop();
    this.container.innerHTML = `
      <div class="v360-error" style="position:relative;width:100%;height:100%;background:#090a0f;overflow:hidden;">
        <img class="v360-fallback-img" src="${escapeHtml(panoramaUrl || '')}"
             alt="${escapeHtml(zoneData?.name || 'Venue')} — still photograph"
             style="width:100%;height:100%;object-fit:cover;filter:brightness(0.55);" />
        <div role="alert" aria-live="assertive"
             style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:min(92%,460px);
                    text-align:center;background:rgba(9,10,15,0.92);border:1px solid rgba(245,158,11,0.55);
                    border-radius:14px;padding:20px 22px;color:#f8fafc;font-size:14px;line-height:1.5;
                    box-shadow:0 18px 48px rgba(0,0,0,0.55);">
          <div style="font-size:26px;line-height:1;margin-bottom:10px;" aria-hidden="true">⚠️</div>
          <strong style="display:block;font-size:15px;margin-bottom:8px;color:#fbbf24;">${escapeHtml(title)}</strong>
          <span style="display:block;opacity:0.85;">${escapeHtml(detail)}</span>
          <button type="button" class="v360-error-retry"
                  style="margin-top:14px;padding:9px 18px;border-radius:999px;border:1px solid rgba(248,250,252,0.35);
                         background:transparent;color:#f8fafc;font:inherit;cursor:pointer;">
            Retry
          </button>
        </div>
      </div>
    `;
    const retry = this.container.querySelector('.v360-error-retry');
    if (retry) {
      retry.addEventListener('click', () => {
        if (zoneData) this.loadZone(zoneData, this._selectionsAsObject(), panoramaUrl);
      });
    }
    this._applyTimeOfDay();
  }

  /** Current selections (plus custom text) as the flat slotId -> itemId object. */
  _selectionsAsObject() {
    const obj = {};
    this.activeSelections.forEach((val, key) => { obj[key] = val; });
    this.customWriting.forEach((val, key) => { obj[`custom_text_${key}`] = val; });
    return obj;
  }

  /** True when the 360 engine failed and the viewer is showing a flat still. */
  isEngineAvailable() {
    return !this._engineFailed && Boolean(this.viewer);
  }
}
