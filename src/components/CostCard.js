import { VENUE_ZONES } from '../data/zones.js';
import { formatMoney, formatMoneyShort, escapeHtml } from '../utils/format.js';
import { buildQuote, renderInvoiceDocument, getOrCreateDocNumber, printHtmlDocument } from '../utils/quote.js';

export class CostCard {
  constructor(containerElement, activeSelections, onQuantityChange) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onQuantityChange = onQuantityChange;
    this.isExpanded = false;
    // Default target: a round number ~10% above the seeded configuration, so the
    // card never boots "over budget" against a hardcoded figure. User-editable.
    this.budgetLimit = CostCard.defaultBudget(buildQuote(this.activeSelections).subtotal);

    this.render();
  }

  /** Round up to a tidy target above `subtotal` (2 significant figures). */
  static defaultBudget(subtotal) {
    const base = Math.max(1, Math.round(Number(subtotal) || 0) * 1.1);
    const magnitude = Math.pow(10, Math.max(0, String(Math.round(base)).length - 2));
    return Math.ceil(base / magnitude) * magnitude;
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.render();
  }

  calculateTotals() {
    const quote = buildQuote(this.activeSelections);
    return {
      grandTotal: quote.subtotal,
      quote,
      zoneBreakdown: quote.zones.map(z => ({
        zone: VENUE_ZONES.find(v => v.id === z.zoneId) || { id: z.zoneId, name: z.zoneName },
        zoneTotal: z.zoneTotal,
        items: z.lines
      }))
    };
  }

  render() {
    const { grandTotal, zoneBreakdown } = this.calculateTotals();
    const budgetPct = this.budgetLimit > 0 ? Math.round((grandTotal / this.budgetLimit) * 100) : 0;
    const barPct = Math.min(budgetPct, 100);
    const overBy = grandTotal - this.budgetLimit;

    this.container.innerHTML = `
      <div class="cost-card-wrapper ${this.isExpanded ? 'expanded' : ''}">
        <!-- Floating Header Pill -->
        <div class="cost-card-header" id="toggleCostCardBtn">
          <div class="cost-header-info">
            <span class="cost-badge">Overall Event Budget (excl. GST)</span>
            <div class="grand-price-row">
              <span class="grand-price">${formatMoney(grandTotal)}</span>
              <span class="budget-target">
                Target: ${formatMoneyShort(this.budgetLimit)} • ${budgetPct}%
                ${overBy > 0 ? ` • ${formatMoneyShort(overBy)} over` : ''}
              </span>
            </div>
          </div>

          <div class="cost-header-right">
            <div class="budget-progress-bar">
              <div class="progress-fill ${budgetPct > 90 ? 'alert' : ''}" style="width: ${barPct}%;"></div>
            </div>
            <button class="btn-toggle-expand" type="button" aria-expanded="${this.isExpanded}" aria-controls="costCardDrawer">
              ${this.isExpanded ? '▲ Hide Breakdown' : '▼ Live Quotation Invoice'}
            </button>
          </div>
        </div>

        <!-- Expandable Itemized Invoice Breakdown -->
        <div class="cost-card-drawer" id="costCardDrawer">
          <div class="drawer-header">
            <h4>Live Itemized Quote</h4>
            <div class="drawer-header-controls">
              <label class="budget-target-label" for="budgetTargetInput">Budget target (₹)</label>
              <input type="number" id="budgetTargetInput" class="budget-target-input" min="0" step="10000"
                     value="${this.budgetLimit}" aria-label="Budget target in rupees" />
              <button class="btn-export-quote" type="button" id="exportQuoteBtn">🖨 Print Quotation</button>
            </div>
          </div>

          <div class="zones-breakdown-list">
            ${zoneBreakdown.length === 0 ? `
              <div class="cost-empty-state">
                <strong>No equipment configured yet.</strong>
                <p>Open a 360° zone and pick items — every swap prices itself here instantly.</p>
              </div>
            ` : zoneBreakdown.map(({ zone, zoneTotal, items }) => `
              <div class="zone-breakdown-group">
                <div class="zone-group-header">
                  <span class="zone-name">${escapeHtml(zone.name)}</span>
                  <span class="zone-subtotal">${formatMoney(zoneTotal)}</span>
                </div>
                <div class="zone-items-table">
                  ${items.map(i => `
                    <div class="breakdown-item-row photo-breakdown-row">
                      <img src="${escapeHtml(i.imageUrl || '')}" alt="" class="breakdown-thumb" />
                      <div class="item-name-col">
                        <span class="item-slot-label">${escapeHtml(i.slotLabel)}</span>
                        <strong class="item-title">${escapeHtml(i.itemName)}</strong>
                      </div>
                      <div class="item-qty-col">
                        <span class="qty-badge">${i.quantity}x</span>
                        <span class="unit-price">@ ${formatMoney(i.unitPrice)}</span>
                      </div>
                      <span class="item-line-total">${formatMoney(i.lineTotal)}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="drawer-footer">
            <span>${zoneBreakdown.length} of ${VENUE_ZONES.length} zones in scope for this event • Live price sync</span>
            <strong>Subtotal (excl. GST): ${formatMoney(grandTotal)}</strong>
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
        if (e.target.closest('.drawer-header-controls')) return;
        this.isExpanded = !this.isExpanded;
        this.render();
      });
    }

    const budgetInput = this.container.querySelector('#budgetTargetInput');
    if (budgetInput) {
      budgetInput.addEventListener('click', e => e.stopPropagation());
      budgetInput.addEventListener('change', (e) => {
        const next = Number(e.target.value);
        this.budgetLimit = Number.isFinite(next) && next > 0 ? Math.round(next) : this.budgetLimit;
        this.render();
        const again = this.container.querySelector('#budgetTargetInput');
        if (again) again.focus();
      });
    }

    const exportBtn = this.container.querySelector('#exportQuoteBtn');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const quote = buildQuote(this.activeSelections);
        const docNumber = getOrCreateDocNumber('cost-card-quotation', 'HE/QTE');
        printHtmlDocument(
          `Quotation ${docNumber}`,
          renderInvoiceDocument({
            quote,
            docNumber,
            heading: 'Quotation',
            buyer: { company: 'Prospective Client', state: quote.buyerState },
            note: 'Quotation only — not a tax invoice. Valid for 15 days from the date above.'
          })
        );
      });
    }
  }
}
