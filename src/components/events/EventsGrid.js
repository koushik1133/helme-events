/**
 * EventsGrid.js — every event in the business, as a card you can walk into.
 *
 * This is the front door to the design tools. Before it existed the Studio
 * opened on a generic aerial venue map that belonged to no event; now the
 * work starts from the event, and the tools open scoped to it.
 *
 *   const grid = new EventsGrid(container, {
 *     store,            // crmStore
 *     finance,          // optional, src/crm/finance.js
 *     session,          // { getUser() } or { getCurrentUser() }
 *     can,              // can(user, action, resource, record) from src/auth/permissions.js
 *     onOpenEvent       // (dealId) => void
 *   });
 *   grid.render();
 *   grid.destroy();     // MUST be called on teardown — it unsubscribes from the store
 *
 * Money: every rupee on this screen is gated through
 * `can(user, 'view', 'money.value', deal)`. A Crew user holds no money grant,
 * so the value line is replaced with an honest "Restricted" rather than a zero.
 */

import { escapeHtml, formatMoney, formatNumber } from '../../utils/format.js';
import { injectEventsStyles } from './eventsStyles.js';
import {
  buildEventsModel, heroImageFor, clientName, dealValue,
  dateRangeLabel, countdownLabel, venueLabel, guestCountFor,
  stageText, stageTone, CATEGORY_LABEL,
  FILTERS, SORTS, matchesFilter, matchesQuery, sortDeals
} from './eventsData.js';


export class EventsGrid {
  constructor(container, options = {}) {
    this.container = container;
    this.options = options;
    this.onOpenEvent = typeof options.onOpenEvent === 'function' ? options.onOpenEvent : () => {};
    this.state = {
      filter: FILTERS.some(f => f.id === options.initialFilter) ? options.initialFilter : 'upcoming',
      sort: 'date',
      query: ''
    };
    this.unsubscribe = null;
    this.handleClick = this.handleClick.bind(this);
    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleInput = this.handleInput.bind(this);
    this.handleChange = this.handleChange.bind(this);
  }

  /* ------------------------------------------------------------- model */

  model() {
    return buildEventsModel({
      store: this.options.store,
      finance: this.options.finance,
      session: this.options.session,
      can: this.options.can
    });
  }

  /** Deals this user may see at all, before filter/search. */
  visibleDeals(model) {
    return model.deals.filter(d => !!d && !!d.id);
  }

  /* ------------------------------------------------------------ render */

