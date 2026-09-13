import { escapeHtml, readJSON, writeJSON } from '../utils/format.js';

const STORAGE_KEY = 'helm_events_notifications_v2';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seed notifications, spread across a believable few days. */
function seedNotifications() {
  const now = Date.now();
  return [
    { id: 1, title: 'Payment Reminder', message: '30% advance is due on the Falaknuma wedding.', icon: '💰', offset: 12 * MINUTE, read: false },
    { id: 2, title: 'New Vendor Matched', message: 'Sanjeevani Caterers matches your Hyderabad brief.', icon: '🍲', offset: 2 * HOUR + 40 * MINUTE, read: false },
    { id: 3, title: 'Schedule Update', message: 'Setup start time moved to 9:00 AM.', icon: '⏰', offset: 9 * HOUR, read: true },
    { id: 4, title: 'Proposal Saved', message: 'Draft proposal v3 saved to your workspace.', icon: '💾', offset: DAY + 3 * HOUR, read: true },
    { id: 5, title: 'Booking Confirmed', message: 'Banquet Hall is confirmed for 14 March.', icon: '✅', offset: 3 * DAY + 5 * HOUR, read: false }
  ].map(({ offset, ...n }) => ({ ...n, time: new Date(now - offset).toISOString() }));
}

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

export class NotificationCenter {
  constructor(containerElement) {
    this.container = containerElement;
    const stored = readJSON(STORAGE_KEY, null);
    this.notifications = Array.isArray(stored) ? stored : seedNotifications();
    this.isOpen = false;
    this.confirmingClear = false;
    this._bound = false;
    this.setupOutsideClickListener();
  }

  setupOutsideClickListener() {
    document.addEventListener('click', e => {
      if (!this.isOpen) return;
      const isInsideNotif = this.container.contains(e.target);
      const notifBtn = document.getElementById('btnNotifications');
      const isClickOnBell = notifBtn && notifBtn.contains(e.target);
      if (!isInsideNotif && !isClickOnBell) this.close();
    });
  }

  getUnreadCount() {
    return this.notifications.filter(n => !n.read).length;
  }

  addNotification(title, message, icon = '🔔') {
    this.notifications.unshift({
      id: Date.now(),
      title,
      message,
      icon,
      time: new Date().toISOString(),
      read: false
    });
    this.save();
    this.updateBadge();
    if (this.isOpen) this.render();
  }

  save() {
    writeJSON(STORAGE_KEY, this.notifications);
  }

  toggle() {
    this.isOpen = !this.isOpen;
    this.render();
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.confirmingClear = false;
    this.render();
  }

  updateBadge() {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;
    const count = this.getUnreadCount();
    badge.textContent = count > 0 ? String(count) : '';
    badge.style.display = count > 0 ? 'flex' : 'none';
  }

  render() {
    this.updateBadge();

    if (!this.isOpen) {
      this.container.innerHTML = '';
      return;
    }

    const unread = this.getUnreadCount();

    this.container.innerHTML = `
      <div class="notification-panel" role="dialog" aria-label="Notifications">
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
          ? '<p class="meta" role="status">This removes all notifications and cannot be undone. Press Confirm clear again, or close this panel to cancel.</p>'
          : ''}

        <div class="notification-list">
          ${this.notifications.length === 0
            ? '<div class="n-empty">You are all caught up — no notifications.</div>'
            : this.notifications.map(n => `
              <div class="notification-item ${n.read ? 'read' : 'unread'}" data-id="${escapeHtml(n.id)}">
                <div class="n-icon" aria-hidden="true">${escapeHtml(n.icon)}</div>
                <div class="n-content">
                  <strong class="n-title">${escapeHtml(n.title)}</strong>
                  <p class="n-msg">${escapeHtml(n.message)}</p>
                  <small class="n-time" title="${escapeHtml(new Date(n.time).toLocaleString())}">${escapeHtml(relativeTime(n.time))}</small>
                </div>
                <button type="button" class="n-dismiss" data-dismiss="${escapeHtml(n.id)}"
                        aria-label="Dismiss ${escapeHtml(n.title)}">&times;</button>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    // Bound once to the persistent container.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      if (e.target.closest('#closeNotifBtn')) {
        e.stopPropagation();
        this.close();
        return;
      }

      const dismiss = e.target.closest('[data-dismiss]');
      if (dismiss) {
        e.stopPropagation();
        const id = dismiss.dataset.dismiss;
        this.notifications = this.notifications.filter(n => String(n.id) !== id);
        this.save();
        this.render();
        return;
      }

      if (e.target.closest('.btn-mark-all')) {
        e.stopPropagation();
        this.notifications.forEach(n => { n.read = true; });
        this.save();
        this.render();
        return;
      }

      if (e.target.closest('.btn-clear-all')) {
        e.stopPropagation();
        if (!this.confirmingClear) {
          this.confirmingClear = true;
        } else {
          this.notifications = [];
          this.confirmingClear = false;
          this.save();
        }
        this.render();
        return;
      }

      const item = e.target.closest('.notification-item');
      if (item) {
        const notif = this.notifications.find(n => String(n.id) === item.dataset.id);
        if (notif && !notif.read) {
          notif.read = true;
          this.save();
          this.render();
        }
      }
    });
  }
}
