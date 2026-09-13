import { formatMoney, escapeHtml, readJSON, writeJSON } from '../utils/format.js';
import {
  buildQuote,
  renderLineTable,
  renderTotalsTable,
  renderScheduleTable,
  renderPartyBlock,
  getOrCreateDocNumber,
  downloadHtmlDocument,
  printHtmlDocument,
  formatDocDate,
  SELLER
} from '../utils/quote.js';

const CONTRACT_KEY = 'helm_events_contracts';
const BUYER_KEY = 'helm_events_invoice_buyer';

const DEFAULT_BUYER = {
  company: 'Royal Palace Events Pvt Ltd',
  name: 'Authorised Signatory',
  address: 'Suite 402, Bandra Kurla Complex',
  city: 'Mumbai',
  zip: '400051',
  state: 'Maharashtra',
  gstin: '27AAAAA0000A1Z5',
  email: 'accounts@royalpalace.in',
  phone: '+91 98765 43210'
};

/** Clause bodies — one source of truth for the on-screen and downloaded copy. */
function contractClauses(quote, buyer, eventDate) {
  const advance = quote.schedule[0];
  const milestone = quote.schedule[1];
  const balance = quote.schedule[2];
  return [
    {
      title: '1. Scope of services',
      body: `${SELLER.legalName} ("the Producer") shall design, supply, deliver, install, operate and dismantle the event production elements itemised in Schedule A for ${escapeHtml(buyer.company)} ("the Client"), at the venue and on the event date agreed in writing between the parties${eventDate ? ` (currently ${escapeHtml(eventDate)})` : ''}. The Producer shall provide on-site supervision from load-in to teardown and a single named production manager as the Client's point of contact.`
    },
    {
      title: '2. Deliverables and timelines',
      body: `Load-in shall commence no later than 24 hours before the event start time and the setup shall be handed over for the Client’s inspection at least 2 hours before guest arrival. Teardown shall be completed within 12 hours of the event close. All items in Schedule A are supplied on a rental basis and remain the property of the Producer unless the line item is expressly marked as a sale.`
    },
    {
      title: '3. Contract value and payment schedule',
      body: `The total contract value is <strong>${formatMoney(quote.grandTotal)}</strong> (taxable value ${formatMoney(quote.subtotal)} plus GST ${formatMoney(quote.gst.total)}). Payment shall be made as follows: <strong>${formatMoney(advance.amount)}</strong> as a non-refundable booking advance on signature of this agreement; <strong>${formatMoney(milestone.amount)}</strong> as a production milestone payment due 15 days before the event date; and <strong>${formatMoney(balance.amount)}</strong> as the balance, due within 7 days of completion of teardown. Amounts unpaid after the due date carry interest at 1.5% per month.`
    },
    {
      title: '4. Changes and variation',
      body: `Any change to Schedule A requested within 10 days of the event date is subject to availability and shall be quoted as a variation. Approved variations are invoiced with the balance payment. Reductions in scope within 10 days of the event do not reduce the contract value.`
    },
    {
      title: '5. Cancellation',
      body: `Cancellation by the Client more than 45 days before the event: the booking advance is forfeited and no further sum is payable. Between 45 and 15 days: 50% of the contract value is payable. Within 15 days of the event: 100% of the contract value is payable, the Producer having by then committed labour, transport and inventory. Cancellation by the Producer other than for force majeure or the Client’s non-payment entitles the Client to a full refund of all sums paid.`
    },
    {
      title: '6. Force majeure',
      body: `Neither party is liable for failure to perform caused by events beyond its reasonable control, including acts of God, flood, fire, epidemic or pandemic, war, civil unrest, strikes, government order, prohibitory orders under Section 163 BNSS, or withdrawal of venue or police permissions. The affected party shall notify the other within 48 hours. Where the event is postponed for such a reason, sums paid shall be credited in full against a rescheduled date within 12 months, subject to availability and to the Producer’s documented out-of-pocket costs.`
    },
    {
      title: '7. Damage, loss and liability',
      body: `The Client is responsible for loss of or damage to rented items while in the Client’s or its guests’ care, fair wear and tear excepted, at the replacement values set out in the Producer’s current rate card. The Producer maintains public liability insurance and shall carry out all electrical, rigging and structural work to applicable safety standards. Save for death or personal injury caused by negligence, and save for fraud, each party’s aggregate liability under this agreement is limited to the total contract value. Neither party is liable for indirect or consequential loss, including loss of profit or goodwill.`
    },
    {
      title: '8. Permissions, safety and compliance',
      body: `The Client shall procure venue access, electrical supply, and all statutory permissions including police, fire and municipal clearances, and any sound or amplification permission, unless expressly listed in Schedule A as a Producer deliverable. The Producer shall comply with applicable safety norms and shall remove all production waste at teardown.`
    },
    {
      title: '9. Taxes (GST)',
      body: `All amounts are exclusive of GST unless stated. GST is charged at ${quote.gstRatePct}% on event support and equipment rental services under the applicable SAC codes shown in Schedule A. ${quote.gst.intraState ? `As the place of supply (${escapeHtml(quote.buyerState)}) is the same state as the Producer’s registration, CGST and SGST are charged at ${quote.gstRatePct / 2}% each.` : `As the place of supply (${escapeHtml(quote.buyerState)}) differs from the Producer’s state of registration, IGST is charged at ${quote.gstRatePct}%.`} TDS, where applicable, shall be deducted at the statutory rate and a certificate furnished. Producer GSTIN: ${escapeHtml(SELLER.gstin)}. Client GSTIN: ${escapeHtml(buyer.gstin || 'Unregistered')}.`
    },
    {
      title: '10. Confidentiality, images and publicity',
      body: `Each party shall keep the other’s commercial information confidential. The Producer may photograph its own installations for portfolio use, and shall not publish images identifying the Client, guests or the venue without the Client’s prior written consent.`
    },
    {
      title: '11. Governing law, dispute resolution and jurisdiction',
      body: `This agreement is governed by the laws of India. The parties shall first attempt resolution by good-faith discussion for 30 days. Failing that, disputes shall be referred to arbitration by a sole arbitrator under the Arbitration and Conciliation Act, 1996, seated at Hyderabad, in English. Subject to the foregoing, the courts at Hyderabad, Telangana shall have exclusive jurisdiction.`
    },
    {
      title: '12. Entire agreement',
      body: `This agreement, together with Schedule A, is the entire agreement between the parties and supersedes all prior discussions and quotations. Amendments must be in writing and signed by both parties. An electronic signature affixed below is valid and binding under the Information Technology Act, 2000.`
    }
  ];
}

