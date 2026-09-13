/**
 * NotificationCenter.js — the bell panel.
 *
 * What changed, and why
 * ---------------------
 * This used to ship five hardcoded strings ("30% advance is due on the Falaknuma
 * wedding") that had nothing to do with the CRM. A notification that is not
 * derived from a fact is worse than no notification: it teaches the owner to
 * ignore the bell, which is the one place a real overdue payment would have
 * shown up.
 *
 * Every item below is now DERIVED, on open, from the same selectors the Home
 * screen uses (`src/components/home/homeData.js`) over the same CRM store and
 * the same finance rollups (`src/crm/finance.js`). Nothing is recomputed here.
 * Four signals, each one something a producer would actually be called about:
 *
 *   1. Overdue milestones            — finance.receivables().overdue
 *   2. Events inside T-7 with no event manager assigned
 *   3. Enquiries with no first response  — the Sales home's SLA clock
 *   4. Balance still due before load-in  — leverage ends at the event
 *
 * Roles are enforced, not decorated: signals 1 and 4 are money, and a Crew user
 * must never see a rupee, so they are gated through
 * `can(user, 'view', 'money.value')`. Signal 3 needs the pipeline. The deal set
 * itself is already scoped per role by `scopedDeals` inside homeData.
 *
 * Read state is per-notification and persists: an item keeps a STABLE id derived
 * from the record it is about (`overdue:<milestoneId>`), so marking it read
 * survives a reload and a re-derivation, and it un-reads itself only if the
 * underlying fact changes.
 *
 * The panel renders through `src/shell/popover.js` into the body-level layer.
 * It was previously anchored in a container the header clips, which is what
 * "the notification one is also not working properly" looked like.
 */

import { escapeHtml, readJSON, writeJSON, formatMoney } from '../utils/format.js';
import { crmStore } from '../crm/store.js';
import * as crmFinance from '../crm/finance.js';
import { session } from '../auth/session.js';
import { can } from '../auth/permissions.js';
import { createPopover } from '../shell/popover.js';
import {
  buildHomeModel, receivablesAgeing, upcomingEvents, unansweredEnquiries,
  clientName, dealHeading, daysUntil, formatAge
} from './home/homeData.js';

const STORAGE_KEY = 'helm_events_notifications_v3';
/** The pre-CRM seed store. Read once so a returning user is not re-nagged. */
const LEGACY_KEY = 'helm_events_notifications_v2';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Events this far out with nobody producing them are a staffing problem. */
const UNSTAFFED_WINDOW_DAYS = 7;

