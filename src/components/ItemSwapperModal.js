import { ITEM_CATALOG, getItemById } from '../data/catalog.js';

/**
 * ItemSwapperModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens when a hotspot card or inventory drawer slot is clicked.
 * Shows ALL catalog options for that slot's category.
 * Selecting one calls onSwap(slotId, newItemId, quantity, customText) —
 * which triggers updateSlotDisplay() (no panorama reload).
 * ─────────────────────────────────────────────────────────────────────────────
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

  // ── Resolve catalog items for this slot category ─────────────────────────
  _getItems() {
    const cat = this.activeSlot.category;
    let items = ITEM_CATALOG[cat] || [];
    if (!items.length) {
      const map = { podium:'stages', speaker:'lighting', sound:'lighting', arch:'backdrops', banner:'backdrops', swing:'tables' };
      const k = Object.keys(map).find(k => cat.includes(k));
      if (k) items = ITEM_CATALOG[map[k]] || [];
    }
    return items.length ? items : (ITEM_CATALOG.stages || []);
  }

  // ── Main render ───────────────────────────────────────────────────────────
  _render() {
    const slot     = this.activeSlot;
    const items    = this._getItems();
    const curId    = this.selections[slot.id] || slot.defaultItemId;
    const curItem  = getItemById(curId);
    const curPrice = curItem ? curItem.price * slot.quantity : 0;

    const emoji = { stages:'🎭', chairs:'🪑', tables:'🍽️', fountains:'⛲', backdrops:'🖼️', lighting:'💡', sofas:'🛋️', podiums:'🎙️' };

    this.container.innerHTML = `
      <div class="ism-overlay" id="ismOverlay">
        <div class="ism-panel" role="dialog" aria-modal="true" aria-label="Choose ${slot.label}">

          <!-- HEADER -->
          <div class="ism-header">
            <div class="ism-header-meta">
              <span class="ism-zone-tag">📍 ${this.activeZone?.name || 'Venue'}</span>
              <h2 class="ism-title">${emoji[slot.category] || '📦'} ${slot.label}</h2>
              <p class="ism-subtitle">Choose a replacement · ${items.length} options available</p>
            </div>
            <button class="ism-close" id="ismClose" aria-label="Close">✕</button>
          </div>

          <!-- CURRENT SELECTION BANNER -->
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
              <span class="ism-qty">${slot.quantity}× qty</span>
            </div>
          </div>

          <!-- OPTIONS GRID -->
          <div class="ism-options-label">All Available Options</div>
          <div class="ism-grid" id="ismGrid">
            ${items.map(item => {
              const isCurrent = item.id === curId;
              const total     = item.price * slot.quantity;
              const diff      = total - curPrice;
              const diffHtml  = diff !== 0
                ? `<span class="ism-diff ${diff > 0 ? 'pos' : 'neg'}">${diff > 0 ? '+' : ''}$${Math.abs(diff).toLocaleString()}</span>`
                : `<span class="ism-diff same">Same price</span>`;

              return `
                <div class="ism-option${isCurrent ? ' ism-option-active' : ''}" data-item-id="${item.id}"
                     tabindex="0" role="button" aria-pressed="${isCurrent}"
                     title="${item.description || item.name}">
                  ${isCurrent ? '<span class="ism-active-badge">✓ Current</span>' : ''}
                  <img class="ism-option-img" src="${item.imageUrl || ''}" alt="${item.name}"
                       onerror="this.style.background='#1a1a2e';this.style.display='flex'" />
                  <div class="ism-option-body">
                    <strong class="ism-option-name">${item.name}</strong>
                    <p class="ism-option-desc">${item.description || ''}</p>
                    <div class="ism-option-pricing">
                      <span class="ism-option-price">$${total.toLocaleString()}</span>
                      ${diffHtml}
                    </div>
                  </div>
                  <button class="ism-select-btn${isCurrent ? ' ism-select-btn-active' : ''}"
                          data-item-id="${item.id}">
                    ${isCurrent ? '✓ Selected' : 'Select'}
                  </button>
                </div>`;
            }).join('')}
          </div>

          <!-- CUSTOM TEXT (for stages/backdrops) -->
          ${['stages','backdrops'].includes(slot.category) ? `
          <div class="ism-custom-row">
            <span class="ism-custom-label">✍️ Custom text overlay (banner / slogan)</span>
            <input class="ism-custom-input" id="ismCustomText"
                   placeholder='e.g. "Vikas Yatra 2025" or "Mr & Mrs Sharma"'
                   value="${this.selections[`custom_text_${slot.id}`] || ''}" />
          </div>` : ''}

          <!-- FOOTER -->
          <div class="ism-footer">
            <button class="ism-btn-cancel" id="ismCancel">Cancel</button>
          </div>
        </div>
      </div>
    `;

    // Wire up close buttons
    document.getElementById('ismClose')?.addEventListener('click',  () => this.close());
    document.getElementById('ismCancel')?.addEventListener('click', () => this.close());
    document.getElementById('ismOverlay')?.addEventListener('click', e => {
      if (e.target.id === 'ismOverlay') this.close();
    });

    // Wire option cards + select buttons
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
    this.close();
    if (this.onSwap) this.onSwap(slot.id, itemId, slot.quantity, customText);
  }
}
