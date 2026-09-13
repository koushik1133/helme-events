/**
 * EventOverview.js — one event, all of it, and the doors into the tools.
 *
 * The picture of the venue first, then the facts beside it, then the actions
 * that take this event into the existing tools. Nothing on this screen is
 * decorative: every row is something a producer has to know on the day.
 *
 *   const view = new EventOverview(container, dealId, {
 *     store, finance, session, can,
 *     onBack,                     // () => void
 *     onAction                    // (kind, dealId, context) => void
 *   });
 *   view.render();
 *   view.destroy();               // MUST be called on teardown
 *
 * `onAction` kinds: 'studio360' | 'floorplan' | 'runsheet' | 'payments' | 'client'.
 * The 'studio360' call also receives `{ zoneId }` — the venue zone whose
 * panorama is this event's hero, so the 360° view opens on the right place
 * instead of a generic aerial map.
 *
 * Money is gated per deal through `can(user, 'view', 'money.value', deal)`;
 * cost and margin each need their own grant. A Crew user sees no rupees.
 */

import { escapeHtml, formatMoney, formatNumber } from '../../utils/format.js';
import { injectEventsStyles } from './eventsStyles.js';
import {
  buildEventsModel, heroZoneFor, clientName, dealValue,
  dateRangeLabel, countdownLabel, venueLabel, guestCountFor, functionsFor,
  stageText, stageTone, CATEGORY_LABEL, financialsFor
} from './eventsData.js';
import { parseISODate } from '../../data/eventState.js';

const ARROW = '<span class="ev-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></span>';
const BACK = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/** The doors out of this screen, in the order a producer actually uses them. */
const ACTIONS = [
  { kind: 'studio360', label: 'Open 360° studio', hint: 'Design this venue in the round', primary: true },
  { kind: 'floorplan', label: 'Open floor plan', hint: 'Tables, seating and flow' },
  { kind: 'runsheet', label: 'Open run sheet', hint: 'The plan, function by function' },
  { kind: 'payments', label: 'Open payments', hint: 'Schedule, receipts and balance', money: true },
  { kind: 'client', label: 'Open client record', hint: 'Contacts, billing and history' }
];

export class EventOverview {
  constructor(container, dealId, options = {}) {
    this.container = container;
    this.dealId = dealId;
    this.options = options;
    this.onBack = typeof options.onBack === 'function' ? options.onBack : () => {};
    this.onAction = typeof options.onAction === 'function' ? options.onAction : () => {};
    this.unsubscribe = null;
    this.handleClick = this.handleClick.bind(this);
  }

  model() {
    return buildEventsModel({
      store: this.options.store,
      finance: this.options.finance,
      session: this.options.session,
      can: this.options.can
    });
  }

  /* ------------------------------------------------------------ render */

  render() {
    injectEventsStyles();
    if (!this.container) return this;

    const model = this.model();
    const deal = model.dealById.get(this.dealId) || null;

    this.container.innerHTML = deal
      ? this.overviewHtml(model, deal)
      : this.missingHtml();

    this.bind();
    return this;
  }

  missingHtml() {
    return `
      <div class="ev" data-overview-root>
        <button type="button" class="ev-btn ev-btn--quiet ev-back" data-back>${BACK} All events</button>
        <div class="ev-empty">
          <h2>That event is not here</h2>
          <p>It may have been removed, or it belongs to someone else's book. Go back to the events list and pick one from there.</p>
          <button type="button" class="ev-btn" data-back>Back to events</button>
        </div>
      </div>`;
  }

  overviewHtml(model, deal) {
    const zone = heroZoneFor(deal);
    const image = (zone && (zone.panoramaUrl || zone.thumbnailUrl)) || '';
    const showMoney = model.canMoney(deal);
    const client = model.clientById.get(deal.clientId) || null;
    const when = countdownLabel(deal, model.today);

    return `
      <div class="ev" data-overview-root>
        <button type="button" class="ev-btn ev-btn--quiet ev-back" data-back>${BACK} All events</button>

        <section class="ev-hero">
          ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(venueLabel(deal))}" decoding="async">` : ''}
          <div class="ev-hero-chips">
            <span class="ev-chip ev-chip--onmedia">${escapeHtml(CATEGORY_LABEL[deal.category] || 'Event')}</span>
            <span class="ev-chip ev-chip--${stageTone(deal)}">${escapeHtml(stageText(deal.stage))}</span>
            ${when ? `<span class="ev-chip ev-chip--onmedia">${escapeHtml(when)}</span>` : ''}
          </div>
          <div class="ev-hero-text">
            <h1>${escapeHtml(deal.title || 'Untitled event')}</h1>
            <span class="ev-hero-sub">${escapeHtml(clientName(model, deal))} · ${escapeHtml(venueLabel(deal))} · ${escapeHtml(dateRangeLabel(deal))}</span>
          </div>
        </section>

