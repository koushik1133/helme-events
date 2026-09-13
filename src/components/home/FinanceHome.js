/**
 * FinanceHome.js — the Finance / Accounts home.
 *
 * This is the one role where a TABLE beats tiles: the receivables ageing table
 * is the screen. It is split deliberately, per the research:
 *
 *   · UPCOMING  — pre-event advances and milestones, scheduled, not yet due.
 *                 Nearly risk-free once received.
 *   · OVERDUE   — post-event corporate invoices at 30–60 day terms. This is
 *                 the entire ageing problem. Bucketed 0-30 / 31-60 / 61-90 / 90+.
 *
 * Lumping the two into one "outstanding" number destroys the signal, so the
 * hero states the total and immediately splits it.
 *
 * TDS is treated as SETTLEMENT, not shortfall. A corporate client who deducts
 * ₹22,000 under 194C has paid in full; if Helm counted that as outstanding,
 * every corporate deal would look permanently unpaid.
 */

import { hero, kpiTiles, card, emptyState, needsList, formatMoney, formatMoneyShort } from './homeUI.js';
import {
  isFresh,
  receivablesAgeing, upcomingMilestones, clientName, recentActivity, relativeTime,
  milestoneBalance, daysUntil
} from './homeData.js';
import { escapeHtml } from '../../utils/format.js';
import { formatEventDate } from '../../data/eventState.js';
import { activityList } from './homeUI.js';

const BUCKET_LABEL = { 0: '1–30 days', 30: '31–60 days', 60: '61–90 days', 90: '90+ days' };

