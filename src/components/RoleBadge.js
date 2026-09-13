/**
 * RoleBadge.js — the persistent top-bar control: who you are signed in as,
 * with an always-visible role switcher.
 *
 * The switcher stays visible on purpose. Hiding it would make the demo "feel
 * real", and feeling real is exactly the dishonest move here — there is no
 * authentication behind it, so pretending otherwise is the one thing we will not
 * do. The menu also carries the permanent demo disclosure, where it cannot be
 * dismissed and cannot scroll away.
 */

import { escapeHtml } from '../utils/format.js';
import { session } from '../auth/session.js';
import { ROLE_META, DEMO_DISCLOSURE } from '../auth/permissions.js';
import { ensureAuthStyles } from './SignInScreen.js';

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
    this.open = false;
    this.unsubscribe = null;
    this._handleClick = this._handleClick.bind(this);
    this._handleKeydown = this._handleKeydown.bind(this);
    this._handleOutside = this._handleOutside.bind(this);
  }

  /** Mount and start tracking the session. Call once. */
  mount() {
    ensureAuthStyles();
    this.container.classList.add('role-badge');
    this.container.style.position = 'relative';
    this.container.addEventListener('click', this._handleClick);
    this.container.addEventListener('keydown', this._handleKeydown);
    document.addEventListener('click', this._handleOutside, true);
    // The badge must never disagree with the session, whoever changed it.
    this.unsubscribe = session.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
    this.container.removeEventListener('click', this._handleClick);
    this.container.removeEventListener('keydown', this._handleKeydown);
    document.removeEventListener('click', this._handleOutside, true);
    this.container.innerHTML = '';
  }

  render() {
    const user = session.getUser();
    if (!user) {
      // Signed out: the badge is not the place to sign in, so say nothing loud.
      this.container.innerHTML = '';
      return;
    }
    const meta = ROLE_META[user.role];
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
      </button>
      <div class="role-menu" role="menu" ${this.open ? '' : 'hidden'}
           aria-label="Switch person">
        <p class="role-menu-label">Switch to</p>
        ${items}
        <div class="role-menu-foot">
          <p class="helm-disclosure" style="margin:0 0 10px;">${escapeHtml(DEMO_DISCLOSURE)}</p>
          <button type="button" class="link-btn" data-action="roles">Roles &amp; permissions</button>
          <button type="button" class="link-btn" data-action="sign-out"
            style="margin-left:14px;">Sign out</button>
        </div>
      </div>`;
  }

  setOpen(next) {
    this.open = next;
    this.render();
    if (next) {
      const first = this.container.querySelector('.role-menu-item');
      if (first) first.focus();
    } else {
      const trigger = this.container.querySelector('[data-action="toggle"]');
      if (trigger) trigger.focus();
    }
  }

  _handleClick(event) {
    const action = event.target.closest('[data-action]');
    if (action) {
      const kind = action.dataset.action;
      if (kind === 'toggle') { this.setOpen(!this.open); return; }
      if (kind === 'roles') { this.setOpen(false); this.onShowRoles(); return; }
      if (kind === 'sign-out') { this.setOpen(false); session.signOut(); this.onSignOut(); return; }
    }
    const item = event.target.closest('[data-user-id]');
    if (!item) return;
    const user = session.switchUser(item.dataset.userId);
    this.open = false;
    this.render();
    if (user) this.onSwitch(user);
  }

  _handleKeydown(event) {
    if (event.key === 'Escape' && this.open) {
      event.stopPropagation();
      this.setOpen(false);
    }
  }

  _handleOutside(event) {
    if (!this.open) return;
    if (this.container.contains(event.target)) return;
    this.open = false;
    this.render();
  }
}

export default RoleBadge;
