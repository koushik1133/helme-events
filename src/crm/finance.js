/**
 * finance.js — every rupee figure in the CRM is computed HERE, from the
 * receipts, and never read back out of storage. A stored balance is a stale
 * balance.
 *
 * The three rules that make this module different from a generic CRM:
 *
 * 1. PLACE OF SUPPLY IS THE VENUE'S STATE, not the client's registered
 *    address. An Infosys-Bengaluru contract for a summit at HICC Hyderabad is
 *    an INTRA-state supply: CGST 9% + SGST 9%, not IGST 18%. Get this backwards
 *    and the client's accounts team rejects the invoice and pays nobody.
 *
 * 2. TDS IS NOT A SHORTFALL. A corporate client deducts tax at source and pays
 *    the government directly on your behalf. A ₹10,00,000 + 18% invoice
 *    (₹11,80,000) is FULLY SETTLED by a bank receipt of ₹11,60,000 once
 *    ₹20,000 has been withheld under 194C at 2% of the ex-GST base. Compute
 *    `outstanding = invoiced − received` and every corporate deal in the book
 *    looks permanently unpaid, the collections list becomes noise, and the
 *    owner stops trusting the screen. It is
 *        outstanding = invoiced − received − tdsWithheld.
 *
 *    (The source research quotes this example as ₹22,000 / ₹11,58,000. That is
 *    an arithmetic slip in the research — 2% of the ₹10,00,000 ex-GST base is
 *    ₹20,000. ₹22,000 would be 2% of ₹11,00,000, or 2% of the GROSS less a bit,
 *    i.e. exactly the "deduct on the gross" error rule 3 warns about. The code
 *    and the contract tests use the statutorily correct ₹20,000.)
 *
 * 3. TDS IS ON THE EX-GST BASE. It is deducted on the taxable value, provided
 *    GST is shown as a separate line item — which it always is on a tax
 *    invoice. Deducting on the gross would over-withhold by 18%.
 *
 * Money is INTEGER RUPEES. Rounding happens once, at the point each number is
 * produced, never twice on the same number.
 */

import { computeGst, GST_RATE, SELLER_STATE } from '../utils/format.js';
import { todayISO, addDaysISO, parseISODate } from '../data/eventState.js';
import { stateNameForCode, SUPPLIER_STATE_CODE } from './schema.js';

export const SAC_CODE = '9983';           // Event management services
export const EVENT_GST_RATE = GST_RATE;   // 18%

// ---------------------------------------------------------------- GST

/**
 * Split GST for a taxable amount given the PLACE OF SUPPLY as a state code.
 * Delegates the actual split to src/utils/format.js so there is exactly one
 * CGST/SGST rounding rule in the codebase.
 */
export function gstForPlaceOfSupply(taxableAmount, placeOfSupplyCode) {
  const stateName = stateNameForCode(placeOfSupplyCode) || SELLER_STATE;
  const split = computeGst(taxableAmount, stateName);
  return {
    ...split,
    rate: EVENT_GST_RATE,
    sac: SAC_CODE,
    placeOfSupply: String(placeOfSupplyCode || SUPPLIER_STATE_CODE),
    mode: split.intraState ? 'intra' : 'inter'
  };
}

/**
 * The place of supply for a DEAL. Venue state wins; the client's billing state
 * is only a fallback for a deal with no venue picked yet.
 */
export function placeOfSupplyFor(deal, client) {
  const venueCode = deal?.venue?.stateCode;
  if (venueCode) return String(venueCode).padStart(2, '0');
  const billing = client?.billing?.placeOfSupply || client?.billing?.address?.stateCode;
  if (billing) return String(billing).padStart(2, '0');
  return SUPPLIER_STATE_CODE;
}

// ---------------------------------------------------------------- TDS

