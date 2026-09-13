/**
 * eventsData.js — the ONE place the Events screens read data from.
 *
 * Nothing here renders. It builds a read-only view over the CRM store and
 * answers the three questions both screens ask:
 *   · which events are there, and in what order
 *   · which venue picture belongs to this event
 *   · may this user see the rupees on this event
 *
 * Selectors that already exist are reused, never re-implemented:
 * `buildHomeModel`, `clientName`, `dealValue`, `isWon`, `isOpenSales`,
 * `daysUntil` all come from `../home/homeData.js`.
 *
 * Money is INTEGER RUPEES (src/utils/format.js). Dates are local `YYYY-MM-DD`
 * (src/data/eventState.js).
 */

import {
  buildHomeModel, clientName, dealValue, isWon, isOpenSales, daysUntil, STAGE_LABEL
} from '../home/homeData.js';
import { VENUE_ZONES } from '../../data/zones.js';
import { ZONES_BY_EVENT_TYPE, parseISODate } from '../../data/eventState.js';

export { clientName, dealValue, isWon, isOpenSales, daysUntil };

/* -------------------------------------------------------------- the model */

/**
 * The snapshot both Events screens render from.
 * Adds to the home model: a per-deal money gate that consults the REAL
 * `can(user, 'view', 'money.value', deal)` with the deal as the record, so an
 * own-scoped or assigned-scoped role sees rupees on its own events only, and
 * Crew — which holds no money grant at all — sees none anywhere.
 */
export function buildEventsModel(deps = {}) {
  const model = buildHomeModel(deps);
  const injectedCan = typeof deps.can === 'function' ? deps.can : null;

  model.canMoney = (deal) => {
    if (injectedCan) {
      try { return !!injectedCan(model.user, 'view', 'money.value', deal || undefined); } catch { return false; }
    }
    return model.can('view_financials');
  };
  model.canCost = (deal) => {
    if (injectedCan) {
      try { return !!injectedCan(model.user, 'view', 'money.cost', deal || undefined); } catch { return false; }
    }
    return model.can('view_margin');
  };
  model.canMargin = (deal) => {
    if (injectedCan) {
      try { return !!injectedCan(model.user, 'view', 'money.margin', deal || undefined); } catch { return false; }
    }
    return model.can('view_margin');
  };
  return model;
}

/* ------------------------------------------------------------ venue image */

const ZONE_BY_ID = new Map(VENUE_ZONES.map(z => [z.id, z]));

/** Stable small hash so one deal always draws the same venue picture. */
function hashOf(text) {
  let h = 0;
  const s = String(text || '');
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Event categories the zone table does not name map onto one that it does. */
const CATEGORY_ALIAS = {
  wedding: 'wedding', corporate: 'corporate', political: 'political',
  private: 'private', concert: 'corporate', exhibition: 'corporate'
};

/**
 * The venue zone whose 360° panorama is this event's hero image, and which the
 * "Open 360° studio" action should land on. Scoped by event category, so a
 * wedding never opens on the election rally ground.
 */
export function heroZoneFor(deal) {
  const category = CATEGORY_ALIAS[String(deal && deal.category) || ''] || 'wedding';
  const ids = (ZONES_BY_EVENT_TYPE[category] || []).filter(id => ZONE_BY_ID.has(id));
  const pool = ids.length ? ids : VENUE_ZONES.map(z => z.id);
  // ZONES_BY_EVENT_TYPE is ordered canonically — the first zone is the venue that
  // event type actually happens in. Hashing across the whole pool gave a political
  // rally a concert lawn, which is exactly the "why am I looking at a concert"
  // complaint; the hash only survives as a tie-break when there is no canonical
  // zone for the category at all.
  const pick = ids.length
    ? pool[0]
    : pool[hashOf((deal && (deal.id || deal.code)) || '') % pool.length];
  return ZONE_BY_ID.get(pick) || VENUE_ZONES[0] || null;
}

export function heroImageFor(deal) {
  const zone = heroZoneFor(deal);
  return (zone && (zone.panoramaUrl || zone.thumbnailUrl)) || '';
}

/* ------------------------------------------------------------ event facts */

export const CATEGORY_LABEL = {
  wedding: 'Wedding', corporate: 'Corporate', political: 'Political',
  concert: 'Concert', exhibition: 'Exhibition', private: 'Private'
};

export function stageText(stage) {
  return STAGE_LABEL[stage] || String(stage || '—');
}

/** Which of the three chip tones a stage deserves. Status only, never decoration. */
export function stageTone(deal) {
  const stage = String(deal && deal.stage);
  if (['lost', 'dropped', 'cancelled'].includes(stage)) return 'critical';
  if (['live', 'in_production'].includes(stage)) return 'warning';
  if (['delivered', 'settled', 'won', 'booked'].includes(stage)) return 'positive';
  return 'neutral';
}

function shortDate(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function longDate(iso) {
  const d = parseISODate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "12–16 Feb 2027", "4 Mar 2027", or "Dates to be set". */
export function dateRangeLabel(deal) {
  const start = deal && deal.eventStartDate;
  const end = deal && deal.eventEndDate;
  if (!start) return 'Dates to be set';
  if (!end || end === start) return longDate(start);
  const a = parseISODate(start); const b = parseISODate(end);
  if (a && b && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `${a.getDate()}–${longDate(end)}`;
  }
  return `${shortDate(start)} – ${longDate(end)}`;
}

/** "in 42 days" / "today" / "8 days ago" — relative to the event start. */
export function countdownLabel(deal, today) {
  const n = deal && deal.eventStartDate ? daysUntil(deal.eventStartDate, today) : null;
  if (n === null) return '';
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n > 0) return `In ${n} days`;
  if (n === -1) return 'Yesterday';
  return `${Math.abs(n)} days ago`;
}

export function venueLabel(deal) {
  const v = (deal && deal.venue) || {};
  const name = String(v.name || '').trim();
  const city = String(v.city || '').trim();
  if (name && city) return `${name}, ${city}`;
  return name || city || 'Venue not set';
}

/** Guests: the deal figure when set, otherwise the largest function. */
export function guestCountFor(deal) {
  const own = Number(deal && deal.guestCount) || 0;
  if (own) return own;
  const fns = Array.isArray(deal && deal.functions) ? deal.functions : [];
  return fns.reduce((max, f) => Math.max(max, Number(f && f.guestCount) || 0), 0);
}

export function functionsFor(deal) {
  return (Array.isArray(deal && deal.functions) ? deal.functions : [])
    .slice()
    .sort((a, b) => String((a && a.date) || '').localeCompare(String((b && b.date) || '')));
}

/* ------------------------------------------------------------- the lists */

export const FILTERS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'production', label: 'In production' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'all', label: 'All events' }
];

