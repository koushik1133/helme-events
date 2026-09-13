/**
 * permissions.js — the ONE place that decides who may see or do what.
 *
 * HONEST FRAMING, READ THIS BEFORE YOU TRUST IT
 * ---------------------------------------------
 * Helm is a front-end-only application. Every record lives in this browser's
 * localStorage, where anyone with the device or DevTools can read and rewrite it.
 * Therefore this module is NOT a security boundary. It shapes the interface; it
 * does not keep anybody out of anything. Hiding a button is not authorisation.
 *
 * We enforce it rigorously anyway, for one concrete reason: when a backend
 * arrives, `PERMISSION_MATRIX` below becomes server middleware UNCHANGED, and the
 * client copy quietly demotes to what it always was — UX. A decorative permission
 * model, scattered inline across twenty components, would not survive that move.
 *
 * Model (from the research; two axes, not one ladder — the HoneyBook pattern):
 *   1. SCOPE       — how much of the company's work you see: none < own/assigned < all.
 *   2. SENSITIVITY — operational data < commercial (contract value) < cost/margin
 *                    < financial (invoices, receipts, exports) < configuration.
 * A role is a point on both. That is why "can see other people's deals" and
 * "can see the money" are separate grants here, and why a Sales Manager can have
 * the whole pipeline in view while still only seeing rupees on their own deals.
 *
 * Contract:
 *   - `can(user, action, resource, record)` is PURE. No storage, no DOM, no clock.
 *   - Default is DENY. A key missing from the matrix is a refusal, never a pass.
 *   - `PERMISSION_MATRIX` is exported as plain data so /roles can render it.
 */

/** Scope levels, weakest to strongest. Exported for sorting/rendering. */
export const SCOPES = Object.freeze({
  NONE: 'none',
  OWN: 'own',           // records where this user is the sales owner
  ASSIGNED: 'assigned', // records where this user is the event manager or crew
  ALL: 'all'
});

const SCOPE_RANK = Object.freeze({ none: 0, own: 1, assigned: 1, all: 2 });

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  SALES_MANAGER: 'sales_manager',
  EVENT_MANAGER: 'event_manager',
  FINANCE: 'finance',
  CREW: 'crew'
});

/** Display metadata for every role. Used by the sign-in cards and /roles. */
export const ROLE_META = Object.freeze({
  admin: {
    id: 'admin',
    label: 'Admin / Director',
    short: 'Director',
    accent: 'violet',
    summary: 'Everything: every pipeline, every rupee, cost and margin, invoices, exports and team settings.'
  },
  sales_manager: {
    id: 'sales_manager',
    label: 'Sales Manager',
    short: 'Sales',
    accent: 'indigo',
    summary: 'Wins work. Owns clients and deals, quotes and proposals — sees rupees only on their own deals, never margin.'
  },
  event_manager: {
    id: 'event_manager',
    label: 'Event Manager',
    short: 'Events',
    accent: 'emerald',
    summary: 'Runs booked events. Production board, checklists, vendors and crew — sees contract value on their events, never margin.'
  },
  finance: {
    id: 'finance',
    label: 'Finance / Accounts',
    short: 'Finance',
    accent: 'gold',
    summary: 'Money only. Invoices, receipts, GST and TDS, every report and every export — read-only on the sales and production work.'
  },
  crew: {
    id: 'crew',
    label: 'Crew / On-site',
    short: 'Crew',
    accent: 'sky',
    summary: 'Their assigned events only: call sheet, checklist and vendor list. No commercials of any kind.'
  }
});

/** Every resource the matrix governs, with the label /roles prints. */
export const RESOURCES = Object.freeze([
  { id: 'home', label: 'Home dashboard', group: 'Workspace' },
  { id: 'pipeline', label: 'Sales pipeline board', group: 'Sales' },
  { id: 'client', label: 'Clients & contacts', group: 'Sales' },
  { id: 'deal', label: 'Deals / events', group: 'Sales' },
  { id: 'quote', label: 'Quotes', group: 'Sales' },
  { id: 'proposal', label: 'Proposals', group: 'Sales' },
  { id: 'contract', label: 'Contracts', group: 'Sales' },
  { id: 'production', label: 'Production board', group: 'Delivery' },
  { id: 'checklist', label: 'Run sheet & checklist', group: 'Delivery' },
  { id: 'vendor', label: 'Vendors', group: 'Delivery' },
  { id: 'crew_roster', label: 'Crew roster', group: 'Delivery' },
  { id: 'catalogue', label: 'Decor catalogue', group: 'Delivery' },
  { id: 'studio', label: '360° studio & layouts', group: 'Delivery' },
  { id: 'invoice', label: 'Invoices (GST)', group: 'Money' },
  { id: 'payment', label: 'Receipts & payments', group: 'Money' },
  { id: 'money.value', label: 'Contract value', group: 'Money' },
  { id: 'money.cost', label: 'Estimated cost', group: 'Money' },
  { id: 'money.margin', label: 'Margin', group: 'Money' },
  { id: 'report', label: 'Reports', group: 'Money' },
  { id: 'export', label: 'CSV / data export', group: 'Money' },
  { id: 'team', label: 'Team members', group: 'Configuration' },
  { id: 'settings', label: 'Workspace settings', group: 'Configuration' },
  { id: 'roles', label: 'Roles & permissions page', group: 'Configuration' }
]);

