/**
 * schema.js — the shape of the CRM. Pure data + pure helpers, no storage, no DOM.
 *
 * Two objects that the rest of this module refuses to conflate:
 *
 *   Client  — the family or the company. Survives every event. Carries the
 *             billing identity (GSTIN/PAN/place of supply/TDS posture) and the
 *             acquisition `source`, which is REQUIRED at enquiry because it is
 *             the most-cited and most-forgotten field in event CRMs.
 *   Deal    — ONE event for that client. One client, many deals.
 *
 * A deal carries `phase` AND `stage`, because an event business runs two
 * pipelines chained end to end — a sales pipeline (enquiry → won) owned by the
 * salesperson, and a production pipeline (booked → settled) owned by the event
 * manager. Cramming both into one dropdown is the mistake every other tool
 * makes; keeping `phase` lets ONE board draw two swimlanes.
 *
 * `eventDates` is an ARRAY and functions are children of the deal, because an
 * Indian wedding is mehendi + haldi + sangeet + wedding + reception. The unit
 * of costing is the FUNCTION, not the event. A single `date` field does not
 * survive a sangeet.
 *
 * Money is INTEGER RUPEES everywhere (see src/utils/format.js). Dates are local
 * `YYYY-MM-DD` strings (see src/data/eventState.js) — never UTC.
 */

// ---------------------------------------------------------------- stages

/** Sales pipeline — probability-weighted, owned by the salesperson. */
export const SALES_STAGES = Object.freeze([
  { id: 'enquiry', label: 'Enquiry', probability: 10 },
  { id: 'qualified', label: 'Qualified', probability: 25 },
  { id: 'site_visit', label: 'Site visit', probability: 40 },
  { id: 'proposal_sent', label: 'Proposal sent', probability: 55 },
  { id: 'negotiation', label: 'Negotiation', probability: 70 }
]);

/** Production pipeline — owned by the event manager. No probability: it is won. */
export const PRODUCTION_STAGES = Object.freeze([
  { id: 'booked', label: 'Booked', probability: 100 },
  { id: 'planning', label: 'Planning', probability: 100 },
  { id: 'in_production', label: 'In production', probability: 100 },
  { id: 'live', label: 'Live', probability: 100 },
  { id: 'delivered', label: 'Delivered', probability: 100 },
  { id: 'settled', label: 'Settled', probability: 100 }
]);

/**
 * Terminal stages. `lost` and `cancelled` are DIFFERENT and the difference is
 * financial: a lost deal never had money, a cancelled deal was booked, took an
 * advance, committed vendors and now needs a refund or a retention decision.
 */
export const CLOSED_STAGES = Object.freeze([
  { id: 'won', label: 'Won', probability: 100 },
  { id: 'lost', label: 'Lost', probability: 0 },
  { id: 'dropped', label: 'Dropped', probability: 0 },
  { id: 'cancelled', label: 'Cancelled', probability: 0 }
]);

export const ALL_STAGES = Object.freeze([
  ...SALES_STAGES, ...PRODUCTION_STAGES, ...CLOSED_STAGES
]);

const STAGE_INDEX = Object.freeze(
  ALL_STAGES.reduce((map, s) => { map[s.id] = s; return map; }, {})
);

export function stageMeta(stageId) {
  return STAGE_INDEX[stageId] || { id: stageId, label: String(stageId || '—'), probability: 0 };
}

export function stageLabel(stageId) {
  return stageMeta(stageId).label;
}

/** Which swimlane a stage belongs in. Terminal stages report `closed`. */
export function phaseForStage(stageId) {
  if (SALES_STAGES.some(s => s.id === stageId)) return 'sales';
  if (PRODUCTION_STAGES.some(s => s.id === stageId)) return 'production';
  return 'closed';
}

/** Probability is DERIVED from the stage. Never stored, never hand-edited. */
export function probabilityForStage(stageId) {
  return stageMeta(stageId).probability;
}

export const LOST_REASONS = Object.freeze([
  'budget', 'date_unavailable', 'competitor', 'no_response', 'postponed', 'other'
]);

