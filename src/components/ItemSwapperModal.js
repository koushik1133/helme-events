import { ITEM_CATALOG, getItemById } from '../data/catalog.js';

export class ItemSwapperModal {
  constructor(containerElement, onSwap) {
    this.container = containerElement;
    this.onSwap = onSwap;
    this.activeSlot = null;
    this.activeZone = null;
    this.currentSelections = {};
  }

  open(zone, slot, currentSelections) {
    this.activeZone = zone;
    this.activeSlot = slot;
    this.currentSelections = currentSelections;
    this.render();
  }

  close() {
    this.container.innerHTML = '';
  }

  render() {
    if (!this.activeSlot) return;

    const currentItemId = this.currentSelections[this.activeSlot.id] || this.activeSlot.defaultItemId;
    const currentItem = getItemById(currentItemId);
    const availableItems = ITEM_CATALOG[this.activeSlot.category] || [];

    this.container.innerHTML = `
      <div class="swapper-modal-overlay">
        <div class="swapper-modal-card realistic-swapper-card">
          <div class="swapper-header">
            <div>
              <span class="swapper-badge">${this.activeZone.name}</span>
              <h3>Customize: ${this.activeSlot.label}</h3>
              <p class="swapper-subtitle">Choose a photorealistic replacement item to interchange directly in the 360° view.</p>
            </div>
            <button class="btn-close-modal" id="closeSwapperBtn">&times;</button>
          </div>

          <!-- Current Selection Summary -->
          <div class="current-item-banner photo-current-banner">
            <img src="${currentItem ? currentItem.imageUrl : ''}" alt="${currentItem ? currentItem.name : ''}" class="current-item-thumb" />
            <div class="current-item-info">
              <span class="current-tag">Currently Active Setup</span>
              <strong>${currentItem ? currentItem.name : 'None'}</strong>
              <p>${currentItem ? currentItem.description : ''}</p>
            </div>
            <div class="current-price-box">
              <span class="price-val">$${currentItem ? currentItem.price * this.activeSlot.quantity : 0}</span>
              <small>Subtotal (${this.activeSlot.quantity}x)</small>
            </div>
          </div>

          <!-- Photorealistic Options Grid -->
          <div class="swapper-options-grid photo-options-grid">
            ${availableItems.map(item => {
              const isSelected = item.id === currentItemId;
              const priceTotal = item.price * this.activeSlot.quantity;
              const currentTotal = currentItem ? currentItem.price * this.activeSlot.quantity : 0;
              const diff = priceTotal - currentTotal;
              const diffText = diff > 0 ? `+$${diff}` : (diff < 0 ? `-$${Math.abs(diff)}` : 'Same Price');

              return `
                <div class="swapper-option-card photo-option-card ${isSelected ? 'selected' : ''}" data-item-id="${item.id}">
                  <div class="option-photo-wrap">
                    <img src="${item.imageUrl}" alt="${item.name}" class="option-img" />
                    <span class="option-price-tag">$${item.price} <small>/ unit</small></span>
                  </div>

                  <div class="option-details">
                    <div class="option-header">
                      <span class="option-title">${item.name}</span>
                    </div>
                    <p class="option-desc">${item.description}</p>
                    <div class="option-footer">
                      <span class="price-diff ${diff > 0 ? 'higher' : (diff < 0 ? 'lower' : '')}">${diffText}</span>
                      <button class="btn-select-swap ${isSelected ? 'active' : ''}" data-item-id="${item.id}">
                        ${isSelected ? '✓ In 360 View' : 'Interchange Item'}
                      </button>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('#closeSwapperBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const backdrop = this.container.querySelector('.swapper-modal-overlay');
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) this.close();
      });
    }

    const swapBtns = this.container.querySelectorAll('.btn-select-swap, .photo-option-card');
    swapBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const itemId = btn.getAttribute('data-item-id');
        if (itemId && this.onSwap && this.activeSlot) {
          this.onSwap(this.activeSlot.id, itemId, this.activeSlot.quantity);
          this.close();
        }
      });
    });
  }
}
