import confetti from 'canvas-confetti';
import { formatMoney, escapeHtml, readJSON, writeJSON, SELLER_STATE } from '../utils/format.js';
import {
  buildQuote,
  setLineQuantity,
  removeLine,
  restoreLine,
  resetBasket,
  subscribeBasket,
  renderInvoiceDocument,
  getOrCreateDocNumber,
  printHtmlDocument,
  downloadHtmlDocument,
  formatDocDate,
  INDIAN_STATES,
  stateCodeFor,
  SELLER
} from '../utils/quote.js';

const BUYER_KEY = 'helm_events_invoice_buyer';
const ORDERS_KEY = 'helm_events_orders';

const DEFAULT_BUYER = {
  name: 'Koushik Goud',
  company: 'Helm Events',
  email: 'hello@helmevents.in',
  phone: '+91 98765 43210',
  address: 'Suite 402, Bandra Kurla Complex',
  city: 'Mumbai',
  zip: '400051',
  state: 'Maharashtra',
  gstin: '27AAAAA0000A1Z5'
};

export class CartPaymentModal {
  constructor(containerElement, activeSelections, onPaymentSuccess) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onPaymentSuccess = onPaymentSuccess;
    this.isOpen = false;
    this.selectedPaymentMethod = 'upi';
    this.isProcessing = false;
    this.isPaid = false;
    this.error = null;
    // Demo-only switch so the decline path can actually be demonstrated.
    this.demoOutcome = 'approve';
    this.order = null;

    const stored = readJSON(BUYER_KEY, null);
    this.buyer = { ...DEFAULT_BUYER, ...(stored && typeof stored === 'object' ? stored : {}) };