  render() {
    injectEventsStyles();
    if (!this.container) return this;

    const model = this.model();
    const all = this.visibleDeals(model);
    const counts = {};
    FILTERS.forEach(f => { counts[f.id] = all.filter(d => matchesFilter(d, f.id, model.today)).length; });

    const rows = sortDeals(
      model,
      all.filter(d => matchesFilter(d, this.state.filter, model.today) && matchesQuery(model, d, this.state.query)),
      this.state.sort
    );

    const anyMoney = all.some(d => model.canMoney(d));
    const sorts = SORTS.filter(s => !s.money || anyMoney);

    this.container.innerHTML = `
      <div class="ev" data-events-root>
        <header class="ev-head">
          <div>
            <h1>Events</h1>
            <p>${model.connected
              ? `${formatNumber(all.length)} event${all.length === 1 ? '' : 's'} in the book · pick one to open its plan, its floor and its 360° view`
              : 'No CRM connected — nothing to show yet'}</p>
          </div>
        </header>

        <div class="ev-toolbar" role="group" aria-label="Filter and sort events">
          <div class="ev-segs">
            ${FILTERS.map(f => `
              <button type="button" class="ev-seg" data-filter="${f.id}"
                      aria-pressed="${this.state.filter === f.id}">
                ${escapeHtml(f.label)}<span class="ev-seg-n">${formatNumber(counts[f.id] || 0)}</span>
              </button>`).join('')}
          </div>
          <span class="ev-spacer"></span>
          <div class="ev-search">
            <label class="sr-only" for="ev-search-input">Search events</label>
            <input id="ev-search-input" type="search" placeholder="Search client, venue, event…"
                   value="${escapeHtml(this.state.query)}" autocomplete="off">
          </div>
          <div class="ev-field">
            <label for="ev-sort-select">Sort</label>
            <select id="ev-sort-select" class="ev-select">
              ${sorts.map(s => `<option value="${s.id}"${this.state.sort === s.id ? ' selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
            </select>
          </div>
        </div>

        ${rows.length
          ? `<div class="ev-grid">${rows.map(d => this.cardHtml(model, d)).join('')}</div>`
          : this.emptyHtml(model, all.length)}
      </div>
    `;

    this.bind();
    return this;
  }

  cardHtml(model, deal) {
    const image = heroImageFor(deal);
    const guests = guestCountFor(deal);
    const showMoney = model.canMoney(deal);
    const value = dealValue(deal);
    const when = countdownLabel(deal, model.today);
    const label = `${clientName(model, deal)} — ${deal.title || 'Untitled event'}`;

    return `
      <article class="ev-card" role="button" tabindex="0" data-deal="${escapeHtml(deal.id)}"
               aria-label="Open ${escapeHtml(label)}">
        <div class="ev-card-media">
          ${image ? `<img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async">` : ''}
          <div class="ev-chip-row">
            <span class="ev-chip ev-chip--onmedia">${escapeHtml(CATEGORY_LABEL[deal.category] || 'Event')}</span>
            <span class="ev-chip ev-chip--${stageTone(deal)}">${escapeHtml(stageText(deal.stage))}</span>
          </div>
          ${when ? `<span class="ev-card-when">${escapeHtml(when)}</span>` : ''}
        </div>
        <div class="ev-card-body">
          <span class="ev-overline">${escapeHtml(clientName(model, deal))}</span>
          <h3>${escapeHtml(deal.title || 'Untitled event')}</h3>
          <div class="ev-meta">
            <span class="ev-num">${escapeHtml(dateRangeLabel(deal))}</span>
            <span>${escapeHtml(venueLabel(deal))}</span>
            <span class="ev-num">${guests ? `${formatNumber(guests)} guests` : 'Guest count to be confirmed'}</span>
          </div>
        </div>
        <div class="ev-card-foot">
          <span class="ev-amount-label">${showMoney ? 'Contract value' : 'Reference'}</span>
          <span class="ev-amount ev-num">${showMoney
            ? escapeHtml(formatMoney(value))
            : escapeHtml(deal.code || '—')}</span>
        </div>
      </article>
    `;
  }

  emptyHtml(model, total) {
    if (!model.connected) {
      return `<div class="ev-empty">
        <h2>No events yet</h2>
        <p>This workspace is not reading from the CRM, so there is nothing to list. Once clients and deals exist, every event shows up here with its venue, dates and plan.</p>
      </div>`;
    }
    if (!total) {
      return `<div class="ev-empty">
        <h2>No events yet</h2>
        <p>Events appear here the moment an enquiry is logged in Clients. Each one carries its own venue, run of show, floor plan and 360° view.</p>
      </div>`;
    }
    const label = (FILTERS.find(f => f.id === this.state.filter) || {}).label || 'this view';
    return `<div class="ev-empty">
      <h2>Nothing in ${escapeHtml(label)}</h2>
      <p>${this.state.query
        ? `No event matches “${escapeHtml(this.state.query)}” here. Try another spelling, or switch to All events.`
        : 'Nothing sits in this view right now. Switch to All events to see the whole book.'}</p>
      <button type="button" class="ev-btn" data-filter="all">Show all events</button>
    </div>`;
  }

  /* ------------------------------------------------------------- events */

  bind() {
    const root = this.container.querySelector('[data-events-root]');
    if (!root) return;
    this.root = root;
    root.addEventListener('click', this.handleClick);
    root.addEventListener('keydown', this.handleKeydown);
    const search = root.querySelector('#ev-search-input');
    if (search) search.addEventListener('input', this.handleInput);
    const sort = root.querySelector('#ev-sort-select');
    if (sort) sort.addEventListener('change', this.handleChange);

    if (!this.unsubscribe && this.options.store && typeof this.options.store.subscribe === 'function') {
      this.unsubscribe = this.options.store.subscribe(() => this.render());
    }
  }

  handleClick(event) {
    const filterBtn = event.target.closest('[data-filter]');
    if (filterBtn) {
      this.state.filter = filterBtn.getAttribute('data-filter');
      this.render();
      const active = this.container.querySelector(`.ev-seg[data-filter="${this.state.filter}"]`);
      if (active) active.focus();
      return;
    }
    const card = event.target.closest('[data-deal]');
    if (card) this.onOpenEvent(card.getAttribute('data-deal'));
  }

  handleKeydown(event) {
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return;
    const card = event.target.closest('.ev-card[data-deal]');
    if (!card) return;
    event.preventDefault();
    this.onOpenEvent(card.getAttribute('data-deal'));
  }

  handleInput(event) {
    this.state.query = event.target.value;
    const caret = event.target.selectionStart;
    this.render();
    const input = this.container.querySelector('#ev-search-input');
    if (input) { input.focus(); try { input.setSelectionRange(caret, caret); } catch { /* search inputs */ } }
  }

  handleChange(event) {
    this.state.sort = event.target.value;
    this.render();
    const sel = this.container.querySelector('#ev-sort-select');
    if (sel) sel.focus();
  }

  destroy() {
    if (this.unsubscribe) { this.unsubscribe(); this.unsubscribe = null; }
    if (this.root) {
      this.root.removeEventListener('click', this.handleClick);
      this.root.removeEventListener('keydown', this.handleKeydown);
      this.root = null;
    }
    if (this.container) this.container.innerHTML = '';
  }
}

export default EventsGrid;