function ageingTable(rows) {
  if (!rows.length) {
    return emptyState({
      mark: '✓', good: true,
      title: 'Nothing is overdue',
      body: 'Every invoice past its due date has been settled. Scheduled dues that have not fallen due yet are in the table below.'
    });
  }
  const total = rows.reduce((s, r) => s + r.balance, 0);
  return `
    <div class="hh-tablewrap">
      <table class="hh-table">
        <thead>
          <tr>
            <th scope="col">Client &amp; event</th>
            <th scope="col">Milestone</th>
            <th scope="col">Due</th>
            <th scope="col">Ageing</th>
            <th scope="col" class="hh-r">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 12).map(r => `
            <tr tabindex="0" role="link" data-go="deal" data-param="${escapeHtml(r.deal.id || '')}"
                aria-label="${escapeHtml(`${r.client}, ${formatMoney(r.balance)} overdue by ${r.overdueBy} days. Open event.`)}">
              <td>
                <div>${escapeHtml(r.client)}</div>
                <div class="hh-sub">${escapeHtml(r.deal.title || r.deal.code || 'Event')}</div>
              </td>
              <td>${escapeHtml(r.milestone.label || 'Payment')}</td>
              <td class="hh-num">${escapeHtml(formatEventDate(r.milestone.dueDate))}</td>
              <td><span class="hh-age" data-b="${r.bucket}">${escapeHtml(BUCKET_LABEL[r.bucket])}</span></td>
              <td class="hh-r">${escapeHtml(formatMoney(r.balance))}</td>
            </tr>`).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4">${rows.length > 12 ? `Showing 12 of ${rows.length} overdue items` : `${rows.length} overdue item${rows.length === 1 ? '' : 's'}`}</td>
            <td class="hh-r">${escapeHtml(formatMoney(total))}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}

function upcomingTable(model, items) {
  if (!items.length) {
    return emptyState({
      mark: '◦',
      title: 'No dues in the next 30 days',
      body: 'Booking advances and pre-event milestones appear here as soon as a deal is won and its payment schedule is set.'
    });
  }
  return `
    <div class="hh-tablewrap">
      <table class="hh-table">
        <thead>
          <tr>
            <th scope="col">Client &amp; event</th>
            <th scope="col">Milestone</th>
            <th scope="col">Due</th>
            <th scope="col">In</th>
            <th scope="col" class="hh-r">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.slice(0, 10).map(m => {
            const deal = model.dealById.get(m.dealId) || { id: m.dealId, title: 'Unlinked milestone' };
            const inDays = daysUntil(m.dueDate, model.today);
            return `
              <tr tabindex="0" role="link" data-go="deal" data-param="${escapeHtml(deal.id || '')}"
                  aria-label="${escapeHtml(`${clientName(model, deal)}, ${formatMoney(milestoneBalance(m))} due in ${inDays} days. Open event.`)}">
                <td>
                  <div>${escapeHtml(clientName(model, deal))}</div>
                  <div class="hh-sub">${escapeHtml(deal.title || deal.code || 'Event')}</div>
                </td>
                <td>${escapeHtml(m.label || 'Payment')}</td>
                <td class="hh-num">${escapeHtml(formatEventDate(m.dueDate))}</td>
                <td class="hh-num">${inDays === 0 ? 'today' : `${inDays}d`}</td>
                <td class="hh-r">${escapeHtml(formatMoney(milestoneBalance(m)))}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

export function renderFinanceHome(model) {
  const ageing = receivablesAgeing(model);
  const upcoming = upcomingMilestones(model, 30);
  const monthPrefix = model.today.slice(0, 7);
  const receivedThisMonth = model.receipts
    .filter(r => String(r.receivedOn || '').slice(0, 7) === monthPrefix)
    .reduce((s, r) => s + Math.round(Number(r.amount || 0)), 0);
  const tdsThisMonth = model.receipts
    .filter(r => String(r.receivedOn || '').slice(0, 7) === monthPrefix)
    .reduce((s, r) => s + Math.round(Number(r.tdsDeducted || 0)), 0);

  const heroHtml = hero({
    label: 'Total outstanding',
    value: ageing.total ? formatMoney(ageing.total) : '₹0',
    tone: ageing.overdue > 0 ? 'warn' : '',
    sub: ageing.total
      ? `${formatMoney(ageing.overdue)} is past its due date; ${formatMoney(ageing.upcoming)} is scheduled but not yet due. Amounts are GST-inclusive and net of TDS already deducted.`
      : 'Nothing is outstanding. Milestones appear here as soon as a won deal has a payment schedule.',
    facts: [
      { label: 'Overdue', value: formatMoneyShort(ageing.overdue) },
      { label: 'Received this month', value: formatMoneyShort(receivedThisMonth) },
      { label: 'TDS deducted this month', value: formatMoneyShort(tdsThisMonth) }
    ],
    actions: [
      { go: 'payments', label: 'Record a receipt', primary: true },
      { go: 'invoices', label: 'Invoices' }
    ]
  });

  const buckets = kpiTiles([
    { label: '1–30 days', value: formatMoneyShort(ageing.buckets[0]), meta: 'Just past due', tone: 'amber', go: 'payments', param: 'age-0-30' },
    { label: '31–60 days', value: formatMoneyShort(ageing.buckets[30]), meta: 'Chase now', tone: 'amber', go: 'payments', param: 'age-31-60' },
    { label: '61–90 days', value: formatMoneyShort(ageing.buckets[60]), meta: 'Escalate', tone: 'rose', go: 'payments', param: 'age-61-90' },
    { label: '90+ days', value: formatMoneyShort(ageing.buckets[90]), meta: 'At risk', tone: 'rose', go: 'payments', param: 'age-90' }
  ]);

  const activity = recentActivity(model).map(a => ({ ...a, when: relativeTime(a.at) }));

  return `
    ${heroHtml}
    ${buckets}
    ${card({
      title: 'Overdue — post-event receivables',
      badge: ageing.rows.length,
      badgeHot: ageing.rows.length > 0,
      action: { go: 'payments', label: 'All receivables' },
      body: ageingTable(ageing.rows)
    })}
    ${card({
      title: 'Upcoming — pre-event, next 30 days',
      badge: upcoming.length,
      action: { go: 'payments', label: 'Full schedule' },
      body: upcomingTable(model, upcoming)
    })}
    ${card({ title: 'Recent activity', body: activityList(activity) })}
    <p class="hh-honest">TDS deducted by a client is treated as settled, not as a shortfall — a ₹11,80,000 invoice cleared by ₹11,58,000 plus ₹22,000 of 194C TDS shows as fully paid.</p>
  `;
}
