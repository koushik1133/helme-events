/**
 * Shared quoting + document engine for the commerce surface.
 *
 * ONE place that knows how to turn `activeSelections` (flat map of
 * slotId -> itemId STRING, per the state contract) into priced line items,
 * how to apply GST, how to number a document, and how to print/download it.
 *
 * Every commerce component imports from here so the cart, the invoice and the
 * contract can never disagree about a number again.
 */

import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import {
  formatMoney,
  computeGst,
  sumLines,
  readJSON,
  writeJSON,
  escapeHtml,
  SELLER_STATE,
  GST_RATE
} from './format.js';

/* ------------------------------------------------------------------ seller */

export const SELLER = {
  legalName: 'Helm Events Production Pvt Ltd',
  address: 'Plot 42, Survey No. 64, Gachibowli, Hyderabad 500032',
  state: SELLER_STATE,
  stateCode: '36',
  gstin: '36AAHCH1234K1ZP',
  pan: 'AAHCH1234K',
  email: 'accounts@helmevents.in',
  phone: '+91 40 4000 1234'
};

/** GST place-of-supply states (code = GST state code). */
export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' }
];

export function stateCodeFor(stateName) {
  const hit = INDIAN_STATES.find(
    s => s.name.toLowerCase() === String(stateName || '').trim().toLowerCase()
  );
  return hit ? hit.code : '--';
}

/**
 * SAC (Services Accounting Code) per catalog category.
 * 997327 — leasing/rental of furniture. 997329 — rental of other goods.
 * 998596 — events, exhibitions and convention support services.
 */
export const SAC_BY_CATEGORY = {
  chairs: '997327',
  sofas: '997327',
  tables: '997327',
  podiums: '997327',
  audio: '997329',
  lighting: '997329',
  stages: '998596',
  backdrops: '998596',
  fountains: '998596'
};

export const DEFAULT_SAC = '998596';

export function sacFor(category) {
  return SAC_BY_CATEGORY[category] || DEFAULT_SAC;
}

/* ------------------------------------------------------------------- quote */

/** The one place quantity is resolved from a zone slot. */
export function slotQuantity(slot) {
  const q = Number(slot && slot.quantity);
  return Number.isFinite(q) && q > 0 ? Math.round(q) : 1;
}

/**
 * Resolve a selection entry to an item id.
 * Selections are strings per the state contract; the object form is tolerated
 * only so a stale localStorage payload from an older build cannot blank a quote.
 */
export function resolveItemId(selection, fallbackId) {
  if (typeof selection === 'string' && selection) return selection;
  if (selection && typeof selection === 'object' && typeof selection.itemId === 'string') {
    return selection.itemId;
  }
  return fallbackId;
}

/**
 * Walk VENUE_ZONES (never Object.entries(selections) — that also contains
 * `custom_text_*` keys) and build the priced line items.
 */
export function buildQuoteLines(activeSelections = {}) {
  const lines = [];
  VENUE_ZONES.forEach(zone => {
    zone.slots.forEach(slot => {
      const itemId = resolveItemId(activeSelections[slot.id], slot.defaultItemId);
      const item = getItemById(itemId);
      if (!item) return;
      const quantity = slotQuantity(slot);
      lines.push({
        zoneId: zone.id,
        zoneName: zone.name,
        slotId: slot.id,
        slotLabel: slot.label,
        itemId: item.id,
        itemName: item.name,
        category: item.category,
        imageUrl: item.imageUrl,
        sac: sacFor(item.category),
        unitPrice: Math.round(Number(item.price) || 0),
        quantity,
        lineTotal: Math.round((Number(item.price) || 0) * quantity)
      });
    });
  });
  return lines;
}

/** Payment schedule used by the cart, the invoice and the contract alike. */
export const PAYMENT_SCHEDULE = [
  { key: 'advance', label: 'Booking advance — due on signature', pct: 0.30 },
  { key: 'milestone', label: 'Production milestone — due 15 days before the event', pct: 0.40 },
  { key: 'balance', label: 'Balance — due on completion of teardown', pct: 0.30 }
];