// ---------------------------------------------------------------- clients

export const CLIENT_TYPES = Object.freeze([
  { id: 'individual', label: 'Individual / family' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'political', label: 'Political' },
  { id: 'government', label: 'Government' },
  { id: 'agency', label: 'Agency' }
]);

/**
 * Acquisition source. REQUIRED on every enquiry — see `validateClient`.
 * Without it there is no way to tell which ₹50,000 directory subscription is
 * worth renewing, which is the one question the owner will eventually ask.
 */
export const CLIENT_SOURCES = Object.freeze([
  { id: 'referral', label: 'Referral' },
  { id: 'repeat', label: 'Repeat client' },
  { id: 'venue_partner', label: 'Venue partner' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'website', label: 'Website' },
  { id: 'wedmegood', label: 'WedMeGood / directory' },
  { id: 'walk_in', label: 'Walk-in' },
  { id: 'cold', label: 'Cold outreach' }
]);

export const EVENT_CATEGORIES = Object.freeze([
  { id: 'wedding', label: 'Wedding / social' },
  { id: 'corporate', label: 'Corporate' },
  { id: 'political', label: 'Political' },
  { id: 'concert', label: 'Concert' },
  { id: 'exhibition', label: 'Exhibition' },
  { id: 'private', label: 'Private' }
]);

/** Functions — the real costing unit for a multi-day Indian wedding. */
export const FUNCTION_TYPES = Object.freeze([
  'mehendi', 'haldi', 'sangeet', 'wedding', 'reception', 'engagement',
  'keynote', 'gala_dinner', 'townhall', 'product_launch', 'rally', 'roadshow', 'other'
]);

export const PAYMENT_MODES = Object.freeze([
  { id: 'upi', label: 'UPI' },
  { id: 'neft', label: 'NEFT' },
  { id: 'rtgs', label: 'RTGS' },
  { id: 'imps', label: 'IMPS' },
  { id: 'cheque', label: 'Cheque' },
  { id: 'card', label: 'Card' },
  { id: 'cash', label: 'Cash' }
]);

export const BILLING_MODELS = Object.freeze([
  { id: 'fixed_package', label: 'Fixed package' },
  { id: 'percentage_of_budget', label: '% of budget' },
  { id: 'cost_plus', label: 'Cost plus' },
  { id: 'pure_agent', label: 'Pure agent (fee only)' }
]);

/**
 * GST state codes for the states this company actually works in. `placeOfSupply`
 * for an event is the VENUE's state, not the client's registered address — an
 * Infosys Bengaluru contract for a Hyderabad summit is an INTRA-state supply.
 */
export const STATE_CODES = Object.freeze({
  '36': 'Telangana', '37': 'Andhra Pradesh', '29': 'Karnataka', '27': 'Maharashtra',
  '07': 'Delhi', '08': 'Rajasthan', '33': 'Tamil Nadu', '32': 'Kerala',
  '24': 'Gujarat', '09': 'Uttar Pradesh', '06': 'Haryana', '19': 'West Bengal',
  '03': 'Punjab', '23': 'Madhya Pradesh', '10': 'Bihar', '21': 'Odisha'
});

export function stateNameForCode(code) {
  return STATE_CODES[String(code).padStart(2, '0')] || '';
}

export function stateCodeForName(name) {
  const wanted = String(name || '').trim().toLowerCase();
  return Object.keys(STATE_CODES).find(c => STATE_CODES[c].toLowerCase() === wanted) || '';
}

/** Where we supply FROM. Matches SELLER_STATE in src/utils/format.js. */
export const SUPPLIER_STATE_CODE = '36';

// ---------------------------------------------- payment milestone templates

/**
 * Payment shapes differ by segment, and the DIRECTION of the risk differs with
 * them. That is the whole point of making these selectable templates:
 *
 *   wedding   — 25–50% advance, balance BEFORE the event. Risk is PRE-event:
 *               if the balance is not in before load-in, it is a bad debt with
 *               a smile on it, because leverage evaporates the moment the
 *               reception ends.
 *   corporate — 30–50% on PO, balance 30–60 days AFTER against invoice, and
 *               procurement itself runs 60–90 days. Risk is POST-event; this is
 *               the entire receivables-ageing problem.
 *   political  — 50–70% advance, sometimes full prepay, days of lead time.
 *               The advance IS the credit control.
 */