/**
 * Statutory TDS rates.
 *   194C — contractual execution (fabrication, lighting, sound, manpower,
 *          logistics, venue build). 1% if the payee is an Individual/HUF,
 *          2% for everyone else. This is the common case for event execution.
 *   194J — professional / technical fees, i.e. the management fee proper.
 *          10% professional, 2% technical.
 *   194I — bare rental of venue or stall area. 10%.
 * Threshold is ~₹30,000 per category per financial year; below it, nothing is
 * deducted at all.
 */
export const TDS_THRESHOLD = 30000;

export function tdsRate(section, deducteeType = 'company') {
  switch (section) {
    case '194C': return deducteeType === 'individual_huf' ? 1 : 2;
    case '194J': return 10;
    case '194J_technical': return 2;
    case '194I': return 10;
    default: return 0;
  }
}

/**
 * TDS on an EX-GST base. Returns integer rupees.
 * Below the annual threshold nothing is deducted — modelling that keeps small
 * one-off corporate jobs from showing a phantom ₹600 withheld.
 */
export function computeTds(exGstBase, section, deducteeType = 'company', { applyThreshold = true } = {}) {
  const base = Math.max(0, Math.round(Number(exGstBase) || 0));
  if (!section) return 0;
  if (applyThreshold && base < TDS_THRESHOLD) return 0;
  return Math.round(base * tdsRate(section, deducteeType) / 100);
}

/**
 * What a client will ACTUALLY transfer against an invoice, and what the invoice
 * needs in order to be considered fully settled.
 *
 *   ₹10,00,000 ex-GST, 18% GST, 194C @ 2%
 *     → gross ₹11,80,000, TDS ₹22,000, expected receipt ₹11,58,000.
 */
export function expectedRemittance(exGstBase, { placeOfSupplyCode, tdsSection = null, deducteeType = 'company' } = {}) {
  const taxable = Math.max(0, Math.round(Number(exGstBase) || 0));
  const gst = gstForPlaceOfSupply(taxable, placeOfSupplyCode);
  const tds = computeTds(taxable, tdsSection, deducteeType);
  return {
    taxable,
    gst,
    gross: taxable + gst.total,
    tds,
    tdsSection,
    net: taxable + gst.total - tds
  };
}

/**
 * A vendor payout is FOUR numbers, not one. Anything that shows a single
 * "vendor cost" number is hiding either the input credit or the withholding.
 */
export function vendorPayout(payout) {
  const gross = Math.max(0, Math.round(Number(payout?.gross) || 0)); // taxable value
  const rate = Number.isFinite(Number(payout?.gstRate)) ? Number(payout.gstRate) : 18;
  const gst = Math.round(gross * rate / 100);   // reclaimable as input credit
  const tds = computeTds(gross, payout?.tdsSection, payout?.deducteeType);
  return { gross, gst, tds, net: gross + gst - tds, inputCredit: gst };
}

// ---------------------------------------------------- milestone scheduling

/** First and last date across the deal's functions. Multi-day is the norm. */
export function eventDateRange(deal) {
  const dates = (deal?.eventDates || [])
    .map(d => (typeof d === 'string' ? d : d?.date))
    .filter(d => parseISODate(d))
    .sort();
  if (!dates.length) return { start: '', end: '' };
  return { start: dates[0], end: dates[dates.length - 1] };
}

/** Resolve a milestone rule into a concrete `YYYY-MM-DD`. */
export function milestoneDueDate(milestone, deal) {
  if (milestone?.dueDate) return milestone.dueDate;
  const { start, end } = eventDateRange(deal);
  const offset = Number(milestone?.dueOffsetDays) || 0;
  switch (milestone?.dueRule) {
    case 'days_before_event':
      return start ? addDaysISO(start, -offset) : '';
    case 'days_after_event':
      return end ? addDaysISO(end, offset) : '';
    case 'on_date':
      return milestone.dueDate || '';
    case 'on_booking':
    default:
      return deal?.bookedAt || deal?.createdAt || '';
  }
}

