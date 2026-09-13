/**
 * RoleBadge.js — the persistent top-bar control: who you are signed in as,
 * with an always-visible role switcher.
 *
 * The switcher stays visible on purpose. Hiding it would make the demo "feel
 * real", and feeling real is exactly the dishonest move here — there is no
 * authentication behind it, so pretending otherwise is the one thing we will not
 * do. The menu also carries the permanent demo disclosure, where it cannot be
 * dismissed and cannot scroll away.
 *
 * The menu itself is rendered by `src/shell/popover.js` into a body-level layer.
 * It used to be an absolutely positioned child of `#roleBadgeSlot`, which carries
 * `overflow:hidden` — the menu was being painted at 300×367 and then clipped to
 * nothing, which is exactly what "clicking my role gives a blank" looked like.
 */

import { escapeHtml } from '../utils/format.js';
import { session } from '../auth/session.js';
import { ROLE_META, DEMO_DISCLOSURE } from '../auth/permissions.js';
import { ensureAuthStyles } from './SignInScreen.js';
import { createPopover } from '../shell/popover.js';

export class RoleBadge {
  /**
   * @param {HTMLElement} containerElement — a slot in the navbar.
   * @param {{onSignOut?:Function, onShowRoles?:Function, onSwitch?:Function}} [hooks]
   */
  constructor(containerElement, hooks = {}) {
    this.container = containerElement;
    this.onSignOut = hooks.onSignOut || (() => {});
    this.onShowRoles = hooks.onShowRoles || (() => {});
    this.onSwitch = hooks.onSwitch || (() => {});
    this.unsubscribe = null;
    this.popover = null;
    this._handleClick = this._handleClick.bind(this);
    this._handleMenuClick = this._handleMenuClick.bind(this);
  }

  /** Is the switcher menu on screen? */
  get open() {
    return !!this.popover && this.popover.isOpen();
  }

  /** Mount and start tracking the session. Call once. */
  mount() {
    ensureAuthStyles();
    this.container.classList.add('role-badge');
    this.container.style.position = 'relative';
    this.container.addEventListener('click', this._handleClick);

    this.popover = createPopover({
      // The trigger is re-created on every render, so resolve it lazily.
      trigger: () => this.container.querySelector('[data-action="toggle"]'),
      className: 'role-menu',
      surface: false,           // `.role-menu` brings its own surface.
      role: 'menu',
      label: 'Switch person',
      align: 'end',
      minWidth: 300,
      maxWidth: 360,
      render: () => this.menuMarkup()
    });
    this.popover.element.addEventListener('click', this._handleMenuClick);

    // The badge must never disagree with the session, whoever changed it.
    this.unsubscribe = session.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.container.removeEventListener('click', this._handleClick);
    if (this.popover) { this.popover.destroy(); this.popover = null; }
    this.container.innerHTML = '';
  }

  /** The trigger only. The menu lives in the popover layer. */
  render() {
    const user = session.getUser();
    if (!user) {
      // Signed out: the badge is not the place to sign in, so say nothing loud.
      this.container.innerHTML = '';
      if (this.popover) this.popover.close({ restoreFocus: false });
      return;
    }
    const meta = ROLE_META[user.role];

    this.container.innerHTML = `
      <button type="button" class="role-badge-btn" data-action="toggle"
        aria-haspopup="menu" aria-expanded="${this.open}"
        aria-label="Signed in as ${escapeHtml(user.name)}, ${escapeHtml(meta.label)}. Switch person.">
        <span class="role-badge-avatar" aria-hidden="true">${escapeHtml(user.initials)}</span>
        <span class="role-badge-who">
          <b>${escapeHtml(user.name)}</b>
          <span>${escapeHtml(meta.label)}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </button>`;

    // A session change while the menu is open must repaint the ticks, not close it.
    if (this.open) {
      this.popover.setContent(this.menuMarkup());
      const trigger = this.container.querySelector('[data-action="toggle"]');
      if (trigger) {
        trigger.setAttribute('aria-expanded', 'true');
        trigger.setAttribute('aria-controls', this.popover.id);
      }
    }
  }

  menuMarkup() {
    const user = session.getUser();
    if (!user) return '';
    const items = session.listUsers().map(u => {
      const m = ROLE_META[u.role];
      const current = u.id === user.id;
      return `
        <button type="button" role="menuitemradio" class="role-menu-item"
          data-user-id="${escapeHtml(u.id)}" aria-current="${current}"
          aria-checked="${current}">
          <span class="role-badge-avatar" aria-hidden="true">${escapeHtml(u.initials)}</span>
          <span>
            <b>${escapeHtml(u.name)}</b><br />
            <span style="color:var(--text-muted);font-size:var(--fs-xs);">${escapeHtml(m.label)}</span>
          </span>
        </button>`;
    }).join('');

    return `
      <p class="role-menu-label">Switch to</p>
      ${items}
      <div class="role-menu-foot">
        <p class="helm-disclosure" style="margin:0 0 10px;">${escapeHtml(DEMO_DISCLOSURE)}</p>
        <button type="button" class="link-btn" data-action="roles">Roles &amp; permissions</button>
        <button type="button" class="link-btn" data-action="sign-out"
          style="margin-left:14px;">Sign out</button>
      </div>`;
  }

  setOpen(next) {
    if (!this.popover) return;
    if (next) this.popover.open();
    else this.popover.close();
    const trigger = this.container.querySelector('[data-action="toggle"]');
    if (trigger) trigger.setAttribute('aria-expanded', String(this.open));
  }

  /** Clicks on the trigger. */
  _handleClick(event) {
    const action = event.target.closest('[data-action="toggle"]');
    if (!action) return;
    this.setOpen(!this.open);
  }

  /** Clicks inside the menu, which is no longer a descendant of the slot. */
  _handleMenuClick(event) {
    const action = event.target.closest('[data-action]');
    if (action) {
      const kind = action.dataset.action;
      if (kind === 'roles') { this.setOpen(false); this.onShowRoles(); return; }
      if (kind === 'sign-out') { this.setOpen(false); session.signOut(); this.onSignOut(); return; }
    }
    const item = event.target.closest('[data-user-id]');
    if (!item) return;
    const user = session.switchUser(item.dataset.userId);
    this.setOpen(false);
    this.render();
    if (user) this.onSwitch(user);
  }
}

export default RoleBadge;
