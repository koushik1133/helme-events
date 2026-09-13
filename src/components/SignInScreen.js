/**
 * SignInScreen.js — "Sign in as" persona cards. The first thing a visitor sees.
 *
 * This is NOT a login form and must never grow into one. There is no password
 * field, no "incorrect password", no credential of any kind, because there is no
 * server to verify one against and a client-side check would be theatre. Picking
 * a card chooses which shape of the product you are looking at.
 *
 * Styling follows the app: CSS custom properties only, no hardcoded colours, so
 * light and dark both work. Everything is a real <button>, reachable by keyboard.
 */

import { escapeHtml } from '../utils/format.js';
import { session } from '../auth/session.js';
import { ROLE_META, DEMO_DISCLOSURE } from '../auth/permissions.js';

const STYLE_ID = 'helm-auth-styles';

/**
 * One stylesheet shared by SignInScreen, RoleBadge and RolesMatrixScreen.
 * Injected once, idempotently — these are new surfaces and style.css is not ours.
 */
export function ensureAuthStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
  .helm-disclosure{display:flex;align-items:center;gap:8px;font-size:var(--fs-xs);
    color:var(--text-muted);line-height:1.45}
  .helm-disclosure::before{content:'';flex:0 0 auto;width:6px;height:6px;border-radius:50%;
    background:var(--accent-amber)}

  .signin-screen{position:fixed;inset:0;z-index:var(--z-modal);background:var(--bg-app);
    color:var(--text-main);overflow-y:auto;display:flex;flex-direction:column;
    align-items:center;padding:48px 24px 32px;font-family:var(--font-attio)}
  .signin-inner{width:100%;max-width:1060px;display:flex;flex-direction:column;gap:28px}
  .signin-head h1{margin:0 0 8px;font-size:var(--fs-xl);font-weight:600;letter-spacing:-0.01em}
  .signin-head p{margin:0;color:var(--text-muted);font-size:var(--fs-md);max-width:60ch}
  .signin-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr))}
  .persona-card{display:flex;flex-direction:column;gap:10px;text-align:left;padding:20px;
    background:var(--bg-surface);border:1px solid var(--border-subtle);
    border-radius:var(--radius-card);cursor:pointer;color:inherit;font:inherit;
    transition:var(--transition-fast)}
  .persona-card:hover{background:var(--bg-surface-hover);border-color:var(--border-strong);
    transform:translateY(-2px)}
  .persona-card:focus-visible{outline:2px solid var(--focus-color);outline-offset:2px;
    box-shadow:var(--focus-ring)}
  .persona-top{display:flex;align-items:center;gap:12px}
  .persona-avatar{flex:0 0 auto;width:42px;height:42px;border-radius:var(--radius-pill);
    display:grid;place-items:center;font-weight:600;font-size:var(--fs-md);
    background:var(--bg-pill);color:var(--text-main);border:1px solid var(--border-subtle)}
  .persona-name{font-size:var(--fs-lg);font-weight:600;line-height:1.2}
  .persona-title{font-size:var(--fs-xs);color:var(--text-muted)}
  .persona-summary{font-size:var(--fs-sm);color:var(--text-muted);line-height:1.5;margin:0}
  .persona-flags{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
  .role-chip{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;
    border-radius:var(--radius-pill);font-size:var(--fs-xs);font-weight:500;
    background:var(--bg-pill);color:var(--text-main);border:1px solid var(--border-subtle)}
  .role-chip[data-accent="violet"]{background:var(--tint-violet);border-color:var(--border-subtle);color:var(--accent-violet)}
  .role-chip[data-accent="indigo"]{background:var(--tint-indigo);border-color:var(--border-indigo);color:var(--accent-indigo)}
  .role-chip[data-accent="emerald"]{background:var(--tint-emerald);color:var(--accent-emerald)}
  .role-chip[data-accent="gold"]{background:var(--tint-gold);border-color:var(--border-gold);color:var(--accent-gold)}
  .role-chip[data-accent="sky"]{background:var(--tint-sky);color:var(--accent-sky)}
  .signin-foot{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;
    padding-top:18px;border-top:1px solid var(--border-subtle)}
  .link-btn{background:none;border:none;padding:4px 0;color:var(--accent-indigo);
    font:inherit;font-size:var(--fs-sm);cursor:pointer;text-decoration:underline}
  .link-btn:focus-visible{outline:2px solid var(--focus-color);outline-offset:2px}

  .role-badge{display:flex;align-items:center;gap:8px}
  .role-badge-btn{display:inline-flex;align-items:center;gap:8px;padding:5px 10px;
    background:var(--bg-pill);border:1px solid var(--border-subtle);
    border-radius:var(--radius-pill);color:var(--text-main);font:inherit;
    font-size:var(--fs-xs);cursor:pointer;transition:var(--transition-fast)}
  .role-badge-btn:hover{background:var(--bg-surface-hover)}
  .role-badge-btn:focus-visible{outline:2px solid var(--focus-color);outline-offset:2px}
  .role-badge-avatar{width:24px;height:24px;border-radius:var(--radius-pill);display:grid;
    place-items:center;font-size:10px;font-weight:600;background:var(--bg-surface);
    border:1px solid var(--border-subtle)}
  .role-badge-who{display:flex;flex-direction:column;line-height:1.15;text-align:left}
  .role-badge-who b{font-weight:600}
  .role-badge-who span{color:var(--text-muted);font-size:10px}
  .role-menu{position:absolute;top:calc(100% + 8px);right:0;min-width:300px;z-index:var(--z-popover);
    background:var(--bg-surface);border:1px solid var(--border-subtle);
    border-radius:var(--radius-ms);box-shadow:var(--shadow-lg);padding:8px;
    display:flex;flex-direction:column;gap:2px}
  .role-menu[hidden]{display:none}
  .role-menu-label{padding:8px 10px 4px;font-size:10px;letter-spacing:0.06em;
    text-transform:uppercase;color:var(--text-dim)}
  .role-menu-item{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;
    background:none;border:none;border-radius:var(--radius-xs);color:var(--text-main);
    font:inherit;font-size:var(--fs-sm);text-align:left;cursor:pointer}
  .role-menu-item:hover{background:var(--bg-surface-hover)}
  .role-menu-item:focus-visible{outline:2px solid var(--focus-color);outline-offset:-2px}
  .role-menu-item[aria-current="true"]{background:var(--bg-pill);font-weight:600}
  .role-menu-foot{border-top:1px solid var(--border-subtle);margin-top:6px;padding:10px}

  .roles-screen{color:var(--text-main);font-family:var(--font-attio);
    padding:24px;display:flex;flex-direction:column;gap:20px}
  .roles-screen h2{margin:0 0 6px;font-size:var(--fs-xl);font-weight:600}
  .roles-screen .roles-intro{margin:0;color:var(--text-muted);font-size:var(--fs-sm);max-width:80ch;line-height:1.55}
  .roles-table-wrap{overflow-x:auto;border:1px solid var(--border-subtle);
    border-radius:var(--radius-ms);background:var(--bg-surface)}
  table.roles-table{border-collapse:collapse;width:100%;min-width:720px;font-size:var(--fs-sm)}
  .roles-table th,.roles-table td{padding:9px 12px;text-align:left;
    border-bottom:1px solid var(--border-subtle);white-space:nowrap}
  .roles-table thead th{position:sticky;top:0;background:var(--bg-elevated);
    font-size:var(--fs-xs);font-weight:600;color:var(--text-muted);z-index:1}
  .roles-table tbody tr:hover{background:var(--bg-surface-hover)}
  .roles-table td.scope-cell{text-align:center;font-variant-numeric:tabular-nums}
  .roles-group-row td{background:var(--bg-elevated);font-weight:600;font-size:var(--fs-xs);
    text-transform:uppercase;letter-spacing:0.06em;color:var(--text-dim)}
  .scope-tag{display:inline-block;min-width:66px;padding:2px 8px;border-radius:var(--radius-pill);
    font-size:var(--fs-xs)}
  .scope-tag[data-scope="all"]{background:var(--tint-emerald);color:var(--accent-emerald)}
  .scope-tag[data-scope="own"]{background:var(--tint-gold);color:var(--accent-gold)}
  .scope-tag[data-scope="assigned"]{background:var(--tint-sky);color:var(--accent-sky)}
  .scope-tag[data-scope="none"]{background:transparent;color:var(--text-dim)}
  `;
  document.head.appendChild(style);
}

export class SignInScreen {
  /**
   * @param {HTMLElement} containerElement — a mount point that may be empty.
   * @param {(user:object)=>void} [onSignIn] — called after a persona is chosen.
   */
  constructor(containerElement, onSignIn) {
    this.container = containerElement;
    this.onSignIn = typeof onSignIn === 'function' ? onSignIn : () => {};
    this.onShowRoles = null;
    this._handleClick = this._handleClick.bind(this);
  }

  /** Show the screen. Idempotent. */
  open() {
    ensureAuthStyles();
    this.container.hidden = false;
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.container.removeEventListener('click', this._handleClick);
    this.container.innerHTML = '';
    this.container.style.display = 'none';
    this.container.hidden = true;
  }

  card(user) {
    const meta = ROLE_META[user.role];
    const flags = [];
    if (user.canViewAllPipelines) flags.push('Sees every pipeline');
    if (user.canSeeMargin) flags.push('Sees cost &amp; margin');
    const flagChips = flags.length
      ? `<div class="persona-flags">${flags
          .map(f => `<span class="role-chip">${f}</span>`).join('')}</div>`
      : '';
    return `
      <button type="button" class="persona-card" data-user-id="${escapeHtml(user.id)}"
        aria-label="Sign in as ${escapeHtml(user.name)}, ${escapeHtml(meta.label)}">
        <span class="persona-top">
          <span class="persona-avatar" aria-hidden="true">${escapeHtml(user.initials)}</span>
          <span>
            <span class="persona-name">${escapeHtml(user.name)}</span><br />
            <span class="persona-title">${escapeHtml(user.title)}</span>
          </span>
        </span>
        <span class="role-chip" data-accent="${escapeHtml(meta.accent)}">${escapeHtml(meta.label)}</span>
        <p class="persona-summary">${escapeHtml(meta.summary)}</p>
        ${flagChips}
      </button>`;
  }

  render() {
    const users = session.listUsers();
    this.container.innerHTML = `
      <div class="signin-screen" role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <div class="signin-inner">
          <header class="signin-head">
            <h1 id="signin-title">Who is using Helm right now?</h1>
            <p>Pick a person to enter the workspace. Each one gets a different first screen,
               a different menu and a different view of the money — that is the whole point
               of the role model.</p>
          </header>

          <div class="signin-grid">${users.map(u => this.card(u)).join('')}</div>

          <div class="signin-foot">
            <p class="helm-disclosure" style="margin:0;max-width:64ch;">${escapeHtml(DEMO_DISCLOSURE)}
              There is no password here and nothing is checked — choosing a person selects a view,
              it does not lock anyone out.</p>
            <button type="button" class="link-btn" data-action="show-roles">
              See exactly what each role can do
            </button>
          </div>
        </div>
      </div>`;
    this.container.addEventListener('click', this._handleClick);
    const first = this.container.querySelector('.persona-card');
    if (first) first.focus();
  }

  _handleClick(event) {
    const rolesBtn = event.target.closest('[data-action="show-roles"]');
    if (rolesBtn) {
      if (typeof this.onShowRoles === 'function') this.onShowRoles();
      return;
    }
    const card = event.target.closest('.persona-card');
    if (!card) return;
    const user = session.signIn(card.dataset.userId);
    if (!user) return;
    this.close();
    this.onSignIn(user);
  }
}

export default SignInScreen;