/** Every action the matrix governs. */
export const ACTIONS = Object.freeze(['view', 'create', 'edit', 'delete', 'export', 'approve']);

const ALL = SCOPES.ALL;
const OWN = SCOPES.OWN;
const ASSIGNED = SCOPES.ASSIGNED;

/**
 * THE MATRIX. `role -> "resource:action" -> scope`.
 * Anything absent is denied. This object is the specification; read it as one.
 */
export const PERMISSION_MATRIX = Object.freeze({

  // ── Admin / Director ──────────────────────────────────────────────────────
  // The only role with configuration and with delete. One per workspace in real life.
  admin: {
    'home:view': ALL,
    'pipeline:view': ALL, 'pipeline:create': ALL, 'pipeline:edit': ALL,
    'client:view': ALL, 'client:create': ALL, 'client:edit': ALL, 'client:delete': ALL,
    'deal:view': ALL, 'deal:create': ALL, 'deal:edit': ALL, 'deal:delete': ALL,
    'quote:view': ALL, 'quote:create': ALL, 'quote:edit': ALL, 'quote:approve': ALL,
    'proposal:view': ALL, 'proposal:create': ALL, 'proposal:edit': ALL, 'proposal:approve': ALL,
    'contract:view': ALL, 'contract:create': ALL, 'contract:edit': ALL, 'contract:approve': ALL,
    'production:view': ALL, 'production:create': ALL, 'production:edit': ALL,
    'checklist:view': ALL, 'checklist:create': ALL, 'checklist:edit': ALL,
    'vendor:view': ALL, 'vendor:create': ALL, 'vendor:edit': ALL, 'vendor:delete': ALL,
    'crew_roster:view': ALL, 'crew_roster:edit': ALL,
    'catalogue:view': ALL, 'catalogue:create': ALL, 'catalogue:edit': ALL,
    'studio:view': ALL, 'studio:edit': ALL,
    'invoice:view': ALL, 'invoice:create': ALL, 'invoice:edit': ALL, 'invoice:delete': ALL,
    'payment:view': ALL, 'payment:create': ALL, 'payment:edit': ALL,
    'money.value:view': ALL, 'money.cost:view': ALL, 'money.margin:view': ALL,
    'report:view': ALL, 'export:view': ALL, 'report:export': ALL,
    'team:view': ALL, 'team:create': ALL, 'team:edit': ALL,
    'settings:view': ALL, 'settings:edit': ALL,
    'roles:view': ALL, 'roles:edit': ALL
  },

  // ── Sales Manager ─────────────────────────────────────────────────────────
  // Deliberate call #1: money is scoped to their OWN deals. `canViewAllPipelines`
  // widens the OPERATIONAL scope to the whole board — it never widens money, and
  // margin stays shut unless a director sets `canSeeMargin` on the individual.
  sales_manager: {
    'home:view': ALL,
    'pipeline:view': OWN, 'pipeline:create': OWN, 'pipeline:edit': OWN,
    'client:view': OWN, 'client:create': ALL, 'client:edit': OWN,
    'deal:view': OWN, 'deal:create': ALL, 'deal:edit': OWN,
    'quote:view': OWN, 'quote:create': OWN, 'quote:edit': OWN,
    'proposal:view': OWN, 'proposal:create': OWN, 'proposal:edit': OWN,
    'contract:view': OWN, 'contract:create': OWN, 'contract:edit': OWN,
    'production:view': OWN,            // read-only: what happens to the deals they won
    'checklist:view': OWN,
    'vendor:view': ALL,
    'crew_roster:view': ALL,
    'catalogue:view': ALL,
    'studio:view': ALL, 'studio:edit': ALL,   // the pitch surface — this is their job
    'invoice:view': OWN,               // sees the document, cannot raise or amend it
    'payment:view': OWN,               // sees whether the advance landed
    'money.value:view': OWN,           // ← rupees on their own deals only
    'report:view': OWN,
    'roles:view': ALL
    // money.cost, money.margin, export, team, settings: DENIED.
  },

  // ── Event Manager ─────────────────────────────────────────────────────────
  // Deliberate call #2: contract value on their assigned events, so they can size
  // the production — and NEVER margin, at any scope, from the role. Cost is granted
  // because they negotiate the vendors; margin is the number that would let them
  // back it out, and that is a director/finance number.
  event_manager: {
    'home:view': ALL,
    'pipeline:view': ALL,              // read-only look-ahead at what is coming
    'client:view': ASSIGNED, 'client:edit': ASSIGNED,
    'deal:view': ALL, 'deal:edit': ASSIGNED,
    'quote:view': ASSIGNED,
    'proposal:view': ASSIGNED,
    'contract:view': ASSIGNED,
    'production:view': ALL, 'production:create': ASSIGNED, 'production:edit': ASSIGNED,
    'checklist:view': ALL, 'checklist:create': ASSIGNED, 'checklist:edit': ASSIGNED,
    'vendor:view': ALL, 'vendor:create': ALL, 'vendor:edit': ALL,
    'crew_roster:view': ALL, 'crew_roster:edit': ASSIGNED,
    'catalogue:view': ALL, 'catalogue:create': ALL, 'catalogue:edit': ALL,
    'studio:view': ALL, 'studio:edit': ALL,
    'invoice:view': ASSIGNED,
    'payment:view': ASSIGNED,          // "has the advance cleared, can I book the venue"
    'money.value:view': ASSIGNED,      // ← contract value, yes
    'money.cost:view': ASSIGNED,       // ← vendor spend they are responsible for
    'report:view': ASSIGNED,
    'roles:view': ALL
    // money.margin: DENIED BY ROLE — only a per-user `canSeeMargin` flag opens it.
  },

  // ── Finance / Accounts ────────────────────────────────────────────────────
  // The Dubsado "Accountant": everything about money, read-only everywhere else.
  // The only role besides Admin that can export.
  finance: {
    'home:view': ALL,
    'pipeline:view': ALL,
    'client:view': ALL,
    'deal:view': ALL,
    'quote:view': ALL, 'proposal:view': ALL, 'contract:view': ALL,
    'production:view': ALL,
    'checklist:view': ALL,
    'vendor:view': ALL,
    'crew_roster:view': ALL,
    'catalogue:view': ALL,
    'studio:view': ALL,
    'invoice:view': ALL, 'invoice:create': ALL, 'invoice:edit': ALL, 'invoice:delete': ALL,
    'payment:view': ALL, 'payment:create': ALL, 'payment:edit': ALL,
    'money.value:view': ALL, 'money.cost:view': ALL, 'money.margin:view': ALL,
    'report:view': ALL, 'report:export': ALL, 'export:view': ALL,
    'roles:view': ALL
    // No editing of deals, no studio edits, no team or settings.
  },

  // ── Crew / On-site ────────────────────────────────────────────────────────
  // Dubsado "Basic": assigned work only, zero commercials. A crew member seeing a
  // contract value on a client's phone screen is a real, frequent incident.
  crew: {
    'home:view': ALL,
    'deal:view': ASSIGNED,
    'production:view': ASSIGNED,
    'checklist:view': ASSIGNED, 'checklist:edit': ASSIGNED,
    'vendor:view': ASSIGNED,
    'crew_roster:view': ASSIGNED,
    'catalogue:view': ALL,
    'studio:view': ALL,
    'roles:view': ALL
    // Every money.* key, every document, every report: DENIED.
  }
});

