import { formatMoney, escapeHtml, readJSON, writeJSON, SELLER_STATE } from '../utils/format.js';
import {
  buildQuote,
  subscribeBasket,
  renderInvoiceDocument,
  getOrCreateDocNumber,
  printHtmlDocument,
  downloadHtmlDocument,
  formatDocDate,
  addDays,
  INDIAN_STATES,
  stateCodeFor,
  SELLER
} from '../utils/quote.js';

const BUYER_KEY = 'helm_events_invoice_buyer';

const DEFAULT_BUYER = {
  company: 'Royal Palace Events Pvt Ltd',
  name: 'Procurement Desk',
  address: 'Suite 402, Bandra Kurla Complex',
  city: 'Mumbai',
  zip: '400051',
  state: 'Maharashtra',
  gstin: '27AAAAA0000A1Z5',
  email: 'accounts@royalpalace.in',
  phone: '+91 98765 43210'
};

export class InvoiceGenerator {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};

    const stored = readJSON(BUYER_KEY, null);
    this.buyer = { ...DEFAULT_BUYER, ...(stored && typeof stored === 'object' ? stored : {}) };

    // Generated ONCE and persisted — never re-randomised on re-render.
    this.docNumber = getOrCreateDocNumber('invoice-current', 'HE/INV');
    this.issuedAt = new Date();

    // A quantity edited in the cart or the cost card must reprice this invoice.
    this.unsubscribeBasket = subscribeBasket(() => {
      if (this.container.style.display === 'flex') this.render();
    });
  }

  destroy() {
    if (this.unsubscribeBasket) this.unsubscribeBasket();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    if (this.container.style.display === 'flex') this.render();
  }

  open() {
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  quote() {
    return buildQuote(this.activeSelections, { buyerState: this.buyer.state });
  }

  documentBody() {
    return renderInvoiceDocument({
      quote: this.quote(),
      buyer: this.buyer,
      docNumber: this.docNumber,
      date: this.issuedAt,
      heading: 'Tax Invoice'
    });
  }

  render() {
    const quote = this.quote();
    const half = quote.gstRatePct / 2;
    const taxRows = quote.gst.intraState
      ? `
        <div class="inv-total-row"><span>CGST @ ${half}%</span><span>${formatMoney(quote.gst.cgst)}</span></div>
        <div class="inv-total-row"><span>SGST @ ${half}%</span><span>${formatMoney(quote.gst.sgst)}</span></div>`
      : `<div class="inv-total-row"><span>IGST @ ${quote.gstRatePct}%</span><span>${formatMoney(quote.gst.igst)}</span></div>`;

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content invoice-modal" style="max-width: 900px; width: 100%;">
          <div class="modal-header">
            <h2>GST Tax Invoice</h2>
            <span class="badge-inr" style="margin-left:auto; margin-right:15px; opacity:.75;">All amounts in INR (₹)</span>
            <button class="btn-close" type="button" aria-label="Close invoice">&times;</button>
          </div>

          <!-- THEME NOTE — deliberate literals. #invoice-print-area is a printable GST
               tax invoice, not an app surface: it is what window.print() puts on paper and
               what a client receives as a PDF. It stays black-on-white in both themes (and
               is self-consistent at 18.9:1), so every rule and border inside it is scoped
               to that white sheet rather than to the theme tokens. -->
          <div class="modal-body invoice-body" id="invoice-print-area" style="padding: 20px; background: #fff; color: #111;">
            <div class="invoice-header" style="display:flex; justify-content:space-between; gap:20px; border-bottom:2px solid #111; padding-bottom:12px; margin-bottom:16px;">
              <div>
                <h1 style="margin:0; font-size:20px;">${escapeHtml(SELLER.legalName)}</h1>
                <p style="margin:4px 0; font-size:12px;">${escapeHtml(SELLER.address)}</p>
                <p style="margin:4px 0; font-size:12px;">GSTIN: <strong>${escapeHtml(SELLER.gstin)}</strong> • State ${escapeHtml(SELLER.state)} (${escapeHtml(SELLER.stateCode)})</p>
              </div>
              <div style="text-align:right; font-size:12px;">
                <h3 style="margin:0 0 6px; text-transform:uppercase; letter-spacing:.08em;">Tax Invoice</h3>
                <div>Invoice no: <strong>${escapeHtml(this.docNumber)}</strong></div>
                <div>Invoice date: ${escapeHtml(formatDocDate(this.issuedAt))}</div>
                <div>Due date: ${escapeHtml(formatDocDate(addDays(this.issuedAt, 7)))}</div>
                <div>${quote.gst.intraState ? 'Intra-state supply (CGST + SGST)' : 'Inter-state supply (IGST)'}</div>
              </div>
            </div>

            <div class="invoice-bill-to" style="margin-bottom:16px;">
              <h3 style="margin:0 0 8px 0; font-size:12px; text-transform:uppercase; letter-spacing:.06em;">Bill to / Place of supply</h3>
              <div class="invoice-buyer-grid" style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px;">
                <label style="font-size:11px;">Company
                  <input type="text" class="inv-field" data-field="company" value="${escapeHtml(this.buyer.company)}" style="width:100%;" />
                </label>
                <label style="font-size:11px;">Contact
                  <input type="text" class="inv-field" data-field="name" value="${escapeHtml(this.buyer.name)}" style="width:100%;" />
                </label>
                <label style="font-size:11px;">GSTIN
                  <input type="text" class="inv-field" data-field="gstin" value="${escapeHtml(this.buyer.gstin)}" style="width:100%;" />
                </label>
                <label style="font-size:11px;">Address
                  <input type="text" class="inv-field" data-field="address" value="${escapeHtml(this.buyer.address)}" style="width:100%;" />
                </label>
                <label style="font-size:11px;">City &amp; PIN
                  <input type="text" class="inv-field" data-field="city" value="${escapeHtml(this.buyer.city)}" style="width:100%;" />
                </label>
                <label style="font-size:11px;">State (place of supply)
                  <select class="inv-field" data-field="state" style="width:100%;">
                    ${INDIAN_STATES.map(s => `<option value="${escapeHtml(s.name)}" ${s.name === this.buyer.state ? 'selected' : ''}>${escapeHtml(s.name)} (${escapeHtml(s.code)})</option>`).join('')}
                  </select>
                </label>
              </div>
              <p style="margin:6px 0 0; font-size:11px; opacity:.7;">
                State code ${escapeHtml(stateCodeFor(this.buyer.state))} — supplier is registered in ${escapeHtml(SELLER_STATE)},
                so this invoice is ${quote.gst.intraState ? 'intra-state and splits CGST/SGST' : 'inter-state and charges IGST'}.
              </p>
            </div>

            <table class="invoice-table" style="width:100%; text-align:left; border-collapse:collapse; margin-bottom:16px; font-size:12px;">
              <thead>
                <tr>
                  <th style="border-bottom:2px solid #999; padding:8px;">Description</th>
                  <th style="border-bottom:2px solid #999; padding:8px;">HSN/SAC</th>
                  <th style="border-bottom:2px solid #999; padding:8px; text-align:right;">Qty</th>
                  <th style="border-bottom:2px solid #999; padding:8px; text-align:right;">Rate</th>
                  <th style="border-bottom:2px solid #999; padding:8px; text-align:right;">Taxable value</th>
                </tr>
              </thead>
              <tbody>
                ${quote.lines.map(l => `
                  <tr>
                    <td style="border-bottom:1px solid #eee; padding:8px;">
                      <strong>${escapeHtml(l.itemName)}</strong><br />
                      <small style="opacity:.7;">${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)}</small>
                    </td>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${escapeHtml(l.sac)}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px; text-align:right;">${l.quantity}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px; text-align:right;">${formatMoney(l.unitPrice)}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px; text-align:right;">${formatMoney(l.lineTotal)}</td>
                  </tr>
                `).join('')}
                ${quote.lines.length === 0 ? `
                  <tr><td colspan="5" style="padding:20px; text-align:center;">
                    No billable lines. Pick items in a 360° zone, or restore removed lines in the cart, and this invoice fills itself in.
                  </td></tr>` : ''}
              </tbody>
            </table>

            <div class="invoice-totals" style="margin-left:auto; width:320px; font-size:13px;">
              <div class="inv-total-row" style="display:flex; justify-content:space-between; padding:4px 0;"><span>Taxable value</span><span>${formatMoney(quote.subtotal)}</span></div>
              ${taxRows}
              <div class="inv-total-row" style="display:flex; justify-content:space-between; padding:8px 0 0; border-top:2px solid #111; font-weight:700; font-size:15px;">
                <span>Total (INR)</span><span>${formatMoney(quote.grandTotal)}</span>
              </div>
            </div>

            <div style="margin-top:20px; font-size:12px;">
              <h3 style="font-size:12px; text-transform:uppercase; letter-spacing:.06em; margin:0 0 6px;">Payment schedule</h3>
              ${quote.schedule.map(s => `
                <div style="display:flex; justify-content:space-between; padding:3px 0;">
                  <span>${escapeHtml(s.label)}</span><strong>${formatMoney(s.amount)}</strong>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-print" type="button">🖨 Print Invoice</button>
            <button class="btn-download-html" type="button">⬇ Download Invoice (HTML)</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('.btn-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const overlay = this.container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    this.container.querySelectorAll('.inv-field').forEach(field => {
      field.addEventListener('change', (e) => {
        const key = e.target.getAttribute('data-field');
        this.buyer[key] = e.target.value;
        writeJSON(BUYER_KEY, this.buyer);
        this.render();
      });
    });

    const printBtn = this.container.querySelector('.btn-print');
    if (printBtn) {
      // Builds a standalone document in a hidden iframe. The SPA DOM is never
      // touched and the page is never reloaded.
      printBtn.addEventListener('click', () => {
        printHtmlDocument(`Tax Invoice ${this.docNumber}`, this.documentBody());
      });
    }

    const dlBtn = this.container.querySelector('.btn-download-html');
    if (dlBtn) {
      dlBtn.addEventListener('click', () => {
        const safe = this.docNumber.replace(/[^\w.-]+/g, '-');
        downloadHtmlDocument(`tax-invoice-${safe}.html`, `Tax Invoice ${this.docNumber}`, this.documentBody());
      });
    }
  }
}
