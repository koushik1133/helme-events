/**
 * homeUI.js — the shared building blocks every role home is assembled from.
 *
 * Each helper returns an HTML string. Interaction is delegated from one
 * listener on the root (see HomeScreen.js), so every clickable thing carries
 * `data-go` (a route) and optional `data-param`. Everything clickable is a
 * real <button> so it is keyboard reachable with an accessible name.
 */

import { escapeHtml, formatMoney, formatMoneyShort } from '../../utils/format.js';

/** One hero number. Never more than one per screen — it is the front door. */
export function hero({ label, value, sub = '', tone = '', facts = [], actions = [] }) {
  const factHtml = facts.map(f => `
    <div class="hh-fact">
      <dt>${escapeHtml(f.label)}</dt>
      <dd class="hh-num">${escapeHtml(f.value)}</dd>
    </div>`).join('');
  const actionHtml = actions.map(a => `
    <button type="button" class="hh-btn${a.primary ? ' is-primary' : ''}"
            data-go="${escapeHtml(a.go)}"${a.param ? ` data-param="${escapeHtml(a.param)}"` : ''}>
      ${escapeHtml(a.label)}
    </button>`).join('');
  return `
    <section class="hh-hero${tone ? ` is-${escapeHtml(tone)}` : ''}" aria-labelledby="hh-hero-label">
      <div>
        <p class="hh-hero-label" id="hh-hero-label">${escapeHtml(label)}</p>
        <p class="hh-hero-value hh-num">${escapeHtml(value)}</p>
        ${sub ? `<p class="hh-hero-sub">${escapeHtml(sub)}</p>` : ''}
        ${actionHtml ? `<div class="hh-hero-cta">${actionHtml}</div>` : ''}
      </div>
      ${factHtml ? `<dl class="hh-hero-side">${factHtml}</dl>` : '<div></div>'}
    </section>`;
}

/**
 * 3–5 tiles. Never more than five: the research is explicit that HoneyBook
 * shipped eleven toggleable widgets because it could not choose, and its
 * mobile home — where it had to choose — is four.
 */
export function kpiTiles(tiles) {
  const list = tiles.slice(0, 5);
  return `
    <div class="hh-kpis" role="list">
      ${list.map(t => `
        <button type="button" class="hh-tile" role="listitem" data-tone="${escapeHtml(t.tone || 'indigo')}"
                data-go="${escapeHtml(t.go)}"${t.param ? ` data-param="${escapeHtml(t.param)}"` : ''}
                aria-label="${escapeHtml(`${t.label}: ${t.value}. ${t.meta || ''} Open list.`)}">
          <span class="hh-tile-go" aria-hidden="true">→</span>
          <span class="hh-tile-k"><span class="hh-swatch" aria-hidden="true"></span>${escapeHtml(t.label)}</span>
          <span class="hh-tile-v hh-num">${escapeHtml(t.value)}</span>
          ${t.meta ? `<span class="hh-tile-m">${escapeHtml(t.meta)}</span>` : ''}
        </button>`).join('')}
    </div>`;
}

export function card({ title, badge = null, badgeHot = false, action = null, body }) {
  return `
    <section class="hh-card">
      <header class="hh-card-head">
        <h2>${escapeHtml(title)}${badge != null ? `<span class="hh-count${badgeHot ? ' is-hot' : ''}">${escapeHtml(String(badge))}</span>` : ''}</h2>
        ${action ? `<button type="button" class="hh-link" data-go="${escapeHtml(action.go)}">${escapeHtml(action.label)}</button>` : ''}
      </header>
      ${body}
    </section>`;
}

/**
 * The "Needs you today" list — the next-best-action block. It outranks every
 * chart on this screen by design; charts live below the fold or on /reports.
 * `items`: { severity, title, meta, right, rightSub, clock, go, param }
 */
