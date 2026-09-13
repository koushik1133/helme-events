/**
 * ClientDetail.js — everything about one client on one screen.
 *
 * The owner's actual question was "track each and everything about the client".
 * That means, on this page and nowhere else: who they are and how to reach
 * them, how they must be BILLED (GSTIN, place of supply, whether they deduct
 * TDS), every event they have run or are running, every payment milestone with
 * what is still owed, every receipt with its UTR and mode, and the activity
 * trail underneath all of it.
 *
 * Every rupee here is derived at render time by finance.js. Nothing is read
 * back from a stored total, so nothing on this page can be stale.
 */

import { crmStore } from '../../crm/store.js';
import { dealFinancials, tdsRate } from '../../crm/finance.js';
import { stateNameForCode, SUPPLIER_STATE_CODE } from '../../crm/schema.js';
import { injectCrmStyles } from './crmStyles.js';
import {
  formatMoney, formatMoneyShort, escapeHtml, formatEventDate, chip, kpi, emptyState,
  sourceLabel, typeLabel, modeLabel, stageChip, dateRangeLabel, relativeDays
} from './shared.js';

export class ClientDetail {
  /** @param {HTMLElement} container @param {string} clientId @param {()=>void} onBack */
  constructor(container, clientId, onBack = null) {
    injectCrmStyles();
    this.container = container;
    this.clientId = clientId;
    this.onBack = onBack;
    this.unsubscribe = crmStore.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  setClient(clientId) {
    this.clientId = clientId;
    this.render();
  }

  render() {
    if (!this.container) return;
    const client = crmStore.client(this.clientId);
    if (!client) {
      this.container.innerHTML = `<section class="crm">${emptyState({
        title: 'Client not found',
        body: 'This client is no longer in the local store — it may have been reset. Go back to the list and pick another.',
        actionLabel: 'Back to clients', action: 'back'
      })}</section>`;
      this.bind();
      return;
    }

    const snapshot = crmStore.get();
    const deals = snapshot.deals.filter(d => d.clientId === client.id);
    const fins = deals.map(deal => ({
      deal,
      fin: dealFinancials(deal, client, snapshot.milestones, snapshot.receipts, snapshot.invoices)
    })).sort((a, b) => String(b.fin.eventStart).localeCompare(String(a.fin.eventStart)));

    const live = fins.filter(x => x.deal.stage !== 'lost' && x.deal.stage !== 'dropped');
    const contracted = live.reduce((a, x) => a + x.fin.contractGross, 0);
    const received = live.reduce((a, x) => a + x.fin.received, 0);
    const tds = live.reduce((a, x) => a + x.fin.tdsWithheld, 0);
    const outstanding = live.reduce((a, x) => a + x.fin.outstanding, 0);
    const overdue = live.reduce((a, x) => a + x.fin.overdue, 0);
    const receipts = snapshot.receipts.filter(r => r.clientId === client.id)
      .sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn)));

    this.container.innerHTML = `
      <section class="crm" aria-labelledby="crm-client-title">
        <header class="crm-head">
          <div>
            <button class="crm-btn" type="button" data-action="back">← All clients</button>
            <h2 class="crm-title" id="crm-client-title" style="margin-top: var(--space-3);">${escapeHtml(client.name)}</h2>
            <p class="crm-sub">${escapeHtml(client.code)} · ${escapeHtml(typeLabel(client.type))} · ${client.source ? `Source: ${escapeHtml(sourceLabel(client.source))}${client.sourceDetail ? ` — ${escapeHtml(client.sourceDetail)}` : ''}` : 'Source was never recorded, and cannot be reconstructed'}</p>
          </div>
        </header>

        <div class="crm-kpis">
          ${kpi({ label: 'Contracted', value: formatMoneyShort(contracted), note: 'incl. GST, live events' })}
          ${kpi({ label: 'Received', value: formatMoneyShort(received), note: 'bank credits', tone: 'good' })}
          ${kpi({ label: 'TDS withheld', value: formatMoneyShort(tds), note: tds > 0 ? 'paid to govt on our behalf — settled, not owed' : 'client does not deduct' })}
          ${kpi({ label: 'Outstanding', value: formatMoneyShort(outstanding), note: 'contract − received − TDS', tone: outstanding > 0 ? 'warn' : 'good' })}
          ${kpi({ label: 'Overdue', value: formatMoneyShort(overdue), note: 'past due date', tone: overdue > 0 ? 'danger' : 'good' })}
        </div>

        <div class="crm-split crm-section">
          <div class="crm-card">
            <h3 class="crm-section-title">Contact</h3>
            <dl class="crm-kv">
              <dt>Primary</dt><dd>${escapeHtml(client.primaryContact?.name || '—')}${client.primaryContact?.role ? ` <span class="crm-deal-client">· ${escapeHtml(client.primaryContact.role)}</span>` : ''}</dd>
              <dt>Phone</dt><dd>${client.primaryContact?.phone ? `<a class="crm-link" href="tel:${escapeHtml(client.primaryContact.phone.replace(/\s+/g, ''))}">${escapeHtml(client.primaryContact.phone)}</a>` : '—'}</dd>
              <dt>WhatsApp</dt><dd>${escapeHtml(client.primaryContact?.whatsapp || '—')}</dd>
              <dt>Email</dt><dd>${client.primaryContact?.email ? `<a class="crm-link" href="mailto:${escapeHtml(client.primaryContact.email)}">${escapeHtml(client.primaryContact.email)}</a>` : '—'}</dd>
              ${(client.altContacts || []).map(a => `<dt>${escapeHtml(a.role || 'Also')}</dt><dd>${escapeHtml(a.name || '')} ${a.phone ? escapeHtml(a.phone) : ''} ${a.email ? escapeHtml(a.email) : ''}</dd>`).join('')}
              <dt>Tags</dt><dd>${(client.tags || []).length ? client.tags.map(t => chip(t, 'muted')).join(' ') : '—'}</dd>
            </dl>
          </div>
          <div class="crm-card">
            <h3 class="crm-section-title">Billing</h3>
            <dl class="crm-kv">
              <dt>Legal name</dt><dd>${escapeHtml(client.billing?.legalName || client.name)}</dd>
              <dt>GSTIN</dt><dd>${client.billing?.gstin ? `<span class="crm-num">${escapeHtml(client.billing.gstin)}</span>` : chip('Unregistered — B2C, no input credit', 'muted')}</dd>
              <dt>PAN</dt><dd>${escapeHtml(client.billing?.pan || '—')}</dd>
              <dt>Address</dt><dd>${escapeHtml([client.billing?.address?.line1, client.billing?.address?.line2, client.billing?.address?.city, client.billing?.address?.state, client.billing?.address?.pincode].filter(Boolean).join(', ') || '—')}</dd>
              <dt>TDS</dt><dd>${client.billing?.tdsApplicable
                ? `${escapeHtml(client.billing.tdsSection || '194C')} @ ${tdsRate(client.billing.tdsSection || '194C', client.billing.tdsDeducteeType)}% — deducted on the ex-GST value before they pay`
                : 'Not deducted (individual / unregistered payer)'}</dd>
            </dl>
            <p class="crm-note">Place of supply is decided per event by the VENUE's state, not by this address. An out-of-state client holding their event in ${escapeHtml(stateNameForCode(SUPPLIER_STATE_CODE))} is still an intra-state supply — CGST + SGST, not IGST.</p>
          </div>
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Events</h3>
          <p class="crm-section-note">One client, many events. Multi-day is the norm — the function count is what the quote is actually built from.</p>
          ${fins.length === 0 ? emptyState({
            title: 'No events for this client yet',
            body: 'Create an event and it will appear here with its payment schedule, its receipts and its own place of supply.'
          }) : `
          <div class="crm-table-wrap">
            <table class="crm-table">
              <thead><tr>
                <th scope="col">Event</th><th scope="col">Dates</th><th scope="col">Venue</th>
                <th scope="col">Stage</th><th scope="col">GST</th>
                <th scope="col" class="crm-num">Contract</th><th scope="col" class="crm-num">Collected</th>
                <th scope="col" class="crm-num">Outstanding</th><th scope="col">Next due</th>
              </tr></thead>
              <tbody>${fins.map(({ deal, fin }) => `
                <tr>
                  <td class="crm-wrap-cell"><strong>${escapeHtml(deal.title)}</strong><div class="crm-deal-client">${escapeHtml(deal.code)}</div></td>
                  <td class="crm-wrap-cell">${escapeHtml(dateRangeLabel(deal))}</td>
                  <td class="crm-wrap-cell">${escapeHtml(deal.venue?.name || '—')}<div class="crm-deal-client">${escapeHtml(deal.venue?.city || '')}${deal.venue?.state ? `, ${escapeHtml(deal.venue.state)}` : ''}</div></td>
                  <td>${stageChip(deal.stage)}</td>
                  <td>${chip(fin.gstMode === 'intra' ? 'CGST + SGST' : 'IGST', 'info')}</td>
                  <td class="crm-num">${formatMoney(fin.contractGross)}</td>
                  <td class="crm-num">${formatMoney(fin.settledValue)}<div class="crm-bar" aria-hidden="true"><span style="width:${fin.collectionPct}%"></span></div><div class="crm-deal-client">${fin.collectionPct}%</div></td>
                  <td class="crm-num">${fin.outstanding > 0 ? formatMoney(fin.outstanding) : chip('Settled', 'good')}</td>
                  <td>${fin.nextDue ? `${escapeHtml(fin.nextDue.label)}<div class="crm-deal-client">${formatMoney(fin.nextDue.amount)} · ${escapeHtml(relativeDays(fin.nextDue.daysUntil))}</div>` : '—'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Payment schedule</h3>
          <p class="crm-section-note">Weddings are advance-funded and corporate work is credit-funded — the same client book contains both, which is why the due date and the event date are shown side by side.</p>
          ${this.milestoneTable(fins)}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Receipts</h3>
          <p class="crm-section-note">What actually arrived, how it arrived, and what the client withheld as TDS. A receipt can clear more than one milestone.</p>
          ${receipts.length === 0 ? emptyState({
            title: 'No money received yet',
            body: 'Record a receipt against a milestone and it shows here with its UTR or cheque number, its mode, and any TDS the client withheld.'
          }) : `
          <div class="crm-table-wrap">
            <table class="crm-table">
              <thead><tr>
                <th scope="col">Receipt</th><th scope="col">Date</th><th scope="col">Event</th>
                <th scope="col">Mode</th><th scope="col">Reference</th>
                <th scope="col" class="crm-num">Credited</th><th scope="col" class="crm-num">TDS withheld</th><th scope="col" class="crm-num">Settles</th>
              </tr></thead>
              <tbody>${receipts.map(r => {
                const deal = deals.find(d => d.id === r.dealId);
                return `<tr>
                  <td>${escapeHtml(r.receiptNo)}</td>
                  <td>${escapeHtml(formatEventDate(r.receivedOn))}</td>
                  <td class="crm-wrap-cell">${escapeHtml(deal?.title || '—')}</td>
                  <td>${escapeHtml(modeLabel(r.mode))}</td>
                  <td class="crm-wrap-cell">${escapeHtml(r.reference || '—')}</td>
                  <td class="crm-num">${formatMoney(r.amount)}</td>
                  <td class="crm-num">${r.tdsDeducted ? `${formatMoney(r.tdsDeducted)}<div class="crm-deal-client">${escapeHtml(r.tdsSection || '')}</div>` : '—'}</td>
                  <td class="crm-num">${formatMoney(r.amount + r.tdsDeducted)}</td>
                </tr>`;
              }).join('')}</tbody>
            </table>
          </div>
          <p class="crm-note">The "Settles" column is the one that matters: credited + TDS withheld. The withheld amount was paid to the government on our behalf, so it clears the invoice exactly as the bank credit does. Reading only the credited column makes every corporate deal look permanently short.</p>`}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Activity</h3>
          ${this.trail(client, deals)}
        </div>
      </section>`;

    this.bind();
  }

  milestoneTable(fins) {
    const rows = fins.flatMap(({ deal, fin }) => fin.milestones.map(m => ({ deal, m, fin })));
    if (!rows.length) {
      return emptyState({
        title: 'No payment schedule yet',
        body: 'A deal in the sales phase has no schedule — you do not schedule money you have not been promised. Once it is booked, pick the segment template (wedding 40/30/30, corporate 50% on PO + net 30, political 70/30) and the milestones appear here.'
      });
    }
    rows.sort((a, b) => String(a.m.dueDate).localeCompare(String(b.m.dueDate)));
    return `
      <div class="crm-table-wrap">
        <table class="crm-table">
          <thead><tr>
            <th scope="col">Event</th><th scope="col">Milestone</th><th scope="col">Due</th>
            <th scope="col" class="crm-num">Due (incl. GST)</th><th scope="col" class="crm-num">Received</th>
            <th scope="col" class="crm-num">TDS</th><th scope="col" class="crm-num">Balance</th><th scope="col">Status</th>
          </tr></thead>
          <tbody>${rows.map(({ deal, m }) => `
            <tr>
              <td class="crm-wrap-cell">${escapeHtml(deal.title)}</td>
              <td class="crm-wrap-cell">${escapeHtml(m.label)} <span class="crm-deal-client">${m.percent}%</span></td>
              <td>${escapeHtml(formatEventDate(m.dueDate))}${m.overdue ? `<div class="crm-deal-client">${m.daysOverdue} days overdue</div>` : ''}</td>
              <td class="crm-num">${formatMoney(m.gross)}</td>
              <td class="crm-num">${formatMoney(m.received)}</td>
              <td class="crm-num">${m.tdsWithheld ? formatMoney(m.tdsWithheld) : '—'}</td>
              <td class="crm-num">${m.balance > 0 ? formatMoney(m.balance) : '—'}</td>
              <td>${m.status === 'paid' ? chip('Paid', 'good')
                    : m.status === 'overdue' ? chip(`Overdue ${m.ageingBucket}`, 'danger')
                    : m.status === 'part_paid' ? chip('Part paid', 'warn')
                    : m.status === 'waived' ? chip('Waived', 'muted')
                    : chip('Scheduled', 'info')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  trail(client, deals) {
    const entries = crmStore.activityForClient(client.id);
    if (!entries.length) {
      return emptyState({ title: 'Nothing logged yet', body: 'Stage moves, receipts, invoices and notes all land here in date order.' });
    }
    const dealById = new Map(deals.map(d => [d.id, d]));
    return `
      <div class="crm-card">
        <ul class="crm-trail">
          ${entries.map(a => `
            <li>
              <time datetime="${escapeHtml(a.at)}">${escapeHtml(formatEventDate(a.at))}</time>
              <span>${escapeHtml(a.text)}${a.dealId && dealById.has(a.dealId) ? ` <span class="crm-deal-client">· ${escapeHtml(dealById.get(a.dealId).title)}</span>` : ''}${a.amount ? ` <strong class="crm-num">${formatMoney(a.amount)}</strong>` : ''}</span>
            </li>`).join('')}
        </ul>
        <p class="crm-note">This is a working log kept in this browser. It is not an audit trail and nothing here is tamper-evident.</p>
      </div>`;
  }

  bind() {
    this.container.querySelectorAll('[data-action="back"]').forEach(btn => {
      btn.addEventListener('click', () => { if (typeof this.onBack === 'function') this.onBack(); });
    });
  }
}

export default ClientDetail;
