import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import { resolveScenePanorama } from '../data/sceneVariants.js';
import { formatMoney, escapeHtml } from '../utils/format.js';

/**
 * Honest before/after.
 *
 * BEFORE = the zone's bare base panorama, dressed with each slot's factory
 *          default item (what the venue hands you).
 * AFTER  = the panorama that the client's CURRENT selections actually resolve
 *          to, via the same `resolveScenePanorama` the 360 viewer uses.
 *
 * When no distinct 360 plate exists for the current selections, the two images
 * are identical — and the component says so out loud rather than faking a
 * difference with a grayscale filter. The spec table underneath always shows
 * the real, itemised difference.
 */
export class BeforeAfterCompare {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.zoneId = VENUE_ZONES[0].id;
    this.splitPercent = 50;
    this._bound = false;
    this._dragging = false;
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this._dragging = false;
    this.container.style.display = 'none';
  }

  get zone() {
    return VENUE_ZONES.find(z => z.id === this.zoneId) || VENUE_ZONES[0];
  }

  /** The zone as the venue hands it over: every slot on its factory default. */
  defaultSelections() {
    const defaults = {};
    this.zone.slots.forEach(slot => { defaults[slot.id] = slot.defaultItemId; });
    return defaults;
  }

  beforeUrl() {
    const zone = this.zone;
    return resolveScenePanorama(zone.id, zone, this.defaultSelections()) || zone.panoramaUrl;
  }

  afterUrl() {
    const zone = this.zone;
    return resolveScenePanorama(zone.id, zone, this.activeSelections) || zone.panoramaUrl;
  }

  /** Per-slot default vs. selected, with the rupee delta. */
  diffRows() {
    return this.zone.slots.map(slot => {
      const beforeItem = getItemById(slot.defaultItemId);
      const selectedId = this.activeSelections[slot.id] || slot.defaultItemId;
      const afterItem = getItemById(selectedId);
      const qty = Number(slot.quantityByItem?.[selectedId] ?? slot.quantity ?? 1);
      const beforeTotal = Math.round((beforeItem?.price || 0) * Number(slot.quantity ?? 1));
      const afterTotal = Math.round((afterItem?.price || 0) * qty);
      return {
        label: slot.label,
        before: beforeItem?.name || '—',
        after: afterItem?.name || '—',
        changed: selectedId !== slot.defaultItemId,
        delta: afterTotal - beforeTotal
      };
    });
  }

  render() {
    const beforeUrl = this.beforeUrl();
    const afterUrl = this.afterUrl();
    const identical = beforeUrl === afterUrl;
    const rows = this.diffRows();
    const changedCount = rows.filter(r => r.changed).length;
    const netDelta = rows.reduce((sum, r) => sum + r.delta, 0);

    const notice = identical
      ? `This zone has no separate 360° plate for the current selections, so both halves show the same base panorama. The itemised changes below are the real difference.`
      : `Left: the venue's default build. Right: the 360° plate for the client's current selections.`;

    this.container.innerHTML = `
      <div class="modal-backdrop" id="compare-backdrop"></div>
      <div class="modal-content compare-modal" role="dialog" aria-modal="true" aria-labelledby="compare-title"
        style="width: 80%; max-width: 1000px; height: 84vh; padding: 20px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: 8px; position: fixed; top: 8vh; left: 50%; transform: translateX(-50%); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.35); display: flex; flex-direction: column;">

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 12px;">
          <h2 id="compare-title" style="margin:0; font-size:1.1rem;">📸 Default vs. Current Selection</h2>
          <select id="compare-zone-select" aria-label="Zone to compare"
            style="padding: 6px; font-size: 14px; border-radius:8px; border:1px solid var(--border-subtle); background: var(--bg-elevated); color: var(--text-main);">
            ${VENUE_ZONES.map(z => `<option value="${escapeHtml(z.id)}" ${z.id === this.zoneId ? 'selected' : ''}>${escapeHtml(z.name)}</option>`).join('')}
          </select>
          <button type="button" id="compare-close-btn" class="btn-icon" aria-label="Close comparison" style="font-size: 1.5em; border:none; background:none; color: var(--text-muted); cursor:pointer;">&times;</button>
        </div>

        <p style="margin:0 0 10px; font-size:11px; color:var(--text-muted);">${escapeHtml(notice)}</p>

        <div class="compare-container" style="position: relative; flex: 1; min-height: 220px; overflow: hidden; border-radius: 8px; background: #000; touch-action: none;">
          <img id="compare-after-img" src="${escapeHtml(afterUrl)}" alt="Current selection view of ${escapeHtml(this.zone.name)}"
            style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.65); color: white; padding: 5px 10px; border-radius: 4px; font-size:12px;">After — Current selection</div>

          <div id="compare-before-wrapper" style="position: absolute; top: 0; left: 0; width: ${this.splitPercent}%; height: 100%; overflow: hidden;">
            <!-- Sized to the CONTAINER, not the viewport, so both layers line up exactly. -->
            <img id="compare-before-img" src="${escapeHtml(beforeUrl)}" alt="Default build view of ${escapeHtml(this.zone.name)}"
              style="position: absolute; top: 0; left: 0; height: 100%; object-fit: cover;" />
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.65); color: white; padding: 5px 10px; border-radius: 4px; font-size:12px;">Before — Venue default</div>
          </div>

          <div id="compare-divider" role="slider" tabindex="0" aria-label="Comparison split position"
            aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.splitPercent)}"
            style="position: absolute; top: 0; left: ${this.splitPercent}%; bottom: 0; width: 4px; background: white; cursor: ew-resize; transform: translateX(-50%); box-shadow: 0 0 5px rgba(0,0,0,0.5);">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: white; color:#111; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
              <span style="font-size: 12px;">&lt;&gt;</span>
            </div>
          </div>
        </div>

        <div style="margin-top:12px; max-height:26%; overflow-y:auto; border:1px solid var(--border-subtle); border-radius:8px;">
          <table style="width:100%; border-collapse:collapse; font-size:12px;">
            <thead>
              <tr style="background:var(--bg-elevated); text-align:left;">
                <th style="padding:8px;">Element</th>
                <th style="padding:8px;">Before (default)</th>
                <th style="padding:8px;">After (selected)</th>
                <th style="padding:8px; text-align:right;">Δ Cost</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => `
                <tr style="border-top:1px solid var(--border-subtle); ${r.changed ? '' : 'opacity:0.6;'}">
                  <td style="padding:8px;">${escapeHtml(r.label)}</td>
                  <td style="padding:8px;">${escapeHtml(r.before)}</td>
                  <td style="padding:8px;">${escapeHtml(r.after)}${r.changed ? ' <span style="color:#4ade80;">•</span>' : ''}</td>
                  <td style="padding:8px; text-align:right; white-space:nowrap;">${r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : '−'}${formatMoney(Math.abs(r.delta))}`}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="border-top:1px solid var(--border-subtle); background:var(--bg-elevated);">
                <td style="padding:8px;" colspan="3"><strong>${changedCount} of ${rows.length} element${rows.length === 1 ? '' : 's'} changed in this zone</strong></td>
                <td style="padding:8px; text-align:right; white-space:nowrap;"><strong>${netDelta === 0 ? '—' : `${netDelta > 0 ? '+' : '−'}${formatMoney(Math.abs(netDelta))}`}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `;
    this.bindEvents();
    this.syncBeforeImageWidth();
  }

  /**
   * The clipped "before" layer must be drawn at the FULL container width and
   * then clipped, or the two halves render at different scales and the seam
   * does not line up.
   */
  syncBeforeImageWidth() {
    const container = this.container.querySelector('.compare-container');
    const beforeImg = this.container.querySelector('#compare-before-img');
    if (container && beforeImg) beforeImg.style.width = `${container.clientWidth}px`;
  }

  setSplit(percent) {
    this.splitPercent = Math.max(0, Math.min(100, percent));
    const divider = this.container.querySelector('#compare-divider');
    const wrapper = this.container.querySelector('#compare-before-wrapper');
    if (divider) {
      divider.style.left = `${this.splitPercent}%`;
      divider.setAttribute('aria-valuenow', String(Math.round(this.splitPercent)));
    }
    if (wrapper) wrapper.style.width = `${this.splitPercent}%`;
  }

  bindEvents() {
    // Bound once against the persistent container, so repeated open() calls
    // cannot stack duplicate window-level drag handlers.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      if (e.target.id === 'compare-close-btn' || e.target.id === 'compare-backdrop') this.close();
    });

    this.container.addEventListener('change', e => {
      if (e.target.id === 'compare-zone-select') {
        this.zoneId = e.target.value;
        this.render();
      }
    });

    // Pointer events cover mouse, touch and pen — the slider now works on the
    // tablet a client walkthrough actually runs on.
    this.container.addEventListener('pointerdown', e => {
      const divider = e.target.closest?.('#compare-divider');
      if (!divider) return;
      this._dragging = true;
      divider.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    });

    this.container.addEventListener('pointermove', e => {
      if (!this._dragging) return;
      const rect = this.container.querySelector('.compare-container')?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      this.setSplit(((e.clientX - rect.left) / rect.width) * 100);
    });

    const stop = () => { this._dragging = false; };
    this.container.addEventListener('pointerup', stop);
    this.container.addEventListener('pointercancel', stop);

    this.container.addEventListener('keydown', e => {
      if (!e.target.closest?.('#compare-divider')) return;
      if (e.key === 'ArrowLeft') { this.setSplit(this.splitPercent - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.setSplit(this.splitPercent + 5); e.preventDefault(); }
      if (e.key === 'Home') { this.setSplit(0); e.preventDefault(); }
      if (e.key === 'End') { this.setSplit(100); e.preventDefault(); }
    });

    window.addEventListener('resize', () => {
      if (this.container.style.display !== 'none') this.syncBeforeImageWidth();
    });
  }
}