export function paymentSchedule(total) {
  const gross = Math.round(Number(total) || 0);
  let allocated = 0;
  return PAYMENT_SCHEDULE.map((stage, i) => {
    const isLast = i === PAYMENT_SCHEDULE.length - 1;
    const amount = isLast ? gross - allocated : Math.round(gross * stage.pct);
    allocated += amount;
    return { ...stage, amount };
  });
}

/**
 * The single quote calculation. Lines are rounded once then summed (sumLines),
 * so the printed lines always add up to the printed subtotal.
 */
export function buildQuote(activeSelections = {}, options = {}) {
  const buyerState = options.buyerState || SELLER_STATE;
  const lines = buildQuoteLines(activeSelections);
  const subtotal = sumLines(lines);
  const gst = computeGst(subtotal, buyerState);
  const grandTotal = subtotal + gst.total;
  const schedule = paymentSchedule(grandTotal);
  const zones = [];
  lines.forEach(line => {
    let bucket = zones.find(z => z.zoneId === line.zoneId);
    if (!bucket) {
      bucket = { zoneId: line.zoneId, zoneName: line.zoneName, lines: [], zoneTotal: 0 };
      zones.push(bucket);
    }
    bucket.lines.push(line);
    bucket.zoneTotal += line.lineTotal;
  });
  return {
    lines,
    zones,
    subtotal,
    gst,
    gstRatePct: Math.round(GST_RATE * 100),
    grandTotal,
    buyerState,
    schedule,
    deposit: schedule[0].amount,
    balanceDue: grandTotal - schedule[0].amount,
    itemCount: lines.length
  };
}

/* -------------------------------------------------------- document numbers */

const DOC_NUMBER_KEY = 'helm_events_doc_numbers';
const DOC_SERIAL_KEY = 'helm_events_doc_serial';

