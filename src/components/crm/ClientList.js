/**
 * ClientList.js — every client the company has, and the one number per row
 * that tells you whether to worry about them.
 *
 * A client is the FAMILY or the COMPANY, not the event. The Sharma family with
 * two weddings and an anniversary is one row here with three events under it —
 * which is exactly the linking that the incumbent tools are criticised for
 * getting wrong.
 *
 * The "Source" column is not decoration. It is the only way to answer "is the
 * directory subscription worth renewing", and it is unrecoverable if it was
 * not captured at enquiry — so a client without one is flagged, loudly.
 */

import { crmStore } from '../../crm/store.js';
import { dealFinancials } from '../../crm/finance.js';
import { injectCrmStyles } from './crmStyles.js';
import {
  formatMoney, formatMoneyShort, escapeHtml, chip, kpi, emptyState,
  sourceLabel, typeLabel, stageChip
} from './shared.js';

export class ClientList {
  /** @param {HTMLElement} container @param {(clientId:string)=>void} onOpenClient */
  constructor(container, onOpenClient = null) {
    injectCrmStyles();
    this.container = container;
    this.onOpenClient = onOpenClient;
    this.query = '';
    this.typeFilter = 'all';
    this.sort = 'value';

    // Any write anywhere re-renders this list. Unsubscribe in destroy().
    this.unsubscribe = crmStore.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  /** One row per client, with its whole book rolled up from the receipts. */
  rows() {
    const snapshot = crmStore.get();
    const { clients, deals, milestones, receipts, invoices } = snapshot;
    return clients.map(client => {
      const clientDeals = deals.filter(d => d.clientId === client.id);
      const fins = clientDeals.map(deal => ({
        deal,
        fin: dealFinancials(deal, client, milestones, receipts, invoices)
      }));
      const live = fins.filter(x => x.deal.stage !== 'lost' && x.deal.stage !== 'dropped');
      return {
        client,
        dealCount: clientDeals.length,
        liveCount: live.filter(x => x.deal.phase !== 'closed').length,
        contracted: live.reduce((a, x) => a + x.fin.contractGross, 0),
        received: live.reduce((a, x) => a + x.fin.received, 0),
        tds: live.reduce((a, x) => a + x.fin.tdsWithheld, 0),
        outstanding: live.reduce((a, x) => a + x.fin.outstanding, 0),
        overdue: live.reduce((a, x) => a + x.fin.overdue, 0),
        nextEvent: live
          .map(x => x.fin.eventStart)
          .filter(Boolean)
          .sort()
          .find(dt => dt >= new Date().toISOString().slice(0, 10)) || '',
        latestStage: (fins[fins.length - 1] || {}).deal?.stage || ''
      };
    });
  }

  filtered(rows) {
    const q = this.query.trim().toLowerCase();
    let out = rows.filter(r => {
      if (this.typeFilter !== 'all' && r.client.type !== this.typeFilter) return false;
      if (!q) return true;
      const hay = [
        r.client.name, r.client.code, r.client.primaryContact?.name,
        r.client.primaryContact?.phone, r.client.primaryContact?.email,
        r.client.billing?.gstin, r.client.billing?.address?.city
      ].join(' ').toLowerCase();
      return hay.includes(q);
    });
    if (this.sort === 'overdue') out.sort((a, b) => b.overdue - a.overdue || b.outstanding - a.outstanding);
    else if (this.sort === 'name') out.sort((a, b) => a.client.name.localeCompare(b.client.name));
    else out.sort((a, b) => b.contracted - a.contracted);
    return out;
  }

  render() {
    if (!this.container) return;
    const all = this.rows();
    const rows = this.filtered(all);
    const unsourced = all.filter(r => !r.client.source).length;
    const totalOverdue = all.reduce((a, r) => a + r.overdue, 0);
    const totalOutstanding = all.reduce((a, r) => a + r.outstanding, 0);

    this.container.innerHTML = `
      <section class="crm" aria-labelledby="crm-clients-title">
        <header class="crm-head">
          <div>
            <h2 class="crm-title" id="crm-clients-title">Clients</h2>
            <p class="crm-sub">The family or the company — not the event. One client holds every event they have ever run with you, every payment, and the whole trail.</p>
          </div>
          <div class="crm-toolbar" role="search">
            <input id="crm-client-search" class="crm-input" type="search" placeholder="Search name, phone, GSTIN, city" aria-label="Search clients" value="${escapeHtml(this.query)}">
            <label for="crm-client-type" class="crm-kpi-label">Type</label>
            <select id="crm-client-type" class="crm-select" aria-label="Filter by client type">
              ${['all', 'individual', 'corporate', 'political', 'government', 'agency'].map(t =>
                `<option value="${t}"${this.typeFilter === t ? ' selected' : ''}>${t === 'all' ? 'All types' : escapeHtml(typeLabel(t))}</option>`).join('')}
            </select>
            <label for="crm-client-sort" class="crm-kpi-label">Sort</label>
            <select id="crm-client-sort" class="crm-select" aria-label="Sort clients">
              <option value="value"${this.sort === 'value' ? ' selected' : ''}>Contracted value</option>
              <option value="overdue"${this.sort === 'overdue' ? ' selected' : ''}>Overdue first</option>
              <option value="name"${this.sort === 'name' ? ' selected' : ''}>Name</option>
            </select>
          </div>
        </header>

        <div class="crm-kpis">
          ${kpi({ label: 'Clients', value: String(all.length), note: `${all.filter(r => r.liveCount > 0).length} with a live event` })}
          ${kpi({ label: 'Contracted', value: formatMoneyShort(all.reduce((a, r) => a + r.contracted, 0)), note: 'incl. GST' })}
          ${kpi({ label: 'Received', value: formatMoneyShort(all.reduce((a, r) => a + r.received, 0)), note: `+ ${formatMoneyShort(all.reduce((a, r) => a + r.tds, 0))} TDS withheld`, tone: 'good' })}
          ${kpi({ label: 'Outstanding', value: formatMoneyShort(totalOutstanding), note: 'net of TDS', tone: totalOutstanding > 0 ? 'warn' : '' })}
          ${kpi({ label: 'Overdue', value: formatMoneyShort(totalOverdue), note: 'past due date', tone: totalOverdue > 0 ? 'danger' : 'good', action: 'payments' })}
        </div>

        ${unsourced > 0 ? `<p class="crm-note">${unsourced} client${unsourced === 1 ? ' has' : 's have'} no acquisition source recorded. Source cannot be reconstructed after the enquiry — without it there is no way to tell which channel is paying for itself.</p>` : ''}

        ${rows.length === 0 ? emptyState({
          title: all.length === 0 ? 'No clients yet' : 'Nothing matches that search',
          body: all.length === 0
            ? 'A client is the family or the company. Add one, record where the enquiry came from, and their events hang off it from then on.'
            : 'Try a different name, phone number, GSTIN or city — or clear the type filter.',
          actionLabel: all.length === 0 ? 'Add the first client' : 'Clear search',
          action: all.length === 0 ? 'add-client' : 'clear'
        }) : `
        <div class="crm-table-wrap">
          <table class="crm-table">
            <caption class="crm-kpi-label" style="padding: var(--space-3); text-align: left;">${rows.length} of ${all.length} clients</caption>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Type</th>
                <th scope="col">Source</th>
                <th scope="col">Events</th>
                <th scope="col">Billing</th>
                <th scope="col" class="crm-num">Contracted</th>
                <th scope="col" class="crm-num">Received</th>
                <th scope="col" class="crm-num">Outstanding</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => this.rowHtml(r)).join('')}
            </tbody>
          </table>
        </div>`}
      </section>`;

