/**
 * homeData.js — the ONE place the home screen reads data from.
 *
 * The CRM store (`src/crm/store.js`), the finance rollups (`src/crm/finance.js`)
 * and the session/permission modules (`src/auth/*`) are written by other
 * owners and may not exist yet. This screen therefore never imports them
 * directly: the host injects them, and everything below degrades to an honest
 * empty state when they are absent.
 *
 *   new HomeScreen(container, {
 *     store,      // { listDeals(), listClients(), listMilestones(), listReceipts(), listActivity() }
 *     finance,    // optional { dealFinancials(deal) }
 *     session,    // { getCurrentUser() }
 *     can,        // (user, action, resource) => boolean
 *     navigate    // (routeName, params) => void
 *   })
 *
 * Money is INTEGER RUPEES throughout, per src/utils/format.js.
 * Dates are LOCAL `YYYY-MM-DD`, per src/data/eventState.js.
 */

import { todayISO, parseISODate, addDaysISO } from '../../data/eventState.js';

/* --------------------------------------------------------------- roles */

export const ROLES = {
  admin: 'admin',
  sales: 'sales',
  event_manager: 'event_manager',
  finance: 'finance'
};

/** Map the many role spellings a session module might use onto our four homes. */
export function normaliseRole(role) {
  const r = String(role || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (/owner|director|admin|super/.test(r)) return ROLES.admin;
  if (/sales|business|account_manager|client_servicing/.test(r)) return ROLES.sales;
  if (/finance|account|book/.test(r)) return ROLES.finance;
  if (/event|producer|planner|production|coordinator|ops/.test(r)) return ROLES.event_manager;
  return ROLES.event_manager; // the safest default: no money on that screen
}

export const ROLE_LABEL = {
  [ROLES.admin]: 'Director',
  [ROLES.sales]: 'Sales Manager',
  [ROLES.event_manager]: 'Event Manager',
  [ROLES.finance]: 'Finance'
};

/**
 * Fallback permission table, used ONLY when the host injects no `can`.
 * Mirrors the two axes in the research: scope and sensitivity.
 * This is UX, never security — nothing here protects anything.
 */
const FALLBACK_CAN = {
  [ROLES.admin]:         { view_financials: true,  view_margin: true,  view_pipeline: true,  view_all_deals: true },
  [ROLES.finance]:       { view_financials: true,  view_margin: true,  view_pipeline: false, view_all_deals: true },
  [ROLES.sales]:         { view_financials: false, view_margin: false, view_pipeline: true,  view_all_deals: false },
  [ROLES.event_manager]: { view_financials: false, view_margin: false, view_pipeline: false, view_all_deals: false }
};

/* ---------------------------------------------------------- stage model */

export const SALES_STAGES = ['enquiry', 'qualified', 'site_visit', 'proposal_sent', 'negotiation'];
export const STAGE_PROBABILITY = {
  enquiry: 0.10, qualified: 0.25, site_visit: 0.40, proposal_sent: 0.55, negotiation: 0.70
};
export const STAGE_LABEL = {
  enquiry: 'Enquiry', qualified: 'Qualified', site_visit: 'Site visit', proposal_sent: 'Proposal sent',
  negotiation: 'Negotiation', won: 'Won', lost: 'Lost', dropped: 'Dropped',
  booked: 'Booked', planning: 'Planning', in_production: 'In production', live: 'Live',
  delivered: 'Delivered', settled: 'Settled', cancelled: 'Cancelled'
};

/* --------------------------------------------------------- date helpers */

/** Indian financial year containing `iso`: 1 Apr – 31 Mar. */
export function financialYear(iso = todayISO()) {
  const d = parseISODate(iso) || new Date();
  const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return {
    startIso: `${y}-04-01`,
    endIso: `${y + 1}-03-31`,
    label: `FY ${String(y).slice(2)}–${String(y + 1).slice(2)}`
  };
}

export function daysUntil(iso, from = todayISO()) {
  const a = parseISODate(from); const b = parseISODate(iso);
  if (!a || !b) return null;
  return Math.round((b - a) / 86400000);
}

/** Hours elapsed since an ISO datetime (or a `YYYY-MM-DD`, assumed 09:00 local). */
export function hoursSince(when) {
  if (!when) return null;
  let t = typeof when === 'number' ? when : Date.parse(when);
  if (Number.isNaN(t) && /^\d{4}-\d{2}-\d{2}$/.test(String(when))) {
    const d = parseISODate(when); if (d) { d.setHours(9, 0, 0, 0); t = d.getTime(); }
  }
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (Date.now() - t) / 3600000);
}

/** "3h 20m" / "2 days" — the response-time clock label. */
export function formatAge(hours) {
  if (hours == null) return '—';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  return `${Math.floor(hours / 24)} days`;
}