export function fiscalYear(date = new Date()) {
  const y = date.getFullYear();
  // Indian FY starts 1 April.
  const start = date.getMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

function nextSerial() {
  const current = Number(readJSON(DOC_SERIAL_KEY, 0));
  const next = (Number.isFinite(current) ? current : 0) + 1;
  writeJSON(DOC_SERIAL_KEY, next);
  return next;
}

/**
 * Generate a document number ONCE per logical document and persist it, so a
 * re-render (or a currency/state change) never re-randomises the invoice id.
 */
export function getOrCreateDocNumber(key, prefix = 'HE/INV') {
  const store = readJSON(DOC_NUMBER_KEY, {});
  const safeStore = store && typeof store === 'object' && !Array.isArray(store) ? store : {};
  if (typeof safeStore[key] === 'string' && safeStore[key]) return safeStore[key];
  const number = `${prefix}/${fiscalYear()}/${String(nextSerial()).padStart(4, '0')}`;
  safeStore[key] = number;
  writeJSON(DOC_NUMBER_KEY, safeStore);
  return number;
}

export function formatDocDate(date = new Date()) {
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Payment terms date: invoice date + n days. */
export function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/* ----------------------------------------------------------- document shell */

/**
 * Print/download stylesheet. Lives INSIDE the generated document (an iframe or
 * a downloaded file), never in the app's own stylesheet.
 */
export const DOCUMENT_CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111827; background: #ffffff;
    margin: 0; padding: 32px; font-size: 13px; line-height: 1.5;
  }
  .doc { max-width: 820px; margin: 0 auto; }
  .doc-head { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #111827; padding-bottom: 16px; margin-bottom: 20px; }
  .doc-head h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: .02em; }
  .doc-title { text-align: right; }
  .doc-title h2 { margin: 0 0 6px; font-size: 16px; text-transform: uppercase; letter-spacing: .08em; }
  .muted { color: #4b5563; }
  .party-grid { display: flex; gap: 24px; margin-bottom: 20px; }
  .party { flex: 1; border: 1px solid #d1d5db; border-radius: 6px; padding: 12px; }
  .party h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #4b5563; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { padding: 7px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  thead th { background: #f3f4f6; border-bottom: 2px solid #9ca3af; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  tbody tr:nth-child(even) { background: #fafafa; }
  .totals { width: 320px; margin-left: auto; }
  .totals td { border-bottom: 1px solid #e5e7eb; }
  .totals tr.grand td { border-top: 2px solid #111827; border-bottom: none; font-weight: 700; font-size: 15px; }
  .section { margin-top: 24px; page-break-inside: avoid; }
  .section h3 { font-size: 13px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
  .section p, .section li { margin: 6px 0; }
  .sign-grid { display: flex; gap: 32px; margin-top: 28px; page-break-inside: avoid; }
  .sign-box { flex: 1; border-top: 1px solid #111827; padding-top: 6px; }
  .sign-img { max-width: 260px; max-height: 110px; display: block; margin-bottom: 4px; }
  .foot { margin-top: 28px; border-top: 1px solid #d1d5db; padding-top: 10px; font-size: 11px; color: #4b5563; }
  .badge { display: inline-block; border: 1px solid #9ca3af; border-radius: 999px; padding: 2px 10px; font-size: 11px; }
  @page { size: A4; margin: 14mm; }
  @media print {
    body { padding: 0; font-size: 11.5px; }
    .doc { max-width: none; }
    .no-print { display: none !important; }
    thead { display: table-header-group; }
    tr, .section, .sign-grid { page-break-inside: avoid; }
    a[href]:after { content: ""; }
  }
`;

/** Wrap a document body in a complete, standalone HTML file. */
export function buildDocumentHtml(title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>${DOCUMENT_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

/**
 * Print a generated document via a hidden iframe.
 * The SPA's DOM is never touched and the page is never reloaded.
 */
export function printHtmlDocument(title, bodyHtml) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('tabindex', '-1');
  iframe.title = title;
  iframe.style.cssText =
    'position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;border:0;pointer-events:none;';
  document.body.appendChild(iframe);

  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch (err) {
      console.warn('Print failed', err);
    }
    cleanup();
  };

  try {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(buildDocumentHtml(title, bodyHtml));
    doc.close();
    // Give the iframe document a tick to lay out (and images a chance to load).
    setTimeout(doPrint, 250);
  } catch (err) {
    console.warn('Could not build print document', err);
    cleanup();
  }
}

/** Download a generated document as a standalone .html file. */
export function downloadHtmlDocument(filename, title, bodyHtml) {
  const blob = new Blob([buildDocumentHtml(title, bodyHtml)], {
    type: 'text/html;charset=utf-8'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* --------------------------------------------------------- invoice document */

export function renderPartyBlock(buyer) {
  return `
    <div class="party-grid">
      <div class="party">
        <h3>Supplier</h3>
        <strong>${escapeHtml(SELLER.legalName)}</strong><br />
        ${escapeHtml(SELLER.address)}<br />
        State: ${escapeHtml(SELLER.state)} (${escapeHtml(SELLER.stateCode)})<br />
        GSTIN: <strong>${escapeHtml(SELLER.gstin)}</strong><br />
        PAN: ${escapeHtml(SELLER.pan)}<br />
        ${escapeHtml(SELLER.email)} • ${escapeHtml(SELLER.phone)}
      </div>
      <div class="party">
        <h3>Bill to / Place of supply</h3>
        <strong>${escapeHtml(buyer.company || buyer.name || 'Client')}</strong><br />
        ${buyer.name ? `Attn: ${escapeHtml(buyer.name)}<br />` : ''}
        ${escapeHtml(buyer.address || '')}${buyer.city ? `, ${escapeHtml(buyer.city)}` : ''}${buyer.zip ? ` ${escapeHtml(buyer.zip)}` : ''}<br />
        State: ${escapeHtml(buyer.state || '')} (${escapeHtml(stateCodeFor(buyer.state))})<br />
        GSTIN: <strong>${escapeHtml(buyer.gstin || 'Unregistered')}</strong><br />
        ${buyer.email ? `${escapeHtml(buyer.email)}` : ''}${buyer.phone ? ` • ${escapeHtml(buyer.phone)}` : ''}
      </div>
    </div>
  `;
}

export function renderLineTable(quote) {
  if (!quote.lines.length) {
    return `<table><thead><tr><th>Description</th></tr></thead>
      <tbody><tr><td>No items configured. Select equipment in the 360° studio to build this quote.</td></tr></tbody></table>`;
  }
  return `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Description</th>
          <th>HSN/SAC</th>
          <th class="num">Qty</th>
          <th class="num">Rate</th>
          <th class="num">Taxable value</th>
        </tr>
      </thead>
      <tbody>
        ${quote.lines
          .map(
            (l, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${escapeHtml(l.itemName)}</strong><br /><span class="muted">${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)}</span></td>
            <td>${escapeHtml(l.sac)}</td>
            <td class="num">${l.quantity}</td>
            <td class="num">${escapeHtml(formatMoney(l.unitPrice))}</td>
            <td class="num">${escapeHtml(formatMoney(l.lineTotal))}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

export function renderTotalsTable(quote) {
  const half = quote.gstRatePct / 2;
  const taxRows = quote.gst.intraState
    ? `
      <tr><td>CGST @ ${half}%</td><td class="num">${escapeHtml(formatMoney(quote.gst.cgst))}</td></tr>
      <tr><td>SGST @ ${half}%</td><td class="num">${escapeHtml(formatMoney(quote.gst.sgst))}</td></tr>`
    : `<tr><td>IGST @ ${quote.gstRatePct}%</td><td class="num">${escapeHtml(formatMoney(quote.gst.igst))}</td></tr>`;
  return `
    <table class="totals">
      <tbody>
        <tr><td>Taxable value</td><td class="num">${escapeHtml(formatMoney(quote.subtotal))}</td></tr>
        ${taxRows}
        <tr class="grand"><td>Total (INR)</td><td class="num">${escapeHtml(formatMoney(quote.grandTotal))}</td></tr>
      </tbody>
    </table>
  `;
}

export function renderScheduleTable(quote) {
  return `
    <table>
      <thead><tr><th>Stage</th><th class="num">Share</th><th class="num">Amount (INR)</th></tr></thead>
      <tbody>
        ${quote.schedule
          .map(
            s => `<tr><td>${escapeHtml(s.label)}</td><td class="num">${Math.round(s.pct * 100)}%</td><td class="num">${escapeHtml(formatMoney(s.amount))}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;
}

/** Full GST tax invoice document body (used for print and for download). */
export function renderInvoiceDocument({ quote, buyer, docNumber, date = new Date(), heading = 'Tax Invoice', note = '' }) {
  const due = addDays(date, 7);
  return `
    <div class="doc">
      <div class="doc-head">
        <div>
          <h1>${escapeHtml(SELLER.legalName)}</h1>
          <div class="muted">${escapeHtml(SELLER.address)}</div>
          <div class="muted">GSTIN ${escapeHtml(SELLER.gstin)}</div>
        </div>
        <div class="doc-title">
          <h2>${escapeHtml(heading)}</h2>
          <div>Invoice no: <strong>${escapeHtml(docNumber)}</strong></div>
          <div>Invoice date: ${escapeHtml(formatDocDate(date))}</div>
          <div>Due date: ${escapeHtml(formatDocDate(due))}</div>
          <div class="muted">Supply: ${quote.gst.intraState ? 'Intra-state (CGST + SGST)' : 'Inter-state (IGST)'}</div>
        </div>
      </div>
      ${renderPartyBlock(buyer)}
      ${renderLineTable(quote)}
      ${renderTotalsTable(quote)}
      <div class="section">
        <h3>Payment schedule</h3>
        ${renderScheduleTable(quote)}
      </div>
      <div class="section">
        <h3>Notes</h3>
        <p>${note ? escapeHtml(note) : 'All equipment is supplied on rental for the event dates stated in the signed services agreement. Prices are in Indian Rupees and are inclusive of delivery, installation and teardown within city limits.'}</p>
        <p class="muted">Tax is charged under the GST Act at ${quote.gstRatePct}% on event support and equipment rental services. Place of supply determines the CGST/SGST vs IGST split.</p>
      </div>
      <div class="foot">
        This is a computer-generated document issued by ${escapeHtml(SELLER.legalName)}.
        Queries: ${escapeHtml(SELLER.email)} • ${escapeHtml(SELLER.phone)}
      </div>
    </div>
  `;
}
