import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class CostCard {
  constructor(containerElement, activeSelections, onQuantityChange) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onQuantityChange = onQuantityChange;
    this.isExpanded = false;
    this.budgetLimit = 25000;

    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.render();
  }

  calculateTotals() {
    let grandTotal = 0;
    const zoneBreakdown = [];

    VENUE_ZONES.forEach(zone => {
      let zoneTotal = 0;
      const itemsList = [];

      zone.slots.forEach(slot => {
        const selectedItemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(selectedItemId);
        if (item) {
          const totalItemPrice = item.price * slot.quantity;
          zoneTotal += totalItemPrice;
          itemsList.push({
            slotId: slot.id,
            slotLabel: slot.label,
            item: item,
            quantity: slot.quantity,
            totalPrice: totalItemPrice
          });
        }
      });

      grandTotal += zoneTotal;
      zoneBreakdown.push({
        zone: zone,
        zoneTotal: zoneTotal,
        items: itemsList
      });
    });

    return { grandTotal, zoneBreakdown };
  }

  render() {
    const { grandTotal, zoneBreakdown } = this.calculateTotals();
    const budgetPct = Math.min(Math.round((grandTotal / this.budgetLimit) * 100), 100);

    this.container.innerHTML = `
      <div class="cost-card-wrapper ${this.isExpanded ? 'expanded' : ''}">
        <!-- Floating Header Pill -->
        <div class="cost-card-header" id="toggleCostCardBtn">
          <div class="cost-header-info">
            <span class="cost-badge">Overall Event Budget</span>
            <div class="grand-price-row">
              <span class="grand-price">$${grandTotal.toLocaleString()}</span>
              <span class="budget-target">Target: $${this.budgetLimit.toLocaleString()}</span>
            </div>
          </div>

          <div class="cost-header-right">
            <div class="budget-progress-bar">
              <div class="progress-fill ${budgetPct > 90 ? 'alert' : ''}" style="width: ${budgetPct}%;"></div>
            </div>
            <button class="btn-toggle-expand" aria-label="Toggle budget breakdown">
              ${this.isExpanded ? '▲ Hide Breakdown' : '▼ Live Quotation Invoice'}
            </button>
          </div>
        </div>

        <!-- Expandable Itemized Invoice Breakdown -->
        <div class="cost-card-drawer">
          <div class="drawer-header">
            <h4>Live Itemized Quote & Quantities</h4>
            <button class="btn-export-quote" id="exportQuoteBtn">🖨 Export Invoice</button>
          </div>

          <div class="zones-breakdown-list">
            ${zoneBreakdown.map(({ zone, zoneTotal, items }) => `
              <div class="zone-breakdown-group">
                <div class="zone-group-header">
                  <span class="zone-name">${zone.name}</span>
                  <span class="zone-subtotal">$${zoneTotal.toLocaleString()}</span>
                </div>
                <div class="zone-items-table">
                  ${items.map(i => `
                    <div class="breakdown-item-row photo-breakdown-row">
                      <img src="${i.item.imageUrl}" alt="${i.item.name}" class="breakdown-thumb" />
                      <div class="item-name-col">
                        <span class="item-slot-label">${i.slotLabel}</span>
                        <strong class="item-title">${i.item.name}</strong>
                      </div>
                      <div class="item-qty-col">
                        <span class="qty-badge">${i.quantity}x</span>
                        <span class="unit-price">@ $${i.item.price}</span>
                      </div>
                      <span class="item-line-total">$${i.totalPrice.toLocaleString()}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="drawer-footer">
            <span>5 Photorealistic 360° Zones • Live Price Sync</span>
            <strong>Grand Total: $${grandTotal.toLocaleString()}</strong>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const toggleBtn = this.container.querySelector('#toggleCostCardBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        if (e.target.closest('#exportQuoteBtn')) return;
        this.isExpanded = !this.isExpanded;
        this.render();
      });
    }

    const exportBtn = this.container.querySelector('#exportQuoteBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        window.print();
      });
    }
  }
}
