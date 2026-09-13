/**
 * PaymentsScreen.js — money in, split the way the risk actually splits.
 *
 * There is no single "outstanding" number on this screen, on purpose.
 *
 * An Indian event company's receivable is two completely different animals
 * wearing one label:
 *
 *   UPCOMING — pre-event, scheduled advances and balances on weddings and
 *   rallies. Once received they are nearly risk-free; the danger is only that
 *   the event happens BEFORE the balance arrives, at which point the leverage
 *   is gone and "90% of clients will find a complaint" to shave the payment.
 *   The action here is: collect before load-in.
 *
 *   OVERDUE — post-event corporate invoices at 30–60 day terms against a
 *   procurement cycle that really runs 60–90. Vendors were paid out weeks
 *   before the event; the client pays months after it. That gap, up to four
 *   months wide, is the working-capital problem the whole industry bleeds
 *   from, and it is ONLY visible as an ageing table.
 *
 * Averaging those two into one figure averages a healthy number with a sick
 * one and produces a number that describes neither. So they never touch.
 *
 * Every figure below is net of TDS withheld. A corporate client who deducted
 * ₹20,000 under 194C did not underpay by ₹20,000 — they paid it to the
 * government on our behalf, and the invoice is closed.
 */

import { crmStore } from '../../crm/store.js';
import { receivables, vendorPayout, AGEING_BUCKETS } from '../../crm/finance.js';
import { injectCrmStyles } from './crmStyles.js';
import {
  formatMoney, formatMoneyShort, escapeHtml, formatEventDate, chip, kpi, emptyState,
  modeLabel, relativeDays
} from './shared.js';

