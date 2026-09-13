/**
 * EventManagerHome.js — the Event / Production Manager home.
 *
 * Research: this role's one screen is a SINGLE-EVENT WORKSPACE — function by
 * function, vendors with confirm status, the production sheet, open approvals
 * and what is missing. So the hero is the next event and its countdown, and
 * everything under it is that event's readiness.
 *
 * NO PAYMENT DATA AT ALL on this screen: no contract value, no balances, no
 * margin, no rupee symbol. That is deliberate and matches the "can see money"
 * axis in the role research.
 */

import {
  hero, kpiTiles, card, needsList, calendarStripHtml, activityList, notConnected
} from './homeUI.js';
import {
  myEvents, openTasks, unconfirmedVendors, calendarStrip, recentActivity,
  relativeTime, clientName, daysUntil, isFresh
} from './homeData.js';
import { formatEventDate } from '../../data/eventState.js';
import { formatNumber } from '../../utils/format.js';

/** Functions (mehendi, sangeet, reception…) — or one row for a single-day event. */
function functionsOf(deal) {
  if (Array.isArray(deal.functions) && deal.functions.length) return deal.functions;
  if (Array.isArray(deal.eventDates) && deal.eventDates.length) return deal.eventDates;
  return [deal];
}

const PHASE_NOTE = {
  booked: 'Booked — planning has not started',
  planning: 'In planning',
  in_production: 'In production',
  live: 'Live today',
  delivered: 'Delivered — wrap pending'
};