/**
 * Per-user override flags, layered on top of the role (the Dubsado pattern:
 * a small fixed role set plus a handful of opt-in capability toggles).
 * Each entry says which matrix keys it touches and how.
 */
export const OVERRIDE_FLAGS = Object.freeze({
  canViewAllPipelines: {
    id: 'canViewAllPipelines',
    label: 'See every pipeline',
    // Operational visibility only. Money keys are deliberately absent.
    grants: ['pipeline:view', 'client:view', 'deal:view', 'production:view', 'checklist:view'],
    scope: ALL,
    note: 'Widens who they can SEE. Does not widen what money they can see.'
  },
  canSeeMargin: {
    id: 'canSeeMargin',
    label: 'See cost & margin',
    grants: ['money.cost:view', 'money.margin:view'],
    // Granted at the user's own record scope, not company-wide.
    scope: null,
    note: 'Opens margin for one named person without promoting them to Director.'
  }
});

/** Normalise whatever we were handed into a user-ish object. Never throws. */
function normaliseUser(user) {
  if (!user || typeof user !== 'object') return null;
  const role = typeof user.role === 'string' ? user.role : '';
  if (!PERMISSION_MATRIX[role]) return null;
  return {
    id: typeof user.id === 'string' ? user.id : '',
    role,
    canViewAllPipelines: user.canViewAllPipelines === true,
    canSeeMargin: user.canSeeMargin === true
  };
}