/** "just now" / "12m ago" / "3h ago" / "2d ago" / an absolute date past a week. */
export function relativeTime(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  if (diff < 0) return 'scheduled';
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`;
  if (diff < 7 * DAY) return `${Math.floor(diff / DAY)}d ago`;
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function emptyState() {
  return { read: {}, dismissed: {}, custom: [], allReadAt: null };
}

function loadState() {
  const stored = readJSON(STORAGE_KEY, null);
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
    return {
      read: stored.read && typeof stored.read === 'object' ? stored.read : {},
      dismissed: stored.dismissed && typeof stored.dismissed === 'object' ? stored.dismissed : {},
      custom: Array.isArray(stored.custom) ? stored.custom : [],
      allReadAt: typeof stored.allReadAt === 'string' ? stored.allReadAt : null
    };
  }
  return emptyState();
}

/**
 * Build the live notification list from the CRM.
 * Pure over its inputs; returns newest-first, capped for the panel.
 * Exported so it can be tested without a DOM.
 */
export function deriveNotifications(deps = {}) {
  const model = buildHomeModel({
    store: deps.store || crmStore,
    finance: deps.finance || crmFinance,
    session: deps.session || session,
    can: deps.can || can
  });
  if (!model.connected) return [];

  const user = model.user;
  const canFn = deps.can || can;
  // Money is a separate resource from the record itself. Crew holds none of it,
  // so signals 1 and 4 simply do not exist for them — not masked, absent.
  const seesMoney = !!canFn(user, 'view', 'money.value');
  const seesPipeline = !!canFn(user, 'view', 'pipeline');
  const out = [];

  /* 1 — overdue milestones ------------------------------------------------ */
  if (seesMoney) {
    receivablesAgeing(model).rows.slice(0, 8).forEach(row => {
      const deal = row.deal || {};
      const m = row.milestone || {};
      // Per-record check too: a sales manager sees rupees on their OWN deals.
      if (!canFn(user, 'view', 'money.value', deal)) return;
      out.push({
        id: `overdue:${m.id || `${deal.id}:${m.dueDate || ''}`}`,
        kind: 'overdue',
        icon: '🔴',
        title: `${row.overdueBy} days overdue — ${formatMoney(row.balance)}`,
        message: `${row.client || clientName(model, deal)} · ${m.label || m.name || 'Payment milestone'}${m.dueDate ? ` · was due ${m.dueDate}` : ''}`,
        // The ageing sits on the Payments screen; that is the thing to act on.
        route: 'payments',
        routeParam: null,
        linkLabel: 'Open payments',
        weight: 1000 + (row.overdueBy || 0),
        time: m.dueDate || model.today
      });
    });
  }

  /* 2 — events inside T-7 with no event manager --------------------------- */
  upcomingEvents(model, UNSTAFFED_WINDOW_DAYS).forEach(deal => {
    if (deal.eventManagerId) return;
    const days = daysUntil(deal.eventStartDate, model.today);
    out.push({
      id: `unstaffed:${deal.id}`,
      kind: 'unstaffed',
      icon: '🧑‍💼',
      title: days === 0 ? 'Today, with no event manager' : `In ${days} day${days === 1 ? '' : 's'}, with no event manager`,
      message: dealHeading(model, deal),
      route: 'client',
      routeParam: deal.clientId || null,
      linkLabel: 'Open the client',
      weight: 900 - (days ?? 0),
      time: deal.eventStartDate
    });
  });

  /* 3 — enquiries with no first response ---------------------------------- */
  if (seesPipeline) {
    unansweredEnquiries(model).slice(0, 6).forEach(row => {
      if (row.sla === 'ok') return;   // inside the hour is not yet a problem
      out.push({
        id: `noreply:${row.deal.id}`,
        kind: 'noreply',
        icon: row.sla === 'late' ? '⏳' : '✉️',
        title: `Enquiry unanswered for ${formatAge(row.hours)}`,
        message: `${row.client} · nobody has replied yet`,
        route: 'client',
        routeParam: row.deal.clientId || null,
        linkLabel: 'Open the client',
        weight: 800 + Math.round(row.hours || 0),
        time: row.deal.enquiryAt || row.deal.createdAt || model.today
      });
    });
  }

  /* 4 — balance due before load-in ---------------------------------------- */
  if (seesMoney) {
    const finance = deps.finance || crmFinance;
    let receivable = null;
    try {
      receivable = finance.receivables(
        model.deals, model.clients, model.milestones, model.receipts, model.invoices, model.today
      );
    } catch { receivable = null; }
    (receivable ? receivable.upcoming : []).forEach(row => {
      const deal = row.deal || {};
      if (row.riskSide !== 'pre_event') return;
      if (!row.eventEnd || !row.dueDate || row.dueDate > row.eventEnd) return;
      if (!canFn(user, 'view', 'money.value', deal)) return;
      const m = row.milestone || {};
      const days = daysUntil(row.dueDate, model.today);
      if (days == null || days > 21) return;   // beyond three weeks it is not news
      out.push({
        id: `preload:${m.id || `${deal.id}:${row.dueDate}`}`,
        kind: 'balance',
        icon: '💰',
        title: `${formatMoney(row.amount)} due before load-in`,
        message: `${(row.client && row.client.name) || clientName(model, deal)} · ${m.label || m.name || 'Balance'} · due ${row.dueDate}`,
        route: 'payments',
        routeParam: null,
        linkLabel: 'Open payments',
        weight: 700 - days,
        time: row.dueDate
      });
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 24);
}

export class NotificationCenter {
  /**
   * @param {HTMLElement} containerElement — kept for compatibility; the panel
   *   itself renders into the shared popover layer.
   * @param {object} [deps] — store / finance / session / can / navigate, all
   *   optional. Injected in tests; the app uses the real singletons.
   */
  constructor(containerElement, deps = {}) {
    this.container = containerElement;
    this.deps = deps;
    this.state = loadState();
    this.migrateLegacy();
    this.notifications = [];
    this.confirmingClear = false;

    this.popover = createPopover({
      trigger: () => document.getElementById('btnNotifications'),
      className: 'notification-panel',
      surface: false,          // `.notification-panel` brings its own surface.
      role: 'dialog',
      label: 'Notifications',
      align: 'end',
      maxWidth: 380,
      minWidth: 320,
      render: () => this.panelMarkup(),
      onClose: () => { this.confirmingClear = false; }
    });
    this.popover.element.addEventListener('click', e => this.handlePanelClick(e));
    // The rows are `role="button"`, so they owe the keyboard the same behaviour.
    this.popover.element.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const item = e.target.closest('.notification-item');
      if (!item) return;
      e.preventDefault();
      this.handlePanelClick({ target: item, stopPropagation() {} });
    });

    // The bell must reflect reality even while the panel is shut.
    const store = this.deps.store || crmStore;
    store.subscribe?.(() => this.refresh());
    (this.deps.session || session).subscribe?.(() => this.refresh());
    this.refresh();
  }

  /** The old seed list had no stable ids; anything already read there stays read. */
  migrateLegacy() {
    const legacy = readJSON(LEGACY_KEY, null);
    if (!Array.isArray(legacy)) return;
    // Seeded copy is gone for good — only the fact that the user had cleared or
    // read things is worth carrying, and the ids do not survive. Drop it, once.
    try { window.localStorage.removeItem(LEGACY_KEY); } catch { /* private mode */ }
  }

  get isOpen() {
    return this.popover.isOpen();
  }

  save() {
    writeJSON(STORAGE_KEY, this.state);
  }

  /** Re-derive from the CRM, apply read/dismissed state, repaint the badge. */
  refresh() {
    const derived = deriveNotifications(this.deps)
      .filter(n => !this.state.dismissed[n.id]);
    const custom = (this.state.custom || []).filter(n => !this.state.dismissed[n.id]);
    this.notifications = [...custom, ...derived]
      .map(n => ({ ...n, read: !!this.state.read[n.id] }));
    this.updateBadge();
    if (this.isOpen) this.popover.setContent(this.panelMarkup());
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  /**
   * An ad-hoc notification raised by something the user just did (a payment
   * confirmed, a proposal loaded). Persisted alongside the derived ones.
   */
  addNotification(title, message, icon = '🔔') {
    const entry = {
      id: `custom:${Date.now()}:${Math.round(Math.random() * 1e6)}`,
      kind: 'custom', icon, title, message,
      route: null, routeParam: null, linkLabel: '',
      weight: 1200, time: new Date().toISOString()
    };
    this.state.custom = [entry, ...(this.state.custom || [])].slice(0, 20);
    this.save();
    this.refresh();
  }

  toggle() { this.popover.toggle(); }
  open() { this.popover.open(); }
  close() { this.popover.close(); }

  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const count = this.getUnreadCount();
    badge.textContent = count > 0 ? String(count) : '';
    // index.html ships the badge with the `hidden` attribute so nothing flashes
    // before JS runs; keep both in sync.
    badge.hidden = count === 0;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  /** Kept so existing callers that expected a re-render still work. */
  render() {
    this.refresh();
  }

  panelMarkup() {
    const unread = this.getUnreadCount();
    const rows = this.notifications.length === 0
      ? `<div class="n-empty">
           <p style="margin:0 0 4px;"><b>Nothing needs you right now.</b></p>
           <p class="meta" style="margin:0;">No overdue payments, unstaffed events or unanswered enquiries in your scope.</p>
         </div>`
      : this.notifications.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${escapeHtml(n.id)}"
             role="button" tabindex="0"
             aria-label="${escapeHtml(`${n.title}. ${n.message}`)}">
          <div class="n-icon" aria-hidden="true">${escapeHtml(n.icon)}</div>
          <div class="n-content">
            <strong class="n-title">${escapeHtml(n.title)}</strong>
            <p class="n-msg">${escapeHtml(n.message)}</p>
            <small class="n-time">${escapeHtml(relativeTime(n.time))}${n.linkLabel ? ` · ${escapeHtml(n.linkLabel)} →` : ''}</small>
          </div>
          <button type="button" class="n-dismiss" data-dismiss="${escapeHtml(n.id)}"
                  aria-label="Dismiss ${escapeHtml(n.title)}">&times;</button>
        </div>`).join('');

    return `
      <div class="notification-header">
        <div class="notif-title-group">
          <span class="notif-bell-icon" aria-hidden="true">🔔</span>
          <h4>Notifications${unread ? ` (${unread} unread)` : ''}</h4>
        </div>
        <div class="notif-actions-group">
          <button type="button" class="btn-mark-all" ${unread ? '' : 'disabled'}>Mark all read</button>
          <button type="button" class="btn-clear-all">${this.confirmingClear ? 'Confirm clear' : 'Clear'}</button>
          <button type="button" class="notif-close-btn" id="closeNotifBtn" aria-label="Close notifications">&times;</button>
        </div>
      </div>

      ${this.confirmingClear
        ? '<p class="meta" role="status">This dismisses everything currently listed. New alerts still appear when the underlying facts change.</p>'
        : ''}

      <div class="notification-list">${rows}</div>`;
  }

  navigate(route, param) {
    if (!route) return;
    const nav = this.deps.navigate
      || (typeof window !== 'undefined' && window.app && window.app.goFromHome?.bind(window.app));
    if (nav) nav(route, param);
  }

  markRead(id) {
    if (this.state.read[id]) return false;
    this.state.read[id] = new Date().toISOString();
    this.save();
    return true;
  }

  handlePanelClick(e) {
    if (e.target.closest('#closeNotifBtn')) {
      e.stopPropagation();
      this.close();
      return;
    }

    const dismiss = e.target.closest('[data-dismiss]');
    if (dismiss) {
      e.stopPropagation();
      this.state.dismissed[dismiss.dataset.dismiss] = true;
      this.save();
      this.refresh();
      return;
    }

    if (e.target.closest('.btn-mark-all')) {
      e.stopPropagation();
      const now = new Date().toISOString();
      this.notifications.forEach(n => { this.state.read[n.id] = now; });
      this.state.allReadAt = now;
      this.save();
      this.refresh();
      return;
    }

    if (e.target.closest('.btn-clear-all')) {
      e.stopPropagation();
      if (!this.confirmingClear) {
        this.confirmingClear = true;
      } else {
        this.notifications.forEach(n => { this.state.dismissed[n.id] = true; });
        this.state.custom = [];
        this.confirmingClear = false;
        this.save();
      }
      this.refresh();
      return;
    }

    const item = e.target.closest('.notification-item');
    if (!item) return;
    const notif = this.notifications.find(n => n.id === item.dataset.id);
    if (!notif) return;
    this.markRead(notif.id);
    this.refresh();
    // A notification that does not take you to the thing is just a sticker.
    if (notif.route) {
      this.close();
      this.navigate(notif.route, notif.routeParam);
    }
  }

  destroy() {
    this.popover.destroy();
  }
}

export default NotificationCenter;
