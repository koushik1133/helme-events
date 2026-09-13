import { VENUE_ZONES } from '../data/zones.js';
import { formatMoney, formatMoneyShort, formatNumber, escapeHtml } from '../utils/format.js';
import {
  buildQuote, renderInvoiceDocument, getOrCreateDocNumber, printHtmlDocument,
  setLineQuantity, removeLine, restoreLine, resetBasket, subscribeBasket
} from '../utils/quote.js';
import { eventState } from '../data/eventState.js';

export class CostCard {
  constructor(containerElement, activeSelections, onQuantityChange) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onQuantityChange = onQuantityChange;
    this.isExpanded = false;
    // Default target: a round number ~10% above the seeded configuration, so the
    // card never boots "over budget" against a hardcoded figure. User-editable.
    this.budgetLimit = eventState.getBudgetTarget() > 0
      ? eventState.getBudgetTarget()
      : CostCard.defaultBudget(buildQuote(this.activeSelections).subtotal);

    // A quantity edit made anywhere (the cart, this card) re-prices every surface.
    this.unsubscribeBasket = subscribeBasket(() => this.render());
    this.unsubscribeEvent = eventState.subscribe((snapshot, changed) => {
      if (changed.includes('guestCount') || changed.includes('eventType') || changed.includes('budgetTarget')) {
        if (changed.includes('budgetTarget') && snapshot.budgetTarget > 0) {
          this.budgetLimit = snapshot.budgetTarget;
        }
        this.render();
      }
    });