/** Expand a template into milestone rows for a deal's net (ex-GST) value. */
export function buildMilestones(template, deal, netValue) {
  const net = Math.max(0, Math.round(Number(netValue) || 0));
  const rows = (template?.milestones || []);
  let allocated = 0;
  return rows.map((row, i) => {
    const isLast = i === rows.length - 1;
    // The last milestone absorbs the rounding remainder so the schedule always
    // re-sums to the contract value exactly.
    const amountDue = isLast ? net - allocated : Math.round(net * (Number(row.percent) || 0) / 100);
    allocated += amountDue;
    return {
      label: row.label,
      sequence: i + 1,
      basis: 'percent',
      percent: Number(row.percent) || 0,
      amountDue,
      dueRule: row.dueRule,
      dueOffsetDays: Number(row.dueOffsetDays) || 0,
      dueDate: milestoneDueDate({ ...row, dueDate: '' }, deal)
    };
  });
}

// ------------------------------------------------------- derived financials

function allocationsFor(receipts, milestoneId) {
  const out = [];
  (receipts || []).forEach(r => {
    (r.allocations || []).forEach(a => {
      if (a.milestoneId === milestoneId) out.push({ ...a, receipt: r });
    });
  });
  return out;
}

/**
 * One milestone, fully derived: what is due gross, what was received, what the
 * client withheld as TDS, and therefore what is genuinely still owed.
 */
export function milestoneState(milestone, deal, client, receipts, today = todayISO()) {
  const pos = placeOfSupplyFor(deal, client);
  const taxable = Math.max(0, Math.round(Number(milestone.amountDue) || 0));
  const gst = gstForPlaceOfSupply(taxable, pos);
  const gross = taxable + gst.total;

  const allocs = allocationsFor(receipts, milestone.id);
  const received = allocs.reduce((a, x) => a + (Number(x.amount) || 0), 0);
  const tdsWithheld = allocs.reduce((a, x) => a + (Number(x.tds) || 0), 0);

  // THE LINE THAT MATTERS. TDS is money the client paid — to the government,
  // on our behalf — so it settles the milestone exactly as a bank credit does.
  const balance = Math.max(0, gross - received - tdsWithheld);

  const dueDate = milestone.dueDate || milestoneDueDate(milestone, deal);
  const overdue = Boolean(dueDate && dueDate < today && balance > 0 && !milestone.waived);
  const daysOverdue = overdue ? daysSince(dueDate, today) : 0;

  let status = 'pending';
  if (milestone.waived) status = 'waived';
  else if (balance === 0 && (received + tdsWithheld) > 0) status = 'paid';
  else if (received + tdsWithheld > 0) status = 'part_paid';
  else if (overdue) status = 'overdue';
  else if (milestone.invoiceId) status = 'invoiced';
  if (overdue && status === 'part_paid') status = 'overdue';

  return {
    ...milestone,
    dueDate,
    taxable, gst, gross,
    received, tdsWithheld,
    settled: received + tdsWithheld,
    balance,
    status, overdue, daysOverdue,
    ageingBucket: overdue ? ageingBucket(daysOverdue) : null
  };
}

