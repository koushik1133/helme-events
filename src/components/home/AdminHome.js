/**
 * AdminHome.js — the Director / Owner home.
 *
 * Research (event-manager-workflow §6): the owner's one screen is
 * "cash & pipeline" — money in vs receivables ageing, confirmed events ahead,
 * and balances still outstanding as an event date approaches.
 *
 * Hero: booked value this financial year. Everything else is a link into a
 * filtered list; no chart sits above the fold.
 */

import {
  hero, kpiTiles, card, needsList, calendarStripHtml, activityList, emptyState, notConnected,
  formatMoney, formatMoneyShort
} from './homeUI.js';
import {
  bookedThisFY, weightedPipeline, receivablesAgeing, upcomingEvents, scopedDeals,
  calendarStrip, recentActivity, relativeTime, unansweredEnquiries, clientName,
  dealValue, daysUntil, milestoneBalance, openMilestones, isFresh
} from './homeData.js';
import { formatEventDate } from '../../data/eventState.js';

/** Money actually received this calendar month, net of nothing — receipts only. */
function receivedThisMonth(model) {
  const prefix = model.today.slice(0, 7);
  return model.receipts
    .filter(r => String(r.receivedOn || '').slice(0, 7) === prefix)
    .reduce((s, r) => s + Math.round(Number(r.amount || 0) + Number(r.tdsDeducted || 0)), 0);
}

export function renderAdminHome(model) {
  const ageing = receivablesAgeing(model);
  const booked = bookedThisFY(model);
  const pipeline = weightedPipeline(scopedDeals(model));
  const events90 = upcomingEvents(model, 90);
  const received = receivedThisMonth(model);

  const heroHtml = hero({
    label: `Booked this year · ${model.fy.label}`,
    value: booked ? formatMoney(booked) : '₹0',
    tone: ageing.overdue > 0 ? 'warn' : '',
    sub: booked
      ? 'Signed contract value, excluding GST. Collections and the receivables ageing sit below.'
      : 'Nothing booked in this financial year yet. Won deals will total here.',
    facts: [
      { label: 'Received this month', value: formatMoneyShort(received) },
      { label: 'Outstanding', value: formatMoneyShort(ageing.total) },
      { label: 'Confirmed, next 90 days', value: String(events90.length) }
    ],
    actions: [
      { go: 'payments', label: 'Open payments', primary: true },
      { go: 'pipeline', label: 'Pipeline' }
    ]
  });

  const tiles = kpiTiles([
    { label: 'Overdue', value: formatMoneyShort(ageing.overdue), meta: `${ageing.rows.length} invoice${ageing.rows.length === 1 ? '' : 's'} past due`, tone: ageing.overdue ? 'rose' : 'emerald', go: 'payments', param: 'overdue' },
    { label: 'Upcoming dues', value: formatMoneyShort(ageing.upcoming), meta: 'Scheduled, not yet due', tone: 'amber', go: 'payments', param: 'upcoming' },
    { label: 'Weighted pipeline', value: formatMoneyShort(pipeline), meta: 'Open deals × stage probability', tone: 'violet', go: 'pipeline' },
    { label: 'Events ahead', value: String(events90.length), meta: 'Confirmed in the next 90 days', tone: 'indigo', go: 'events', param: 'upcoming' }
  ]);

  /* --- "Needs you today": overdue money first, then risk on upcoming events. */
  const needs = [];

  ageing.rows.slice(0, 4).forEach(r => {
    needs.push({
      severity: r.overdueBy > 30 ? 'critical' : 'warn',
      title: `${r.client} — ${r.milestone.label || 'Payment'} overdue`,
      meta: `${r.deal.title || r.deal.code || 'Event'} · due ${formatEventDate(r.milestone.dueDate)} · ${r.overdueBy} days late`,
      right: formatMoney(r.balance),
      rightSub: 'outstanding',
      go: 'deal', param: r.deal.id
    });
  });

  // A balance still outstanding with the event date closing in is the single
  // most expensive thing on an event company's books.
  openMilestones(model).forEach(m => {
    const deal = model.dealById.get(m.dealId);
    if (!deal || !deal.eventStartDate) return;
    const d = daysUntil(deal.eventStartDate, model.today);
    if (d == null || d < 0 || d > 14) return;
    if (m.dueDate && m.dueDate < model.today) return; // already counted as overdue
    needs.push({
      severity: d <= 3 ? 'critical' : 'warn',
      title: `${clientName(model, deal)} — balance due before load-in`,
      meta: `${deal.title || deal.code} · event in ${d} day${d === 1 ? '' : 's'}`,
      right: formatMoney(milestoneBalance(m)),
      rightSub: 'unpaid',
      go: 'deal', param: deal.id
    });
  });

  events90.filter(d => !d.eventManagerId).slice(0, 3).forEach(d => {
    needs.push({
      severity: 'warn',
      title: `${d.title || d.code} has no event manager`,
      meta: `${formatEventDate(d.eventStartDate)} · ${(d.venue && d.venue.name) || d.city || 'Venue TBC'}`,
      right: formatMoneyShort(dealValue(d)),
      rightSub: 'contract',
      go: 'deal', param: d.id
    });
  });

  unansweredEnquiries(model).filter(e => (e.hours ?? 0) >= 4).slice(0, 3).forEach(e => {
    needs.push({
      severity: 'critical',
      title: `${e.client} enquiry still unanswered`,
      meta: 'Nobody on the team has replied yet',
      clock: { sla: e.sla, text: `${Math.floor(e.hours)}h` },
      go: 'enquiry', param: e.deal.id
    });
  });

  const needsHtml = card({
    title: 'Needs you today',
    badge: needs.length,
    badgeHot: needs.some(n => n.severity === 'critical'),
    action: { go: 'payments', label: 'All payments' },
    body: needsList(needs.slice(0, 8), (model.connected && !isFresh(model))
      ? { mark: '✓', good: true, title: 'Nothing is on fire', body: 'No overdue money, every confirmed event has a manager, and every enquiry has had a reply.' }
      : { mark: '◌', title: 'Nothing recorded yet', body: 'Overdue payments, events without a manager and unanswered enquiries all surface here. Add the first enquiry and this list starts working for you.', action: { go: 'new-enquiry', label: 'Add the first enquiry' } })
  });

  const activity = recentActivity(model).map(a => ({ ...a, when: relativeTime(a.at) }));

  return `
    ${heroHtml}
    ${tiles}
    ${needsHtml}
    <div class="hh-split">
      ${card({ title: 'Next seven days', action: { go: 'calendar', label: 'Calendar' }, body: calendarStripHtml(calendarStrip(model, { includeMoney: true })) })}
      ${card({ title: 'Recent activity', body: activityList(activity) })}
    </div>
    ${model.connected ? '' : card({ title: 'Getting started', body: notConnected('Director') })}
  `;
}