export function renderEventManagerHome(model) {
  const events = myEvents(model, 120);
  const next = events[0] || null;
  const countdown = next ? daysUntil(next.eventStartDate, model.today) : null;

  const nextVendors = next ? unconfirmedVendors(next) : [];
  const allTasks = openTasks(events, model.today);
  const overdueTasks = allTasks.filter(t => t.overdue);

  const heroHtml = next
    ? hero({
        label: 'Next event',
        value: countdown === 0 ? 'Today' : countdown === 1 ? 'Tomorrow' : `${countdown} days`,
        tone: countdown != null && countdown <= 7 ? 'warn' : '',
        sub: `${next.title || next.code} · ${clientName(model, next)} · ${formatEventDate(next.eventStartDate)} · ${(next.venue && next.venue.name) || next.city || 'Venue TBC'}`,
        facts: [
          { label: 'Guests', value: next.guestCount ? formatNumber(next.guestCount) : 'TBC' },
          { label: 'Functions', value: String(functionsOf(next).length) },
          { label: 'Status', value: PHASE_NOTE[next.stage] || 'Confirmed' }
        ],
        actions: [
          { go: 'deal', param: next.id, label: 'Open event workspace', primary: true },
          { go: 'studio360', label: 'Open 360° view' }
        ]
      })
    : hero({
        label: 'Next event',
        value: 'Nothing scheduled',
        sub: 'No confirmed event is assigned to you yet. When sales marks a deal won and you are named as its producer, it lands here with a countdown.',
        facts: [
          { label: 'Events assigned', value: '0' },
          { label: 'Open tasks', value: '0' },
          { label: 'Vendors pending', value: '0' }
        ],
        actions: [{ go: 'events', label: 'Browse all events' }]
      });

  // Indian weddings are multi-function: the unit of production is the function,
  // not the event, so it gets a tile of its own.
  const functionCount = events.reduce((sum, e) => sum + functionsOf(e).length, 0);
  const vendorCount = events.reduce((sum, e) => sum + unconfirmedVendors(e).length, 0);

  const tiles = kpiTiles([
    { label: 'Events assigned', value: String(events.length), meta: 'Confirmed, next 120 days', tone: 'violet', go: 'events', param: 'mine' },
    { label: 'Functions to run', value: String(functionCount), meta: next ? `${functionsOf(next).length} on the next event` : 'Across your events', tone: 'indigo', go: 'events', param: 'functions' },
    { label: 'Overdue tasks', value: String(overdueTasks.length), meta: overdueTasks.length ? 'Past their due date' : 'Nothing late', tone: overdueTasks.length ? 'rose' : 'emerald', go: 'tasks', param: 'overdue' },
    { label: 'Vendors to confirm', value: String(vendorCount), meta: next ? `${nextVendors.length} on the next event` : 'Across your events', tone: 'amber', go: 'vendors' }
  ]);

  /* ---------- what is missing on the events closest to their date ---------- */
  const needs = [];

  overdueTasks.slice(0, 4).forEach(t => {
    needs.push({
      severity: 'critical',
      title: t.task.label || 'Untitled task',
      meta: `${t.deal.title || t.deal.code} · was due ${formatEventDate(t.task.due)}`,
      right: 'Overdue',
      go: 'deal', param: t.deal.id
    });
  });

  events.slice(0, 3).forEach(e => {
    const d = daysUntil(e.eventStartDate, model.today);
    const pending = unconfirmedVendors(e);
    if (pending.length && d != null && d <= 21) {
      needs.push({
        severity: d <= 7 ? 'critical' : 'warn',
        title: `${pending.length} vendor${pending.length === 1 ? '' : 's'} unconfirmed on ${e.title || e.code}`,
        meta: `${pending.slice(0, 3).map(v => v.service || v.name).join(', ')} · event in ${d} day${d === 1 ? '' : 's'}`,
        right: `T-${d}`,
        go: 'deal', param: e.id
      });
    }
    if (!e.recceDoneAt && d != null && d <= 30) {
      needs.push({
        severity: 'warn',
        title: `Site recce not recorded for ${e.title || e.code}`,
        meta: `${(e.venue && e.venue.name) || e.city || 'Venue TBC'} · measurements, power and load-in access still unknown`,
        right: `T-${d}`,
        go: 'deal', param: e.id
      });
    }
    if (!e.productionSheetAt && d != null && d <= 14) {
      needs.push({
        severity: d <= 5 ? 'critical' : 'warn',
        title: `Production sheet not issued for ${e.title || e.code}`,
        meta: 'Run of show, staffing and load-in timings are not out to the crew yet',
        right: `T-${d}`,
        go: 'deal', param: e.id
      });
    }
  });

  allTasks.filter(t => !t.overdue).slice(0, 4).forEach(t => {
    needs.push({
      severity: 'info',
      title: t.task.label || 'Untitled task',
      meta: `${t.deal.title || t.deal.code}${t.task.due ? ` · due ${formatEventDate(t.task.due)}` : ''}`,
      right: t.task.due ? formatEventDate(t.task.due) : 'No date',
      go: 'deal', param: t.deal.id
    });
  });

  const needsHtml = card({
    title: 'Needs you today',
    badge: needs.length,
    badgeHot: needs.some(n => n.severity === 'critical'),
    action: { go: 'tasks', label: 'All tasks' },
    body: needsList(needs.slice(0, 8), (model.connected && !isFresh(model))
      ? { mark: '✓', good: true, title: 'Every event is on track', body: 'No overdue tasks, no unconfirmed vendors inside three weeks, and every recce is recorded.' }
      : { mark: '◌', title: 'No events assigned yet', body: 'Overdue tasks, unconfirmed vendors and missing recces appear here once a won event names you as its producer.' })
  });

  const activity = recentActivity(model).map(a => ({ ...a, when: relativeTime(a.at) }));

  return `
    ${heroHtml}
    ${tiles}
    ${needsHtml}
    <div class="hh-split">
      ${card({ title: 'Next seven days', action: { go: 'calendar', label: 'Calendar' }, body: calendarStripHtml(calendarStrip(model, { includeMoney: false })) })}
      ${card({ title: 'Recent activity', body: activityList(activity) })}
    </div>
    ${model.connected ? '' : card({ title: 'Getting started', body: notConnected('Event Manager') })}
  `;
}