    this.bind();
  }

  rowHtml(r) {
    const c = r.client;
    const billing = c.billing?.isRegistered
      ? `${chip('GST registered', 'info')}${c.billing.tdsApplicable ? ` ${chip(`TDS ${c.billing.tdsSection || ''}`.trim(), 'warn')}` : ''}`
      : chip('Unregistered (B2C)', 'muted');
    return `
      <tr>
        <td class="crm-wrap-cell">
          <button class="crm-link" type="button" data-client="${escapeHtml(c.id)}">${escapeHtml(c.name)}</button>
          <div class="crm-deal-client">${escapeHtml(c.code)} · ${escapeHtml(c.primaryContact?.name || 'No contact named')}</div>
        </td>
        <td>${escapeHtml(typeLabel(c.type))}</td>
        <td>${c.source ? escapeHtml(sourceLabel(c.source)) : chip('Not recorded', 'danger')}</td>
        <td class="crm-num">${r.dealCount}${r.liveCount ? ` <span class="crm-deal-client">(${r.liveCount} live)</span>` : ''}</td>
        <td>${billing}</td>
        <td class="crm-num">${formatMoney(r.contracted)}</td>
        <td class="crm-num">${formatMoney(r.received)}${r.tds ? `<div class="crm-deal-client">+${formatMoney(r.tds)} TDS</div>` : ''}</td>
        <td class="crm-num">${r.outstanding > 0 ? formatMoney(r.outstanding) : chip('Settled', 'good')}</td>
        <td>${r.overdue > 0 ? chip(`${formatMoneyShort(r.overdue)} overdue`, 'danger') : (r.latestStage ? stageChip(r.latestStage) : '—')}</td>
      </tr>`;
  }

  /**
   * Re-bound after EVERY render. innerHTML throws the old nodes away, so a
   * "bind once" guard here would silently leave the second render dead.
   */
  bind() {
    const search = this.container.querySelector('#crm-client-search');
    if (search) {
      search.addEventListener('input', (e) => {
        this.query = e.target.value;
        this.render();
        const next = this.container.querySelector('#crm-client-search');
        if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
      });
    }
    const type = this.container.querySelector('#crm-client-type');
    if (type) type.addEventListener('change', (e) => { this.typeFilter = e.target.value; this.render(); });
    const sort = this.container.querySelector('#crm-client-sort');
    if (sort) sort.addEventListener('change', (e) => { this.sort = e.target.value; this.render(); });

    this.container.querySelectorAll('[data-client]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof this.onOpenClient === 'function') this.onOpenClient(btn.dataset.client);
      });
    });
    const clear = this.container.querySelector('[data-action="clear"]');
    if (clear) clear.addEventListener('click', () => { this.query = ''; this.typeFilter = 'all'; this.render(); });
  }
}

export default ClientList;
