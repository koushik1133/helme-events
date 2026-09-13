/**
 * eventState.js — the single source of truth for "what event are we planning?"
 *
 * Before this module the app kept FIVE contradictory guest counts, SIX budget
 * representations in two currencies, and THREE disconnected date stores. Every
 * surface that needs the guest count, the event dates, the budget target or the
 * venue must read them from here.
 *
 * Contract:
 *  - Money is INR, stored as INTEGER RUPEES. Never paise, never floats, never `$`.
 *  - Dates are LOCAL `YYYY-MM-DD` strings (India-market product; never UTC
 *    `toISOString()` — that stamps yesterday before 05:30 IST).
 *  - Persisted under ONE versioned key via readJSON/writeJSON.
 *  - Observable: `subscribe(fn)` returns an unsubscribe function.
 */

import { readJSON, writeJSON } from '../utils/format.js';

export const EVENT_STATE_KEY = 'helm_event_state_v1';

/** Local-time `YYYY-MM-DD` for a Date (never UTC). */
export function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return toLocalISODate(new Date());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as a local `YYYY-MM-DD` string. */
export function todayISO() {
  return toLocalISODate(new Date());
}

/** Parse a `YYYY-MM-DD` into a LOCAL midnight Date (no timezone drift). */
export function parseISODate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Add n days to a `YYYY-MM-DD`, returning a `YYYY-MM-DD`. */
export function addDaysISO(iso, n) {
  const d = parseISODate(iso) || new Date();
  d.setDate(d.getDate() + n);
  return toLocalISODate(d);
}

