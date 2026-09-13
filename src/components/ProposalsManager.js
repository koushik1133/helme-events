import { formatMoney, escapeHtml, readJSON, writeJSON } from '../utils/format.js';
import {
  buildQuote,
  getBasket,
  applyBasket,
  subscribeBasket,
  renderInvoiceDocument,
  getOrCreateDocNumber,
  printHtmlDocument,
  formatDocDate
} from '../utils/quote.js';
import { eventState, zonesInScope } from '../data/eventState.js';
import { VENUE_ZONES } from '../data/zones.js';

const PROPOSALS_KEY = 'event360_proposals';
const MAX_PROPOSALS = 40;

export class ProposalsManager {
  constructor(containerElement, activeSelections, onLoadProposal) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onLoadProposal = onLoadProposal;
    this.isFormOpen = false;
    this.formError = '';

    const stored = readJSON(PROPOSALS_KEY, []);
    this.proposals = Array.isArray(stored) ? stored.filter(p => p && typeof p === 'object') : [];

    if (this.proposals.length === 0) {
      // Seed proposals derive their totals from their own selections — no invented numbers.
      this.proposals = [
        this.buildProposal({
          id: 'prop-seed-rally',
          title: 'Grand Election Rally Jansabha 2026 — Mumbai',
          client: 'National Campaign Committee',
          date: '2026-08-15',
          selections: { ...activeSelections }
        }),
        this.buildProposal({
          id: 'prop-seed-wedding',
          title: 'Royal Destination Wedding Sangeet & Mandap',
          client: 'Royal Palace Events Pvt Ltd',
          date: '2026-11-20',
          selections: { ...activeSelections }
        })
      ];
      this.persist();
    }

    this.unsubscribeBasket = subscribeBasket(() => this.render());
    this.unsubscribeEvent = eventState.subscribe((snap, changed) => {
      if (changed.includes('guestCount') || changed.includes('eventType')) this.render();
    });

