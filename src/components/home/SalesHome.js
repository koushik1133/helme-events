/**
 * SalesHome.js — the Sales Manager home.
 *
 * The highest-ROI element in the whole product, per the research, is an
 * enquiry inbox with a response-time clock:
 *   · 66% of clients book the FIRST supplier who responds
 *   · replying within 5 minutes converts ~21x better than replying at an hour
 *   · the industry median first reply is ~11 hours
 * So unanswered enquiries are the loudest block on this screen, sorted oldest
 * first, with the clock always visible.
 *
 * No company financials here — this role sees its own pipeline, never the
 * company's cash position, receivables or margin.
 */

import {
  hero, kpiTiles, card, needsList, calendarStripHtml, activityList, emptyState,
  formatMoney, formatMoneyShort
} from './homeUI.js';
import {
  scopedDeals, weightedPipeline, isOpenSales, isWon, dealValue, clientName,
  calendarStrip, recentActivity, relativeTime, unansweredEnquiries,
  STAGE_LABEL, STAGE_PROBABILITY, formatAge, daysUntil, hoursSince, slaBand, dealHeading, isFresh
} from './homeData.js';
import { formatEventDate } from '../../data/eventState.js';

export function renderSalesHome(model) {
  const mine = scopedDeals(model);
  const open = mine.filter(isOpenSales);
  const weighted = weightedPipeline(mine);
  const enquiries = unansweredEnquiries(model);
  const proposals = open.filter(d => d.stage === 'proposal_sent' || d.stage === 'negotiation');

  const monthPrefix = model.today.slice(0, 7);
  const wonThisMonth = mine.filter(d => isWon(d) &&
    String(d.wonAt || d.contractSignedAt || d.stageChangedAt || '').slice(0, 7) === monthPrefix);

  const heroHtml = hero({
    label: 'My weighted pipeline',
    value: weighted ? formatMoney(weighted) : '₹0',
    tone: enquiries.some(e => e.sla === 'late') ? 'warn' : '',
    sub: open.length
      ? `${open.length} open deal${open.length === 1 ? '' : 's'}, each counted at its stage probability. Full value if every one of them closed: ${formatMoney(open.reduce((s, d) => s + dealValue(d), 0))}.`
      : 'No open deals yet. Add an enquiry and it starts counting here at 10%.',
    facts: [
      { label: 'Open deals', value: String(open.length) },
      { label: 'Won this month', value: String(wonThisMonth.length) },
      { label: 'Proposals out', value: String(proposals.length) }
    ],
    actions: [
      { go: 'new-enquiry', label: 'New enquiry', primary: true },
      { go: 'pipeline', label: 'My pipeline' }
    ]
  });

  const oldest = enquiries[0];
  const tiles = kpiTiles([
    {
      label: 'Unanswered enquiries',
      value: String(enquiries.length),
      meta: oldest ? `Oldest waiting ${formatAge(oldest.hours)}` : 'Every enquiry has had a reply',
      tone: enquiries.length ? 'rose' : 'emerald',
      go: 'enquiries'
    },
    { label: 'Proposals out', value: String(proposals.length), meta: `${formatMoneyShort(proposals.reduce((s, d) => s + dealValue(d), 0))} in play`, tone: 'amber', go: 'pipeline', param: 'proposal_sent' },
    { label: 'Site visits', value: String(open.filter(d => d.stage === 'site_visit').length), meta: 'Recce booked or pending', tone: 'violet', go: 'pipeline', param: 'site_visit' },
    { label: 'Won this month', value: formatMoneyShort(wonThisMonth.reduce((s, d) => s + dealValue(d), 0)), meta: `${wonThisMonth.length} deal${wonThisMonth.length === 1 ? '' : 's'} signed`, tone: 'emerald', go: 'pipeline', param: 'won' }
  ]);

  /* ---- the enquiry inbox: the loudest thing on this screen, oldest first. */
  const inbox = enquiries.slice(0, 8).map(e => ({
    severity: e.sla === 'late' ? 'critical' : e.sla === 'warn' ? 'warn' : 'info',
    title: dealHeading(model, e.deal),
    meta: [
      e.deal.category ? String(e.deal.category).replace(/_/g, ' ') : null,
      e.deal.eventStartDate ? formatEventDate(e.deal.eventStartDate) : 'Date TBC',
      e.deal.guestCount ? `${e.deal.guestCount} guests` : null,
      e.deal.source ? `via ${String(e.deal.source).replace(/_/g, ' ')}` : null
    ].filter(Boolean).join(' · '),
    clock: { sla: e.sla, text: formatAge(e.hours) },
    go: 'enquiry', param: e.deal.id
  }));

  const inboxHtml = card({
    title: 'Enquiry inbox — nobody has replied yet',
    badge: enquiries.length,
    badgeHot: enquiries.some(e => e.sla === 'late'),
    action: { go: 'enquiries', label: 'Open inbox' },
    body: needsList(inbox, isFresh(model)
      ? { mark: '◌', title: 'No enquiries yet',
          body: 'Every enquiry lands here with a clock running from the moment it arrived. Two thirds of clients book whoever replies first, so this is the box to keep empty.',
          action: { go: 'new-enquiry', label: 'Add the first enquiry' } }
      : { mark: '✓', good: true, title: 'Inbox clear',
          body: 'Every enquiry has had a first reply. Two thirds of clients book whoever answers first, so this is the box to keep empty.' })
  });

  /* ---- follow-ups: deals that have gone quiet, and events closing in. */
  const followByDeal = new Map();
  const addFollow = (dealId, item) => {
    const existing = followByDeal.get(dealId);
    // One row per deal — the most urgent reason wins.
    if (existing && existing.severity === 'critical') return;
    followByDeal.set(dealId, item);
  };
  open.filter(d => d.firstRespondedAt).forEach(d => {
    const since = hoursSince(d.lastContactAt || d.firstRespondedAt);
    const days = since == null ? null : Math.floor(since / 24);
    if (days == null || days < 3) return;
    addFollow(d.id, {
      severity: days >= 10 ? 'critical' : 'warn',
      title: `${clientName(model, d)} — no contact for ${days} days`,
      meta: `${STAGE_LABEL[d.stage] || d.stage} · ${Math.round((Number(d.probability ?? STAGE_PROBABILITY[d.stage] ?? 0) > 1 ? Number(d.probability) : Number(d.probability ?? STAGE_PROBABILITY[d.stage] ?? 0) * 100))}% · ${formatMoneyShort(dealValue(d))}`,
      right: d.nextFollowUp ? formatEventDate(d.nextFollowUp) : 'No follow-up set',
      rightSub: d.nextFollowUp ? 'follow-up' : '',
      go: 'deal', param: d.id
    });
  });
  open.forEach(d => {
    const dd = d.eventStartDate ? daysUntil(d.eventStartDate, model.today) : null;
    if (dd == null || dd < 0 || dd > 21) return;
    addFollow(d.id, {
      severity: 'critical',
      title: `${clientName(model, d)} — event in ${dd} day${dd === 1 ? '' : 's'}, still unsigned`,
      meta: `${STAGE_LABEL[d.stage] || d.stage} · ${(d.venue && d.venue.name) || d.city || 'Venue TBC'}`,
      right: formatMoneyShort(dealValue(d)),
      rightSub: 'quoted',
      go: 'deal', param: d.id
    });
  });
  const follow = [...followByDeal.values()]
    .sort((a, b) => (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1));

  const followHtml = card({
    title: 'Needs a follow-up',
    badge: follow.length,
    badgeHot: follow.some(f => f.severity === 'critical'),
    body: needsList(follow.slice(0, 6), {
      mark: '✓', good: true,
      title: 'Every open deal is warm',
      body: 'Nothing in your pipeline has gone quiet for more than three days.'
    })
  });

  const activity = recentActivity(model).map(a => ({ ...a, when: relativeTime(a.at) }));

  return `
    ${heroHtml}
    ${tiles}
    ${inboxHtml}
    ${followHtml}
    <div class="hh-split">
      ${card({ title: 'Next seven days', action: { go: 'calendar', label: 'Calendar' }, body: calendarStripHtml(calendarStrip(model, { includeMoney: false })) })}
      ${card({ title: 'Recent activity', body: activityList(activity) })}
    </div>
  `;
}