    // A quantity edited in the cost card while the cart is open must reprice here too.
    this.unsubscribeBasket = subscribeBasket(() => {
      if (this.isOpen && !this.isPaid && !this.isProcessing) this.render();
    });
  }

  destroy() {
    if (this.unsubscribeBasket) this.unsubscribeBasket();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    if (this.isOpen) this.render();
  }

  open() {
    this.isOpen = true;
    this.isProcessing = false;
    this.error = null;
    this.render();
  }

  close() {
    if (this.isProcessing) return;
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  calculateTotals() {
    return buildQuote(this.activeSelections, { buyerState: this.buyer.state });
  }

  persistBuyer() {
    writeJSON(BUYER_KEY, this.buyer);
  }

  /**
   * The quote AS IT WAS when the advance was taken.
   *
   * The receipt and the tax invoice must never be recomputed from the live
   * configuration — edit a quantity after checkout and the "paid" invoice
   * would silently change amount.
   */
  orderQuote() {
    const o = this.order;
    return {
      lines: o.lines,
      zones: [],
      subtotal: o.subtotal,
      gst: o.gst,
      gstRatePct: o.gstRatePct,
      grandTotal: o.grandTotal,
      buyerState: o.buyer.state,
      schedule: o.schedule,
      deposit: o.advancePaid,
      balanceDue: o.grandTotal - o.advancePaid,
      itemCount: o.lines.length,
      removedLines: [],
      removedCount: 0,
      unitCount: o.lines.reduce((a, l) => a + l.quantity, 0)
    };
  }

  documentBody(quote, order) {
    return renderInvoiceDocument({
      quote,
      buyer: this.buyer,
      docNumber: order.invoiceNumber,
      date: new Date(order.issuedAt),
      heading: 'Tax Invoice',
      note: `Booking advance of ${formatMoney(order.advancePaid)} received (demo transaction ${order.reference}). Balance payable per the schedule below.`
    });
  }

  render() {
    if (!this.isOpen) return;
    const quote = this.calculateTotals();
    const half = quote.gstRatePct / 2;

    const taxRows = quote.gst.intraState
      ? `
        <div class="summary-line"><span>CGST @ ${half}%</span><strong>${formatMoney(quote.gst.cgst)}</strong></div>
        <div class="summary-line"><span>SGST @ ${half}%</span><strong>${formatMoney(quote.gst.sgst)}</strong></div>`
      : `<div class="summary-line"><span>IGST @ ${quote.gstRatePct}%</span><strong>${formatMoney(quote.gst.igst)}</strong></div>`;

    this.container.innerHTML = `
      <div class="cart-modal-overlay">
        <div class="cart-modal-card realistic-swapper-card" role="dialog" aria-modal="true" aria-label="Checkout">
          <div class="cart-modal-header">
            <div>
              <span class="cart-modal-badge">🛒 Equipment Cart & GST Checkout</span>
              <h3>B2B Tax Invoice & Event Setup Reservation</h3>
              <p class="cart-modal-subtitle">All amounts in Indian Rupees. GST is applied per place of supply.</p>
            </div>
            <button class="btn-close-modal" type="button" id="btnCloseCartModal" aria-label="Close checkout">&times;</button>
          </div>

          <div class="demo-banner" role="note" style="margin:0 0 14px; padding:10px 14px; border:1px dashed var(--warning); border-radius:8px; background:var(--tint-warning); font-size:13px;">
            <strong>Demo checkout — no real payment is processed.</strong>
            No card details are collected anywhere in this flow. Never enter live payment information.
          </div>

          ${this.isPaid ? this.renderSuccess(this.orderQuote()) : this.renderCheckout(quote, taxRows)}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderSuccess(quote) {
    const order = this.order;
    return `
      <div class="payment-success-box">
        <div class="success-icon">🎉</div>
        <h3>Advance recorded &amp; venue reserved (demo)</h3>
        <p class="receipt-id">Tax Invoice: <strong>${escapeHtml(order.invoiceNumber)}</strong> • Reference: <strong>${escapeHtml(order.reference)}</strong></p>

        <div class="receipt-summary">
          <div class="receipt-row"><span>Client / Company:</span><strong>${escapeHtml(this.buyer.name)} (${escapeHtml(this.buyer.company)})</strong></div>
          <div class="receipt-row"><span>Billing address:</span><strong>${escapeHtml(this.buyer.address)}, ${escapeHtml(this.buyer.city)} ${escapeHtml(this.buyer.zip)}, ${escapeHtml(this.buyer.state)}</strong></div>
          <div class="receipt-row"><span>Buyer GSTIN:</span><strong>${escapeHtml(this.buyer.gstin || 'Unregistered')}</strong></div>
          <div class="receipt-row"><span>Supplier GSTIN:</span><strong>${escapeHtml(SELLER.gstin)}</strong></div>
          <div class="receipt-row"><span>Invoice date:</span><strong>${escapeHtml(formatDocDate(new Date(order.issuedAt)))}</strong></div>
          <div class="receipt-row"><span>Taxable value:</span><strong>${formatMoney(quote.subtotal)}</strong></div>
          <div class="receipt-row"><span>${quote.gst.intraState ? `CGST + SGST @ ${quote.gstRatePct}%` : `IGST @ ${quote.gstRatePct}%`}:</span><strong>${formatMoney(quote.gst.total)}</strong></div>
          <div class="receipt-row"><span>Grand total:</span><strong>${formatMoney(quote.grandTotal)}</strong></div>
          <div class="receipt-row"><span>Advance paid:</span><strong>${formatMoney(order.advancePaid)}</strong></div>
          <div class="receipt-row"><span>Balance due:</span><strong>${formatMoney(quote.grandTotal - order.advancePaid)}</strong></div>
          <div class="receipt-row"><span>Status:</span><span class="status-badge-paid">CONFIRMED (DEMO)</span></div>
        </div>

        <h4 class="column-title">Payment schedule</h4>
        <div class="receipt-summary">
          ${quote.schedule.map((s, i) => `
            <div class="receipt-row">
              <span>${escapeHtml(s.label)}</span>
              <strong>${formatMoney(s.amount)}${i === 0 ? ' — paid' : ''}</strong>
            </div>
          `).join('')}
        </div>

        <div class="receipt-actions">
          <button class="btn-print-receipt" type="button" id="btnPrintInvoice">🖨️ Print GST Tax Invoice</button>
          <button class="btn-print-receipt" type="button" id="btnDownloadInvoice">⬇ Download Invoice</button>
          <button class="btn-print-receipt" type="button" id="btnNewOrder">➕ Start a new order</button>
          <button class="btn-watch-progress" type="button" id="btnWatchSetupProgress">🌀 Watch Live 360° Setup Tour →</button>
        </div>
      </div>
    `;
  }

  renderCheckout(quote, taxRows) {
    return `
      <div class="cart-grid-layout">
        <div class="cart-items-column">
          <div class="location-selector-box">
            <h4 class="column-title">🧾 Billing details &amp; place of supply</h4>
            <div class="form-row-dual">
              <div class="form-group"><label for="inputClientName">Client name</label><input type="text" id="inputClientName" class="cart-input" data-buyer="name" value="${escapeHtml(this.buyer.name)}" autocomplete="off" /></div>
              <div class="form-group"><label for="inputClientCompany">Company</label><input type="text" id="inputClientCompany" class="cart-input" data-buyer="company" value="${escapeHtml(this.buyer.company)}" autocomplete="off" /></div>
            </div>
            <div class="form-row-dual">
              <div class="form-group"><label for="inputAddress">Street address</label><input type="text" id="inputAddress" class="cart-input" data-buyer="address" value="${escapeHtml(this.buyer.address)}" autocomplete="off" /></div>
              <div class="form-group"><label for="inputCity">City</label><input type="text" id="inputCity" class="cart-input" data-buyer="city" value="${escapeHtml(this.buyer.city)}" autocomplete="off" /></div>
            </div>
            <div class="form-row-dual">
              <div class="form-group"><label for="inputZip">PIN code</label><input type="text" id="inputZip" class="cart-input" data-buyer="zip" value="${escapeHtml(this.buyer.zip)}" autocomplete="off" /></div>
              <div class="form-group">
                <label for="cartStateSelect">State (place of supply)</label>
                <select id="cartStateSelect" class="cart-input" data-buyer="state">
                  ${INDIAN_STATES.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === this.buyer.state ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="form-row-dual">
              <div class="form-group"><label for="inputGstin">Buyer GSTIN</label><input type="text" id="inputGstin" class="cart-input" data-buyer="gstin" value="${escapeHtml(this.buyer.gstin)}" autocomplete="off" /></div>
              <div class="form-group"><label for="inputEmail">Billing email</label><input type="email" id="inputEmail" class="cart-input" data-buyer="email" value="${escapeHtml(this.buyer.email)}" autocomplete="off" /></div>
            </div>
            <p class="upi-hint">Supplier is registered in ${escapeHtml(SELLER_STATE)} (code ${escapeHtml(SELLER.stateCode)}). Place of supply ${escapeHtml(this.buyer.state)} (code ${escapeHtml(stateCodeFor(this.buyer.state))}) ⇒ ${quote.gst.intraState ? 'CGST + SGST' : 'IGST'}.</p>
          </div>

          <h4 class="column-title">📋 Itemized equipment list (${quote.itemCount} ${quote.itemCount === 1 ? 'line' : 'lines'} • ${quote.unitCount} units)</h4>
          <div class="cart-items-scroll">
            ${quote.lines.length === 0 ? `
              <div class="cart-empty-state" style="padding:24px; text-align:center; opacity:.8;">
                <strong>${quote.removedCount > 0 ? 'You have removed every line.' : 'Your cart is empty.'}</strong>
                <p>${quote.removedCount > 0
                  ? 'Put a line back below, or configure equipment in a 360° zone.'
                  : 'Configure equipment in a 360° zone and it will appear here, priced.'}</p>
              </div>
            ` : quote.lines.map(l => `
              <div class="cart-item-row">
                <div class="cart-item-info">
                  <strong>${escapeHtml(l.itemName)}</strong>
                  <small>${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)} • SAC ${escapeHtml(l.sac)} • ${formatMoney(l.unitPrice)} each</small>
                  <div class="qty-stepper" role="group" aria-label="Quantity for ${escapeHtml(l.itemName)}">
                    <button type="button" class="qty-step" data-qty-step="-1" data-slot-id="${escapeHtml(l.slotId)}"
                            aria-label="Decrease quantity of ${escapeHtml(l.itemName)}" ${l.quantity <= 1 ? 'disabled' : ''}>−</button>
                    <input type="number" class="qty-input" min="1" max="100000" step="1" value="${l.quantity}"
                           data-slot-id="${escapeHtml(l.slotId)}" aria-label="Quantity of ${escapeHtml(l.itemName)}" />
                    <button type="button" class="qty-step" data-qty-step="1" data-slot-id="${escapeHtml(l.slotId)}"
                            aria-label="Increase quantity of ${escapeHtml(l.itemName)}">+</button>
                    <button type="button" class="btn-remove-line" data-remove-slot="${escapeHtml(l.slotId)}"
                            aria-label="Remove ${escapeHtml(l.itemName)} from the cart">Remove</button>
                    ${l.isCustomQuantity ? `
                      <button type="button" class="qty-reset" data-qty-reset="${escapeHtml(l.slotId)}"
                              aria-label="Reset ${escapeHtml(l.itemName)} to the default quantity of ${l.defaultQuantity}">reset to ${l.defaultQuantity}</button>` : ''}
                  </div>
                </div>
                <span class="cart-item-price">${formatMoney(l.lineTotal)}</span>
              </div>
            `).join('')}
          </div>

          ${quote.removedCount > 0 ? `
            <div class="removed-lines-block">
              <h5 class="column-title">Removed from this cart (${quote.removedCount})</h5>
              <ul class="removed-lines-list">
                ${quote.removedLines.map(l => `
                  <li>
                    <span>${escapeHtml(l.itemName)} <small>${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)} • ${formatMoney(l.lineTotal)}</small></span>
                    <button type="button" class="btn-restore-line" data-restore-slot="${escapeHtml(l.slotId)}"
                            aria-label="Add ${escapeHtml(l.itemName)} back to the cart">＋ Add back</button>
                  </li>
                `).join('')}
              </ul>
              <button type="button" class="btn-restore-all" id="btnCartResetBasket">Restore all lines &amp; default quantities</button>
            </div>
          ` : ''}
        </div>

        <div class="checkout-column">
          <h4 class="column-title">💳 Payment method</h4>
          <div class="payment-methods-tabs">
            <button class="pay-method-btn ${this.selectedPaymentMethod === 'upi' ? 'active' : ''}" type="button" data-method="upi">📲 UPI / NetBanking</button>
            <button class="pay-method-btn ${this.selectedPaymentMethod === 'po' ? 'active' : ''}" type="button" data-method="po">📄 B2B Purchase Order</button>
            <button class="pay-method-btn ${this.selectedPaymentMethod === 'bank' ? 'active' : ''}" type="button" data-method="bank">🏦 Bank Transfer (NEFT/RTGS)</button>
          </div>

          <div class="payment-form-box">
            ${this.selectedPaymentMethod === 'upi' ? `
              <div class="form-group">
                <label for="inputUpi">UPI ID to raise the collect request against</label>
                <input type="text" id="inputUpi" class="cart-input" value="helmevents@okicici" autocomplete="off" readonly />
              </div>
              <p class="upi-hint">Demo only — no collect request is sent and no funds move.</p>
            ` : this.selectedPaymentMethod === 'po' ? `
              <div class="form-group">
                <label for="inputPo">Corporate PO number</label>
                <input type="text" id="inputPo" class="cart-input" value="PO-${new Date().getFullYear()}-IN-091" autocomplete="off" />
              </div>
              <p class="upi-hint">Demo only — the PO is recorded against this quote, nothing is billed.</p>
            ` : `
              <div class="form-group">
                <label>Remit to (demo account)</label>
                <input type="text" class="cart-input" value="${escapeHtml(SELLER.legalName)} • A/C 0000 0000 0000 • IFSC HELM0000042" autocomplete="off" readonly />
              </div>
              <p class="upi-hint">Demo only — these are placeholder bank details, not a real account.</p>
            `}
          </div>

          <div class="form-group">
            <label for="demoOutcome">Demo outcome</label>
            <select id="demoOutcome" class="cart-input">
              <option value="approve" ${this.demoOutcome === 'approve' ? 'selected' : ''}>Simulate approval</option>
              <option value="decline" ${this.demoOutcome === 'decline' ? 'selected' : ''}>Simulate decline</option>
            </select>
          </div>

          <div class="checkout-summary-box">
            <div class="summary-line"><span>Equipment taxable value:</span><strong>${formatMoney(quote.subtotal)}</strong></div>
            ${taxRows}
            <div class="summary-line highlight-line"><span>Grand total:</span><strong class="total-val">${formatMoney(quote.grandTotal)}</strong></div>
            <div class="summary-line deposit-line"><span>Booking advance (30%):</span><strong class="deposit-val">${formatMoney(quote.deposit)}</strong></div>
          </div>

          ${this.error ? `
            <div class="payment-error-box" role="alert" style="margin:10px 0; padding:10px 14px; border:1px solid var(--critical); border-radius:8px; background:var(--tint-critical); font-size:13px;">
              <strong>Payment declined (demo).</strong> ${escapeHtml(this.error)}
            </div>
          ` : ''}

          <button class="btn-pay-now" type="button" id="btnExecutePayment" ${this.isProcessing || quote.lines.length === 0 ? 'disabled' : ''}>
            ${this.isProcessing
              ? '⏳ Simulating authorization…'
              : quote.lines.length === 0
                ? 'Add equipment to continue'
                : `${this.error ? '↻ Retry — ' : '🔒 '}Pay ${formatMoney(quote.deposit)} advance (demo)`}
          </button>
        </div>
      </div>
    `;
  }

  recordOrder(quote) {
    const invoiceNumber = getOrCreateDocNumber(`order-${Date.now()}`, 'HE/INV');
    const order = {
      invoiceNumber,
      reference: `DEMO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      buyer: { ...this.buyer },
      subtotal: quote.subtotal,
      gst: quote.gst,
      gstRatePct: quote.gstRatePct,
      grandTotal: quote.grandTotal,
      advancePaid: quote.deposit,
      schedule: quote.schedule,
      lines: quote.lines.map(l => ({
        itemId: l.itemId, itemName: l.itemName, quantity: l.quantity,
        unitPrice: l.unitPrice, lineTotal: l.lineTotal, sac: l.sac,
        zoneName: l.zoneName, slotLabel: l.slotLabel, slotId: l.slotId
      }))
    };
    const orders = readJSON(ORDERS_KEY, []);
    const list = Array.isArray(orders) ? orders : [];
    list.unshift(order);
    writeJSON(ORDERS_KEY, list.slice(0, 50));
    return order;
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('#btnCloseCartModal');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const overlay = this.container.querySelector('.cart-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    this.container.querySelectorAll('[data-buyer]').forEach(field => {
      field.addEventListener('change', (e) => {
        this.buyer[e.target.getAttribute('data-buyer')] = e.target.value;
        this.persistBuyer();
        this.render();
      });
    });

    this.container.querySelectorAll('[data-qty-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const slotId = btn.getAttribute('data-slot-id');
        const input = this.container.querySelector(`.qty-input[data-slot-id="${slotId}"]`);
        const next = Math.max(1, (Number(input && input.value) || 1) + Number(btn.getAttribute('data-qty-step')));
        setLineQuantity(slotId, next);
        this.render();
      });
    });

    this.container.querySelectorAll('.qty-input').forEach(input => {
      input.addEventListener('change', () => {
        const n = Math.round(Number(input.value));
        setLineQuantity(input.getAttribute('data-slot-id'), Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 1);
        this.render();
      });
    });

    this.container.querySelectorAll('[data-qty-reset]').forEach(btn => {
      btn.addEventListener('click', () => {
        setLineQuantity(btn.getAttribute('data-qty-reset'), 0);
        this.render();
      });
    });

    this.container.querySelectorAll('[data-remove-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        removeLine(btn.getAttribute('data-remove-slot'));
        this.render();
      });
    });

    this.container.querySelectorAll('[data-restore-slot]').forEach(btn => {
      btn.addEventListener('click', () => {
        restoreLine(btn.getAttribute('data-restore-slot'));
        this.render();
      });
    });

    const resetBasketBtn = this.container.querySelector('#btnCartResetBasket');
    if (resetBasketBtn) {
      resetBasketBtn.addEventListener('click', () => {
        resetBasket();
        this.render();
      });
    }

    const outcome = this.container.querySelector('#demoOutcome');
    if (outcome) {
      outcome.addEventListener('change', (e) => { this.demoOutcome = e.target.value; });
    }

    this.container.querySelectorAll('.pay-method-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPaymentMethod = btn.getAttribute('data-method');
        this.render();
      });
    });

    const payBtn = this.container.querySelector('#btnExecutePayment');
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        this.isProcessing = true;
        this.error = null;
        this.render();

        setTimeout(() => {
          this.isProcessing = false;
          if (this.demoOutcome === 'decline') {
            this.error = 'The simulated issuer refused the advance. Choose "Simulate approval" or a different method and retry.';
            this.render();
            return;
          }
          const quote = this.calculateTotals();
          this.order = this.recordOrder(quote);
          this.isPaid = true;
          this.render();
          confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 } });
        }, 1200);
      });
    }

    const printBtn = this.container.querySelector('#btnPrintInvoice');
    if (printBtn && this.order) {
      printBtn.addEventListener('click', () => {
        printHtmlDocument(`Tax Invoice ${this.order.invoiceNumber}`, this.documentBody(this.orderQuote(), this.order));
      });
    }

    const dlBtn = this.container.querySelector('#btnDownloadInvoice');
    if (dlBtn && this.order) {
      dlBtn.addEventListener('click', () => {
        const safe = this.order.invoiceNumber.replace(/[^\w.-]+/g, '-');
        downloadHtmlDocument(`tax-invoice-${safe}.html`, `Tax Invoice ${this.order.invoiceNumber}`, this.documentBody(this.orderQuote(), this.order));
      });
    }

    const newOrderBtn = this.container.querySelector('#btnNewOrder');
    if (newOrderBtn) {
      newOrderBtn.addEventListener('click', () => {
        this.isPaid = false;
        this.order = null;
        this.error = null;
        this.render();
      });
    }

    const tourBtn = this.container.querySelector('#btnWatchSetupProgress');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => {
        this.isOpen = false;
        this.container.innerHTML = '';
        if (this.onPaymentSuccess) this.onPaymentSuccess();
      });
    }
  }
}
