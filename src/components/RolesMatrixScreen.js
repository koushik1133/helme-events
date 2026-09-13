/**
 * RolesMatrixScreen.js — the transparency page. Renders PERMISSION_MATRIX as a
 * readable table so anyone can see exactly what each role can do, without
 * reading JavaScript.
 *
 * It renders the live matrix, not a written-out copy of it. A hand-maintained
 * table would drift from the code within a week and then be worse than nothing.
 */

import { escapeHtml } from '../utils/format.js';
import {
  PERMISSION_MATRIX, ROLE_META, OVERRIDE_FLAGS,
  permissionRows, scopeLabel, DEMO_DISCLOSURE
} from '../auth/permissions.js';
import { TEAM } from '../auth/users.js';
import { ensureAuthStyles } from './SignInScreen.js';

const ROLE_ORDER = Object.keys(PERMISSION_MATRIX);

export class RolesMatrixScreen {
  /** @param {HTMLElement} containerElement */
  constructor(containerElement) {
    this.container = containerElement;
    this._handleClick = this._handleClick.bind(this);
    this.onClose = null;
  }

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
    if (typeof this.onClose === 'function') this.onClose();
  }

  headerRow() {
    return `
      <tr>
        <th scope="col">What</th>
        <th scope="col">Action</th>
        ${ROLE_ORDER.map(r =>
          `<th scope="col" style="text-align:center;">${escapeHtml(ROLE_META[r].short)}</th>`
        ).join('')}
      </tr>`;
  }

  bodyRows() {
    const rows = permissionRows();
    let lastGroup = null;
    const out = [];
    rows.forEach(row => {
      if (row.group !== lastGroup) {
        lastGroup = row.group;
        out.push(`<tr class="roles-group-row"><td colspan="${ROLE_ORDER.length + 2}">${escapeHtml(row.group)}</td></tr>`);
      }
      out.push(`
        <tr>
          <th scope="row" style="font-weight:500;">${escapeHtml(row.label)}</th>
          <td style="color:var(--text-muted);">${escapeHtml(row.action)}</td>
          ${ROLE_ORDER.map(role => {
            const scope = row.scopes[role];
            return `<td class="scope-cell"><span class="scope-tag" data-scope="${escapeHtml(scope)}">${escapeHtml(scopeLabel(scope))}</span></td>`;
          }).join('')}
        </tr>`);
    });
    return out.join('');
  }

  peopleRows() {
    return TEAM.map(u => {
      const meta = ROLE_META[u.role];
      const flags = Object.values(OVERRIDE_FLAGS)
        .filter(f => u[f.id])
        .map(f => `<span class="role-chip">${escapeHtml(f.label)}</span>`)
        .join(' ') || '<span style="color:var(--text-dim);">None</span>';
      return `
        <tr>
          <th scope="row" style="font-weight:500;">${escapeHtml(u.name)}</th>
          <td>${escapeHtml(u.title)}</td>
          <td><span class="role-chip" data-accent="${escapeHtml(meta.accent)}">${escapeHtml(meta.label)}</span></td>
          <td>${flags}</td>
        </tr>`;
    }).join('');
  }

  render() {
    this.container.innerHTML = `
      <section class="roles-screen" aria-labelledby="roles-title">
        <header style="display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;">
          <div>
            <h2 id="roles-title">Roles &amp; permissions</h2>
            <p class="roles-intro">
              Five roles across two axes: how much of the company's work you see
              (own → assigned → all) and how sensitive the data is (operational →
              contract value → cost and margin → invoices, receipts and exports).
              <strong>Own</strong> means deals where you are the sales owner.
              <strong>Assigned</strong> means events you are running or crewing.
              Anything not listed is denied.
            </p>
          </div>
          <button type="button" class="link-btn" data-action="close">Close</button>
        </header>

        <p class="helm-disclosure" style="max-width:80ch;">${escapeHtml(DEMO_DISCLOSURE)}
          This table describes what the interface shows each role — it is not a security
          boundary, and it will become server-side rules when a backend lands.</p>

        <div class="roles-table-wrap">
          <table class="roles-table">
            <caption class="sr-only">Permission matrix by role</caption>
            <thead>${this.headerRow()}</thead>
            <tbody>${this.bodyRows()}</tbody>
          </table>
        </div>

        <h3 style="margin:8px 0 0;font-size:var(--fs-lg);font-weight:600;">The two deliberate calls</h3>
        <ul class="roles-intro" style="margin:0;padding-left:20px;line-height:1.7;">
          <li><strong>Sales Manager sees rupees only on their own deals.</strong> Priya can watch the
              whole board because she has the "see every pipeline" flag — but that flag widens whose
              <em>work</em> she sees, never whose <em>money</em>. Cost and margin stay shut.</li>
          <li><strong>Event Manager sees contract value, never margin.</strong> Arjun needs the contract
              value to size the production and the vendor costs he is negotiating. Margin is the number
              that prices the company's own position, and it stays with the Director and Finance.</li>
        </ul>

        <h3 style="margin:8px 0 0;font-size:var(--fs-lg);font-weight:600;">This workspace's people</h3>
        <div class="roles-table-wrap">
          <table class="roles-table">
            <thead><tr>
              <th scope="col">Person</th><th scope="col">Title</th>
              <th scope="col">Role</th><th scope="col">Per-person overrides</th>
            </tr></thead>
            <tbody>${this.peopleRows()}</tbody>
          </table>
        </div>
      </section>`;
    this.container.addEventListener('click', this._handleClick);
  }

  _handleClick(event) {
    if (event.target.closest('[data-action="close"]')) this.close();
  }
}

export default RolesMatrixScreen;