export const MILESTONE_TEMPLATES = Object.freeze([
  {
    id: 'wedding_40_30_30',
    label: 'Wedding — 40 / 30 / 30 (balance before event)',
    segment: 'wedding',
    riskSide: 'pre_event',
    milestones: [
      { label: 'Booking advance', percent: 40, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'Vendor lock-in', percent: 30, dueRule: 'days_before_event', dueOffsetDays: 30 },
      { label: 'Pre-event balance', percent: 30, dueRule: 'days_before_event', dueOffsetDays: 3 }
    ]
  },
  {
    id: 'wedding_50_25_25',
    label: 'Wedding — 50 / 25 / 25',
    segment: 'wedding',
    riskSide: 'pre_event',
    milestones: [
      { label: 'Booking advance', percent: 50, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'T-30 milestone', percent: 25, dueRule: 'days_before_event', dueOffsetDays: 30 },
      { label: 'Pre-event balance', percent: 25, dueRule: 'days_before_event', dueOffsetDays: 7 }
    ]
  },
  {
    id: 'corporate_50_50_net30',
    label: 'Corporate — 50% on PO, 50% net 30 after',
    segment: 'corporate',
    riskSide: 'post_event',
    milestones: [
      { label: 'Advance on PO', percent: 50, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'Balance — net 30', percent: 50, dueRule: 'days_after_event', dueOffsetDays: 30 }
    ]
  },
  {
    id: 'corporate_30_70_net60',
    label: 'Corporate — 30% on PO, 70% net 60 after',
    segment: 'corporate',
    riskSide: 'post_event',
    milestones: [
      { label: 'Advance on PO', percent: 30, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'Balance — net 60', percent: 70, dueRule: 'days_after_event', dueOffsetDays: 60 }
    ]
  },
  {
    id: 'political_70_30',
    label: 'Political — 70% advance, 30% on delivery',
    segment: 'political',
    riskSide: 'pre_event',
    milestones: [
      { label: 'Mobilisation advance', percent: 70, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'Balance on delivery', percent: 30, dueRule: 'days_after_event', dueOffsetDays: 7 }
    ]
  },
  {
    id: 'exhibition_25_40_35',
    label: 'Exhibition / concert — 25 / 40 / 35',
    segment: 'exhibition',
    riskSide: 'pre_event',
    milestones: [
      { label: 'Booking deposit', percent: 25, dueRule: 'on_booking', dueOffsetDays: 0 },
      { label: 'Build milestone', percent: 40, dueRule: 'days_before_event', dueOffsetDays: 60 },
      { label: 'Pre-event balance', percent: 35, dueRule: 'days_before_event', dueOffsetDays: 30 }
    ]
  }
]);

export function templateById(id) {
  return MILESTONE_TEMPLATES.find(t => t.id === id) || null;
}

/** The template we default to for a category, so nobody starts from nothing. */
export function defaultTemplateFor(category) {
  if (category === 'corporate') return templateById('corporate_50_50_net30');
  if (category === 'political') return templateById('political_70_30');
  if (category === 'exhibition' || category === 'concert') return templateById('exhibition_25_40_35');
  return templateById('wedding_40_30_30');
}

// ---------------------------------------------------------------- factories

