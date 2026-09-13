/**
 * EventDetailsPanel — the brief, in one place.
 *
 * Until now nothing in the UI let anyone say who the client is, how many guests
 * are coming, when the event runs, or what the budget is. Every downstream
 * screen invented its own answer, which is why the app shipped five different
 * guest counts. This panel is the single input surface for `eventState`; the
 * planning components subscribe to that store and re-render themselves.
 *
 * Styles are injected once from here rather than added to style.css, so this
 * component is self-contained. All colours come from the existing theme tokens,
 * so it follows light/dark like everything else.
 */

import { eventState, todayISO, addDaysISO, daysBetween, formatEventDate } from '../data/eventState.js';
import { formatMoney, formatNumber, escapeHtml } from '../utils/format.js';

const EVENT_TYPES = [
  ['wedding', 'Wedding / Mandap'],
  ['corporate', 'Corporate Summit'],
  ['political', 'Political Rally'],
  ['private', 'Private Celebration']
];

// States and union territories, for the GST place-of-supply rule.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu',
  'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
];

const STYLE_ID = 'helm-event-details-styles';

export class EventDetailsPanel {
  constructor(container, onSaved = null) {
    this.container = container;
    this.onSaved = onSaved;
    this.isOpen = false;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .edp-backdrop {
        position: fixed; inset: 0; z-index: 9500;
        display: flex; align-items: center; justify-content: center;
        padding: 24px; background: rgba(0,0,0,0.55);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      }
      .edp-panel {
        width: min(720px, 100%); max-height: min(86vh, 760px); overflow-y: auto;
        background: var(--bg-surface, #16161c); color: var(--text-main, #f5f5f7);
        border: 1px solid var(--border-soft, rgba(255,255,255,0.10));
        border-radius: var(--radius-lg, 22px);
        box-shadow: 0 30px 80px rgba(0,0,0,0.45);
        padding: 26px 28px 22px;
      }
      .edp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 4px; }
      .edp-head h2 { margin: 0; font-size: 1.15rem; font-weight: 650; letter-spacing: -0.01em; }
      .edp-head p { margin: 4px 0 0; font-size: 0.8rem; color: var(--text-dim, #8b8b93); max-width: 46ch; }
      .edp-close {
        flex: 0 0 auto; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
        border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
        background: transparent; color: inherit; font-size: 1rem; line-height: 1;
      }
      .edp-close:hover { background: var(--bg-elevated, rgba(255,255,255,0.06)); }
      .edp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 18px; margin-top: 20px; }
      .edp-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
      .edp-field.edp-wide { grid-column: 1 / -1; }
      .edp-field label { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; color: var(--text-dim, #8b8b93); }
      .edp-field input, .edp-field select {
        width: 100%; box-sizing: border-box; font: inherit; font-size: 0.88rem;
        padding: 10px 12px; border-radius: var(--radius-sm, 10px);
        background: var(--bg-elevated, rgba(255,255,255,0.05));
        color: var(--text-main, #f5f5f7);
        border: 1px solid var(--border-soft, rgba(255,255,255,0.12));
      }
      .edp-field input:focus-visible, .edp-field select:focus-visible {
        outline: 2px solid var(--accent-gold, #e5a93b); outline-offset: 1px;
      }
      .edp-hint { font-size: 0.72rem; color: var(--text-dim, #8b8b93); }
      .edp-error { font-size: 0.72rem; color: #ff6b6b; }
      .edp-field[data-invalid="1"] input { border-color: #ff6b6b; }
      .edp-derived {
        margin-top: 20px; padding: 14px 16px; border-radius: var(--radius-md, 14px);
        background: var(--bg-elevated, rgba(255,255,255,0.05));
        border: 1px solid var(--border-soft, rgba(255,255,255,0.10));
        display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px;
      }
      .edp-derived div { min-width: 0; }
      .edp-derived dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-dim, #8b8b93); margin: 0 0 3px; }
      .edp-derived dd { margin: 0; font-size: 0.95rem; font-weight: 650; }
      .edp-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
      .edp-btn {
        font: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer;
        padding: 10px 20px; border-radius: 999px; border: 1px solid transparent;
      }
      .edp-btn-ghost { background: transparent; color: var(--text-main, #f5f5f7); border-color: var(--border-soft, rgba(255,255,255,0.14)); }
      .edp-btn-primary { background: var(--accent-gold, #e5a93b); color: #1d1d1f; }
      .edp-btn:focus-visible { outline: 2px solid var(--accent-gold, #e5a93b); outline-offset: 2px; }
      @media (max-width: 560px) {
        .edp-grid { grid-template-columns: 1fr; }
        .edp-panel { padding: 20px 18px 18px; }
      }
    `;
    document.head.appendChild(style);
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this._previousFocus = document.activeElement;

    const s = eventState.get();
    // Seed sensible dates on first open rather than presenting empty fields.
    const startDate = s.startDate || todayISO();
    const endDate = s.endDate || addDaysISO(startDate, 2);

    this.container.innerHTML = this._template({ ...s, startDate, endDate });
    this._bind();

    const first = this.container.querySelector('#edpEventName');
    if (first) first.focus();
  }

  _template(s) {
    const stateOptions = INDIAN_STATES
      .map(st => `<option value="${escapeHtml(st)}"${st === s.clientState ? ' selected' : ''}>${escapeHtml(st)}</option>`)
      .join('');
    const typeOptions = EVENT_TYPES
      .map(([v, label]) => `<option value="${v}"${v === s.eventType ? ' selected' : ''}>${escapeHtml(label)}</option>`)
      .join('');

    return `
      <div class="edp-backdrop" data-edp-backdrop>
        <div class="edp-panel" role="dialog" aria-modal="true" aria-labelledby="edpTitle">
          <div class="edp-head">
            <div>
              <h2 id="edpTitle">Event details</h2>
              <p>Guest count drives table and seating capacity, dates drive the timeline,
                 and the billing state decides whether GST is charged as CGST + SGST or IGST.</p>
            </div>
            <button type="button" class="edp-close" data-edp-close aria-label="Close event details">✕</button>
          </div>

          <form class="edp-grid" id="edpForm" novalidate>
            <div class="edp-field edp-wide">
              <label for="edpEventName">Event name</label>
              <input id="edpEventName" name="eventName" type="text" value="${escapeHtml(s.eventName)}"
                     placeholder="Aditi &amp; Rohan — Wedding Weekend" />
            </div>

            <div class="edp-field">
              <label for="edpEventType">Event type</label>
              <select id="edpEventType" name="eventType">${typeOptions}</select>
            </div>

            <div class="edp-field">
              <label for="edpVenue">Venue</label>
              <input id="edpVenue" name="venue" type="text" value="${escapeHtml(s.venue)}" placeholder="Falaknuma Grounds" />
            </div>

            <div class="edp-field">
              <label for="edpClientName">Client name</label>
              <input id="edpClientName" name="clientName" type="text" value="${escapeHtml(s.clientName)}" placeholder="Aditi Rao" />
            </div>

            <div class="edp-field">
              <label for="edpClientPhone">Client phone</label>
              <input id="edpClientPhone" name="clientPhone" type="tel" inputmode="tel"
                     value="${escapeHtml(s.clientPhone)}" placeholder="+91 98490 00000" />
            </div>

            <div class="edp-field">
              <label for="edpStartDate">Start date</label>
              <input id="edpStartDate" name="startDate" type="date" value="${escapeHtml(s.startDate)}" />
            </div>

            <div class="edp-field" id="edpEndField">
              <label for="edpEndDate">End date</label>
              <input id="edpEndDate" name="endDate" type="date" value="${escapeHtml(s.endDate)}" />
              <span class="edp-error" id="edpEndError" hidden>End date cannot be before the start date.</span>
            </div>

            <div class="edp-field" id="edpGuestField">
              <label for="edpGuestCount">Guest count</label>
              <input id="edpGuestCount" name="guestCount" type="number" min="1" max="100000" step="1"
                     value="${Number(s.guestCount) || 250}" />
              <span class="edp-error" id="edpGuestError" hidden>Enter a guest count of at least 1.</span>
            </div>

            <div class="edp-field">
              <label for="edpBudget">Budget target (₹)</label>
              <input id="edpBudget" name="budgetTarget" type="number" min="0" step="1000"
                     value="${Number(s.budgetTarget) || 0}" />
              <span class="edp-hint">0 means no target set.</span>
            </div>

            <div class="edp-field edp-wide">
              <label for="edpClientState">Billing state (GST place of supply)</label>
              <select id="edpClientState" name="clientState">${stateOptions}</select>
            </div>
          </form>

          <dl class="edp-derived" id="edpDerived"></dl>

          <div class="edp-actions">
            <button type="button" class="edp-btn edp-btn-ghost" data-edp-close>Cancel</button>
            <button type="button" class="edp-btn edp-btn-primary" id="edpSave">Save details</button>
          </div>
        </div>
      </div>`;
  }

  _bind() {
    const panel = this.container.querySelector('.edp-panel');
    const form = this.container.querySelector('#edpForm');

    this.container.querySelectorAll('[data-edp-close]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    this.container.querySelector('[data-edp-backdrop]')?.addEventListener('mousedown', (e) => {
      if (e.target === e.currentTarget) this.close();
    });

    form.addEventListener('input', () => this._renderDerived());
    form.addEventListener('submit', (e) => e.preventDefault());
    this.container.querySelector('#edpSave').addEventListener('click', () => this._save());

    // Keep focus inside the dialog while it is open.
    panel.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusables = panel.querySelectorAll(
        'button, input, select, textarea, [href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    this._renderDerived();
  }

  /** Read the form without saving. Returns raw values plus validity. */
  _read() {
    const form = this.container.querySelector('#edpForm');
    if (!form) return null;
    const data = Object.fromEntries(new FormData(form).entries());
    const guestCount = Math.floor(Number(data.guestCount));
    const budgetTarget = Math.max(0, Math.round(Number(data.budgetTarget) || 0));

    const guestValid = Number.isFinite(guestCount) && guestCount >= 1;
    const datesValid = !data.startDate || !data.endDate || data.endDate >= data.startDate;

    return {
      values: {
        eventName: String(data.eventName || '').trim() || 'Untitled Event',
        eventType: data.eventType,
        clientName: String(data.clientName || '').trim(),
        clientPhone: String(data.clientPhone || '').trim(),
        clientState: data.clientState,
        venue: String(data.venue || '').trim() || 'Main Venue',
        startDate: data.startDate,
        endDate: data.endDate,
        guestCount: guestValid ? guestCount : 0,
        budgetTarget
      },
      guestValid,
      datesValid
    };
  }

  /**
   * Show what the entered numbers actually produce. This is the point of the
   * panel: the planner sees capacity and per-head cost move as they type.
   */
  _renderDerived() {
    const read = this._read();
    const target = this.container.querySelector('#edpDerived');
    if (!read || !target) return;
    const { values, guestValid, datesValid } = read;

    const guestField = this.container.querySelector('#edpGuestField');
    const guestError = this.container.querySelector('#edpGuestError');
    if (guestField) guestField.dataset.invalid = guestValid ? '0' : '1';
    if (guestError) guestError.hidden = guestValid;

    const endField = this.container.querySelector('#edpEndField');
    const endError = this.container.querySelector('#edpEndError');
    if (endField) endField.dataset.invalid = datesValid ? '0' : '1';
    if (endError) endError.hidden = datesValid;

    const guests = guestValid ? values.guestCount : 0;
    const SEATS_PER_TABLE = 10;
    const tables = guests ? Math.ceil(guests / SEATS_PER_TABLE) : 0;
    const days = values.startDate && values.endDate && datesValid
      ? daysBetween(values.startDate, values.endDate)
      : 1;
    const perGuest = guests && values.budgetTarget ? Math.round(values.budgetTarget / guests) : 0;

    target.innerHTML = `
      <div><dt>Guests</dt><dd>${guests ? formatNumber(guests) : '—'}</dd></div>
      <div><dt>Tables at ${SEATS_PER_TABLE}/table</dt><dd>${tables || '—'}</dd></div>
      <div><dt>Event length</dt><dd>${days} ${days === 1 ? 'day' : 'days'}</dd></div>
      <div><dt>Budget per guest</dt><dd>${perGuest ? formatMoney(perGuest) : '—'}</dd></div>
      <div><dt>GST treatment</dt><dd>${values.clientState === 'Telangana' ? 'CGST + SGST' : 'IGST'}</dd></div>
      <div><dt>Starts</dt><dd>${values.startDate ? escapeHtml(formatEventDate(values.startDate)) : '—'}</dd></div>`;
  }

  _save() {
    const read = this._read();
    if (!read) return;
    if (!read.guestValid || !read.datesValid) {
      this._renderDerived();
      const bad = this.container.querySelector('[data-invalid="1"] input');
      if (bad) bad.focus();
      return;
    }
    eventState.set(read.values, { source: 'EventDetailsPanel' });
    this.close();
    if (typeof this.onSaved === 'function') this.onSaved(read.values);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.innerHTML = '';
    if (this._previousFocus && document.contains(this._previousFocus)) {
      this._previousFocus.focus();
    }
    this._previousFocus = null;
  }
}