/** Inclusive whole-day difference between two `YYYY-MM-DD` strings. */
export function daysBetween(startIso, endIso) {
  const a = parseISODate(startIso);
  const b = parseISODate(endIso);
  if (!a || !b) return 1;
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

/** Human label for a `YYYY-MM-DD`, e.g. "12 Sep 2026". */
export function formatEventDate(iso) {
  const d = parseISODate(iso);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const DEFAULTS = Object.freeze({
  eventName: 'Untitled Event',
  eventType: 'wedding', // wedding | corporate | political | private
  clientName: '',
  clientPhone: '',
  clientState: 'Telangana', // drives GST intra/inter-state
  venue: 'Main Venue',
  startDate: '',
  endDate: '',
  guestCount: 250,
  budgetTarget: 0, // INTEGER RUPEES
  scopeZoneIds: null, // null = derive from eventType; an array overrides it
  currency: 'INR'
});

const NUMERIC_KEYS = ['guestCount', 'budgetTarget'];
const STRING_KEYS = [
  'eventName', 'eventType', 'clientName', 'clientPhone',
  'clientState', 'venue', 'startDate', 'endDate'
];

function sanitize(raw) {
  const base = { ...DEFAULTS };
  if (!raw || typeof raw !== 'object') {
    base.startDate = todayISO();
    base.endDate = base.startDate;
    return base;
  }
  STRING_KEYS.forEach(k => {
    if (typeof raw[k] === 'string') base[k] = raw[k];
  });
  NUMERIC_KEYS.forEach(k => {
    const n = Math.max(0, Math.round(Number(raw[k])));
    if (Number.isFinite(n)) base[k] = n;
  });
  base.currency = 'INR';
  // Array-valued, so it is handled outside the STRING_KEYS/NUMERIC_KEYS loops.
  if (Array.isArray(raw.scopeZoneIds)) {
    base.scopeZoneIds = raw.scopeZoneIds.filter(v => typeof v === 'string');
  }

  if (!parseISODate(base.startDate)) base.startDate = todayISO();
  if (!parseISODate(base.endDate)) base.endDate = base.startDate;
  // An end before the start is never meaningful — clamp it up.
  if (base.endDate < base.startDate) base.endDate = base.startDate;
  if (!Number.isFinite(base.guestCount) || base.guestCount <= 0) {
    base.guestCount = DEFAULTS.guestCount;
  }
  return base;
}

class EventState {
  constructor() {
    this.state = sanitize(readJSON(EVENT_STATE_KEY, null));
    this.listeners = new Set();
  }

  /** Read-only snapshot. Mutating the returned object does nothing. */
  get() {
    return { ...this.state };
  }

  /** Convenience readers — use these instead of local copies. */
  getGuestCount() { return this.state.guestCount; }
  getBudgetTarget() { return this.state.budgetTarget; }
  getDates() { return { startDate: this.state.startDate, endDate: this.state.endDate }; }
  getDayCount() { return daysBetween(this.state.startDate, this.state.endDate); }

  /**
   * Merge a patch into the event state, persist it, and notify subscribers.
   * Returns the new snapshot. No-ops (and does not notify) if nothing changed.
   */
  set(patch, meta = {}) {
    // Drop undefined/null entries first. sanitize() spreads the patch over current
    // state and then falls back to DEFAULTS for anything that isn't a valid value,
    // so `set({ eventName: undefined })` would otherwise RESET the name rather than
    // leave it untouched — a trap for every caller building a patch from optional fields.
    const clean = {};
    for (const [key, value] of Object.entries(patch || {})) {
      if (value !== undefined && value !== null) clean[key] = value;
    }
    const next = sanitize({ ...this.state, ...clean });
    const changed = Object.keys(next).filter(k => next[k] !== this.state[k]);
    if (changed.length === 0) return this.get();
    this.state = next;
    writeJSON(EVENT_STATE_KEY, this.state);
    this.notify(changed, meta);
    return this.get();
  }

  /** Reset to defaults (used by "New event"). */
  reset() {
    this.state = sanitize(null);
    writeJSON(EVENT_STATE_KEY, this.state);
    this.notify(Object.keys(this.state), { reason: 'reset' });
    return this.get();
  }

  /**
   * Subscribe to changes. `fn(snapshot, changedKeys, meta)`.
   * Returns an unsubscribe function — always call it on teardown.
   */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changedKeys, meta) {
    const snapshot = this.get();
    this.listeners.forEach(fn => {
      // One bad subscriber must never stop the others.
      try { fn(snapshot, changedKeys, meta); } catch { /* ignore */ }
    });
  }
}

/** The app-wide singleton. Import this, not the class. */
export const eventState = new EventState();

export default eventState;

/**
 * Which venue zones belong to which kind of event.
 *
 * Before this existed, every total iterated all 8 zones, so a wedding quote
 * silently included the election rally stage and the corporate summit podium.
 * That is the single fastest way to lose credibility in a live pitch.
 */
export const ZONES_BY_EVENT_TYPE = Object.freeze({
  wedding: ['zone-india-function', 'zone-stage', 'zone-banquet', 'zone-entrance', 'zone-fountain', 'zone-lounge'],
  political: ['zone-india-election', 'zone-stage', 'zone-entrance'],
  corporate: ['zone-india-meeting', 'zone-banquet', 'zone-entrance', 'zone-lounge'],
  private: ['zone-lounge', 'zone-banquet', 'zone-fountain', 'zone-entrance']
});

/**
 * The zone ids currently in scope for the quote.
 *
 * An explicit `scopeZoneIds` on the event state always wins, so a planner can
 * include or drop a zone by hand. Otherwise it falls back to the event type,
 * and finally to every zone (which is the old behaviour, kept only as a
 * last resort so nothing can ever silently quote zero).
 */
export function zonesInScope(allZoneIds) {
  const state = eventState.get();
  const explicit = Array.isArray(state.scopeZoneIds) ? state.scopeZoneIds.filter(Boolean) : null;
  if (explicit && explicit.length) {
    const valid = explicit.filter(id => allZoneIds.includes(id));
    if (valid.length) return valid;
  }
  const byType = ZONES_BY_EVENT_TYPE[state.eventType];
  if (byType) {
    const valid = byType.filter(id => allZoneIds.includes(id));
    if (valid.length) return valid;
  }
  return [...allZoneIds];
}