const PRODUCTION_STAGES = ['booked', 'planning', 'in_production', 'live'];

export function matchesFilter(deal, filterId, today) {
  if (filterId === 'all') return true;
  if (filterId === 'pipeline') return isOpenSales(deal);
  if (filterId === 'production') return PRODUCTION_STAGES.includes(String(deal.stage));
  // upcoming: confirmed and still ahead of us
  return isWon(deal) && !!deal.eventStartDate && deal.eventStartDate >= today;
}

export const SORTS = [
  { id: 'date', label: 'Event date' },
  { id: 'value', label: 'Contract value', money: true },
  { id: 'client', label: 'Client name' },
  { id: 'stage', label: 'Stage' }
];

const STAGE_ORDER = [
  'enquiry', 'qualified', 'site_visit', 'proposal_sent', 'negotiation',
  'booked', 'planning', 'in_production', 'live', 'delivered', 'settled',
  'won', 'lost', 'dropped', 'cancelled'
];

export function sortDeals(model, deals, sortId) {
  const rows = deals.slice();
  if (sortId === 'value') {
    return rows.sort((a, b) => dealValue(b) - dealValue(a));
  }
  if (sortId === 'client') {
    return rows.sort((a, b) => clientName(model, a).localeCompare(clientName(model, b), 'en-IN'));
  }
  if (sortId === 'stage') {
    return rows.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  }
  // Date: events still ahead first and soonest-first; past events after, newest first.
  const today = model.today;
  const key = (d) => d.eventStartDate || '';
  return rows.sort((a, b) => {
    const ka = key(a); const kb = key(b);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    const fa = ka >= today; const fb = kb >= today;
    if (fa !== fb) return fa ? -1 : 1;
    return fa ? ka.localeCompare(kb) : kb.localeCompare(ka);
  });
}

/** Free-text match across the fields someone would actually type. */
export function matchesQuery(model, deal, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [
    deal.title, deal.code, clientName(model, deal), venueLabel(deal),
    CATEGORY_LABEL[deal.category] || deal.category, stageText(deal.stage)
  ].join(' ').toLowerCase();
  return hay.includes(q);
}

/**
 * The finance rollup for one deal, or null when the host injected no finance
 * module. Never called for a user without the money grant.
 */
export function financialsFor(model, deal) {
  const f = model.finance;
  if (!f || typeof f.dealFinancials !== 'function' || !deal) return null;
  try {
    const client = model.clientById.get(deal.clientId) || null;
    return f.dealFinancials(deal, client, model.milestones, model.receipts, model.invoices, model.today);
  } catch {
    return null;
  }
}