export class ESignatureFlow {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};

    const stored = readJSON(BUYER_KEY, null);
    this.buyer = { ...DEFAULT_BUYER, ...(stored && typeof stored === 'object' ? stored : {}) };

    const record = readJSON(CONTRACT_KEY, null);
    this.signedRecord = record && typeof record === 'object' && record.signedAt ? record : null;
    this.isSigned = Boolean(this.signedRecord);

    this.docNumber = getOrCreateDocNumber('services-agreement', 'HE/AGR');
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

  /** The complete agreement, used on screen, for print and for download. */
  documentBody(signatureDataUrl, signedAt) {
    const quote = this.quote();
    const clauses = contractClauses(quote, this.buyer, null);
    const signedDate = signedAt ? formatDocDate(new Date(signedAt)) : null;
    return `
      <div class="doc">
        <div class="doc-head">
          <div>
            <h1>${escapeHtml(SELLER.legalName)}</h1>
            <div class="muted">${escapeHtml(SELLER.address)}</div>
            <div class="muted">GSTIN ${escapeHtml(SELLER.gstin)}</div>
          </div>
          <div class="doc-title">
            <h2>Event Production Services Agreement</h2>
            <div>Agreement no: <strong>${escapeHtml(this.docNumber)}</strong></div>
            <div>Date: ${escapeHtml(signedDate || formatDocDate(new Date()))}</div>
            <div class="muted">${signedDate ? 'Executed' : 'Draft for signature'}</div>
          </div>
        </div>

        ${renderPartyBlock(this.buyer)}

        ${clauses.map(c => `
          <div class="section">
            <h3>${escapeHtml(c.title)}</h3>
            <p>${c.body}</p>
          </div>
        `).join('')}

        <div class="section">
          <h3>Schedule A — priced equipment and services</h3>
          ${renderLineTable(quote)}
          ${renderTotalsTable(quote)}
        </div>

        <div class="section">
          <h3>Schedule B — payment schedule</h3>
          ${renderScheduleTable(quote)}
        </div>

        <div class="sign-grid">
          <div class="sign-box">
            ${signatureDataUrl ? `<img class="sign-img" src="${signatureDataUrl}" alt="Client signature" />` : '<div style="height:110px;"></div>'}
            <strong>For ${escapeHtml(this.buyer.company)}</strong><br />
            ${escapeHtml(this.buyer.name)}<br />
            ${signedDate ? `Signed on ${escapeHtml(signedDate)}` : 'Date: ______________'}
          </div>
          <div class="sign-box">
            <div style="height:110px;"></div>
            <strong>For ${escapeHtml(SELLER.legalName)}</strong><br />
            Authorised Signatory<br />
            Date: ______________
          </div>
        </div>

        <div class="foot">
          Agreement ${escapeHtml(this.docNumber)} • Contract value ${escapeHtml(formatMoney(quote.grandTotal))} (incl. GST) •
          ${escapeHtml(SELLER.email)} • ${escapeHtml(SELLER.phone)}
        </div>
      </div>
    `;
  }

  render() {
    const quote = this.quote();
    const clauses = contractClauses(quote, this.buyer, null);

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content contract-modal">
          <div class="modal-header">
            <h2>Event Production Services Agreement</h2>
            <button class="btn-close" type="button" aria-label="Close contract">&times;</button>
          </div>
          <div class="modal-body contract-body">
            <p class="contract-meta">
              Agreement <strong>${escapeHtml(this.docNumber)}</strong> •
              ${escapeHtml(SELLER.legalName)} (GSTIN ${escapeHtml(SELLER.gstin)}) and
              <strong>${escapeHtml(this.buyer.company)}</strong>, ${escapeHtml(this.buyer.city)}, ${escapeHtml(this.buyer.state)} •
              Contract value <strong>${formatMoney(quote.grandTotal)}</strong> incl. GST
            </p>

            ${this.isSigned ? `
              <div class="contract-signed-box" role="status" style="margin:12px 0; padding:12px 14px; border:1px solid #16a34a; border-radius:8px; background:rgba(22,163,74,.12);">
                <strong>Signed on ${escapeHtml(formatDocDate(new Date(this.signedRecord.signedAt)))}</strong>
                by ${escapeHtml(this.signedRecord.signatoryName || this.buyer.name)} for ${escapeHtml(this.signedRecord.company || this.buyer.company)}.
                <div style="margin-top:8px;">
                  ${this.signedRecord.signature ? `<img src="${this.signedRecord.signature}" alt="Recorded signature" style="max-width:240px; background:#fff; border:1px solid #ccc; border-radius:4px;" />` : ''}
                </div>
              </div>
            ` : ''}

            <div class="contract-clauses">
              ${clauses.map(c => `
                <section class="contract-clause">
                  <h3>${escapeHtml(c.title)}</h3>
                  <p>${c.body}</p>
                </section>
              `).join('')}
            </div>

            <section class="contract-clause">
              <h3>Schedule A — priced equipment and services</h3>
              ${quote.lines.length === 0 ? `
                <p><em>No equipment configured yet. Schedule A will populate from your 360° configuration.</em></p>
              ` : `
                <div class="contract-schedule-scroll" style="max-height:260px; overflow:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead><tr>
                      <th style="text-align:left; padding:6px; border-bottom:1px solid #888;">Description</th>
                      <th style="text-align:left; padding:6px; border-bottom:1px solid #888;">SAC</th>
                      <th style="text-align:right; padding:6px; border-bottom:1px solid #888;">Qty</th>
                      <th style="text-align:right; padding:6px; border-bottom:1px solid #888;">Rate</th>
                      <th style="text-align:right; padding:6px; border-bottom:1px solid #888;">Amount</th>
                    </tr></thead>
                    <tbody>
                      ${quote.lines.map(l => `
                        <tr>
                          <td style="padding:6px;">${escapeHtml(l.itemName)}<br /><small style="opacity:.65;">${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)}</small></td>
                          <td style="padding:6px;">${escapeHtml(l.sac)}</td>
                          <td style="padding:6px; text-align:right;">${l.quantity}</td>
                          <td style="padding:6px; text-align:right;">${formatMoney(l.unitPrice)}</td>
                          <td style="padding:6px; text-align:right;">${formatMoney(l.lineTotal)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
                <p style="margin-top:8px;">
                  Taxable value <strong>${formatMoney(quote.subtotal)}</strong> •
                  GST <strong>${formatMoney(quote.gst.total)}</strong> •
                  Total <strong>${formatMoney(quote.grandTotal)}</strong>
                </p>
              `}
            </section>

            <div class="signature-section">
              <h4>Sign here</h4>
              <label for="signatorySignatureName" style="display:block; font-size:12px; margin-bottom:6px;">Signatory name</label>
              <input type="text" id="signatorySignatureName" class="cart-input" value="${escapeHtml(this.buyer.name)}" autocomplete="off" style="max-width:400px; margin-bottom:10px;" />
              <canvas id="signature-pad" class="signature-pad" width="400" height="200"
                      style="border:1px solid #ccc; background:#fff; cursor:crosshair; touch-action:none; max-width:100%;"
                      aria-label="Signature drawing area"></canvas>
              <div style="margin-top:10px;">
                <button class="btn-clear-sig" type="button">Clear signature</button>
              </div>
            </div>

            <div class="terms-check" style="margin-top:20px;">
              <input type="checkbox" id="agree-terms" />
              <label for="agree-terms">I have read and agree to clauses 1–12 and Schedules A and B of this agreement.</label>
            </div>
            <div class="date-stamp" style="margin-top:10px; font-weight:bold;">Date: ${escapeHtml(formatDocDate(new Date()))}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-print-contract" type="button">🖨 Print agreement</button>
            ${this.isSigned ? '<button class="btn-redownload" type="button">⬇ Re-download signed agreement</button>' : ''}
            <button class="btn-sign-download" type="button" disabled>Sign &amp; download contract</button>
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

    const canvas = this.container.querySelector('#signature-pad');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';

    let isDrawing = false;
    let hasDrawn = false;

    // Scale client coords into canvas coords — the canvas is responsive.
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const source = e.touches && e.touches.length ? e.touches[0] : e;
      return {
        x: (source.clientX - rect.left) * (canvas.width / rect.width),
        y: (source.clientY - rect.top) * (canvas.height / rect.height)
      };
    };

    const startDrawing = (e) => {
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      e.preventDefault();
    };

    const stopDrawing = (e) => {
      isDrawing = false;
      if (e && e.cancelable) e.preventDefault();
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);

    this.container.querySelector('.btn-clear-sig').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    });

    const agreeCheck = this.container.querySelector('#agree-terms');
    const btnDownload = this.container.querySelector('.btn-sign-download');
    agreeCheck.addEventListener('change', (e) => {
      btnDownload.disabled = !e.target.checked;
    });

    const printBtn = this.container.querySelector('.btn-print-contract');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const sig = this.isSigned && this.signedRecord ? this.signedRecord.signature : null;
        const at = this.isSigned && this.signedRecord ? this.signedRecord.signedAt : null;
        printHtmlDocument(`Agreement ${this.docNumber}`, this.documentBody(sig, at));
      });
    }

    const redownload = this.container.querySelector('.btn-redownload');
    if (redownload && this.signedRecord) {
      redownload.addEventListener('click', () => {
        downloadHtmlDocument(
          `event-production-agreement-${this.docNumber.replace(/[^\w.-]+/g, '-')}.html`,
          `Agreement ${this.docNumber}`,
          this.documentBody(this.signedRecord.signature, this.signedRecord.signedAt)
        );
      });
    }

    btnDownload.addEventListener('click', () => {
      if (!hasDrawn) {
        window.alert('Please provide your signature before downloading the agreement.');
        return;
      }
      const nameInput = this.container.querySelector('#signatorySignatureName');
      const signatoryName = (nameInput && nameInput.value.trim()) || this.buyer.name;
      const signature = canvas.toDataURL('image/png');
      const signedAt = new Date().toISOString();
      const quote = this.quote();

      this.signedRecord = {
        signedAt,
        signatoryName,
        company: this.buyer.company,
        docNumber: this.docNumber,
        contractValue: quote.grandTotal,
        signature
      };
      this.isSigned = true;
      writeJSON(CONTRACT_KEY, this.signedRecord);

      downloadHtmlDocument(
        `event-production-agreement-${this.docNumber.replace(/[^\w.-]+/g, '-')}.html`,
        `Agreement ${this.docNumber}`,
        this.documentBody(signature, signedAt)
      );
      this.render();
    });
  }
}