/**
 * SLA band for an unanswered enquiry. Evidence: 66% of clients book the first
 * supplier who replies; a reply inside 5 minutes converts ~21x better than one
 * at an hour; the industry median first reply is ~11 hours.
 */
export function slaBand(hours) {
  if (hours == null) return 'ok';
  if (hours >= 4) return 'late';
  if (hours >= 1) return 'warn';
  return 'ok';
}

export function relativeTime(when) {
  const h = hoursSince(when);
  if (h == null) return '';
  if (h < 1) return 'just now';
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

/* ------------------------------------------------------------- the view */

const EMPTY = Object.freeze({ deals: [], clients: [], milestones: [], receipts: [], activity: [] });

function safeList(store, method) {
  try {
    if (!store || typeof store[method] !== 'function') return null;
    const out = store[method]();
    return Array.isArray(out) ? out : null;
  } catch { return null; }
}

/**
 * Build the read-only snapshot every home variant renders from.
 * `connected: false` means no CRM module was injected — the screen says so
 * rather than pretending the business has no work.
 */
export function buildHomeModel(deps = {}) {
  const { store = null, finance = null, session = null } = deps;

  let user = null;
  try { user = session && typeof session.getCurrentUser === 'function' ? session.getCurrentUser() : null; }
  catch { user = null; }
  user = user || { id: null, name: 'there', role: ROLES.event_manager };

  const role = normaliseRole(user.role);
  const injectedCan = typeof deps.can === 'function' ? deps.can : null;
  const can = (action, resource = null) => {
    if (injectedCan) {
      try { return !!injectedCan(user, action, resource); } catch { return false; }
    }
    return !!(FALLBACK_CAN[role] || {})[action];
  };

  const deals = safeList(store, 'listDeals');
  const connected = deals !== null;

  const model = {
    user, role, roleLabel: ROLE_LABEL[role], can, connected,
    today: todayISO(),
    fy: financialYear(),
    deals: deals || EMPTY.deals,
    clients: safeList(store, 'listClients') || EMPTY.clients,
    milestones: safeList(store, 'listMilestones') || safeList(store, 'listPaymentMilestones') || EMPTY.milestones,
    receipts: safeList(store, 'listReceipts') || EMPTY.receipts,
    activity: safeList(store, 'listActivity') || EMPTY.activity,
    finance
  };
  model.clientById = new Map(model.clients.map(c => [c.id, c]));
  model.dealById = new Map(model.deals.map(d => [d.id, d]));
  return model;
}

/* ---------------------------------------------------------- derivations */

export function clientName(model, deal) {
  const c = deal && model.clientById.get(deal.clientId);
  return (c && c.name) || (deal && deal.clientName) || 'Unnamed client';
}

export function dealValue(deal) {
  return Math.round(Number(deal.netValue ?? deal.quotedValue ?? deal.budgetIndicated ?? 0) || 0);
}

export function dealGross(deal) {
  return Math.round(Number(deal.grossValue ?? Math.round(dealValue(deal) * 1.18)) || 0);
}

export function isSalesStage(deal) {
  return SALES_STAGES.includes(deal.stage) || deal.phase === 'sales';
}

export function isWon(deal) {
  return deal.stage === 'won' || deal.phase === 'production' ||
    ['booked', 'planning', 'in_production', 'live', 'delivered', 'settled'].includes(deal.stage);
}

export function isOpenSales(deal) {
  return isSalesStage(deal) && !['won', 'lost', 'dropped', 'cancelled'].includes(deal.stage);
}

/** Deals owned by this user, unless the role may see everything. */
export function scopedDeals(model, ownerField = 'salesOwnerId') {
  if (model.can('view_all_deals')) return model.deals;
  const id = model.user.id;
  if (!id) return model.deals;
  return model.deals.filter(d => d[ownerField] === id || d.salesOwnerId === id || d.eventManagerId === id);
}

/** Σ value × stage probability, over open sales-phase deals. */
export function weightedPipeline(deals) {
  return deals.filter(isOpenSales).reduce((sum, d) => {
    const p = Number(d.probability ?? STAGE_PROBABILITY[d.stage] ?? 0);
    return sum + Math.round(dealValue(d) * (p > 1 ? p / 100 : p));
  }, 0);
}

/** Contract value won inside the current financial year. */
export function bookedThisFY(model) {
  const { startIso, endIso } = model.fy;
  return model.deals.filter(isWon).reduce((sum, d) => {
    const when = d.wonAt || d.contractSignedAt || d.stageChangedAt || d.createdAt || d.eventStartDate;
    const iso = String(when || '').slice(0, 10);
    return iso >= startIso && iso <= endIso ? sum + dealValue(d) : sum;
  }, 0);
}

/** Milestone rollup — the receivables spine. TDS is settlement, not shortfall. */
export function milestoneBalance(m) {
  const due = Math.round(Number(m.amountDueGross ?? m.amountDue ?? 0) || 0);
  const got = Math.round(Number(m.amountReceived ?? 0) || 0);
  const tds = Math.round(Number(m.tdsDeducted ?? 0) || 0);
  return Math.max(0, due - got - tds);
}

export function openMilestones(model) {
  return model.milestones.filter(m =>
    !['paid', 'waived', 'cancelled'].includes(String(m.status || '')) && milestoneBalance(m) > 0
  );
}

/** Post-event money past its due date, split into ageing buckets. */
export function receivablesAgeing(model) {
  const today = model.today;
  const buckets = { 0: 0, 30: 0, 60: 0, 90: 0 };
  const rows = [];
  let upcoming = 0;

  openMilestones(model).forEach(m => {
    const balance = milestoneBalance(m);
    const overdueBy = m.dueDate ? -daysUntil(m.dueDate, today) : null;
    const deal = model.dealById.get(m.dealId) || { id: m.dealId, title: 'Unlinked milestone' };
    if (overdueBy == null || overdueBy <= 0) { upcoming += balance; return; }
    const b = overdueBy > 90 ? 90 : overdueBy > 60 ? 60 : overdueBy > 30 ? 30 : 0;
    buckets[b] += balance;
    rows.push({ milestone: m, deal, balance, overdueBy, bucket: b, client: clientName(model, deal) });
  });

  rows.sort((a, b) => b.overdueBy - a.overdueBy);
  const overdue = buckets[0] + buckets[30] + buckets[60] + buckets[90];
  return { rows, buckets, overdue, upcoming, total: overdue + upcoming };
}

/** Pre-event money scheduled but not yet due — the low-risk half. */
export function upcomingMilestones(model, withinDays = 30) {
  const limit = addDaysISO(model.today, withinDays);
  return openMilestones(model)
    .filter(m => m.dueDate && m.dueDate >= model.today && m.dueDate <= limit)
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
}

/** Enquiries nobody has replied to yet, oldest first. The sales screen's core. */
export function unansweredEnquiries(model) {
  return scopedDeals(model)
    .filter(d => isOpenSales(d) && !d.firstRespondedAt)
    .map(d => {
      const hours = hoursSince(d.enquiryAt || d.createdAt);
      return { deal: d, hours, sla: slaBand(hours), client: clientName(model, d) };
    })
    .sort((a, b) => (b.hours ?? 0) - (a.hours ?? 0));
}

/** Confirmed events, soonest first, from today onward. */
export function upcomingEvents(model, withinDays = 90) {
  const limit = addDaysISO(model.today, withinDays);
  return model.deals
    .filter(d => isWon(d) && d.eventStartDate && d.eventStartDate >= model.today && d.eventStartDate <= limit)
    .sort((a, b) => String(a.eventStartDate).localeCompare(String(b.eventStartDate)));
}

/** My events — an event manager sees only what they are producing. */
export function myEvents(model, withinDays = 120) {
  const id = model.user.id;
  const all = upcomingEvents(model, withinDays);
  if (!id) return all;
  const mine = all.filter(d => d.eventManagerId === id);
  return mine.length ? mine : all;
}

/** Open checklist items across a set of deals, soonest due first. */
export function openTasks(deals, today = todayISO()) {
  const out = [];
  deals.forEach(d => {
    (Array.isArray(d.checklist) ? d.checklist : []).forEach(t => {
      if (t && !t.done) out.push({ task: t, deal: d, overdue: t.due ? t.due < today : false });
    });
  });
  return out.sort((a, b) => String(a.task.due || '9999').localeCompare(String(b.task.due || '9999')));
}

/** Vendors on a deal that are still unconfirmed. */
export function unconfirmedVendors(deal) {
  return (Array.isArray(deal && deal.vendors) ? deal.vendors : [])
    .filter(v => v && !['confirmed', 'paid', 'done'].includes(String(v.status || '').toLowerCase()));
}

/** A 7-day strip: events starting, and money due, on each day. */
export function calendarStrip(model, { includeMoney = false, days = 7 } = {}) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const iso = addDaysISO(model.today, i);
    const d = parseISODate(iso);
    const events = model.deals.filter(x => isWon(x) && x.eventStartDate === iso);
    const money = includeMoney
      ? openMilestones(model).filter(m => m.dueDate === iso)
      : [];
    out.push({
      iso,
      isToday: i === 0,
      dow: d ? d.toLocaleDateString('en-IN', { weekday: 'short' }) : '',
      dayNum: d ? d.getDate() : '',
      month: d ? d.toLocaleDateString('en-IN', { month: 'short' }) : '',
      events, money
    });
  }
  return out;
}

/** Newest-first activity, capped. */
export function recentActivity(model, limit = 6) {
  return [...model.activity]
    .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')))
    .slice(0, limit);
}

export function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function longDate(iso = todayISO()) {
  const d = parseISODate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
