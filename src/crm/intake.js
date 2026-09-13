/**
 * intake.js — the ONE router from the event brief into the CRM.
 *
 * The problem this solves, in the owner's words: "whenever they enter all the
 * stuff … it should cover everything … and be stored in CRM … because adding it
 * separately would take a lot of time." Before this module the brief wizard
 * collected eighteen fields, pushed five of them into `eventState`, and threw
 * the rest away. An event booked through the brief never appeared in Clients or
 * in the Pipeline at all.
 *
 * So: one completed brief goes in, and every record the rest of the app reads
 * comes out — a CLIENT, a DEAL at `enquiry`, the deal's FUNCTIONS, the design
 * selection, the non-money REQUIREMENTS, and the shared `eventState`.
 *
 * ── Three rules this file exists to enforce ─────────────────────────────────
 *
 * 1. NO PAYMENT RECORDS AT INTAKE. The owner is explicit: "not the payment
 *    details, because payment will be seen after the 30th." A brief is an
 *    ENQUIRY, not a booking. Milestones are generated when the deal is actually
 *    booked and money is agreed; here we only SUGGEST a template and store its
 *    id. `addDeal` is therefore called with `withSchedule: false`.
 *
 * 2. PLACE OF SUPPLY FOLLOWS THE VENUE. An Infosys Bengaluru contract for a
 *    Hyderabad summit is an INTRA-state supply, because for an event the place
 *    of supply is the venue's state, not the client's registered address. We
 *    therefore write `deal.venue.stateCode` from the venue and let
 *    `finance.placeOfSupplyFor()` prefer it over the client's billing state.
 *
 * 3. TRANSACTION-LIKE. Both records are built and validated in full BEFORE
 *    anything is written. A brief that fails deal validation must not leave a
 *    half-created client behind, and submitting the same brief twice must not
 *    create a second client — see `findExistingClient` / `findExistingDeal`.
 *
 * ── Where every field lands (the field map) ─────────────────────────────────
 * See `FIELD_MAP` below. It is exported, and the contract tests read it, so it
 * cannot drift away from the code the way a comment can.
 *
 * Money is INTEGER RUPEES. Dates are LOCAL `YYYY-MM-DD` (never UTC).
 */

import { crmStore } from './store.js';
import { eventState, todayISO } from '../data/eventState.js';
import {
  makeClient, makeDeal, validateClient, validateDeal,
  stateCodeForName, stateNameForCode, defaultTemplateFor, templateById,
  CLIENT_TYPES, CLIENT_SOURCES, FUNCTION_TYPES
} from './schema.js';

/* ─────────────────────────────── field map ─────────────────────────────── */

/**
 * The single documented answer to "where does this field go?".
 * `brief path` → `destination`. Anything not in here is not captured, and that
 * is a bug to fix here rather than a field to add to some other screen.
 */