/** The natural record scope for a role — 'own' for sales, 'assigned' otherwise. */
function baseScopeFor(role) {
  return role === ROLES.SALES_MANAGER ? OWN : ASSIGNED;
}

/**
 * The scope at which `user` holds `resource:action`.
 * Returns one of SCOPES. This is the function a server would call first.
 */
export function scopeFor(user, action, resource) {
  const u = normaliseUser(user);
  if (!u) return SCOPES.NONE;
  const key = `${resource}:${action}`;
  let scope = PERMISSION_MATRIX[u.role][key] || SCOPES.NONE;

  for (const flag of Object.values(OVERRIDE_FLAGS)) {
    if (!u[flag.id]) continue;
    if (!flag.grants.includes(key)) continue;
    const granted = flag.scope || baseScopeFor(u.role);
    if (SCOPE_RANK[granted] > SCOPE_RANK[scope] || scope === SCOPES.NONE) scope = granted;
  }
  return scope;
}

/**
 * Does `record` fall inside `scope` for `user`?
 * A record shaped like the CRM Deal: { salesOwnerId, ownerId, eventManagerId, crewIds }.
 */
export function recordInScope(user, scope, record) {
  if (scope === SCOPES.ALL) return true;
  if (scope === SCOPES.NONE) return false;
  // No record supplied means "may they reach this surface at all?" — yes, filtered.
  if (record === undefined || record === null) return true;
  const u = normaliseUser(user);
  if (!u || !u.id) return false;
  if (scope === OWN) {
    return record.salesOwnerId === u.id || record.ownerId === u.id;
  }
  // ASSIGNED also honours ownership: running an event you also sold still counts.
  return record.eventManagerId === u.id
    || record.salesOwnerId === u.id
    || record.ownerId === u.id
    || (Array.isArray(record.crewIds) && record.crewIds.includes(u.id));
}

/**
 * THE function. `can(user, 'view', 'money.margin', deal)`.
 * Pure, default-deny, safe with undefined everything.
 */
export function can(user, action, resource, record) {
  const scope = scopeFor(user, action, resource);
  if (scope === SCOPES.NONE) return false;
  return recordInScope(user, scope, record);
}

/** Convenience: may this user see rupees on this record at all? */
export function canSeeMoney(user, record) {
  return can(user, 'view', 'money.value', record);
}

/** Convenience: mask a money value the user may not see. */
export function maskMoney(user, record, formatted, placeholder = '—') {
  return canSeeMoney(user, record) ? formatted : placeholder;
}

/**
 * Filter a list down to what `user` may `action`. Use this everywhere a list is
 * rendered, so the filtering rule is never re-implemented per screen.
 */
export function filterByScope(user, action, resource, records) {
  if (!Array.isArray(records)) return [];
  const scope = scopeFor(user, action, resource);
  if (scope === SCOPES.NONE) return [];
  if (scope === SCOPES.ALL) return [...records];
  return records.filter(r => recordInScope(user, scope, r));
}

/**
 * The matrix as rows for the /roles table: one row per resource+action that any
 * role holds, with the scope each role gets. Pure data — no DOM.
 */
export function permissionRows() {
  const keys = new Set();
  Object.values(PERMISSION_MATRIX).forEach(table => {
    Object.keys(table).forEach(k => keys.add(k));
  });
  const order = new Map(RESOURCES.map((r, i) => [r.id, i]));
  return [...keys]
    .map(key => {
      const [resource, action] = key.split(':');
      const meta = RESOURCES.find(r => r.id === resource);
      return {
        key,
        resource,
        action,
        group: meta ? meta.group : 'Other',
        label: meta ? meta.label : resource,
        scopes: Object.fromEntries(
          Object.keys(PERMISSION_MATRIX).map(role => [
            role,
            PERMISSION_MATRIX[role][key] || SCOPES.NONE
          ])
        )
      };
    })
    .sort((a, b) => {
      const ra = order.has(a.resource) ? order.get(a.resource) : 999;
      const rb = order.has(b.resource) ? order.get(b.resource) : 999;
      if (ra !== rb) return ra - rb;
      return ACTIONS.indexOf(a.action) - ACTIONS.indexOf(b.action);
    });
}

/** Human label for a scope, for the matrix table. */
export function scopeLabel(scope) {
  switch (scope) {
    case SCOPES.ALL: return 'All';
    case SCOPES.OWN: return 'Own';
    case SCOPES.ASSIGNED: return 'Assigned';
    default: return '—';
  }
}

/** The permanent, non-negotiable honesty line. Import it; never retype it. */
export const DEMO_DISCLOSURE =
  'Demo workspace — roles shape what you see, they do not secure data. Everything is stored in this browser.';

export default can;
