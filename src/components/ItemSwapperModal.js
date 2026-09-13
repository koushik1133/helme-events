import { ITEM_CATALOG, getItemById } from '../data/catalog.js';
import { hasSceneVariant, sceneVariantCoverage } from '../data/sceneVariants.js';
import { formatMoney, escapeHtml } from '../utils/format.js';

/**
 * ItemSwapperModal — pick a replacement for a zone slot.
 *
 * Prices are integer rupees per unit per event day (see src/data/catalog.js).
 *
 * Honesty rule: this modal must never promise a visual result it cannot
 * deliver. Options that have a real environment-locked 360 plate are badged
 * "360° preview"; everything else is badged "Prop preview" and the subtitle
 * says how many of the options actually re-render the scene.
 */
export class ItemSwapperModal {
  constructor(containerEl, onSwap) {
    this.container  = containerEl;
    this.onSwap     = onSwap;
    this.activeSlot = null;
    this.activeZone = null;
    this.selections = {};
    this.isOpen     = false;
    this._prevFocus = null;
    this._handleKey = this._handleKey.bind(this);
  }

  open(zone, slot, currentSelections) {
    this.activeZone = zone;
    this.activeSlot = slot;
    this.selections = currentSelections || {};
    this._prevFocus = document.activeElement;
    this.isOpen = true;
    this._render();
    document.addEventListener('keydown', this._handleKey, true);
    // Focus the current option so arrow keys work immediately.
    const start = this.container.querySelector('.ism-option-active') || this.container.querySelector('.ism-option');
    (start || this.container.querySelector('.ism-close'))?.focus();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._handleKey, true);
    const prev = this._prevFocus;
    this._prevFocus = null;
    if (prev && typeof prev.focus === 'function' && document.contains(prev)) prev.focus();
  }

  /** All focusable controls inside the dialog, in DOM order. */
  _focusables() {
    return Array.from(
      this.container.querySelectorAll('button, input, [href], select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(el => !el.disabled && el.offsetParent !== null);
  }

  _options() {
    return Array.from(this.container.querySelectorAll('.ism-option'));
  }

  _handleKey(e) {
    if (!this.isOpen) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }

    // Focus trap — Tab must never escape the dialog.
    if (e.key === 'Tab') {
      const items = this._focusables();
      if (!items.length) return;
      const first = items[0];
      const last  = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !this.container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !this.container.contains(active))) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    // Arrow / Home / End navigation across the option grid.
    const NAV = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const options = this._options();
    if (!options.length) return;
    const idx = options.indexOf(document.activeElement.closest?.('.ism-option') || document.activeElement);

    if (e.key in NAV && idx !== -1) {
      e.preventDefault();
      const next = (idx + NAV[e.key] + options.length) % options.length;
      options[next].focus();
    } else if (e.key === 'Home' && idx !== -1) {
      e.preventDefault();
      options[0].focus();
    } else if (e.key === 'End' && idx !== -1) {
      e.preventDefault();
      options[options.length - 1].focus();
    }
  }

  _getItems() {
    const slot = this.activeSlot;
    if (!slot) return [];

    // Explicit allow-list (deduped, order preserved)
    if (Array.isArray(slot.allowedItemIds) && slot.allowedItemIds.length) {
      const seen = new Set();
      return slot.allowedItemIds
        .map(id => getItemById(id))
        .filter(item => {
          if (!item || seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
    }

    const cats = slot.swapCategories || [slot.category];
    const seen = new Set();
    const items = [];
    for (const cat of cats) {
      for (const item of (ITEM_CATALOG[cat] || [])) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        items.push(item);
      }
    }

    if (items.length) return items;

    const map = { podium: 'podiums', speaker: 'lighting', sound: 'lighting', arch: 'backdrops', banner: 'backdrops', swing: 'tables' };
    const k = Object.keys(map).find(key => (slot.category || '').includes(key));
    if (k) return ITEM_CATALOG[map[k]] || [];
    return ITEM_CATALOG.stages || [];
  }

  _effectiveQuantity(itemId) {
    const slot = this.activeSlot;
    if (slot?.quantityByItem?.[itemId] != null) return slot.quantityByItem[itemId];
    return slot?.quantity || 1;
  }

  _render() {
    const slot     = this.activeSlot;
    const items    = this._getItems();
    const curId    = this.selections[slot.id] || slot.defaultItemId;
    const curItem  = getItemById(curId);
    const curQty   = this._effectiveQuantity(curId);
    const curPrice = curItem ? Math.round(curItem.price * curQty) : 0;
    const zoneId   = this.activeZone?.id;

    const coverage = sceneVariantCoverage(zoneId, slot.id, items.map(i => i.id));
    // Say exactly what will happen, rather than claiming every swap re-renders.
    const effectLine = coverage.total === 0
      ? 'No options available for this slot'
      : coverage.withPlate === coverage.total
        ? `Same room, this element only · all ${coverage.total} options re-render the 360° view`
        : coverage.withPlate === 0
          ? `Same room · ${coverage.total} options shown as a labelled prop preview, not a re-rendered 360°`
          : `Same room, this element only · ${coverage.withPlate} of ${coverage.total} options re-render the 360° view, the rest update the prop preview`;

    const emoji = { stages:'🎭', chairs:'🪑', tables:'🍽️', fountains:'⛲', backdrops:'🖼️', lighting:'💡', sofas:'🛋️', podiums:'🎙️', audio:'🔊' };

    const emptyState = `
      <div class="ism-empty" role="status">
        <span class="ism-empty-icon" aria-hidden="true">📦</span>
        <strong>No alternatives configured for this element yet</strong>
        <p>This slot has no catalog options assigned. Your sales contact can add them for your quote.</p>
      </div>`;

    this.container.innerHTML = `
      <div class="ism-overlay" id="ismOverlay">
        <div class="ism-panel" role="dialog" aria-modal="true"
             aria-labelledby="ismTitle" aria-describedby="ismSubtitle">

          <div class="ism-header">
            <div class="ism-header-meta">
              <span class="ism-zone-tag">📍 ${escapeHtml(this.activeZone?.name || 'Venue')}</span>
              <h2 class="ism-title" id="ismTitle">${emoji[slot.category] || '📦'} ${escapeHtml(slot.label)}</h2>
              <p class="ism-subtitle" id="ismSubtitle">${escapeHtml(effectLine)}</p>
            </div>
            <button type="button" class="ism-close" id="ismClose" aria-label="Close item swapper">✕</button>
          </div>

          <div class="ism-current">
            <img class="ism-current-img" src="${escapeHtml(curItem?.imageUrl || '')}" alt="" />
            <div class="ism-current-info">
              <span class="ism-current-label">Currently Selected</span>
              <strong class="ism-current-name">${escapeHtml(curItem?.name || '—')}</strong>
              <span class="ism-current-desc">${escapeHtml(curItem?.description || '')}</span>
            </div>
            <div class="ism-current-price">
              <span class="ism-price-unit">${formatMoney(curItem?.price || 0)}/unit/day</span>
              <span class="ism-price-total">${formatMoney(curPrice)} total</span>
              <span class="ism-qty">${curQty}× qty</span>
            </div>
          </div>

          <div class="ism-options-label" id="ismGridLabel">All Available Options</div>
          <div class="ism-grid" id="ismGrid" role="group" aria-labelledby="ismGridLabel">
            ${items.length ? items.map(item => this._renderOption(item, curId, curPrice, zoneId, slot)).join('') : emptyState}
          </div>

          ${['stages','backdrops','podiums'].includes(slot.category) ? `
          <div class="ism-custom-row">
            <label class="ism-custom-label" for="ismCustomText">✍️ Custom text overlay (banner / slogan)</label>
            <input class="ism-custom-input" id="ismCustomText" type="text"
                   placeholder='e.g. "Vikas Yatra 2025" or "Mr &amp; Mrs Sharma"'
                   value="${escapeHtml(this.selections[`custom_text_${slot.id}`] || '')}" />
          </div>` : ''}

          <div class="ism-footer">
            <button type="button" class="ism-btn-cancel" id="ismCancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ismClose')?.addEventListener('click',  () => this.close());
    document.getElementById('ismCancel')?.addEventListener('click', () => this.close());
    document.getElementById('ismOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'ismOverlay') this.close();
    });

    // Every option is a real <button>, so Enter/Space are handled natively.
    this.container.querySelectorAll('.ism-option').forEach(card => {
      card.addEventListener('click', () => {
        const itemId = card.getAttribute('data-item-id');
        const customInput = document.getElementById('ismCustomText');
        this._select(itemId, customInput?.value?.trim() || undefined);
      });
    });
  }

  _renderOption(item, curId, curPrice, zoneId, slot) {
    const isCurrent = item.id === curId;
    const qty       = this._effectiveQuantity(item.id);
    const total     = Math.round(item.price * qty);
    const diff      = total - curPrice;
    const hasPlate  = hasSceneVariant(zoneId, slot.id, item.id);

    const diffHtml = diff !== 0
      ? `<span class="ism-diff ${diff > 0 ? 'pos' : 'neg'}">${diff > 0 ? '+' : '−'}${formatMoney(Math.abs(diff))}</span>`
      : `<span class="ism-diff same">Same price</span>`;

    // Honest badge: only claim a 360 re-render when a real plate exists.
    const previewBadge = hasPlate
      ? `<span class="ism-scene-badge" title="Loads a 360° plate of this same room with this element changed">360° preview</span>`
      : `<span class="ism-scene-badge ism-scene-badge-prop" title="The 360° room stays as it is; a labelled product preview is placed at this hotspot">Prop preview</span>`;

    const diffLabel = diff === 0
      ? 'no price change'
      : `${diff > 0 ? 'adds' : 'saves'} ${formatMoney(Math.abs(diff))}`;
    const a11yLabel = `${item.name}. ${formatMoney(total)} for ${qty}. ${diffLabel}. `
      + (hasPlate ? 'Re-renders the 360 view.' : 'Updates the prop preview only.')
      + (isCurrent ? ' Currently selected.' : '');

    return `
      <button type="button" class="ism-option${isCurrent ? ' ism-option-active' : ''}"
              data-item-id="${escapeHtml(item.id)}"
              aria-pressed="${isCurrent}"
              aria-label="${escapeHtml(a11yLabel)}">
        ${isCurrent ? '<span class="ism-active-badge">✓ Current</span>' : ''}
        ${previewBadge}
        <img class="ism-option-img" src="${escapeHtml(item.imageUrl || '')}" alt="" loading="lazy" />
        <span class="ism-option-body">
          <strong class="ism-option-name">${escapeHtml(item.name)}</strong>
          <span class="ism-option-desc">${escapeHtml(item.description || '')}</span>
          ${slot.quantityByItem ? `<span class="ism-option-qty-hint">${qty} on stage</span>` : ''}
          <span class="ism-option-pricing">
            <span class="ism-option-price">${formatMoney(total)}</span>
            ${diffHtml}
          </span>
        </span>
        <span class="ism-select-btn${isCurrent ? ' ism-select-btn-active' : ''}" aria-hidden="true">
          ${isCurrent ? '✓ Selected' : 'Swap in'}
        </span>
      </button>`;
  }

  _select(itemId, customText) {
    const slot = this.activeSlot;
    if (!slot) return;
    const quantity = this._effectiveQuantity(itemId);
    this.close();
    if (this.onSwap) this.onSwap(slot.id, itemId, quantity, customText);
  }
}