let counter = 0;
/** Ids are only ever local to this browser — there is no server to collide with. */
export function makeId(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyBilling() {
  return {
    legalName: '', gstin: '', pan: '',
    address: { line1: '', line2: '', city: '', state: '', stateCode: '', pincode: '' },
    placeOfSupply: '',      // state CODE — set from the VENUE, not this address
    isRegistered: false,    // false => B2C: no input credit, so GST is a real cost to them
    tdsApplicable: false,   // corporates and government deduct; families do not
    tdsSection: null,       // '194C' | '194J' | '194I'
    tdsDeducteeType: 'company' // 'individual_huf' => 194C at 1%, otherwise 2%
  };
}

export function makeClient(patch = {}) {
  const billing = { ...emptyBilling(), ...(patch.billing || {}) };
  billing.address = { ...emptyBilling().address, ...((patch.billing || {}).address || {}) };
  return {
    id: patch.id || makeId('cl'),
    code: patch.code || '',
    type: patch.type || 'individual',
    name: patch.name || '',
    primaryContact: {
      name: '', role: '', phone: '', whatsapp: '', email: '',
      ...(patch.primaryContact || {})
    },
    altContacts: Array.isArray(patch.altContacts) ? patch.altContacts : [],
    billing,
    source: patch.source || '',
    sourceDetail: patch.sourceDetail || '',
    ownerId: patch.ownerId || '',
    tags: Array.isArray(patch.tags) ? patch.tags : [],
    notes: Array.isArray(patch.notes) ? patch.notes : [],
    activity: Array.isArray(patch.activity) ? patch.activity : [],
    createdAt: patch.createdAt || '',
    updatedAt: patch.updatedAt || ''
  };
}

export function makeDeal(patch = {}) {
  const stage = patch.stage || 'enquiry';
  return {
    id: patch.id || makeId('dl'),
    code: patch.code || '',
    clientId: patch.clientId || '',
    title: patch.title || '',
    category: patch.category || 'wedding',
    subType: patch.subType || '',

    // Ownership drives the permission scopes: Sales is own-scoped and the Event
    // Manager is assigned-scoped, so a deal with neither set is invisible to both.
    // Sales owns the deal up to signature; the event manager owns delivery.
    ownerId: patch.ownerId || '',
    eventManagerId: patch.eventManagerId || '',
    assignedTo: patch.assignedTo || patch.eventManagerId || patch.ownerId || '',

    phase: patch.phase || phaseForStage(stage),
    stage,
    stageChangedAt: patch.stageChangedAt || '',
    stageHistory: Array.isArray(patch.stageHistory) ? patch.stageHistory : [],
    lostReason: patch.lostReason || null,

    // Multi-day is the norm. Functions are the costing unit.
    eventDates: Array.isArray(patch.eventDates) ? patch.eventDates : [],
    functions: Array.isArray(patch.functions) ? patch.functions : [],
    venue: { name: '', city: '', state: '', stateCode: '', address: '', contact: '', type: '', ...(patch.venue || {}) },
    guestCount: Number(patch.guestCount) || 0,
    guestCountConfirmed: Boolean(patch.guestCountConfirmed),
    isDestination: Boolean(patch.isDestination),

    currency: 'INR',
    budgetIndicated: Math.round(Number(patch.budgetIndicated) || 0),
    quotedValue: Math.round(Number(patch.quotedValue) || 0),   // ex-GST
    discount: Math.round(Number(patch.discount) || 0),
    gstRate: 18,                                                // SAC 9983
    estimatedCost: Math.round(Number(patch.estimatedCost) || 0),
    billingModel: patch.billingModel || 'fixed_package',
    poNumber: patch.poNumber || '',

    salesOwnerId: patch.salesOwnerId || '',
    eventManagerId: patch.eventManagerId || '',
    milestoneTemplateId: patch.milestoneTemplateId || '',

    notes: Array.isArray(patch.notes) ? patch.notes : [],
    activity: Array.isArray(patch.activity) ? patch.activity : [],
    createdAt: patch.createdAt || '',
    updatedAt: patch.updatedAt || ''
  };
}

export function makeMilestone(patch = {}) {
  return {
    id: patch.id || makeId('ms'),
    dealId: patch.dealId || '',
    label: patch.label || 'Milestone',
    sequence: Number(patch.sequence) || 1,
    basis: patch.basis || 'percent',
    percent: Number(patch.percent) || 0,
    amountDue: Math.round(Number(patch.amountDue) || 0), // ex-GST; derived from percent when basis is percent
    dueRule: patch.dueRule || 'on_booking',
    dueOffsetDays: Number(patch.dueOffsetDays) || 0,
    dueDate: patch.dueDate || '',
    invoiceId: patch.invoiceId || null,
    waived: Boolean(patch.waived)
    // NOTE: no `status`, no `amountReceived`, no `balance` here. Those are
    // DERIVED in finance.js from the receipts. A stored balance is a stale
    // balance, and a stale balance is how a settled deal keeps chasing money.
  };
}

export function makeReceipt(patch = {}) {
  const allocations = Array.isArray(patch.allocations) ? patch.allocations : [];
  return {
    id: patch.id || makeId('rc'),
    receiptNo: patch.receiptNo || '',
    dealId: patch.dealId || '',
    clientId: patch.clientId || '',
    // One UPI transfer routinely clears two milestones, so allocation is a LIST.
    allocations: allocations.map(a => ({
      milestoneId: a.milestoneId || '',
      amount: Math.round(Number(a.amount) || 0),
      tds: Math.round(Number(a.tds) || 0)
    })),
    amount: Math.round(Number(patch.amount) || 0),            // what actually hit the bank
    tdsDeducted: Math.round(Number(patch.tdsDeducted) || 0),  // withheld by the client, NOT a shortfall
    tdsSection: patch.tdsSection || null,
    receivedOn: patch.receivedOn || '',
    mode: patch.mode || 'neft',
    reference: patch.reference || '',
    recordedBy: patch.recordedBy || '',
    notes: patch.notes || ''
  };
}

export function makeInvoice(patch = {}) {
  return {
    id: patch.id || makeId('in'),
    invoiceNo: patch.invoiceNo || '',
    dealId: patch.dealId || '',
    clientId: patch.clientId || '',
    milestoneId: patch.milestoneId || null,
    type: patch.type || 'tax_invoice', // 'proforma' | 'tax_invoice' | 'credit_note'
    issueDate: patch.issueDate || '',
    dueDate: patch.dueDate || '',
    placeOfSupply: patch.placeOfSupply || '',
    supplierStateCode: patch.supplierStateCode || SUPPLIER_STATE_CODE,
    lineItems: Array.isArray(patch.lineItems) ? patch.lineItems : [],
    status: patch.status || 'issued',
    poNumber: patch.poNumber || '',
    notes: patch.notes || ''
  };
}

/** A vendor payout needs FOUR numbers, never one. See finance.js. */
export function makeVendorPayout(patch = {}) {
  return {
    id: patch.id || makeId('vp'),
    dealId: patch.dealId || '',
    vendorName: patch.vendorName || '',
    service: patch.service || '',
    gross: Math.round(Number(patch.gross) || 0), // ex-GST taxable value
    gstRate: Number.isFinite(Number(patch.gstRate)) ? Number(patch.gstRate) : 18,
    tdsSection: patch.tdsSection || '194C',
    deducteeType: patch.deducteeType || 'company',
    paidOn: patch.paidOn || '',
    status: patch.status || 'pending'
  };
}

// ---------------------------------------------------------------- validation

/**
 * `source` is required. This is deliberate friction: the field is trivially
 * skippable and permanently unrecoverable afterwards.
 */
export function validateClient(client) {
  const errors = {};
  if (!String(client?.name || '').trim()) errors.name = 'Client name is required.';
  if (!String(client?.source || '').trim()) {
    errors.source = 'Where did this enquiry come from? Source is required — it cannot be recovered later.';
  }
  const gstin = String(client?.billing?.gstin || '').trim();
  if (gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]{3}$/.test(gstin)) {
    errors.gstin = 'GSTIN should be 15 characters, e.g. 36AABCI1234M1Z5.';
  }
  const pan = String(client?.billing?.pan || '').trim();
  if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
    errors.pan = 'PAN should be 10 characters, e.g. AABCI1234M.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateDeal(deal) {
  const errors = {};
  if (!String(deal?.title || '').trim()) errors.title = 'Give the event a name.';
  if (!String(deal?.clientId || '').trim()) errors.clientId = 'Every event belongs to a client.';
  if (!Array.isArray(deal?.eventDates) || deal.eventDates.length === 0) {
    errors.eventDates = 'At least one event date — multi-day is normal, add one row per function.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}