export function daysSince(iso, today = todayISO()) {
  const a = parseISODate(iso);
  const b = parseISODate(today);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

export function daysUntil(iso, today = todayISO()) {
  return -daysSince(iso, today);
}

export const AGEING_BUCKETS = Object.freeze(['0-30', '31-60', '61-90', '90+']);

export function ageingBucket(daysOverdue) {
  const d = Number(daysOverdue) || 0;
  if (d <= 30) return '0-30';
  if (d <= 60) return '31-60';
  if (d <= 90) return '61-90';
  return '90+';
}

/**
 * The full financial picture for one deal. Everything here is computed; nothing
 * is read from a stored total.
 */
export function dealFinancials(deal, client, milestones, receipts, invoices, today = todayISO()) {
  const pos = placeOfSupplyFor(deal, client);
  const quoted = Math.max(0, Math.round(Number(deal?.quotedValue) || 0));
  const discount = Math.max(0, Math.round(Number(deal?.discount) || 0));
  const net = Math.max(0, quoted - discount);
  const gst = gstForPlaceOfSupply(net, pos);
  const contractGross = net + gst.total;

  const dealMilestones = (milestones || [])
    .filter(m => m.dealId === deal.id)
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
    .map(m => milestoneState(m, deal, client, receipts, today));

  const dealReceipts = (receipts || []).filter(r => r.dealId === deal.id);
  const received = dealReceipts.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const tdsWithheld = dealReceipts.reduce((a, r) => a + (Number(r.tdsDeducted) || 0), 0);

  // Only tax invoices are receivables. A proforma is a request, not a debt;
  // a credit note reduces the debt.
  const dealInvoices = (invoices || []).filter(i => i.dealId === deal.id);
  const invoiced = dealInvoices.reduce((a, i) => {
    if (i.status === 'cancelled') return a;
    const rows = invoiceTotals(i, pos);
    if (i.type === 'credit_note') return a - rows.total;
    if (i.type === 'tax_invoice') return a + rows.total;
    return a;
  }, 0);

  const outstanding = Math.max(0, contractGross - received - tdsWithheld);
  const invoicedOutstanding = Math.max(0, invoiced - received - tdsWithheld);

  const overdueMilestones = dealMilestones.filter(m => m.overdue);
  const overdue = overdueMilestones.reduce((a, m) => a + m.balance, 0);

  const upcoming = dealMilestones
    .filter(m => !m.overdue && m.balance > 0 && m.status !== 'waived')
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const nextDue = upcoming[0]
    ? {
        label: upcoming[0].label,
        amount: upcoming[0].balance,
        dueDate: upcoming[0].dueDate,
        daysUntil: daysUntil(upcoming[0].dueDate, today)
      }
    : null;

  const { start, end } = eventDateRange(deal);
  const estimatedCost = Math.max(0, Math.round(Number(deal?.estimatedCost) || 0));

  return {
    placeOfSupply: pos,
    gstMode: gst.mode,
    quoted, discount, net, gst,
    contractGross,
    invoiced,
    received,
    tdsWithheld,
    settledValue: received + tdsWithheld,
    outstanding,
    invoicedOutstanding,
    overdue,
    nextDue,
    milestones: dealMilestones,
    receipts: dealReceipts,
    invoices: dealInvoices,
    collectionPct: contractGross > 0
      ? Math.min(100, Math.round((received + tdsWithheld) * 100 / contractGross))
      : 0,
    fullySettled: contractGross > 0 && outstanding === 0,
    weightedValue: Math.round(net * (Number(deal?.probability ?? probabilityOf(deal)) || 0) / 100),
    estimatedCost,
    margin: estimatedCost > 0 ? net - estimatedCost : null,
    marginPct: estimatedCost > 0 && net > 0 ? Math.round((net - estimatedCost) * 100 / net) : null,
    eventStart: start,
    eventEnd: end,
    // Weddings are advance-funded, corporate is credit-funded. Whether a
    // balance is still owed AFTER the event is the difference between a
    // scheduled receivable and a collection problem.
    riskSide: end && end < today ? 'post_event' : 'pre_event',
    balanceDueBeforeEvent: dealMilestones
      .filter(m => m.balance > 0 && m.dueDate && start && m.dueDate <= start)
      .reduce((a, m) => a + m.balance, 0)
  };
}

function probabilityOf(deal) {
  // Local import-free copy of the stage probability so this stays cheap.
  const table = {
    enquiry: 10, qualified: 25, site_visit: 40, proposal_sent: 55, negotiation: 70,
    won: 100, booked: 100, planning: 100, in_production: 100, live: 100,
    delivered: 100, settled: 100, lost: 0, dropped: 0, cancelled: 0
  };
  return table[deal?.stage] ?? 0;
}

/** Totals for one invoice document. */
export function invoiceTotals(invoice, placeOfSupplyCode) {
  const taxable = (invoice?.lineItems || []).reduce(
    (a, l) => a + Math.round((Number(l.rate) || 0) * (Number(l.qty) || 1)), 0
  );
  const gst = gstForPlaceOfSupply(taxable, placeOfSupplyCode || invoice?.placeOfSupply);
  return { taxable, cgst: gst.cgst, sgst: gst.sgst, igst: gst.igst, tax: gst.total, total: taxable + gst.total };
}

// ---------------------------------------------------- portfolio-level views

/**
 * The Payments screen splits UPCOMING from OVERDUE deliberately.
 *
 * A pre-event advance that is not yet due is a scheduled inflow on a wedding
 * that is nearly risk-free once received. A post-event corporate invoice at
 * 60 days is the entire ageing problem. Adding them into one "outstanding"
 * number averages a healthy number with a sick one and tells you nothing.
 */
export function receivables(deals, clients, milestones, receipts, invoices, today = todayISO()) {
  const clientById = new Map((clients || []).map(c => [c.id, c]));
  const upcoming = [];
  const overdue = [];
  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  let totalUpcoming = 0;
  let totalOverdue = 0;
  let totalTds = 0;
  let totalReceived = 0;
  let contracted = 0;

  (deals || []).forEach(deal => {
    if (deal.stage === 'lost' || deal.stage === 'dropped') return;
    const client = clientById.get(deal.clientId) || null;
    const fin = dealFinancials(deal, client, milestones, receipts, invoices, today);
    contracted += fin.contractGross;
    totalReceived += fin.received;
    totalTds += fin.tdsWithheld;

    fin.milestones.forEach(m => {
      if (m.balance <= 0 || m.status === 'waived') return;
      const row = {
        milestone: m, deal, client,
        amount: m.balance,
        dueDate: m.dueDate,
        eventEnd: fin.eventEnd,
        riskSide: fin.eventEnd && fin.eventEnd < today ? 'post_event' : 'pre_event'
      };
      if (m.overdue) {
        row.daysOverdue = m.daysOverdue;
        row.bucket = m.ageingBucket;
        buckets[m.ageingBucket] += m.balance;
        totalOverdue += m.balance;
        overdue.push(row);
      } else {
        row.daysUntil = daysUntil(m.dueDate, today);
        totalUpcoming += m.balance;
        upcoming.push(row);
      }
    });
  });

  upcoming.sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  overdue.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0));

  return {
    upcoming, overdue, buckets,
    totalUpcoming, totalOverdue, totalTds, totalReceived, contracted,
    // Balance still owed on events that have NOT happened yet. The research is
    // blunt: collect this before load-in, because leverage ends at the event.
    dueBeforeEvent: upcoming
      .filter(r => r.riskSide === 'pre_event' && r.eventEnd && r.dueDate <= r.eventEnd)
      .reduce((a, r) => a + r.amount, 0)
  };
}

/** Pipeline roll-up for the board header. */
export function pipelineSummary(deals, clients, milestones, receipts, invoices, today = todayISO()) {
  const clientById = new Map((clients || []).map(c => [c.id, c]));
  let salesValue = 0, weighted = 0, productionValue = 0, wonCount = 0, openCount = 0;
  (deals || []).forEach(deal => {
    const fin = dealFinancials(deal, clientById.get(deal.clientId) || null, milestones, receipts, invoices, today);
    const phase = deal.phase;
    if (phase === 'sales') {
      salesValue += fin.net;
      weighted += fin.weightedValue;
      openCount += 1;
    } else if (phase === 'production') {
      productionValue += fin.net;
      wonCount += 1;
    }
  });
  return { salesValue, weighted, productionValue, wonCount, openCount };
}
