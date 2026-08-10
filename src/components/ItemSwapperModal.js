import { ITEM_CATALOG, getItemById } from '../data/catalog.js';
import { hasSceneVariant } from '../data/sceneVariants.js';

/**
 * ItemSwapperModal — pick a replacement for a zone slot.
 * Shows zone-filtered catalog options and marks items that have
 * environment-locked 360 variant plates ready to load.
 */
export class ItemSwapperModal {
  constructor(containerEl, onSwap) {
    this.container  = containerEl;
    this.onSwap     = onSwap;
    this.activeSlot = null;
    this.activeZone = null;
    this.selections = {};
    this._handleKey = this._handleKey.bind(this);
  }

  open(zone, slot, currentSelections) {
    this.activeZone = zone;
    this.activeSlot = slot;
    this.selections = currentSelections || {};
    this._render();
    document.addEventListener('keydown', this._handleKey);
  }

  close() {
    this.container.innerHTML = '';
    document.removeEventListener('keydown', this._handleKey);
  }

  _handleKey(e) {
    if (e.key === 'Escape') this.close();
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
    const curPrice = curItem ? curItem.price * curQty : 0;
    const zoneId   = this.activeZone?.id;

    const emoji = { stages:'🎭', chairs:'🪑', tables:'🍽️', fountains:'⛲', backdrops:'🖼️', lighting:'💡', sofas:'🛋️', podiums:'🎙️', audio:'🔊' };

    this.container.innerHTML = `
      <div class="ism-overlay" id="ismOverlay">
        <div class="ism-panel" role="dialog" aria-modal="true" aria-label="Choose ${slot.label}">

          <div class="ism-header">
            <div class="ism-header-meta">
              <span class="ism-zone-tag">📍 ${this.activeZone?.name || 'Venue'}</span>
              <h2 class="ism-title">${emoji[slot.category] || '📦'} ${slot.label}</h2>
              <p class="ism-subtitle">Swap this element only · environment stays locked · ${items.length} options</p>
            </div>
            <button class="ism-close" id="ismClose" aria-label="Close">✕</button>
          </div>

          <div class="ism-current">
            <img class="ism-current-img" src="${curItem?.imageUrl || ''}" alt="${curItem?.name || ''}" />
            <div class="ism-current-info">
              <span class="ism-current-label">Currently Selected</span>
              <strong class="ism-current-name">${curItem?.name || '—'}</strong>
              <span class="ism-current-desc">${curItem?.description || ''}</span>
            </div>
            <div class="ism-current-price">
              <span class="ism-price-unit">$${curItem?.price?.toLocaleString() || 0}/unit</span>
              <span class="ism-price-total">$${curPrice.toLocaleString()} total</span>
              <span class="ism-qty">${curQty}× qty</span>
            </div>
          </div>

          <div class="ism-options-label">All Available Options</div>
          <div class="ism-grid" id="ismGrid">
            ${items.map(item => {
              const isCurrent = item.id === curId;
              const qty       = this._effectiveQuantity(item.id);
              const total     = item.price * qty;
              const diff      = total - curPrice;
              const hasPlate  = hasSceneVariant(zoneId, slot.id, item.id);
              const diffHtml  = diff !== 0
                ? `<span class="ism-diff ${diff > 0 ? 'pos' : 'neg'}">${diff > 0 ? '+' : ''}$${Math.abs(diff).toLocaleString()}</span>`
                : `<span class="ism-diff same">Same price</span>`;

              return `
                <div class="ism-option${isCurrent ? ' ism-option-active' : ''}" data-item-id="${item.id}"
                     tabindex="0" role="button" aria-pressed="${isCurrent}"
                     title="${item.description || item.name}">
                  ${isCurrent ? '<span class="ism-active-badge">✓ Current</span>' : ''}
                  ${hasPlate ? '<span class="ism-scene-badge">360° ready</span>' : ''}
                  <img class="ism-option-img" src="${item.imageUrl || ''}" alt="${item.name}"
                       onerror="this.style.background='#1a1a2e'" />
                  <div class="ism-option-body">
                    <strong class="ism-option-name">${item.name}</strong>
                    <p class="ism-option-desc">${item.description || ''}</p>
                    ${slot.quantityByItem ? `<p class="ism-option-qty-hint">${qty} on stage</p>` : ''}
                    <div class="ism-option-pricing">
                      <span class="ism-option-price">$${total.toLocaleString()}</span>
                      ${diffHtml}
                    </div>
                  </div>
                  <button class="ism-select-btn${isCurrent ? ' ism-select-btn-active' : ''}"
                          data-item-id="${item.id}">
                    ${isCurrent ? '✓ Selected' : 'Swap in'}
                  </button>
                </div>`;
            }).join('')}
          </div>

          ${['stages','backdrops','podiums'].includes(slot.category) ? `
          <div class="ism-custom-row">
            <span class="ism-custom-label">✍️ Custom text overlay (banner / slogan)</span>
            <input class="ism-custom-input" id="ismCustomText"
                   placeholder='e.g. "Vikas Yatra 2025" or "Mr & Mrs Sharma"'
                   value="${this.selections[`custom_text_${slot.id}`] || ''}" />
          </div>` : ''}

          <div class="ism-footer">
            <button class="ism-btn-cancel" id="ismCancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('ismClose')?.addEventListener('click',  () => this.close());
    document.getElementById('ismCancel')?.addEventListener('click', () => this.close());
    document.getElementById('ismOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'ismOverlay') this.close();
    });

    this.container.querySelectorAll('.ism-option').forEach(card => {
      const selectFn = () => {
        const itemId = card.getAttribute('data-item-id');
        const customInput = document.getElementById('ismCustomText');
        this._select(itemId, customInput?.value?.trim() || undefined);
      };
      card.addEventListener('click', selectFn);
      card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') selectFn(); });
    });

    this.container.querySelectorAll('.ism-select-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const itemId = btn.getAttribute('data-item-id');
        const customInput = document.getElementById('ismCustomText');
        this._select(itemId, customInput?.value?.trim() || undefined);
      });
    });
  }

  _select(itemId, customText) {
    const slot = this.activeSlot;
    if (!slot) return;
    const quantity = this._effectiveQuantity(itemId);
    this.close();
    if (this.onSwap) this.onSwap(slot.id, itemId, quantity, customText);
  }
}