export const FIELD_MAP = Object.freeze({
  // ── Client record (Clients section) ──────────────────────────────────────
  'client.name': 'client.name',
  'client.type': 'client.type',
  'client.source': 'client.source  (REQUIRED — unrecoverable later)',
  'client.sourceDetail': 'client.sourceDetail',
  'client.contactName': 'client.primaryContact.name',
  'client.contactRole': 'client.primaryContact.role',
  'client.phone': 'client.primaryContact.phone',
  'client.whatsapp': 'client.primaryContact.whatsapp (falls back to phone)',
  'client.email': 'client.primaryContact.email',
  'client.altContacts[]': 'client.altContacts[]',
  'client.city': 'client.billing.address.city',
  'client.state': 'client.billing.address.state / .stateCode',
  'client.billing.legalName': 'client.billing.legalName',
  'client.billing.gstin': 'client.billing.gstin',
  'client.billing.pan': 'client.billing.pan',
  'client.billing.isRegistered': 'client.billing.isRegistered',
  'client.billing.tdsApplicable': 'client.billing.tdsApplicable',
  'client.billing.tdsSection': 'client.billing.tdsSection',
  'client.ownerId': 'client.ownerId',
  '(derived) client placeOfSupply': 'client.billing.placeOfSupply — the CLIENT default only; '
    + 'the invoice uses the VENUE state via finance.placeOfSupplyFor()',

  // ── Deal record (Pipeline section) ───────────────────────────────────────
  'event.name': 'deal.title',
  'event.category': 'deal.category (mapped through CATEGORY_MAP)',
  'event.subType': 'deal.subType',
  '(fixed) enquiry': "deal.stage = 'enquiry', deal.phase = 'sales' — a brief is NOT a booking",
  'event.startDate / endDate / functions[].date': 'deal.eventDates[] ({date,startTime,endTime,label})',
  'event.venueName': 'deal.venue.name',
  'event.venueCity': 'deal.venue.city',
  'event.venueState': 'deal.venue.state + deal.venue.stateCode — DRIVES THE GST SPLIT',
  'event.venueType': 'deal.venue.type',
  'event.venueContact': 'deal.venue.contact',
  'event.guestCount': 'deal.guestCount',
  'event.budgetIndicated': 'deal.budgetIndicated (integer rupees)',
  'event.ownerId': 'deal.ownerId + deal.salesOwnerId',
  'event.eventManagerId': 'deal.eventManagerId + deal.assignedTo',
  'event.notes': "deal.notes[] as {kind:'brief_note'}",

  // ── Functions (the costing unit) ─────────────────────────────────────────
  'functions[].type/label': 'deal.functions[].type / .label',
  'functions[].date/startTime/endTime': 'deal.functions[].date / .startTime / .endTime',
  'functions[].headcount': 'deal.functions[].headcount',
  'functions[].requirements': 'deal.functions[].requirements (free text, per function)',

  // ── Requirements — everything that is NOT money ──────────────────────────
  'requirements.*': "deal.notes[] as {kind:'requirements', data:{…}} — read it back with "
    + 'readRequirements(deal). Covers catering (incl. veg / Jain / satvik), AV, security, '
    + 'power, accommodation and transport.',

  // ── Design ───────────────────────────────────────────────────────────────
  'design.*': "deal.notes[] as {kind:'design', data:{conceptId,title,panoramaUrl,selections,"
    + 'styleKeywords}} — read it back with readDesign(deal)',

  // ── Shared event state (studio, seating, timeline, quote) ────────────────
  'event.name → eventState.eventName': 'eventState.eventName',
  'event.category → eventState.eventType': 'eventState.eventType (wedding|corporate|political|private)',
  'client.name → eventState.clientName': 'eventState.clientName',
  'client.phone → eventState.clientPhone': 'eventState.clientPhone',
  'event.venueState → eventState.clientState': 'eventState.clientState — the GST state',
  'event.venueName → eventState.venue': 'eventState.venue',
  'event.startDate/endDate → eventState': 'eventState.startDate / eventState.endDate',
  'event.guestCount → eventState': 'eventState.guestCount',
  'event.budgetIndicated → eventState': 'eventState.budgetTarget (integer rupees)',

  // ── Deliberately NOT captured ────────────────────────────────────────────
  '(none) payment details': 'NOTHING. No milestone, no receipt, no invoice is created at intake. '
    + 'A template is suggested only: deal.milestoneTemplateId.'
});

/** Note kinds written onto `deal.notes[]`. Read them through the helpers below. */
export const NOTE_KIND = Object.freeze({
  REQUIREMENTS: 'requirements',
  DESIGN: 'design',
  BRIEF: 'brief_note'
});

/** Wizard category → CRM `EVENT_CATEGORIES` id. */
export const CATEGORY_MAP = Object.freeze({
  social: 'wedding', wedding: 'wedding',
  corporate: 'corporate',
  political: 'political',
  public: 'concert',
  private: 'private', exhibition: 'exhibition', concert: 'concert'
});

/** A few sub-types legitimately belong in a different CRM category than their wizard group. */
const SUBTYPE_CATEGORY_OVERRIDE = Object.freeze({
  birthday: 'private', anniversary: 'private',
  trade_show: 'exhibition', charity_run: 'exhibition', cultural_fair: 'exhibition'
});

/** CRM category → the four event types `eventState` understands. */
const EVENT_STATE_TYPE = Object.freeze({
  wedding: 'wedding', corporate: 'corporate', exhibition: 'corporate',
  political: 'political', concert: 'private', private: 'private'
});

/* ─────────────────────────────── helpers ───────────────────────────────── */