export function needsList(items, emptyOpts) {
  if (!items.length) return emptyState(emptyOpts);
  return `
    <ul class="hh-needs">
      ${items.map(i => `
        <li>
          <button type="button" class="hh-need" data-sev="${escapeHtml(i.severity || 'info')}"
                  data-go="${escapeHtml(i.go)}"${i.param ? ` data-param="${escapeHtml(i.param)}"` : ''}>
            <span class="hh-need-bar" aria-hidden="true"></span>
            <span>
              <span class="hh-need-t">${escapeHtml(i.title)}</span>
              <span class="hh-need-m">${escapeHtml(i.meta || '')}</span>
            </span>
            <span class="hh-need-r hh-num">${
              i.clock
                ? `<span class="hh-clock" data-sla="${escapeHtml(i.clock.sla)}">${escapeHtml(i.clock.text)}</span>`
                : `${escapeHtml(i.right || '')}${i.rightSub ? `<small>${escapeHtml(i.rightSub)}</small>` : ''}`
            }</span>
            <span class="hh-need-go" aria-hidden="true">›</span>
          </button>
        </li>`).join('')}
    </ul>`;
}

/** Seven days of what is actually happening. Below the "needs you" block. */
export function calendarStripHtml(days) {
  return `
    <div class="hh-days">
      ${days.map(d => {
        const chips = [
          ...d.events.map(e => `<span class="hh-chip" data-kind="${d.isToday ? 'live' : 'event'}">${escapeHtml(e.title || e.code || 'Event')}</span>`),
          ...d.money.map(m => `<span class="hh-chip" data-kind="money">${escapeHtml(formatMoneyShort(m.amountDueGross ?? m.amountDue ?? 0))} due</span>`)
        ].slice(0, 3);
        const count = d.events.length + d.money.length;
        return `
          <button type="button" class="hh-day${d.isToday ? ' is-today' : ''}" data-go="calendar" data-param="${escapeHtml(d.iso)}"
                  aria-label="${escapeHtml(`${d.dow} ${d.dayNum} ${d.month}: ${count} item${count === 1 ? '' : 's'}`)}">
            <span class="hh-day-d">${escapeHtml(d.dow)}</span>
            <span class="hh-day-n hh-num">${escapeHtml(String(d.dayNum))}</span>
            ${chips.join('')}
          </button>`;
      }).join('')}
    </div>`;
}

export function activityList(items) {
  if (!items.length) {
    return emptyState({
      mark: '◦',
      title: 'Nothing has happened yet',
      body: 'Stage changes, receipts and notes will appear here as your team works.'
    });
  }
  return `
    <ul class="hh-acts">
      ${items.map(a => `
        <li class="hh-act">
          <span class="hh-act-i" aria-hidden="true">${escapeHtml(initials(a.byName || a.by || '•'))}</span>
          <span>
            <span class="hh-act-t">${escapeHtml(a.text || a.label || 'Activity')}</span>
            <span class="hh-act-w">${escapeHtml(a.when || '')}</span>
          </span>
        </li>`).join('')}
    </ul>`;
}

/** A real empty state: says what this is for and offers the next step. */
export function emptyState({ mark = '+', title, body, action = null, good = false }) {
  return `
    <div class="hh-empty${good ? ' is-good' : ''}">
      <div class="hh-empty-mark" aria-hidden="true">${escapeHtml(mark)}</div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(body)}</p>
      ${action ? `<button type="button" class="hh-btn is-primary" data-go="${escapeHtml(action.go)}">${escapeHtml(action.label)}</button>` : ''}
    </div>`;
}

/** Shown when no CRM module is wired in — honest, not a fake dashboard. */
export function notConnected(roleLabel) {
  return emptyState({
    mark: '◌',
    title: 'No workspace data yet',
    body: `This is the ${roleLabel} home. Once clients, enquiries and events exist in this browser, the numbers above fill in. Nothing is hidden — there is simply nothing recorded yet.`,
    action: { go: 'new-enquiry', label: 'Add the first enquiry' }
  });
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '•';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

export { formatMoney, formatMoneyShort };
