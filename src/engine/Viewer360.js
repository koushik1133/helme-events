import { getItemById } from '../data/catalog.js';
import { resolveSceneComposite, unbakedChanges } from '../data/sceneVariants.js';
import { overlaySpec, loadCutoutManifest, cutoutFor, loadOverlayManifest, bakedOverlay,
  CAMERA_HEIGHT_M } from '../data/propOverlays.js';
import { projectAnchor, verticalFov } from './panoProjection.js';
import { EquirectViewer } from './EquirectViewer.js';
import { PanoCompositor } from './PanoCompositor.js';
import { formatMoney, escapeHtml } from '../utils/format.js';

/**
 * Viewer360 — three.js equirectangular viewer with hotspot cards, over a
 * panorama that is COMPOSITED at runtime from a base plate plus one
 * transparent layer per swapped decor slot.
 *
 * THE REGRESSION THIS FIXES
 * -------------------------
 * The owner's report: "Previously, if I changed the item, it would have been
 * updated on the screen in the 360 view, but it's not updating now." Confirmed
 * by hashing the canvas across a scripted swap sequence — after the first slot,
 * the panorama pixels were byte-identical. Two causes, both structural:
 *
 *  1. The variant table can only bake ONE slot into a plate, so every other
 *     swapped slot fell back to a DOM <img> layered over the viewer. The
 *     panorama itself never changed, and when that sprite failed to lay out it
 *     changed nothing at all.
 *  2. Pannellum has no `setPanorama()`, so every plate change was a
 *     destroy-and-rebuild with a visible flash and a hand-restored camera.
 *
 * Now: a three.js inverted sphere is textured from a canvas this class owns
 * (`PanoCompositor`). A swap redraws that canvas — base plate, then each
 * swapped slot's contact shadow (multiply) and cut-out (over), rasterised into
 * equirectangular space by the exact inverse map in `equirectBillboard.js` —
 * and flips `texture.needsUpdate`. No reload, no flash, and the picture itself
 * changes, so screenshots and exports change with it.
 *
 * The public surface (loadZone / updatePanorama / updateSlotDisplay /
 * toggleAutoRotate / setAutoRotate / setTimeOfDay / hotspot clicks / the error
 * state) is unchanged, so main.js did not have to move.
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
    this._loadGeneration     = 0;
    this._currentPanorama    = null;
    this._timeKey            = 'day';
    this._engineFailed       = false;
    this._composite          = null;
    this._compositor         = null;
    this._THREE              = null;
    this._forcedLayerSlot    = null;
    this._lastSignature      = null;
  }

  // ---------------------------------------------------------------- loading

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

    this._resolveComposite(zoneData, activeSelectionsObj, overridePanoramaUrl);
    this._forcedLayerSlot = null;

    // Rebuild the hotspot layer synchronously so the UI is never empty while
    // the GPU side boots; the panorama itself arrives when the plate decodes.
    this._buildOverlayLayer(zoneData);

    this._boot(myGen, zoneData);
  }

  _resolveComposite(zoneData, activeSelectionsObj, overridePanoramaUrl) {
    this._composite = resolveSceneComposite(zoneData.id, zoneData, activeSelectionsObj);
    if (overridePanoramaUrl && overridePanoramaUrl !== this._composite.panorama) {
      // A caller forced a specific plate (theme preview, backdrop plate). We did
      // not render it, so we must not claim any slot is baked into it.
      this._composite = {
        ...this._composite,
        panorama: overridePanoramaUrl,
        bakedSlotId: null,
        bakedItemId: null,
        overlaySlots: zoneData.slots
          .map(s => ({ slotId: s.id,
                       itemId: activeSelectionsObj[s.id] || s.defaultItemId,
                       swapped: (activeSelectionsObj[s.id] || s.defaultItemId) !== s.defaultItemId }))
          .filter(o => Boolean(o.itemId))
      };
    }
    this._currentPanorama = overridePanoramaUrl || this._composite.panorama || zoneData.panoramaUrl;
  }

  /** Start (or reuse) the WebGL viewer and paint the current configuration. */
  async _boot(myGen, zoneData) {
    try {
      if (!this._THREE) this._THREE = await import('three');
      await Promise.all([loadCutoutManifest(), loadOverlayManifest()]);
    } catch (e) {
      if (myGen !== this._loadGeneration) return;
      this._loadFallback(this._currentPanorama, zoneData);
      return;
    }
    if (myGen !== this._loadGeneration) return;

    if (!this._compositor) this._compositor = new PanoCompositor();

    try {
      await this._compositor.setBase(this._currentPanorama);
    } catch (e) {
      if (myGen !== this._loadGeneration) return;
      this._showEngineError(
        'This 360° view could not be loaded.',
        'The panorama image failed to load or decode.',
        this._currentPanorama, zoneData);
      return;
    }
    if (myGen !== this._loadGeneration) return;

    await this._paint();
    if (myGen !== this._loadGeneration) return;

    if (!this.viewer || this.viewer.destroyed) {
      // Rebuilding the canvas each zone would throw away the WebGL context for
      // no reason — the sphere's texture is what changes, not the viewer.
      this._teardownViewer();
      try {
        this.viewer = new EquirectViewer(this.container, this._THREE, {
          hfov: 100, minHfov: 50, maxHfov: 130,
          label: `${zoneData?.name || 'Venue'} — 360 degree view. `
            + 'Drag or use the arrow keys to look around, plus and minus to zoom.'
        });
      } catch (e) {
        this._loadFallback(this._currentPanorama, zoneData);
        return;
      }
      this.viewer.on('error', msg => {
        if (myGen !== this._loadGeneration) return;
        this._showEngineError('This 360° view could not be displayed.',
          String(msg || 'WebGL is unavailable in this browser.'),
          this._currentPanorama, zoneData);
      });
      this.viewer.setSourceCanvas(this._compositor.canvas);
      this.container.appendChild(this._overlayEl);
    } else {
      this.viewer.markTextureDirty();
      if (!this._overlayEl.parentNode) this.container.appendChild(this._overlayEl);
    }

    this._engineFailed = false;
    this.setAutoRotate(this.autoRotate);
    this._applyTimeOfDay();
    this._renderCompositeNotice();
    this._startLoop();
  }

  // ------------------------------------------------------------ compositing

  /**
   * Layer descriptors for everything the current plate does NOT depict.
   *
   * Only SWAPPED slots are composited. A slot sitting at its default is already
   * in the photograph, and drawing it again would show the chair twice.
   */
  _layerSpecs() {
    const zone = this.currentZone;
    if (!zone) return [];
    const specs = [];
    for (const slot of zone.slots) {
      const itemId = this.activeSelections.get(slot.id);
      if (!itemId) continue;
      const isBaked = this._composite?.bakedSlotId === slot.id;
      const swapped = itemId !== slot.defaultItemId;
      const forced  = this._forcedLayerSlot === slot.id;
      if (!forced && (isBaked || !swapped)) continue;

      const item = getItemById(itemId);
      const spec = overlaySpec(slot, item);
      const cut  = cutoutFor(itemId);
      if (!spec || !cut) continue;
      specs.push({
        slotId: slot.id,
        itemId,
        cutoutUrl: cut.url,
        contact: cut.contact,
        yawDeg: spec.anchorYaw,
        pitchDeg: spec.anchorPitch,
        distanceM: spec.distanceM,
        heightM: spec.heightM,
        cameraHeightM: CAMERA_HEIGHT_M,
        ground: spec.ground,
        baked: bakedOverlay(zone.id, slot.id, itemId)
      });
    }
    return specs;
  }

  /** Signature of everything that determines the composited pixels. */
  _signature(specs) {
    return [this._currentPanorama, ...specs.map(s => `${s.slotId}=${s.itemId}`)].join('|');
  }

  async _paint() {
    if (!this._compositor) return;
    const specs = this._layerSpecs();
    this._lastSignature = this._signature(specs);
    this._compositor.setLayers(specs);
    await this._compositor.render();
    this.viewer?.markTextureDirty();
  }

  // ------------------------------------------------------------ public API

  /**
   * Swap the base plate without rebuilding the viewer.
   *
   * Under Pannellum this had to destroy and re-construct the whole viewer and
   * then restore pitch/yaw/hfov on a timer. Here the camera is never touched.
   */
  async updatePanorama(newPanoramaUrl, selectionsOverride = null) {
    if (!newPanoramaUrl) return;
    if (!this.currentZone) return;

    const activeObj = {};
    if (selectionsOverride && typeof selectionsOverride === 'object') {
      Object.assign(activeObj, selectionsOverride);
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

    if (!this._compositor || !this.viewer || this.viewer.destroyed) {
      this.loadZone(this.currentZone, activeObj, newPanoramaUrl);
      return;
    }

    const myGen = ++this._loadGeneration;
    this._resolveComposite(this.currentZone, activeObj, newPanoramaUrl);
    try { await this._compositor.setBase(this._currentPanorama); }
    catch (e) { return; }
    if (myGen !== this._loadGeneration) return;
    await this._paint();
    this._refreshAllCards();
    this._renderCompositeNotice();
    this._applyTimeOfDay();
  }

  /**
   * Apply one slot swap and repaint.
   *
   * Returns a promise so the swap audit (and any caller that wants to know the
   * picture is final) can await the redraw instead of guessing a timeout.
   */
  updateSlotDisplay(slotId, newItemId, writingText) {
    this.activeSelections.set(slotId, newItemId);
    if (writingText !== undefined) this.customWriting.set(slotId, writingText);
    this._refreshCard(slotId, newItemId, writingText);
    return this._recomposite(slotId);
  }

  async _recomposite(changedSlotId) {
    if (!this.currentZone || !this._compositor) return;
    const myGen = ++this._loadGeneration;

    this._forcedLayerSlot = null;
    this._resolveComposite(this.currentZone, this._selectionsAsObject(), null);

    // Every swap must visibly change the view. If the resolved plate AND the
    // layer set are both unchanged — which happens when two catalogue options
    // share one plate file — composite the changed item explicitly rather than
    // letting the swap silently no-op.
    let specs = this._layerSpecs();
    if (this._signature(specs) === this._lastSignature && changedSlotId) {
      this._forcedLayerSlot = changedSlotId;
      specs = this._layerSpecs();
    }

    try { await this._compositor.setBase(this._currentPanorama); }
    catch (e) { return; }
    if (myGen !== this._loadGeneration) return;

    this._lastSignature = this._signature(specs);
    this._compositor.setLayers(specs);
    await this._compositor.render();
    if (myGen !== this._loadGeneration) return;
    this.viewer?.markTextureDirty();
    this._applyTimeOfDay();
    this._renderCompositeNotice();
  }

  navigateToZoneWithZoom(targetZoneId, targetPitch, targetYaw) {
    if (!this.viewer) {
      if (this.onNavigateZone) this.onNavigateZone(targetZoneId);
      return;
    }
    try {
      this.viewer.setPitch(targetPitch, 400);
      this.viewer.setYaw(targetYaw, 400);
      this.viewer.setHfov(60, 400);
    } catch (e) {}
    setTimeout(() => { if (this.onNavigateZone) this.onNavigateZone(targetZoneId); }, 420);
  }

  // ------------------------------------------------------------- hotspots

  _buildOverlayLayer(zoneData) {
    if (this._overlayEl?.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
    this.container.style.position = 'relative';
    this._overlayEl = this._buildOverlay(zoneData);
  }

  _buildOverlay(zoneData) {
    const overlay = document.createElement('div');
    overlay.className = 'hs-overlay';
    overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible;';

    // No prop sprites here any more. Decor lives in the panorama texture, which
    // is the only place it can live and still be part of the picture.
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

  /** Update one hotspot card in place. */
  _refreshCard(slotId, newItemId, writingText) {
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

    card.classList.add('hs-card-flash');
    setTimeout(() => card.classList.remove('hs-card-flash'), 600);
  }

  _refreshAllCards() {
    this.currentZone?.slots.forEach(slot => {
      this._refreshCard(slot.id, this.activeSelections.get(slot.id), this.customWriting.get(slot.id));
    });
  }

  /**
   * Say, in the view itself, which selections are photographic and which are
   * composited. Without this the client cannot tell the difference, and a
   * composited element that reads as a render is exactly the claim this product
   * must not make.
   */
  _renderCompositeNotice() {
    if (!this._overlayEl) return;
    let note = this._overlayEl.querySelector('.v360-composite-note');
    const drawn = (this._compositor?._layers || []).map(l => getItemById(l.itemId)?.name).filter(Boolean);

    if (!drawn.length) { if (note) note.remove(); return; }

    const text = drawn.length === 1
      ? `${drawn[0]} is drawn into this photograph as a composited layer — the room and the other elements are the real plate.`
      : `${drawn.length} changes are drawn into this photograph as composited layers: ${drawn.join(', ')}.`;

    if (!note) {
      note = document.createElement('div');
      note.className = 'v360-composite-note';
      note.setAttribute('role', 'status');
      note.style.cssText = `position:absolute;left:50%;bottom:14px;transform:translateX(-50%);
        max-width:min(90%,560px);display:flex;gap:9px;align-items:flex-start;
        padding:9px 14px;border-radius:12px;font-size:12.5px;line-height:1.45;
        background:var(--surface-2, rgba(9,10,15,0.88));color:var(--text-primary, #f8fafc);
        border:1px solid var(--accent, #f59e0b);pointer-events:auto;z-index:60;`;
      this._overlayEl.appendChild(note);
    }
    note.innerHTML = `<span class="v360-note-icon" aria-hidden="true">◐</span>
      <span class="v360-note-text">${escapeHtml(text)}</span>`;
  }

  /**
   * Exact rectilinear placement for the hotspot cards and nav arrows.
   * See `panoProjection.js` for the derivation; the camera here is the same
   * rotation-only spherical camera the plates were shot with.
   */
  _updateCardPositions() {
    if (!this.viewer || this.viewer.destroyed || !this._overlayEl) return;

    const W = this.container.clientWidth  || 1;
    const H = this.container.clientHeight || 1;

    let cam;
    try {
      cam = { yaw: this.viewer.getYaw(), pitch: this.viewer.getPitch(), hfov: this.viewer.getHfov() };
    } catch { return; }

    const halfH = cam.hfov / 2;
    const halfV = verticalFov(cam.hfov, W, H) / 2;

    this._overlayEl.querySelectorAll('.hs-card, .nav-arrow-hotspot').forEach(el => {
      const hp = parseFloat(el.getAttribute('data-pitch'));
      const hy = parseFloat(el.getAttribute('data-yaw'));
      if (Number.isNaN(hp) || Number.isNaN(hy)) return;

      let dYaw = hy - cam.yaw;
      while (dYaw >  180) dYaw -= 360;
      while (dYaw < -180) dYaw += 360;

      const proj = projectAnchor(hy, hp, cam, W, H);
      if (!proj.visible || Math.abs(dYaw) > halfH + 25 || Math.abs(hp - cam.pitch) > halfV + 25) {
        el.style.display = 'none';
        return;
      }

      el.style.display = 'block';
      el.style.left = `${proj.x}px`;
      el.style.top  = `${proj.y}px`;
      el.style.transform = el.classList.contains('hs-card')
        ? 'translate(-50%, -100%)'
        : 'translate(-50%, -50%)';
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
    if (this._loopId) { cancelAnimationFrame(this._loopId); this._loopId = null; }
  }

  _teardownViewer() {
    this._stopLoop();
    if (this._overlayEl?.parentNode) this._overlayEl.parentNode.removeChild(this._overlayEl);
    if (this.viewer) { try { this.viewer.destroy(); } catch (e) {} this.viewer = null; }
  }

  /** Release the WebGL context and every cached patch. */
  dispose() {
    this._loadGeneration++;
    this._teardownViewer();
    this._overlayEl = null;
    this._compositor?.dispose();
    this._compositor = null;
  }

  // ------------------------------------------------------------ view state

  /**
   * Explicitly set auto-rotation. The guided tour needs to turn rotation ON
   * regardless of the current state, which `toggleAutoRotate()` cannot do.
   */
  setAutoRotate(on) {
    this.autoRotate = Boolean(on);
    if (!this.viewer || this.viewer.destroyed) return this.autoRotate;
    try {
      if (this.autoRotate) this.viewer.startAutoRotate(-2);
      else this.viewer.stopAutoRotate();
    } catch (e) {}
    return this.autoRotate;
  }

  toggleAutoRotate() { return this.setAutoRotate(!this.autoRotate); }

  /** Soft day/night grade over the panorama canvas (CSS filter). */
  setTimeOfDay(timeKey = 'day') {
    this._timeKey = timeKey || 'day';
    this._applyTimeOfDay();
    return this._timeKey;
  }

  getTimeOfDay() { return this._timeKey; }

  _applyTimeOfDay() {
    const target = this.viewer?.canvas
      || this.container?.querySelector('canvas')
      || this.container?.querySelector('.v360-fallback-img');
    if (!target) return;
    const filters = {
      dawn: 'brightness(0.95) saturate(1.15) hue-rotate(-8deg)',
      day: 'none',
      dusk: 'brightness(0.85) saturate(1.25) hue-rotate(12deg)',
      night: 'brightness(0.55) saturate(0.85) contrast(1.1)'
    };
    target.style.filter = filters[this._timeKey] || filters.day;
    target.style.transition = 'filter 0.6s ease';
  }

  /**
   * The 3D engine could not start — no WebGL, or the module failed to load. We
   * still show the venue photo, but we say plainly that this is a flat still
   * and not the interactive 360 view, because silently degrading to a photo
   * while the UI still promises "360°" is exactly the kind of claim this
   * product cannot afford to get caught making.
   */
  _loadFallback(panoramaUrl, zoneData) {
    this._showEngineError(
      '360° engine unavailable — showing a flat still',
      'The 3D viewer could not start (WebGL is disabled or unsupported in this browser). '
        + 'Panning, hotspots and live swaps are disabled until it is available.',
      panoramaUrl, zoneData);
  }

  /** Visible, accessible failure state layered over the still image. */
  _showEngineError(title, detail, panoramaUrl, zoneData) {
    this._engineFailed = true;
    this._teardownViewer();
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
    return !this._engineFailed && Boolean(this.viewer) && !this.viewer.destroyed;
  }
}