const str = v => String(v ?? '').trim();
const int = v => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : 0; };
const norm = v => str(v).toLowerCase().replace(/\s+/g, ' ');

/** Digits only, dropping a leading country code, so `+91 98490 11002` === `9849011002`. */
export function normalizePhone(value) {
  const digits = str(value).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function isValidPhone(value) {
  return /^[6-9]\d{9}$/.test(normalizePhone(value));
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(str(value));
}

function validId(list, value, fallback = '') {
  return list.some(x => x.id === value) ? value : fallback;
}

export function crmCategoryFor(category, subType) {
  return SUBTYPE_CATEGORY_OVERRIDE[str(subType)]
    || CATEGORY_MAP[str(category)]
    || 'wedding';
}

/* ────────────────────────────── normalise ──────────────────────────────── */

/**
 * Coerce a raw brief into the exact shape the rest of this module expects.
 * Every later function takes a normalised brief, so validation and submission
 * can never disagree about what a field contains.
 */
export function normalizeBrief(raw = {}) {
  const c = raw.client || {};
  const e = raw.event || {};
  const req = raw.requirements || {};
  const des = raw.design || {};

  const category = crmCategoryFor(e.category, e.subType);
  const venueState = str(e.venueState);
  const clientState = str(c.state);

  const fns = (Array.isArray(raw.functions) ? raw.functions : [])
    .map((f, i) => ({
      type: FUNCTION_TYPES.includes(str(f.type)) ? str(f.type) : 'other',
      label: str(f.label) || str(f.type) || `Function ${i + 1}`,
      date: str(f.date),
      startTime: str(f.startTime),
      endTime: str(f.endTime),
      headcount: int(f.headcount),
      requirements: str(f.requirements)
    }))
    .filter(f => f.label || f.date);

  return {
    intakeRef: str(raw.intakeRef),
    client: {
      name: str(c.name),
      type: validId(CLIENT_TYPES, str(c.type), 'individual'),
      source: validId(CLIENT_SOURCES, str(c.source), ''),
      sourceDetail: str(c.sourceDetail),
      contactName: str(c.contactName),
      contactRole: str(c.contactRole),
      phone: str(c.phone),
      whatsapp: str(c.whatsapp) || str(c.phone),
      email: str(c.email),
      altContacts: (Array.isArray(c.altContacts) ? c.altContacts : [])
        .map(a => ({ name: str(a.name), role: str(a.role), phone: str(a.phone), email: str(a.email) }))
        .filter(a => a.name || a.phone || a.email),
      city: str(c.city),
      state: clientState,
      ownerId: str(c.ownerId),
      billing: {
        legalName: str((c.billing || {}).legalName),
        gstin: str((c.billing || {}).gstin).toUpperCase(),
        pan: str((c.billing || {}).pan).toUpperCase(),
        isRegistered: Boolean((c.billing || {}).isRegistered),
        tdsApplicable: Boolean((c.billing || {}).tdsApplicable),
        tdsSection: str((c.billing || {}).tdsSection) || null
      }
    },
    event: {
      name: str(e.name),
      category,
      rawCategory: str(e.category),
      subType: str(e.subType),
      venueName: str(e.venueName),
      venueCity: str(e.venueCity),
      venueState,
      venueType: str(e.venueType),
      venueContact: str(e.venueContact),
      guestCount: int(e.guestCount),
      budgetIndicated: Math.max(0, int(e.budgetIndicated)),
      startDate: str(e.startDate),
      endDate: str(e.endDate) || str(e.startDate),
      startTime: str(e.startTime),
      endTime: str(e.endTime),
      altDate: str(e.altDate),
      ownerId: str(e.ownerId),
      eventManagerId: str(e.eventManagerId),
      notes: str(e.notes)
    },
    functions: fns,
    requirements: {
      cateringStyle: str(req.cateringStyle),
      dietary: (Array.isArray(req.dietary) ? req.dietary : []).map(str).filter(Boolean),
      av: str(req.av),
      security: str(req.security),
      power: str(req.power),
      accommodation: str(req.accommodation),
      transport: str(req.transport),
      notes: str(req.notes)
    },
    design: {
      conceptId: str(des.conceptId),
      conceptTitle: str(des.conceptTitle),
      panoramaUrl: str(des.panoramaUrl),
      selections: des.selections && typeof des.selections === 'object' ? { ...des.selections } : {},
      styleKeywords: str(des.styleKeywords),
      matchedKeywords: (Array.isArray(des.matchedKeywords) ? des.matchedKeywords : []).map(str)
    },
    suggestedTemplateId: str(raw.suggestedTemplateId)
  };
}

/* ────────────────────────────── validation ─────────────────────────────── */

/**
 * Blocking validation. Every message says what to DO, not merely what is wrong —
 * "Pick where this enquiry came from" beats "source invalid".
 *
 * The keys are the wizard's own field names so the wizard can put the message
 * under the right input without a translation table.
 */
export function validateIntake(rawBrief) {
  const b = normalizeBrief(rawBrief);
  const errors = {};

  // Client identity
  if (!b.client.name) errors.clientName = 'Enter the client or company name — the record is filed under it.';
  if (!b.client.source) {
    errors.clientSource = 'Pick where this enquiry came from. It cannot be reconstructed later, '
      + 'and it is the only way to tell which channel is worth paying for.';
  }
  if (!b.client.contactName) errors.contactName = 'Name the person we actually deal with.';
  if (!b.client.phone) errors.contactPhone = 'A phone number is how an enquiry gets answered — add one.';
  else if (!isValidPhone(b.client.phone)) {
    errors.contactPhone = 'Enter a 10-digit Indian mobile number, e.g. 98490 11002.';
  }
  if (b.client.whatsapp && !isValidPhone(b.client.whatsapp)) {
    errors.contactWhatsapp = 'The WhatsApp number should be a 10-digit Indian mobile, or left blank to reuse the phone.';
  }
  if (b.client.email && !isValidEmail(b.client.email)) {
    errors.contactEmail = 'That email address is missing an @ or a domain — fix it or clear it.';
  }
  if (!b.client.city) errors.clientCity = 'Which city is the client in? It decides who from the team can visit.';

  b.client.altContacts.forEach((a, i) => {
    if (a.phone && !isValidPhone(a.phone)) {
      errors[`altContactPhone${i}`] = `Alternate contact ${i + 1}: enter a 10-digit mobile number or clear the field.`;
    }
    if (a.email && !isValidEmail(a.email)) {
      errors[`altContactEmail${i}`] = `Alternate contact ${i + 1}: that email address is not valid.`;
    }
  });

  // Billing — optional, but wrong is worse than absent.
  const draftClient = buildClientDraft(b);
  const clientCheck = validateClient(draftClient);
  if (clientCheck.errors.gstin) errors.gstin = clientCheck.errors.gstin;
  if (clientCheck.errors.pan) errors.pan = clientCheck.errors.pan;
  if (b.client.billing.tdsApplicable && !b.client.billing.tdsSection) {
    errors.tdsSection = 'Choose the TDS section this client deducts under — 194C for execution, 194J for the management fee.';
  }

  // Event
  if (!b.event.name) errors.eventName = 'Give the event a name — it is the title on the pipeline card.';
  if (!b.event.startDate) errors.eventDate = 'Pick the primary event date.';
  if (b.event.endDate && b.event.startDate && b.event.endDate < b.event.startDate) {
    errors.eventEndDate = 'The last day cannot fall before the first day.';
  }
  if (b.event.altDate && b.event.altDate === b.event.startDate) {
    errors.altDate = 'The alternate date must differ from the primary date, or leave it blank.';
  }
  if (!b.event.venueName) errors.venueName = 'Name the venue — even "to be confirmed — Jubilee Hills" is worth more than blank.';
  if (!b.event.venueState) {
    errors.venueState = 'Pick the venue state. It sets the GST split (CGST+SGST or IGST) for every invoice on this event.';
  } else if (!stateCodeForName(b.event.venueState)) {
    errors.venueState = `We do not have a GST state code for "${b.event.venueState}". Pick a state from the list.`;
  }
  if (!b.event.guestCount) errors.guestCount = 'Enter the expected number of people — it drives catering, seating and crew.';
  else if (b.event.guestCount < 10 || b.event.guestCount > 100000) {
    errors.guestCount = 'Expected attendance should be between 10 and 1,00,000.';
  }
  if (!b.event.ownerId) errors.ownerId = 'Assign an owner. An unassigned enquiry is an unanswered enquiry.';

  // Functions — optional for a single-function event, checked when present.
  b.functions.forEach((f, i) => {
    if (!f.date) errors[`functionDate${i}`] = `${f.label}: give this function its own date — the function is the costing unit.`;
    if (f.headcount && f.headcount > b.event.guestCount * 2) {
      errors[`functionHeadcount${i}`] = `${f.label}: headcount is more than double the event's guest count. Check it.`;
    }
  });

  return { ok: Object.keys(errors).length === 0, errors, brief: b };
}

/* ──────────────────────────── record builders ──────────────────────────── */

function buildClientDraft(b) {
  const stateCode = stateCodeForName(b.client.state);
  return makeClient({
    name: b.client.name,
    type: b.client.type,
    source: b.client.source,
    sourceDetail: b.client.sourceDetail,
    ownerId: b.client.ownerId || b.event.ownerId,
    primaryContact: {
      name: b.client.contactName,
      role: b.client.contactRole,
      phone: b.client.phone,
      whatsapp: b.client.whatsapp || b.client.phone,
      email: b.client.email
    },
    altContacts: b.client.altContacts,
    billing: {
      legalName: b.client.billing.legalName || b.client.name,
      gstin: b.client.billing.gstin,
      pan: b.client.billing.pan,
      address: {
        line1: '', line2: '',
        city: b.client.city,
        state: b.client.state,
        stateCode,
        pincode: ''
      },
      // The CLIENT's own default. The invoice does not use it: for an event the
      // place of supply is the VENUE's state (see finance.placeOfSupplyFor).
      placeOfSupply: stateCode,
      isRegistered: b.client.billing.isRegistered || Boolean(b.client.billing.gstin),
      tdsApplicable: b.client.billing.tdsApplicable,
      tdsSection: b.client.billing.tdsSection,
      tdsDeducteeType: b.client.type === 'individual' ? 'individual_huf' : 'company'
    }
  });
}

/** The `eventDates[]` a deal carries: one row per function, or the span itself. */
function buildEventDates(b) {
  if (b.functions.length) {
    return b.functions
      .filter(f => f.date)
      .map(f => ({
        date: f.date,
        startTime: f.startTime || b.event.startTime,
        endTime: f.endTime || b.event.endTime,
        label: f.label
      }));
  }
  const rows = [{
    date: b.event.startDate,
    startTime: b.event.startTime,
    endTime: b.event.endTime,
    label: b.event.name
  }];
  if (b.event.endDate && b.event.endDate !== b.event.startDate) {
    rows.push({ date: b.event.endDate, startTime: b.event.startTime, endTime: b.event.endTime, label: `${b.event.name} — final day` });
  }
  return rows;
}

function buildNotes(b, at) {
  const notes = [];
  const reqs = b.requirements;
  const hasReqs = Object.values(reqs).some(v => (Array.isArray(v) ? v.length : Boolean(v)));
  if (hasReqs) {
    // Requirements are stored on the DEAL so the production side can read them
    // without going back to the person who took the enquiry. They carry no money.
    notes.push({ kind: NOTE_KIND.REQUIREMENTS, at, data: { ...reqs, dietary: [...reqs.dietary] } });
  }
  if (b.design.conceptId || Object.keys(b.design.selections).length) {
    notes.push({ kind: NOTE_KIND.DESIGN, at, data: { ...b.design, selections: { ...b.design.selections } } });
  }
  if (b.event.notes) notes.push({ kind: NOTE_KIND.BRIEF, at, text: b.event.notes });
  return notes;
}

function buildDealDraft(b, clientId, at) {
  const eventDates = buildEventDates(b);
  const venueCode = stateCodeForName(b.event.venueState);
  return makeDeal({
    clientId,
    title: b.event.name,
    category: b.event.category,
    subType: b.event.subType,
    // A brief is an ENQUIRY. It is not a booking, and pretending otherwise is
    // how a pipeline fills with events nobody has paid for.
    stage: 'enquiry',
    ownerId: b.event.ownerId,
    salesOwnerId: b.event.ownerId,
    eventManagerId: b.event.eventManagerId,
    assignedTo: b.event.eventManagerId || b.event.ownerId,
    eventDates,
    functions: b.functions.map(f => ({ ...f })),
    venue: {
      name: b.event.venueName,
      city: b.event.venueCity,
      state: b.event.venueState,
      stateCode: venueCode,      // ← THE GST SPLIT COMES FROM HERE
      address: '',
      contact: b.event.venueContact,
      type: b.event.venueType
    },
    guestCount: b.event.guestCount,
    budgetIndicated: b.event.budgetIndicated,
    // Suggested only. No milestone row is written at intake.
    milestoneTemplateId: (templateById(b.suggestedTemplateId) || defaultTemplateFor(b.event.category)).id,
    notes: buildNotes(b, at),
    stageHistory: [{ stage: 'enquiry', at, note: 'Created from the event brief' }]
  });
}

/* ───────────────────────────── idempotence ─────────────────────────────── */

/**
 * The same family enquiring twice is ONE client, not two. We match on the
 * normalised name, or on the primary phone — either is enough, because two
 * records sharing a phone are the same household in practice.
 */
export function findExistingClient(clients, b) {
  const name = norm(b.client.name);
  const phone = normalizePhone(b.client.phone);
  return clients.find(c =>
    norm(c.name) === name
    || (phone && normalizePhone(c.primaryContact?.phone) === phone)
  ) || null;
}

/** The same event submitted twice is ONE deal: same client, same title, same first date. */
export function findExistingDeal(deals, clientId, b) {
  const title = norm(b.event.name);
  const firstDate = (buildEventDates(b)[0] || {}).date || '';
  return deals.find(d =>
    d.clientId === clientId
    && norm(d.title) === title
    && ((d.eventDates || [])[0] || {}).date === firstDate
  ) || null;
}

/* ─────────────────────────────── submit ────────────────────────────────── */

/**
 * Route one completed brief into the CRM.
 *
 * Returns `{ ok, errors, created }` and NEVER throws for a validation problem.
 * `created` reports exactly what happened so the UI can say it out loud:
 *   { client, clientCreated, deal, dealCreated, functionCount,
 *     milestonesCreated (always 0), suggestedTemplate, placeOfSupply }
 *
 * @param {object} rawBrief
 * @param {{store?:object, state?:object}} deps — injectable for tests.
 */
export function submitIntake(rawBrief, { store = crmStore, state = eventState } = {}) {
  const check = validateIntake(rawBrief);
  if (!check.ok) return { ok: false, errors: check.errors, created: null };

  const b = check.brief;
  const at = todayISO();

  // Build and validate BOTH records before writing EITHER of them. This is the
  // whole of the "transaction": nothing is persisted until everything passes.
  const clientDraft = buildClientDraft(b);
  const clientCheck = validateClient(clientDraft);
  if (!clientCheck.ok) return { ok: false, errors: clientCheck.errors, created: null };

  const existingClient = findExistingClient(store.clients(), b);
  const dealProbe = buildDealDraft(b, existingClient ? existingClient.id : 'probe', at);
  const dealCheck = validateDeal(dealProbe);
  if (!dealCheck.ok) return { ok: false, errors: dealCheck.errors, created: null };

  // ── writes start here ──
  let client;
  let clientCreated = false;
  if (existingClient) {
    // Repeat client: fill in what the brief knows and leave the rest alone.
    // Never blank an existing value with an empty one from this form.
    client = store.updateClient(existingClient.id, mergeClient(existingClient, clientDraft)) || existingClient;
  } else {
    client = store.addClient(clientDraft);
    clientCreated = true;
  }

  const existingDeal = findExistingDeal(store.dealsForClient(client.id), client.id, b);
  let deal;
  let dealCreated = false;
  if (existingDeal) {
    const draft = buildDealDraft(b, client.id, at);
    deal = store.updateDeal(existingDeal.id, {
      ...draft,
      id: existingDeal.id,
      code: existingDeal.code,
      // A deal that has already moved on is not dragged back to `enquiry`.
      stage: existingDeal.stage,
      stageHistory: existingDeal.stageHistory,
      notes: [...(existingDeal.notes || []).filter(n => !n.kind), ...draft.notes]
    }) || existingDeal;
  } else {
    // withSchedule:false is the whole of rule 1. No milestone at intake.
    deal = store.addDeal(buildDealDraft(b, client.id, at), { withSchedule: false });
    dealCreated = true;
  }

  // The shared event state the studio, seating chart, timeline and live quote read.
  state.set({
    eventName: b.event.name,
    eventType: EVENT_STATE_TYPE[b.event.category] || 'wedding',
    clientName: b.client.name,
    clientPhone: b.client.phone,
    clientState: b.event.venueState,   // GST state = VENUE state
    venue: b.event.venueName,
    startDate: b.event.startDate,
    endDate: b.event.endDate || b.event.startDate,
    guestCount: b.event.guestCount,
    budgetTarget: b.event.budgetIndicated
  }, { source: 'crm/intake' });

  return {
    ok: true,
    errors: {},
    created: {
      client,
      clientCreated,
      deal,
      dealCreated,
      functionCount: (deal.functions || []).length,
      milestonesCreated: store.milestonesForDeal(deal.id).length,
      suggestedTemplate: templateById(deal.milestoneTemplateId),
      placeOfSupply: {
        stateCode: deal.venue.stateCode,
        stateName: stateNameForCode(deal.venue.stateCode) || b.event.venueState,
        from: 'venue'
      }
    }
  };
}

/** Non-destructive merge for a repeat client: a blank field never overwrites a filled one. */
function mergeClient(existing, draft) {
  const pick = (a, b2) => (str(b2) ? b2 : a);
  return {
    name: pick(existing.name, draft.name),
    type: draft.type || existing.type,
    source: existing.source || draft.source,   // first-touch attribution wins
    sourceDetail: pick(existing.sourceDetail, draft.sourceDetail),
    ownerId: pick(existing.ownerId, draft.ownerId),
    primaryContact: {
      name: pick(existing.primaryContact.name, draft.primaryContact.name),
      role: pick(existing.primaryContact.role, draft.primaryContact.role),
      phone: pick(existing.primaryContact.phone, draft.primaryContact.phone),
      whatsapp: pick(existing.primaryContact.whatsapp, draft.primaryContact.whatsapp),
      email: pick(existing.primaryContact.email, draft.primaryContact.email)
    },
    altContacts: draft.altContacts.length ? draft.altContacts : existing.altContacts,
    billing: {
      ...existing.billing,
      legalName: pick(existing.billing.legalName, draft.billing.legalName),
      gstin: pick(existing.billing.gstin, draft.billing.gstin),
      pan: pick(existing.billing.pan, draft.billing.pan),
      address: { ...existing.billing.address, ...prune(draft.billing.address) },
      placeOfSupply: pick(existing.billing.placeOfSupply, draft.billing.placeOfSupply),
      isRegistered: draft.billing.isRegistered || existing.billing.isRegistered,
      tdsApplicable: draft.billing.tdsApplicable || existing.billing.tdsApplicable,
      tdsSection: draft.billing.tdsSection || existing.billing.tdsSection
    }
  };
}

function prune(obj) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => { if (str(v)) out[k] = v; });
  return out;
}

/* ───────────────────────────── read helpers ────────────────────────────── */

function noteOfKind(deal, kind) {
  return (deal?.notes || []).filter(n => n && n.kind === kind).slice(-1)[0] || null;
}

/** The non-money requirements captured at intake, or null. */
export function readRequirements(deal) {
  const note = noteOfKind(deal, NOTE_KIND.REQUIREMENTS);
  return note ? note.data : null;
}

/** The design concept and slot selections captured at intake, or null. */
export function readDesign(deal) {
  const note = noteOfKind(deal, NOTE_KIND.DESIGN);
  return note ? note.data : null;
}

/** Human summary of what a submit created — the sentence the wizard shows. */
export function describeIntake(created) {
  if (!created) return '';
  const parts = [];
  parts.push(`Client ${created.client.name} ${created.clientCreated ? 'created' : 'matched'} (${created.client.code})`);
  parts.push(`Enquiry ${created.deal.code} ${created.dealCreated ? 'added to' : 'updated in'} the pipeline`);
  if (created.functionCount) parts.push(`${created.functionCount} function${created.functionCount > 1 ? 's' : ''} recorded`);
  return parts.join(' · ');
}

export default submitIntake;
