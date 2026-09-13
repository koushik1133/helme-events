/**
 * HomeScreen.js — the app's front door.
 *
 * Helm used to open on an aerial venue map. A map is a feature, not a home:
 * an event company that lives in this tool all day needs to be told what needs
 * doing, not shown a picture of a lawn.
 *
 * The structure is the same for every role, because the evidence says so:
 *
 *   greeting + ONE hero number
 *   → 3–5 clickable KPI tiles (never more)
 *   → "Needs you today" — the next-best-action list
 *   → calendar strip
 *   → activity
 *
 * Charts do not appear above the fold. Every number is a link into a filtered
 * list. Which of the four homes renders is decided by
 * `session.getCurrentUser().role`, and every number is gated through
 * `can(user, action, resource)`.
 *
 * Usage (the host wires the real modules in; all of them are optional):
 *
 *   const home = new HomeScreen(document.getElementById('home-view'), {
 *     store, finance, session, can, navigate
 *   });
 *   home.render();
 *
 * Nothing here is a security boundary. Roles shape what this screen shows;
 * all data lives in this browser and anyone with the device can read it.
 */

import { injectHomeStyles } from './homeStyles.js';
import { buildHomeModel, greeting, longDate, ROLES, ROLE_LABEL } from './homeData.js';
import { escapeHtml } from '../../utils/format.js';
import { renderAdminHome } from './AdminHome.js';
import { renderSalesHome } from './SalesHome.js';
import { renderEventManagerHome } from './EventManagerHome.js';
import { renderFinanceHome } from './FinanceHome.js';

const VARIANTS = {
  [ROLES.admin]: renderAdminHome,
  [ROLES.sales]: renderSalesHome,
  [ROLES.event_manager]: renderEventManagerHome,
  [ROLES.finance]: renderFinanceHome
};

export class HomeScreen {
  /**
   * @param {HTMLElement} container
   * @param {object} deps { store, finance, session, can, navigate }
   */
  constructor(container, deps = {}) {
    this.container = container;
    this.deps = deps;
    this.onNavigate = typeof deps.navigate === 'function' ? deps.navigate : null;
    this._onClick = this._onClick.bind(this);
    this._onKey = this._onKey.bind(this);
    this._bound = false;
    injectHomeStyles();
  }

  /** Re-read everything and repaint. Safe to call on any state change. */
  render() {
    if (!this.container) return;
    let model;
    try {
      model = buildHomeModel(this.deps);
    } catch {
      // A broken store must never blank the front door.
      model = buildHomeModel({});
    }
    this.model = model;

    const variant = VARIANTS[model.role] || renderEventManagerHome;
    let body;
    try {
      body = variant(model);
    } catch (err) {
      body = `<section class="hh-card"><div class="hh-empty">
        <div class="hh-empty-mark" aria-hidden="true">!</div>
        <h3>This view could not be built</h3>
        <p>${escapeHtml(String((err && err.message) || err))}</p>
      </div></section>`;
    }

    const firstName = String(model.user.name || 'there').trim().split(/\s+/)[0];

    this.container.innerHTML = `
      <div class="hh">
        <header class="hh-top">
          <div class="hh-greet">
            <h1>${escapeHtml(greeting())}, ${escapeHtml(firstName)}</h1>
            <p>${escapeHtml(longDate(model.today))}</p>
          </div>
          <span class="hh-rolechip">
            <span class="hh-dot" aria-hidden="true"></span>
            ${escapeHtml(ROLE_LABEL[model.role] || 'Team')} view
          </span>
        </header>
        ${body}
        <p class="hh-honest">
          Demo workspace — your role shapes what this screen shows, it does not restrict the data.
          Everything is stored in this browser and anyone using this device can read it.
        </p>
      </div>`;

    this._bind();
  }

  _bind() {
    if (this._bound || !this.container) return;
    this.container.addEventListener('click', this._onClick);
    this.container.addEventListener('keydown', this._onKey);
    this._bound = true;
  }

  destroy() {
    if (!this.container || !this._bound) return;
    this.container.removeEventListener('click', this._onClick);
    this.container.removeEventListener('keydown', this._onKey);
    this._bound = false;
  }

  _onClick(event) {
    const target = event.target.closest('[data-go]');
    if (!target || !this.container.contains(target)) return;
    this._go(target.getAttribute('data-go'), target.getAttribute('data-param'));
  }

  /** Table rows are role="link" with tabindex — Enter and Space must work. */
  _onKey(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest('tr[data-go]');
    if (!target) return;
    event.preventDefault();
    this._go(target.getAttribute('data-go'), target.getAttribute('data-param'));
  }

  _go(route, param) {
    if (!route) return;
    if (this.onNavigate) {
      try { this.onNavigate(route, param || null); return; } catch { /* fall through */ }
    }
    // No router wired yet — announce it rather than failing silently.
    this.container.dispatchEvent(new CustomEvent('helm:navigate', {
      bubbles: true, detail: { route, param: param || null }
    }));
  }
}

export default HomeScreen;