export class PaymentsScreen {
  /** @param {HTMLElement} container @param {(clientId:string)=>void} onOpenClient */
  constructor(container, onOpenClient = null) {
    injectCrmStyles();
    this.container = container;
    this.onOpenClient = onOpenClient;
    this.bucketFilter = 'all';
    this.unsubscribe = crmStore.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  render() {
    if (!this.container) return;
    const s = crmStore.get();
    const r = receivables(s.deals, s.clients, s.milestones, s.receipts, s.invoices);
    const payouts = s.vendorPayouts.map(p => ({ payout: p, math: vendorPayout(p) }));
    const recent = [...s.receipts].sort((a, b) => String(b.receivedOn).localeCompare(String(a.receivedOn))).slice(0, 12);
    const dealById = new Map(s.deals.map(d => [d.id, d]));

    this.container.innerHTML = `
      <section class="crm" aria-labelledby="crm-pay-title">
        <header class="crm-head">
          <div>
            <h2 class="crm-title" id="crm-pay-title">Payments</h2>
            <p class="crm-sub">Upcoming and overdue are kept apart because they are different risks. A scheduled pre-event advance and a 90-day-old corporate invoice do not belong in the same number.</p>
          </div>
        </header>

        <div class="crm-kpis">
          ${kpi({ label: 'Received', value: formatMoneyShort(r.totalReceived), note: 'into the bank', tone: 'good' })}
          ${kpi({ label: 'TDS withheld', value: formatMoneyShort(r.totalTds), note: 'settled, not owed' })}
          ${kpi({ label: 'Upcoming', value: formatMoneyShort(r.totalUpcoming), note: `${r.upcoming.length} scheduled milestone${r.upcoming.length === 1 ? '' : 's'}` })}
          ${kpi({ label: 'Overdue', value: formatMoneyShort(r.totalOverdue), note: `${r.overdue.length} past due`, tone: r.totalOverdue > 0 ? 'danger' : 'good' })}
          ${kpi({ label: 'Due before event', value: formatMoneyShort(r.dueBeforeEvent), note: 'collect before load-in', tone: r.dueBeforeEvent > 0 ? 'warn' : 'good' })}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Receivables ageing</h3>
          <p class="crm-section-note">Only overdue balances age. Everything in this table is money for work already delivered, net of TDS.</p>
          <div class="crm-table-wrap">
            <table class="crm-table">
              <thead><tr>
                <th scope="col">Bucket</th>
                ${AGEING_BUCKETS.map(b => `<th scope="col" class="crm-num">${escapeHtml(b)} days</th>`).join('')}
                <th scope="col" class="crm-num">Total overdue</th>
              </tr></thead>
              <tbody>
                <tr>
                  <th scope="row">Amount</th>
                  ${AGEING_BUCKETS.map(b => `<td class="crm-num">${r.buckets[b] > 0 ? formatMoney(r.buckets[b]) : '—'}</td>`).join('')}
                  <td class="crm-num"><strong>${formatMoney(r.totalOverdue)}</strong></td>
                </tr>
                <tr>
                  <th scope="row">Invoices</th>
                  ${AGEING_BUCKETS.map(b => `<td class="crm-num">${r.overdue.filter(x => x.bucket === b).length || '—'}</td>`).join('')}
                  <td class="crm-num"><strong>${r.overdue.length}</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
          ${r.buckets['90+'] > 0 ? `<p class="crm-note">${formatMoney(r.buckets['90+'])} has been outstanding for more than 90 days. Corporate procurement genuinely runs 60–90 days, so 90+ is past even the generous reading — it needs a call, not a reminder email.</p>` : ''}
        </div>

        <div class="crm-section">
          <div class="crm-lane-head">
            <h3 class="crm-section-title" style="margin:0;">Overdue — post-event collection</h3>
            <span class="crm-col-meta">${formatMoneyShort(r.totalOverdue)}</span>
          </div>
          <p class="crm-section-note">Work is delivered, the invoice is out, the date has passed. This is the working-capital gap: vendors were paid before the event, this money arrives long after it.</p>
          <div class="crm-toolbar">
            <label for="crm-bucket" class="crm-kpi-label">Ageing</label>
            <select id="crm-bucket" class="crm-select" aria-label="Filter overdue by ageing bucket">
              <option value="all"${this.bucketFilter === 'all' ? ' selected' : ''}>All buckets</option>
              ${AGEING_BUCKETS.map(b => `<option value="${b}"${this.bucketFilter === b ? ' selected' : ''}>${b} days</option>`).join('')}
            </select>
          </div>
          ${this.overdueTable(r)}
        </div>

        <div class="crm-section">
          <div class="crm-lane-head">
            <h3 class="crm-section-title" style="margin:0;">Upcoming — scheduled, not yet due</h3>
            <span class="crm-col-meta">${formatMoneyShort(r.totalUpcoming)}</span>
          </div>
          <p class="crm-section-note">Advances and balances still ahead of their due date. The column that matters is whether the due date falls before the event — after it, you are collecting without leverage.</p>
          ${this.upcomingTable(r)}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Recent receipts</h3>
          <p class="crm-section-note">Payment mode is recorded because it is a real fact about how the money moved. There is no second ledger here and there will not be one.</p>
          ${recent.length === 0 ? emptyState({ title: 'No receipts recorded', body: 'Record money against a milestone and it will show here with its UTR or cheque reference.' }) : `
          <div class="crm-table-wrap">
            <table class="crm-table">
              <thead><tr>
                <th scope="col">Receipt</th><th scope="col">Date</th><th scope="col">Event</th><th scope="col">Mode</th>
                <th scope="col">Reference</th><th scope="col" class="crm-num">Credited</th>
                <th scope="col" class="crm-num">TDS</th><th scope="col" class="crm-num">Settles</th>
              </tr></thead>
              <tbody>${recent.map(x => `
                <tr>
                  <td>${escapeHtml(x.receiptNo)}</td>
                  <td>${escapeHtml(formatEventDate(x.receivedOn))}</td>
                  <td class="crm-wrap-cell">${escapeHtml(dealById.get(x.dealId)?.title || '—')}</td>
                  <td>${escapeHtml(modeLabel(x.mode))}</td>
                  <td class="crm-wrap-cell">${escapeHtml(x.reference || '—')}</td>
                  <td class="crm-num">${formatMoney(x.amount)}</td>
                  <td class="crm-num">${x.tdsDeducted ? `${formatMoney(x.tdsDeducted)} <span class="crm-deal-client">${escapeHtml(x.tdsSection || '')}</span>` : '—'}</td>
                  <td class="crm-num">${formatMoney(x.amount + x.tdsDeducted)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <div class="crm-section">
          <h3 class="crm-section-title">Vendor payouts</h3>
          <p class="crm-section-note">Four numbers, never one: gross (taxable), the GST you can reclaim as input credit, the TDS you must withhold under 194C, and the net that actually leaves the bank.</p>
          ${payouts.length === 0 ? emptyState({ title: 'No vendor payouts recorded', body: 'Record what goes out to the tent house, the florist and the AV crew here — it is the other half of the cash gap.' }) : `
          <div class="crm-table-wrap">
            <table class="crm-table">
              <thead><tr>
                <th scope="col">Vendor</th><th scope="col">Event</th><th scope="col">Section</th>
                <th scope="col" class="crm-num">Gross</th><th scope="col" class="crm-num">GST (input credit)</th>
                <th scope="col" class="crm-num">TDS withheld</th><th scope="col" class="crm-num">Net paid</th>
              </tr></thead>
              <tbody>${payouts.map(({ payout, math }) => `
                <tr>
                  <td class="crm-wrap-cell">${escapeHtml(payout.vendorName)}<div class="crm-deal-client">${escapeHtml(payout.service || '')}</div></td>
                  <td class="crm-wrap-cell">${escapeHtml(dealById.get(payout.dealId)?.title || '—')}</td>
                  <td>${escapeHtml(payout.tdsSection)} ${chip(payout.deducteeType === 'individual_huf' ? '1% · Individual/HUF' : '2% · Company', 'muted')}</td>
                  <td class="crm-num">${formatMoney(math.gross)}</td>
                  <td class="crm-num">${formatMoney(math.gst)}</td>
                  <td class="crm-num">${formatMoney(math.tds)}</td>
                  <td class="crm-num"><strong>${formatMoney(math.net)}</strong></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <p class="crm-note">All of this lives in this browser's local storage. It is not a backend, not an accounting system, and not a substitute for your CA's books.</p>
      </section>`;

    this.bind();
  }

  overdueTable(r) {
    const rows = this.bucketFilter === 'all' ? r.overdue : r.overdue.filter(x => x.bucket === this.bucketFilter);
    if (!rows.length) {
      return emptyState({
        title: r.overdue.length === 0 ? 'Nothing overdue' : 'Nothing in that bucket',
        body: r.overdue.length === 0
          ? 'Every scheduled milestone is either paid or still ahead of its due date. For a company running corporate work alongside weddings, this is the good state and it is worth noticing.'
          : 'Try another ageing bucket, or clear the filter to see every overdue milestone.'
      });
    }
    return `
      <div class="crm-table-wrap">
        <table class="crm-table">
          <thead><tr>
            <th scope="col">Client</th><th scope="col">Event</th><th scope="col">Milestone</th>
            <th scope="col">Due</th><th scope="col" class="crm-num">Days</th>
            <th scope="col">Bucket</th><th scope="col" class="crm-num">Balance</th>
          </tr></thead>
          <tbody>${rows.map(x => `
            <tr>
              <td class="crm-wrap-cell"><button class="crm-link" type="button" data-client="${escapeHtml(x.client?.id || '')}">${escapeHtml(x.client?.name || 'Unknown')}</button></td>
              <td class="crm-wrap-cell">${escapeHtml(x.deal.title)}<div class="crm-deal-client">${escapeHtml(x.deal.poNumber ? `PO ${x.deal.poNumber}` : x.deal.code)}</div></td>
              <td class="crm-wrap-cell">${escapeHtml(x.milestone.label)}</td>
              <td>${escapeHtml(formatEventDate(x.dueDate))}</td>
              <td class="crm-num">${x.daysOverdue}</td>
              <td>${chip(x.bucket, x.bucket === '90+' ? 'danger' : x.bucket === '61-90' ? 'danger' : 'warn')}</td>
              <td class="crm-num"><strong>${formatMoney(x.amount)}</strong></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  upcomingTable(r) {
    if (!r.upcoming.length) {
      return emptyState({
        title: 'No scheduled payments ahead',
        body: 'Once a deal is booked, pick its segment template — wedding 40/30/30, corporate 50% on PO plus net 30, political 70/30 — and every milestone lands here with a due date.'
      });
    }
    return `
      <div class="crm-table-wrap">
        <table class="crm-table">
          <thead><tr>
            <th scope="col">Client</th><th scope="col">Event</th><th scope="col">Milestone</th>
            <th scope="col">Due</th><th scope="col">Relative to event</th><th scope="col" class="crm-num">Amount</th>
          </tr></thead>
          <tbody>${r.upcoming.map(x => {
            const beforeEvent = x.eventEnd && x.dueDate <= x.eventEnd;
            return `
            <tr>
              <td class="crm-wrap-cell"><button class="crm-link" type="button" data-client="${escapeHtml(x.client?.id || '')}">${escapeHtml(x.client?.name || 'Unknown')}</button></td>
              <td class="crm-wrap-cell">${escapeHtml(x.deal.title)}</td>
              <td class="crm-wrap-cell">${escapeHtml(x.milestone.label)}</td>
              <td>${escapeHtml(formatEventDate(x.dueDate))}<div class="crm-deal-client">${escapeHtml(relativeDays(x.daysUntil))}</div></td>
              <td>${beforeEvent ? chip('Before the event', 'good') : chip('After the event — no leverage', 'warn')}</td>
              <td class="crm-num">${formatMoney(x.amount)}</td>
            </tr>`;
          }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  bind() {
    const bucket = this.container.querySelector('#crm-bucket');
    if (bucket) bucket.addEventListener('change', (e) => { this.bucketFilter = e.target.value; this.render(); });
    this.container.querySelectorAll('[data-client]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.client && typeof this.onOpenClient === 'function') this.onOpenClient(btn.dataset.client);
      });
    });
  }
}

export default PaymentsScreen;