        <div class="ev-cols">
          <div class="ev-stack">
            ${this.factsHtml(model, deal)}
            ${this.runOfShowHtml(model, deal, showMoney)}
            ${this.moneyHtml(model, deal, showMoney)}
          </div>
          <div class="ev-stack">
            ${this.actionsHtml(model, deal, zone, showMoney)}
            ${this.contactsHtml(client)}
          </div>
        </div>
      </div>`;
  }

  factsHtml(model, deal) {
    const guests = guestCountFor(deal);
    const fns = functionsFor(deal);
    const venue = deal.venue || {};
    const rows = [
      ['Client', escapeHtml(clientName(model, deal)), deal.code ? `<small>${escapeHtml(deal.code)}</small>` : ''],
      ['Dates', escapeHtml(dateRangeLabel(deal)), fns.length ? `<small>${formatNumber(fns.length)} function${fns.length === 1 ? '' : 's'}</small>` : ''],
      ['Venue', escapeHtml(venue.name || 'Not set'), venue.city ? `<small>${escapeHtml([venue.city, venue.state].filter(Boolean).join(', '))}</small>` : ''],
      ['Guests', guests ? `${formatNumber(guests)}` : 'To be confirmed', deal.guestCountConfirmed ? '<small>Confirmed</small>' : (guests ? '<small>Indicative</small>' : '')],
      ['Stage', escapeHtml(stageText(deal.stage)), deal.stageChangedAt ? `<small>since ${escapeHtml(this.dayLabel(deal.stageChangedAt))}</small>` : ''],
      ['Category', escapeHtml(CATEGORY_LABEL[deal.category] || '—'), deal.subType ? `<small>${escapeHtml(String(deal.subType).replace(/_/g, ' '))}</small>` : '']
    ];
    return `
      <section class="ev-panel">
        <div class="ev-panel-head"><h2>Event details</h2></div>
        <dl class="ev-facts">
          ${rows.map(([k, v, extra]) => `
            <div class="ev-fact"><dt>${escapeHtml(k)}</dt><dd class="ev-num">${v}${extra || ''}</dd></div>
          `).join('')}
        </dl>
      </section>`;
  }

  dayLabel(iso) {
    const d = parseISODate(iso);
    if (!d) return String(iso || '');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  runOfShowHtml(model, deal, showMoney) {
    const fns = functionsFor(deal);
    if (!fns.length) {
      return `
        <section class="ev-panel">
          <div class="ev-panel-head"><h2>Run of show</h2></div>
          <p class="ev-locked">No functions have been added to this event yet. Open the run sheet to lay out the days — for a wedding that is mehendi, haldi, sangeet, wedding and reception, each with its own guests and its own venue.</p>
          <button type="button" class="ev-btn" data-action="runsheet">Open run sheet</button>
        </section>`;
    }
    return `
      <section class="ev-panel">
        <div class="ev-panel-head">
          <h2>Run of show</h2>
          <span class="ev-note">${formatNumber(fns.length)} function${fns.length === 1 ? '' : 's'}</span>
        </div>
        <div class="ev-runs">
          ${fns.map(f => {
            const d = parseISODate(f.date);
            const guests = Number(f.guestCount) || 0;
            const value = Math.round(Number(f.quotedValue) || 0);
            return `
              <div class="ev-run">
                <span class="ev-run-date ev-num">
                  ${d ? escapeHtml(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : '—'}
                  <small>${d ? escapeHtml(d.toLocaleDateString('en-IN', { weekday: 'short' })) : ''}</small>
                </span>
                <span class="ev-run-what">
                  ${escapeHtml(f.label || 'Function')}
                  <small>${escapeHtml([
                    (f.startTime && f.endTime) ? `${f.startTime}–${f.endTime}` : '',
                    f.venue || '',
                    guests ? `${formatNumber(guests)} guests` : ''
                  ].filter(Boolean).join(' · ') || 'Timing to be set')}</small>
                </span>
                <span class="ev-run-side ev-num">${showMoney && value ? escapeHtml(formatMoney(value)) : ''}</span>
              </div>`;
          }).join('')}
        </div>
        <button type="button" class="ev-btn" data-action="runsheet">Open run sheet</button>
      </section>`;
  }

  moneyHtml(model, deal, showMoney) {
    if (!showMoney) {
      return `
        <section class="ev-panel">
          <div class="ev-panel-head"><h2>Money</h2></div>
          <p class="ev-locked">Contract values, payments and margins on this event are not part of your access. Everything else on this page — the plan, the floor, the 360° view — is yours to work with.</p>
        </section>`;
    }
    const fin = financialsFor(model, deal);
    const net = fin ? fin.net : dealValue(deal);
    const gross = fin ? fin.contractGross : Math.round(net * 1.18);
    const received = fin ? fin.settledValue : 0;
    const outstanding = fin ? fin.outstanding : gross;
    const pct = fin ? fin.collectionPct : 0;
    const overdue = fin ? fin.overdue : 0;
    const next = fin && fin.nextDue ? fin.nextDue : null;
    const showMargin = model.canMargin(deal) && fin && fin.margin !== null;

    return `
      <section class="ev-panel">
        <div class="ev-panel-head">
          <h2>Money</h2>
          <span class="ev-note">${fin ? escapeHtml(fin.gstMode === 'igst' ? 'IGST · inter-state' : 'CGST + SGST · intra-state') : 'Contract'}</span>
        </div>
        <dl class="ev-money">
          <div class="ev-money-cell">
            <dt>Contract value</dt>
            <dd class="ev-num">${escapeHtml(formatMoney(net))}<small>${escapeHtml(formatMoney(gross))} incl. GST</small></dd>
          </div>
          <div class="ev-money-cell">
            <dt>Received</dt>
            <dd class="ev-num">${escapeHtml(formatMoney(received))}<small>${formatNumber(pct)}% of the contract</small></dd>
          </div>
          <div class="ev-money-cell${overdue > 0 ? ' ev-money-cell--overdue' : ''}">
            <dt>${overdue > 0 ? 'Overdue' : 'Outstanding'}</dt>
            <dd class="ev-num">${escapeHtml(formatMoney(overdue > 0 ? overdue : outstanding))}<small>${next
              ? `Next: ${escapeHtml(next.label)} on ${escapeHtml(this.dayLabel(next.dueDate))}`
              : (outstanding ? 'No milestone dated yet' : 'Fully settled')}</small></dd>
          </div>
          ${showMargin ? `
          <div class="ev-money-cell">
            <dt>Margin</dt>
            <dd class="ev-num">${escapeHtml(formatMoney(fin.margin))}<small>${formatNumber(fin.marginPct || 0)}% of net</small></dd>
          </div>` : ''}
        </dl>
        <div class="ev-bar" role="img" aria-label="${formatNumber(pct)} percent collected">
          <i style="width:${Math.max(0, Math.min(100, pct))}%"></i>
        </div>
        <button type="button" class="ev-btn" data-action="payments">Open payments</button>
      </section>`;
  }

  actionsHtml(model, deal, zone, showMoney) {
    const list = ACTIONS.filter(a => !a.money || showMoney);
    return `
      <section class="ev-panel">
        <div class="ev-panel-head">
          <h2>Work on this event</h2>
          ${zone ? `<span class="ev-note">${escapeHtml(String(zone.name).replace(/[^\x20-\x7E–—’]/g, '').trim())}</span>` : ''}
        </div>
        <div class="ev-actions">
          ${list.map(a => `
            <button type="button" class="ev-action${a.primary ? ' ev-action--primary' : ''}" data-action="${a.kind}">
              <span><strong>${escapeHtml(a.label)}</strong><small>${escapeHtml(a.hint)}</small></span>
              ${ARROW}
            </button>`).join('')}
        </div>
      </section>`;
  }

  contactsHtml(client) {
    if (!client) {
      return `
        <section class="ev-panel">
          <div class="ev-panel-head"><h2>Contacts</h2></div>
          <p class="ev-locked">This event is not linked to a client record yet, so there is nobody to call. Link it from the client list.</p>
        </section>`;
    }
    const people = [client.primaryContact, ...(Array.isArray(client.altContacts) ? client.altContacts : [])]
      .filter(p => p && (p.name || p.phone || p.email));
    return `
      <section class="ev-panel">
        <div class="ev-panel-head"><h2>Contacts</h2><span class="ev-note">${escapeHtml(client.name || '')}</span></div>
        ${people.length ? `
        <div class="ev-contact">
          ${people.map(p => `
            <div class="ev-contact-row">
              <strong>${escapeHtml(p.name || 'Unnamed contact')}</strong>
              <small>${escapeHtml(p.role || '')}</small>
              ${p.phone ? `<small><a href="tel:${escapeHtml(String(p.phone).replace(/\s+/g, ''))}">${escapeHtml(p.phone)}</a></small>` : ''}
              ${p.email ? `<small><a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></small>` : ''}
            </div>`).join('')}
        </div>` : '<p class="ev-locked">No contact details recorded against this client yet.</p>'}
        <button type="button" class="ev-btn" data-action="client">Open client record</button>
      </section>`;
  }

  /* ------------------------------------------------------------- events */

  bind() {
    const root = this.container.querySelector('[data-overview-root]');
    if (!root) return;
    this.root = root;
    root.addEventListener('click', this.handleClick);
    if (!this.unsubscribe && this.options.store && typeof this.options.store.subscribe === 'function') {
      this.unsubscribe = this.options.store.subscribe(() => this.render());
    }
  }

  handleClick(event) {
    if (event.target.closest('[data-back]')) { this.onBack(); return; }
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const kind = btn.getAttribute('data-action');
    const model = this.model();
    const deal = model.dealById.get(this.dealId) || null;
    const zone = deal ? heroZoneFor(deal) : null;
    this.onAction(kind, this.dealId, {
      deal,
      zoneId: zone ? zone.id : null,
      clientId: deal ? deal.clientId : null
    });
  }

  destroy() {
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
    if (this.root) { this.root.removeEventListener('click', this.handleClick); this.root = null; }
    if (this.container) this.container.innerHTML = '';
  }
}

export default EventOverview;
