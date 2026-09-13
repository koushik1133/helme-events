/**
 * shared.js — the small pieces every CRM screen renders the same way.
 * Money always through src/utils/format.js; text always through escapeHtml.
 */

import { formatMoney, formatMoneyShort, escapeHtml } from '../../utils/format.js';
import { formatEventDate } from '../../data/eventState.js';
import { stageLabel, CLIENT_SOURCES, CLIENT_TYPES, PAYMENT_MODES } from '../../crm/schema.js';

export { formatMoney, formatMoneyShort, escapeHtml, formatEventDate };

const SOURCE_LABELS = Object.fromEntries(CLIENT_SOURCES.map(s => [s.id, s.label]));
const TYPE_LABELS = Object.fromEntries(CLIENT_TYPES.map(s => [s.id, s.label]));
const MODE_LABELS = Object.fromEntries(PAYMENT_MODES.map(s => [s.id, s.label]));

export const sourceLabel = (id) => SOURCE_LABELS[id] || (id ? id : 'Source not recorded');
export const typeLabel = (id) => TYPE_LABELS[id] || id || '—';
export const modeLabel = (id) => MODE_LABELS[id] || id || '—';

export function chip(text, tone = 'muted') {
  return `<span class="crm-chip" data-tone="${escapeHtml(tone)}">${escapeHtml(text)}</span>`;
}

export function stageChip(stage) {
  const tone = stage === 'lost' || stage === 'dropped' ? 'muted'
    : stage === 'cancelled' ? 'danger'
    : stage === 'settled' || stage === 'delivered' ? 'good'
    : stage === 'live' || stage === 'in_production' ? 'warn'
    : 'info';
  return chip(stageLabel(stage), tone);
}

export function kpi({ label, value, note = '', tone = '', action = '' }) {
  return `
    <button class="crm-kpi" type="button"${tone ? ` data-tone="${escapeHtml(tone)}"` : ''}${action ? ` data-action="${escapeHtml(action)}"` : ''}>
      <span class="crm-kpi-label">${escapeHtml(label)}</span>
      <span class="crm-kpi-value">${escapeHtml(value)}</span>
      ${note ? `<span class="crm-kpi-note">${escapeHtml(note)}</span>` : ''}
    </button>`;
}

/** A real empty state: says what is missing, and offers the way out of it. */
export function emptyState({ title, body, actionLabel = '', action = '' }) {
  return `
    <div class="crm-empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${actionLabel ? `<button class="crm-btn" data-variant="primary" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>` : ''}
    </div>`;
}

/** "12 Sep 2026 – 16 Sep 2026 · 5 functions" for a multi-day deal. */
export function dateRangeLabel(deal) {
  const dates = (deal.eventDates || []).map(x => (typeof x === 'string' ? x : x?.date)).filter(Boolean).sort();
  if (!dates.length) return 'Dates not set';
  const fnCount = (deal.functions || []).length;
  const range = dates.length === 1 || dates[0] === dates[dates.length - 1]
    ? formatEventDate(dates[0])
    : `${formatEventDate(dates[0])} – ${formatEventDate(dates[dates.length - 1])}`;
  return fnCount > 1 ? `${range} · ${fnCount} functions` : range;
}

export function relativeDays(days) {
  const n = Number(days) || 0;
  if (n === 0) return 'today';
  if (n > 0) return `in ${n} day${n === 1 ? '' : 's'}`;
  return `${Math.abs(n)} day${Math.abs(n) === 1 ? '' : 's'} ago`;
}