    this.render();
  }

  destroy() {
    if (this.unsubscribeBasket) this.unsubscribeBasket();
    if (this.unsubscribeEvent) this.unsubscribeEvent();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.render();
  }

  persist() {
    this.proposals = this.proposals.slice(0, MAX_PROPOSALS);
    writeJSON(PROPOSALS_KEY, this.proposals);
  }

  /**
   * A proposal's total is always computed from its own selections — and from
   * the basket and guest count it was saved with, so loading it back reproduces
   * the exact price the client was shown.
   */
  buildProposal({ id, title, client, date, selections, basket, guestCount, eventType, zoneIds }) {
    const ev = eventState.get();
    const snapshot = {
      id,
      title,
      client,
      date,
      selections: { ...(selections || {}) },
      basket: basket || getBasket(),
      guestCount: Number(guestCount) > 0 ? Math.round(Number(guestCount)) : ev.guestCount,
      eventType: eventType || ev.eventType,
      zoneIds: Array.isArray(zoneIds) && zoneIds.length
        ? zoneIds
        : zonesInScope(VENUE_ZONES.map(z => z.id))
    };
    const quote = this.quoteFor(snapshot);
    return {
      ...snapshot,
      subtotal: quote.subtotal,
      total: quote.grandTotal,
      itemCount: quote.itemCount
    };
  }

  /** Re-derive totals for a stored proposal, against ITS saved basket. */
  quoteFor(prop) {
    return buildQuote(prop.selections || {}, {
      basket: prop.basket,
      guestCount: prop.guestCount,
      zoneIds: Array.isArray(prop.zoneIds) && prop.zoneIds.length ? prop.zoneIds : undefined
    });
  }

  saveCurrentProposal(title, client, date) {
    const prop = this.buildProposal({
      id: 'prop-' + Date.now(),
      title: title || 'Custom Event Proposal ' + formatDocDate(new Date()),
      client: client || 'Corporate Client',
      date: date || new Date().toISOString().split('T')[0],
      selections: this.activeSelections
    });
    this.proposals.unshift(prop);
    this.persist();
    this.isFormOpen = false;
    this.render();
  }

  deleteProposal(id) {
    this.proposals = this.proposals.filter(p => p.id !== id);
    this.persist();
    this.render();
  }

  render() {
    const today = new Date().toISOString().split('T')[0];

    this.container.innerHTML = `
      <div class="proposals-wrapper realistic-map-theme">
        <div class="proposals-header">
          <div>
            <h3>📁 Saved Proposals & Printable B2B Contract Exporter</h3>
            <p>Save custom blueprints, manage contract drafts, and export a priced quotation for any saved design.</p>
          </div>
          <button class="btn-save-proposal" type="button" id="btnSaveNewProposal" aria-expanded="${this.isFormOpen}">
            ${this.isFormOpen ? '✕ Cancel' : '➕ Save Current Design as Proposal'}
          </button>
        </div>

        ${this.isFormOpen ? `
          <form class="proposal-form" id="proposalForm" style="margin-bottom:18px; padding:16px; border:1px solid rgba(148,163,184,.35); border-radius:10px;">
            <div class="form-row-dual" style="display:flex; gap:12px; flex-wrap:wrap;">
              <div class="form-group" style="flex:2; min-width:220px;">
                <label for="propTitle">Proposal title</label>
                <input type="text" id="propTitle" class="cart-input" required maxlength="120"
                       value="Grand Gala Event Blueprint 2026" autocomplete="off" style="width:100%;" />
              </div>
              <div class="form-group" style="flex:1; min-width:180px;">
                <label for="propClient">Client</label>
                <input type="text" id="propClient" class="cart-input" required maxlength="120"
                       value="VVIP Corporate Client" autocomplete="off" style="width:100%;" />
              </div>
              <div class="form-group" style="flex:1; min-width:160px;">
                <label for="propDate">Event date</label>
                <input type="date" id="propDate" class="cart-input" value="${today}" style="width:100%;" />
              </div>
            </div>
            ${this.formError ? `<p role="alert" style="color:#ef4444; margin:8px 0 0;">${escapeHtml(this.formError)}</p>` : ''}
            <div style="margin-top:12px; display:flex; gap:10px;">
              <button type="submit" class="btn-save-proposal">Save proposal</button>
              <button type="button" class="btn-load-prop" id="btnCancelProposal">Cancel</button>
            </div>
            <p style="margin:10px 0 0; opacity:.75; font-size:12px;">
              Saves the current 360° configuration — ${formatMoney(buildQuote(this.activeSelections).grandTotal)} incl. GST.
            </p>
          </form>
        ` : ''}

        ${this.proposals.length === 0 ? `
          <div class="proposals-empty-state" style="padding:40px 20px; text-align:center; border:1px dashed rgba(148,163,184,.4); border-radius:12px;">
            <h4 style="margin:0 0 8px;">No saved proposals yet</h4>
            <p style="margin:0; opacity:.8;">Configure a venue in the 360° studio, then press “Save Current Design as Proposal” to keep it here as a priced, printable draft.</p>
          </div>
        ` : `
          <div class="proposals-grid">
            ${this.proposals.map(prop => {
              const quote = this.quoteFor(prop);
              return `
              <div class="proposal-card">
                <div class="prop-card-head">
                  <span class="prop-badge">B2B CONTRACT DRAFT</span>
                  <span class="prop-date">${escapeHtml(prop.date || '')}</span>
                </div>
                <h4 class="prop-title">${escapeHtml(prop.title || 'Untitled proposal')}</h4>
                <p class="prop-client">Client: <strong>${escapeHtml(prop.client || 'Unnamed client')}</strong></p>
                <div class="prop-price-box">
                  <span class="prop-total">${formatMoney(quote.grandTotal)}</span>
                  <small>Est. invoice total (incl. GST) • ${quote.itemCount} items</small>
                </div>

                <div class="prop-actions">
                  <button class="btn-load-prop" type="button" data-prop-id="${escapeHtml(prop.id)}">📂 Load Design</button>
                  <button class="btn-print-prop" type="button" data-print-id="${escapeHtml(prop.id)}">🖨️ Export Quotation</button>
                  <button class="btn-delete-prop" type="button" data-delete-id="${escapeHtml(prop.id)}" aria-label="Delete ${escapeHtml(prop.title || 'proposal')}">🗑 Delete</button>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector('#btnSaveNewProposal');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        this.isFormOpen = !this.isFormOpen;
        this.formError = '';
        this.render();
        const title = this.container.querySelector('#propTitle');
        if (title) title.focus();
      });
    }

    const cancelBtn = this.container.querySelector('#btnCancelProposal');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.isFormOpen = false;
        this.render();
      });
    }

    const form = this.container.querySelector('#proposalForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = this.container.querySelector('#propTitle').value.trim();
        const client = this.container.querySelector('#propClient').value.trim();
        const date = this.container.querySelector('#propDate').value;
        if (!title || !client) {
          this.formError = 'Both a proposal title and a client name are required.';
          this.render();
          return;
        }
        this.formError = '';
        this.saveCurrentProposal(title, client, date);
      });
    }

    this.container.querySelectorAll('.btn-load-prop[data-prop-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prop = this.proposals.find(p => p.id === btn.getAttribute('data-prop-id'));
        if (!prop) return;
        // Restore the COMMERCIAL state as well as the design, or the price the
        // client agreed to would not come back with it.
        if (prop.basket) applyBasket(prop.basket);
        const patch = {};
        if (Number(prop.guestCount) > 0) patch.guestCount = Math.round(Number(prop.guestCount));
        if (prop.eventType) patch.eventType = prop.eventType;
        if (Array.isArray(prop.zoneIds) && prop.zoneIds.length) patch.scopeZoneIds = prop.zoneIds;
        if (Object.keys(patch).length) eventState.set(patch, { reason: 'proposal-load' });
        if (this.onLoadProposal) this.onLoadProposal(prop.selections || {});
        this.render();
      });
    });

    this.container.querySelectorAll('[data-print-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const prop = this.proposals.find(p => p.id === btn.getAttribute('data-print-id'));
        if (!prop) return;
        const quote = this.quoteFor(prop);
        const docNumber = getOrCreateDocNumber(`proposal-${prop.id}`, 'HE/QTE');
        printHtmlDocument(
          `Quotation ${docNumber}`,
          renderInvoiceDocument({
            quote,
            docNumber,
            heading: 'Quotation',
            buyer: { company: prop.client, state: quote.buyerState },
            note: `Quotation for "${prop.title}" (event date ${prop.date}). Valid for 15 days. Not a tax invoice.`
          })
        );
      });
    });

    this.container.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-delete-id');
        const prop = this.proposals.find(p => p.id === id);
        if (!prop) return;
        if (window.confirm(`Delete the proposal "${prop.title}"? This cannot be undone.`)) {
          this.deleteProposal(id);
        }
      });
    });
  }
}