    this.render();
  }

  /** Always call this when the card is torn down, or the listeners leak. */
  destroy() {
    if (this.unsubscribeBasket) this.unsubscribeBasket();
    if (this.unsubscribeEvent) this.unsubscribeEvent();
  }

  /** One place that applies a quantity edit and lets everyone else know. */
  applyQuantity(slotId, quantity) {
    setLineQuantity(slotId, quantity);
    if (typeof this.onQuantityChange === 'function') this.onQuantityChange(slotId, quantity);
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

  /** One editable line row — quantity stepper, direct entry, and remove. */
  renderLineRow(i) {
    return `
      <div class="breakdown-item-row photo-breakdown-row" data-slot-id="${escapeHtml(i.slotId)}">
        <img src="${escapeHtml(i.imageUrl || '')}" alt="" class="breakdown-thumb" />
        <div class="item-name-col">
          <span class="item-slot-label">${escapeHtml(i.slotLabel)}</span>
          <strong class="item-title">${escapeHtml(i.itemName)}</strong>
        </div>
        <div class="item-qty-col">
          <div class="qty-stepper" role="group" aria-label="Quantity for ${escapeHtml(i.itemName)}">
            <button type="button" class="qty-step" data-qty-step="-1" data-slot-id="${escapeHtml(i.slotId)}"
                    aria-label="Decrease quantity of ${escapeHtml(i.itemName)}" ${i.quantity <= 1 ? 'disabled' : ''}>−</button>
            <input type="number" class="qty-input" min="1" max="100000" step="1"
                   value="${i.quantity}" data-slot-id="${escapeHtml(i.slotId)}"
                   aria-label="Quantity of ${escapeHtml(i.itemName)}" />
            <button type="button" class="qty-step" data-qty-step="1" data-slot-id="${escapeHtml(i.slotId)}"
                    aria-label="Increase quantity of ${escapeHtml(i.itemName)}">+</button>
          </div>
          <span class="unit-price">@ ${formatMoney(i.unitPrice)}</span>
          ${i.isCustomQuantity ? `
            <button type="button" class="qty-reset" data-qty-reset="${escapeHtml(i.slotId)}"
                    aria-label="Reset ${escapeHtml(i.itemName)} to the default quantity of ${i.defaultQuantity}">
              edited • reset to ${i.defaultQuantity}
            </button>` : ''}
        </div>
        <span class="item-line-total">${formatMoney(i.lineTotal)}</span>
        <button type="button" class="btn-remove-line" data-remove-slot="${escapeHtml(i.slotId)}"
                aria-label="Remove ${escapeHtml(i.itemName)} from the quote">Remove</button>
      </div>
    `;
  }

  render() {
    const { grandTotal, zoneBreakdown, quote } = this.calculateTotals();
    const guests = eventState.getGuestCount();
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
                <strong>${quote.removedCount > 0 ? 'Every line has been removed.' : 'No equipment configured yet.'}</strong>
                <p>${quote.removedCount > 0
                  ? 'Put a line back below, or open a 360° zone and pick items.'
                  : 'Open a 360° zone and pick items — every swap prices itself here instantly.'}</p>
              </div>
            ` : zoneBreakdown.map(({ zone, zoneTotal, items }) => `
              <div class="zone-breakdown-group">
                <div class="zone-group-header">
                  <span class="zone-name">${escapeHtml(zone.name)}</span>
                  <span class="zone-subtotal">${formatMoney(zoneTotal)}</span>
                </div>
                <div class="zone-items-table">
                  ${items.map(i => this.renderLineRow(i)).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          ${quote.removedCount > 0 ? `
            <div class="removed-lines-block">
              <h5>Removed from this quote (${quote.removedCount})</h5>
              <ul class="removed-lines-list">
                ${quote.removedLines.map(l => `
                  <li>
                    <span>${escapeHtml(l.itemName)} <small>${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)}</small></span>
                    <button type="button" class="btn-restore-line" data-restore-slot="${escapeHtml(l.slotId)}"
                            aria-label="Put ${escapeHtml(l.itemName)} back into the quote">Put back</button>
                  </li>
                `).join('')}
              </ul>
              <button type="button" class="btn-restore-all" id="btnResetBasket">Restore all lines &amp; default quantities</button>
            </div>
          ` : ''}

          <div class="drawer-footer">
            <span>
              ${zoneBreakdown.length} of ${VENUE_ZONES.length} zones in scope •
              ${formatNumber(quote.unitCount)} units • seating and tables sized for ${formatNumber(guests)} guests
            </span>
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
        // The budget target is shared event data, not a private field of this card.
        eventState.set({ budgetTarget: this.budgetLimit });
        this.render();
        const again = this.container.querySelector('#budgetTargetInput');
        if (again) again.focus();
      });
    }

    // --- basket controls -------------------------------------------------
    this.container.querySelectorAll('[data-qty-step]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slotId = btn.getAttribute('data-slot-id');
        const input = this.container.querySelector(`.qty-input[data-slot-id="${slotId}"]`);
        const step = Number(btn.getAttribute('data-qty-step'));
        const next = Math.max(1, (Number(input && input.value) || 1) + step);
        this.applyQuantity(slotId, next);
      });
    });

    this.container.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('click', e => e.stopPropagation());
      input.addEventListener('change', (e) => {
        e.stopPropagation();
        const slotId = input.getAttribute('data-slot-id');
        const next = Math.round(Number(input.value));
        if (!Number.isFinite(next) || next < 1) {
          // Never accept a zero or negative line; removing is an explicit action.
          input.value = '1';
          this.applyQuantity(slotId, 1);
          return;
        }
        this.applyQuantity(slotId, Math.min(next, 100000));
      });
    });

    this.container.querySelectorAll('[data-qty-reset]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.applyQuantity(btn.getAttribute('data-qty-reset'), 0);
      });
    });

    this.container.querySelectorAll('[data-remove-slot]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeLine(btn.getAttribute('data-remove-slot'));
        if (typeof this.onQuantityChange === 'function') {
          this.onQuantityChange(btn.getAttribute('data-remove-slot'), 0);
        }
      });
    });

    this.container.querySelectorAll('[data-restore-slot]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        restoreLine(btn.getAttribute('data-restore-slot'));
        if (typeof this.onQuantityChange === 'function') {
          this.onQuantityChange(btn.getAttribute('data-restore-slot'), null);
        }
      });
    });

    const resetBtn = this.container.querySelector('#btnResetBasket');
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetBasket();
        if (typeof this.onQuantityChange === 'function') this.onQuantityChange(null, null);
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
