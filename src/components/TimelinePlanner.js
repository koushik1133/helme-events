import { readJSON, writeJSON, escapeHtml } from '../utils/format.js';
import {
  eventState, todayISO, addDaysISO, parseISODate, formatEventDate
} from '../data/eventState.js';

const STORE_KEY = 'helm_events_timeline_v2';
const LEGACY_KEY = 'helme_events_timeline';

/** Authentic North-Indian multi-day wedding run-of-show. */
const WEDDING_TEMPLATE = [
  {
    name: 'Haldi',
    offset: 0,
    segments: [
      { label: 'Vendor setup & marigold install', start: '07:00', end: '09:30', owner: 'Decor team' },
      { label: 'Haldi ceremony', start: '10:00', end: '12:30', owner: 'Family / Pandit' },
      { label: 'Brunch service', start: '12:30', end: '14:30', owner: 'Catering' }
    ]
  },
  {
    name: 'Mehendi',
    offset: 1,
    segments: [
      { label: 'Mehendi artists arrive', start: '14:00', end: '15:00', owner: 'Mehendi artists' },
      { label: 'Mehendi & dholak', start: '15:00', end: '19:00', owner: 'Family' },
      { label: 'High tea', start: '17:00', end: '18:30', owner: 'Catering' }
    ]
  },
  {
    name: 'Sangeet',
    offset: 2,
    segments: [
      { label: 'Sound check & rehearsal', start: '15:00', end: '17:30', owner: 'AV crew' },
      { label: 'Guest arrival & cocktails', start: '19:00', end: '20:30', owner: 'Hospitality' },
      { label: 'Sangeet performances', start: '20:30', end: '23:00', owner: 'Choreographer' },
      { label: 'Dinner', start: '22:00', end: '00:00', owner: 'Catering' }
    ]
  },
  {
    name: 'Baraat & Pheras',
    offset: 3,
    segments: [
      { label: 'Mandap setup & puja prep', start: '09:00', end: '15:00', owner: 'Decor / Pandit' },
      { label: 'Baraat procession', start: '17:30', end: '19:00', owner: "Groom's family" },
      { label: 'Milni & Varmala', start: '19:00', end: '20:00', owner: 'Both families' },
      { label: 'Pheras / ceremony', start: '21:00', end: '23:30', owner: 'Pandit' },
      { label: 'Vidaai', start: '23:30', end: '00:30', owner: "Bride's family" }
    ]
  },
  {
    name: 'Reception',
    offset: 4,
    segments: [
      { label: 'Stage & lighting changeover', start: '12:00', end: '17:00', owner: 'Production' },
      { label: 'Guest arrival & photos', start: '19:00', end: '20:30', owner: 'Hospitality' },
      { label: 'Couple entry & speeches', start: '20:30', end: '21:30', owner: 'Emcee' },
      { label: 'Dinner & dancing', start: '21:30', end: '00:00', owner: 'Catering / DJ' }
    ]
  }
];

/** "HH:MM" -> minutes since midnight, or null. */
function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtTime(hhmm) {
  const mins = toMinutes(hhmm);
  if (mins === null) return '--:--';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/**
 * Segment extent in minutes. A segment that ends at or before it starts is
 * treated as running past midnight (e.g. dinner 22:00 -> 00:00 = 120 min),
 * which is the norm for Indian wedding functions.
 */
function segmentExtent(seg) {
  const start = toMinutes(seg.start);
  let end = toMinutes(seg.end);
  if (start === null || end === null) return null;
  if (end <= start) end += 24 * 60;
  return { start, end, duration: end - start };
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export class TimelinePlanner {
  constructor(containerElement, activeSelections, onLoadDay) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onLoadDay = onLoadDay;
    this.message = null;
    this.openAddFor = null;

    this.days = this.loadDays();
    this.activeDayId = this.days.length ? this.days[0].id : null;

    this.unsubscribe = eventState.subscribe((snap, changed) => {
      if (changed.includes('startDate') || changed.includes('eventName')) this.render();
    });

    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  loadDays() {
    let stored = readJSON(STORE_KEY, null);
    if (!Array.isArray(stored)) {
      // One-time migration from the pre-v2 shape (no times, UTC dates).
      const legacy = readJSON(LEGACY_KEY, null);
      if (Array.isArray(legacy) && legacy.length) {
        stored = legacy.map((d, i) => ({
          id: d.id || `day-${i + 1}`,
          name: typeof d.name === 'string' ? d.name : `Day ${i + 1}`,
          date: parseISODate(d.date) ? d.date : todayISO(),
          segments: [],
          selections: d.selections && typeof d.selections === 'object' ? d.selections : {}
        }));
      }
    }
    const days = Array.isArray(stored) ? stored.filter(d => d && typeof d === 'object') : [];
    if (!days.length) return this.seedDays();
    return this.sortDays(days.map(d => this.normaliseDay(d)));
  }

  normaliseDay(d) {
    return {
      id: typeof d.id === 'string' && d.id ? d.id : `day-${Math.random().toString(36).slice(2, 9)}`,
      name: typeof d.name === 'string' && d.name.trim() ? d.name : 'Untitled function',
      date: parseISODate(d.date) ? d.date : todayISO(),
      segments: Array.isArray(d.segments)
        ? d.segments
            .filter(s => s && typeof s === 'object')
            .map(s => ({
              id: typeof s.id === 'string' ? s.id : `seg-${Math.random().toString(36).slice(2, 9)}`,
              label: String(s.label ?? 'Segment'),
              start: toMinutes(s.start) === null ? '18:00' : s.start,
              end: toMinutes(s.end) === null ? '20:00' : s.end,
              owner: String(s.owner ?? '')
            }))
        : [],
      selections: d.selections && typeof d.selections === 'object' ? d.selections : {}
    };
  }

  seedDays() {
    const start = eventState.get().startDate || todayISO();
    return WEDDING_TEMPLATE.map((tpl, i) => ({
      id: `day-${i + 1}`,
      name: tpl.name,
      date: addDaysISO(start, tpl.offset),
      segments: tpl.segments.map((s, j) => ({ id: `seg-${i + 1}-${j + 1}`, ...s })),
      selections: { ...this.activeSelections }
    }));
  }

  sortDays(days) {
    return [...days].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      const as = this.earliestStart(a);
      const bs = this.earliestStart(b);
      return as - bs;
    });
  }

  earliestStart(day) {
    const starts = day.segments.map(s => toMinutes(s.start)).filter(v => v !== null);
    return starts.length ? Math.min(...starts) : 24 * 60 + 1;
  }

  /**
   * Called by main.js on tab-open / catalog change. It must NOT overwrite the
   * active day's saved configuration — that silently destroyed a client's
   * saved design on every tab switch. It only refreshes the live reference.
   */
  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    this.render();
  }

  /** Explicit, user-initiated write of the live 360 design onto a day. */
  saveDesignToDay(dayId) {
    const day = this.days.find(d => d.id === dayId);
    if (!day) return;
    day.selections = { ...this.activeSelections };
    this.save();
    this.message = { kind: 'ok', text: `Saved the current 360° design to “${day.name}”.` };
    this.render();
  }

  save() {
    this.days = this.sortDays(this.days);
    writeJSON(STORE_KEY, this.days);
    const dates = this.days.map(d => d.date).filter(Boolean).sort();
    if (dates.length) {
      eventState.set(
        { startDate: dates[0], endDate: dates[dates.length - 1] },
        { source: 'TimelinePlanner' }
      );
    }
  }

  /**
   * Duplicate dates and genuine resource clashes, computed fresh on each render.
   *
   * A run-of-show runs things in PARALLEL on purpose — high tea is served while
   * the mehendi is going on, dinner opens while the sangeet performances are
   * still running. Flagging every time overlap as a conflict marked four items
   * in the shipped wedding template as problems and taught the planner to
   * ignore the warning. A conflict is therefore an overlap where the SAME
   * OWNER is booked in two places at once — a real, actionable double-booking.
   * Plain overlaps between different owners are reported as parallel tracks.
   */
  analyse() {
    const byDate = new Map();
    this.days.forEach(d => {
      if (!byDate.has(d.date)) byDate.set(d.date, []);
      byDate.get(d.date).push(d);
    });

    const duplicateDates = [...byDate.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([date, list]) => ({ date, names: list.map(d => d.name) }));

    const conflicts = new Map(); // segmentId -> reason (same owner, double-booked)
    const parallel = new Map();  // segmentId -> reason (different owners, fine)

    byDate.forEach((list) => {
      const all = [];
      list.forEach(day => {
        day.segments.forEach(seg => {
          const ext = segmentExtent(seg);
          if (ext) all.push({ day, seg, ...ext });
        });
      });
      all.sort((a, b) => a.start - b.start);
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          if (all[j].start >= all[i].end) continue;
          const ownerA = String(all[i].seg.owner || '').trim().toLowerCase();
          const ownerB = String(all[j].seg.owner || '').trim().toLowerCase();
          if (ownerA && ownerA === ownerB) {
            const who = all[i].seg.owner;
            conflicts.set(all[i].seg.id, `${who} is also on “${all[j].seg.label}” at the same time`);
            conflicts.set(all[j].seg.id, `${who} is also on “${all[i].seg.label}” at the same time`);
          } else {
            if (!conflicts.has(all[i].seg.id)) parallel.set(all[i].seg.id, `Runs alongside “${all[j].seg.label}”`);
            if (!conflicts.has(all[j].seg.id)) parallel.set(all[j].seg.id, `Runs alongside “${all[i].seg.label}”`);
          }
        }
      }
    });

    conflicts.forEach((_, id) => parallel.delete(id));
    return { duplicateDates, conflicts, parallel };
  }

  /**
   * LAYOUT NOTE — why a day is a full-width ROW, not a column.
   *
   * The run sheet used to be a card grid: every function became a ~280px
   * column that had to carry a name field, a date field, a proportional strip,
   * its timeline items AND its own five-control add form. With five functions
   * and nineteen items that left roughly 200px for "7:00 AM – 9:30 AM", the
   * title, the owner and the duration, so every title truncated
   * ("Mehendi cere…", "Baraat processi…").
   *
   * A horizontally scrolling board of wide columns was the other option, but a
   * run sheet is read down a day, and side-scrolling to reach the reception
   * hides four of the five functions at any moment. A day-per-row layout gives
   * each item a real four-column line — time · title · owner · duration — that
   * fits at 1024px without truncation, keeps all five functions in one vertical
   * read, and lets the proportional strip be the full width of the page, which
   * is what makes the shape of a day legible in the first place.
   *
   * The per-day controls moved out of the body: the date sits in the day
   * header, and the add-item form is a disclosure that is closed until asked
   * for, so items — the actual content — dominate the card.
   */
  render() {
    const { duplicateDates, conflicts, parallel } = this.analyse();
    const ev = eventState.get();
    const totalSegments = this.days.reduce((n, d) => n + d.segments.length, 0);

    const banner = this.message
      ? `<div role="status" class="rs-banner">${escapeHtml(this.message.text)}</div>`
      : '';

    const dupWarning = duplicateDates.length
      ? `<div role="alert" class="rs-banner rs-banner-alert">
           ⚠️ Two functions share the same date:
           ${duplicateDates.map(d => `${escapeHtml(formatEventDate(d.date))} — ${escapeHtml(d.names.join(' & '))}`).join('; ')}.
           Give each function its own date, or merge them into one day.
         </div>`
      : '';

    const conflictCount = conflicts.size;
    const conflictWarning = conflictCount
      ? `<div role="alert" class="rs-banner rs-banner-alert">
           ⏱️ ${conflictCount} item${conflictCount === 1 ? ' books its owner' : 's book their owners'} in two places
           at once — highlighted below. Items that simply run in parallel under different owners are not flagged.
         </div>`
      : '';

    const body = this.days.length
      ? `<div class="runsheet-days" id="timeline-grid">
           ${this.days.map((day, i) => this.renderDayCard(day, i, conflicts, parallel)).join('')}
         </div>`
      : this.renderEmptyState();

    this.container.innerHTML = `
      <div class="timeline-wrapper runsheet">
        <div class="timeline-header runsheet-head">
          <div class="runsheet-head-text">
            <h2>📅 Multi-Day Event Run-of-Show</h2>
            <p class="rs-sub">
              ${escapeHtml(ev.eventName)} · ${this.days.length} function${this.days.length === 1 ? '' : 's'}
              · ${totalSegments} timeline item${totalSegments === 1 ? '' : 's'}
              ${this.days.length ? `· ${escapeHtml(formatEventDate(this.days[0].date))} – ${escapeHtml(formatEventDate(this.days[this.days.length - 1].date))}` : ''}
            </p>
            <p class="rs-hint">
              Functions sort by date, then by first start time. ⚠️ marks an owner booked in two places at once;
              ⇉ marks items that simply run in parallel.
            </p>
          </div>
          <div class="runsheet-head-actions">
            <button class="btn-secondary" id="timeline-seed-btn" type="button">Load Indian wedding template</button>
            <button class="btn-primary" id="timeline-add-btn" type="button">+ Add Function Day</button>
          </div>
        </div>
        ${banner}${dupWarning}${conflictWarning}
        ${body}
        <datalist id="timeline-owner-options">
          ${this.knownOwners().map(o => `<option value="${escapeHtml(o)}"></option>`).join('')}
        </datalist>
      </div>
    `;
    this.message = null;
    this.bindEvents();
  }

  /** Owners already used anywhere in the plan, so the next one is one keystroke. */
  knownOwners() {
    const seen = new Set();
    this.days.forEach(d => d.segments.forEach(s => {
      const o = String(s.owner || '').trim();
      if (o) seen.add(o);
    }));
    return [...seen].sort((a, b) => a.localeCompare(b));
  }

  renderEmptyState() {
    return `
      <div class="rs-empty">
        <div style="font-size:2rem;">📅</div>
        <h3>No functions planned yet</h3>
        <p>
          Add your haldi, mehendi, sangeet, baraat and reception days — each with real start and end
          times — and the planner will sort them by date and flag any overlaps.
        </p>
        <button class="btn-primary" id="timeline-empty-seed" type="button">Start from the Indian wedding template</button>
      </div>
    `;
  }

  /**
   * A proportional run-of-show strip for one day: every segment drawn against
   * the day's own span, so a planner can see the shape of the day — the long
   * setup block, the gap before guests arrive, the overlapping service — in
   * one glance instead of reading a list of times. Full page width now, so the
   * hour marks are readable rather than a 200px smear.
   */
  renderGantt(day, conflicts) {
    const placed = day.segments
      .map(seg => ({ seg, ext: segmentExtent(seg) }))
      .filter(x => x.ext)
      .sort((a, b) => a.ext.start - b.ext.start);
    if (!placed.length) return '';

    const from = Math.min(...placed.map(p => p.ext.start));
    const to = Math.max(...placed.map(p => p.ext.end));
    const span = Math.max(1, to - from);

    const hourMarks = [];
    const firstHour = Math.ceil(from / 60) * 60;
    // One mark an hour reads fine across a full-width strip; fall back to every
    // two hours only when the day is long enough for the labels to collide.
    const stepMinutes = span > 8 * 60 ? 120 : 60;
    for (let t = firstHour; t <= to; t += stepMinutes) {
      const left = ((t - from) / span) * 100;
      const hh = Math.floor((t / 60) % 24);
      hourMarks.push(`
        <span aria-hidden="true" class="rs-strip-rule" style="left:${left.toFixed(2)}%;"></span>
        <span aria-hidden="true" class="rs-strip-tick" style="left:${left.toFixed(2)}%;">${String(hh).padStart(2, '0')}:00</span>`);
    }

    // Lay bars out into as few rows as fit without overlapping, so parallel
    // items are all visible instead of alternating blindly between two rows.
    const rowEnds = [];
    const bars = placed.map(({ seg, ext }) => {
      const left = ((ext.start - from) / span) * 100;
      const width = Math.max(1.2, (ext.duration / span) * 100);
      let row = rowEnds.findIndex(end => ext.start >= end);
      if (row === -1) { row = rowEnds.length; rowEnds.push(ext.end); }
      else rowEnds[row] = ext.end;
      const isConflict = conflicts.has(seg.id);
      // THEME NOTE — opacity is pinned to 1 here on purpose. The stylesheet
      // fades a non-conflict lane to .78, which fades the LABEL with it and
      // drops the label onto a washed-out tint: measured 4.13:1 in dark and
      // 3.17:1 in light at 11px, under the 4.5:1 body minimum in both themes.
      // At full strength the same --on-accent label reads 8.8:1 on the dark
      // accent and 6.3:1 on the light one. Separation from the strip ground
      // comes from the accent itself, not from a fade.
      return `<span class="rs-strip-bar ${isConflict ? 'is-conflict' : ''}"
                    title="${escapeHtml(`${fmtTime(seg.start)}–${fmtTime(seg.end)} ${seg.label}`)}"
                    style="left:${left.toFixed(2)}%; width:${width.toFixed(2)}%; top:${4 + row * 16}px; opacity:1;"
              ><span class="rs-strip-bar-label">${escapeHtml(seg.label)}</span></span>`;
    }).join('');

    const rows = Math.max(2, rowEnds.length);
    return `
      <div class="rs-strip" aria-hidden="true" style="height:${8 + rows * 16}px;">
        ${hourMarks.join('')}${bars}
      </div>`;
  }

  renderDayCard(day, index, conflicts, parallel) {
    const isActive = day.id === this.activeDayId;
    const extents = day.segments.map(segmentExtent).filter(Boolean);
    const dayMinutes = extents.reduce((n, e) => n + e.duration, 0);
    const itemCount = Object.keys(day.selections || {}).length;
    const addOpen = this.openAddFor === day.id;
    const id = escapeHtml(day.id);

    return `
      <section class="rs-day ${isActive ? 'is-active' : ''}" data-id="${id}"
               aria-label="${escapeHtml(day.name)}">
        <div class="rs-day-head">
          <div class="rs-day-id">
            <span class="rs-day-index">Day ${index + 1}</span>
            <input type="text" class="timeline-name-input rs-day-name" aria-label="Function name"
                   value="${escapeHtml(day.name)}" data-id="${id}" />
          </div>
          <input type="date" class="timeline-date-input rs-day-date" aria-label="Date for ${escapeHtml(day.name)}"
                 value="${escapeHtml(day.date)}" data-id="${id}" />
          <p class="rs-day-stats">
            ${day.segments.length} item${day.segments.length === 1 ? '' : 's'}
            · ${formatDuration(dayMinutes)} scheduled
            · ${itemCount} design item${itemCount === 1 ? '' : 's'} saved
          </p>
          <div class="rs-day-actions">
            <button class="btn-secondary rs-add-toggle" type="button" data-id="${id}"
                    aria-expanded="${addOpen}">${addOpen ? 'Close' : '+ Item'}</button>
            <button class="btn-secondary timeline-load-btn ${isActive ? 'is-current' : ''}" type="button" data-id="${id}"
                    ${isActive ? 'aria-current="true"' : ''}>${isActive ? 'Currently active' : 'Load design'}</button>
            <button class="btn-secondary timeline-save-design-btn" type="button" data-id="${id}"
                    title="Overwrite this day's saved design with what is live in the 360° Studio">Save design</button>
            <button class="btn-icon timeline-remove-btn" type="button"
                    aria-label="Remove ${escapeHtml(day.name)}" data-id="${id}">❌</button>
          </div>
        </div>

        ${this.renderGantt(day, conflicts)}

        <div class="rs-items" role="list">
          ${day.segments.length
            ? day.segments
                .slice()
                .sort((a, b) => (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0))
                .map(seg => this.renderSegment(day, seg, conflicts.get(seg.id), parallel.get(seg.id)))
                .join('')
            : `<p class="rs-items-empty">No run-of-show items yet — use <strong>+ Item</strong> to add the first one.</p>`}
        </div>

        ${addOpen ? this.renderAddForm(day) : ''}
      </section>
    `;
  }

  renderAddForm(day) {
    const id = escapeHtml(day.id);
    return `
      <div class="rs-add-form">
        <label class="rs-field rs-field-grow">
          <span>Item</span>
          <input type="text" class="seg-label-input" data-id="${id}" placeholder="e.g. Varmala" />
        </label>
        <label class="rs-field rs-field-grow">
          <span>Owner</span>
          <input type="text" class="seg-owner-input" data-id="${id}" placeholder="e.g. AV crew"
                 list="timeline-owner-options" />
        </label>
        <label class="rs-field">
          <span>Starts</span>
          <input type="time" class="seg-start-input" data-id="${id}" value="19:00" />
        </label>
        <label class="rs-field">
          <span>Ends</span>
          <input type="time" class="seg-end-input" data-id="${id}" value="20:00" />
        </label>
        <button class="btn-primary seg-add-btn" type="button" data-id="${id}">Add item</button>
      </div>
    `;
  }

  renderSegment(day, seg, conflictReason, parallelReason) {
    const ext = segmentExtent(seg);
    return `
      <div class="rs-item ${conflictReason ? 'is-conflict' : ''}" role="listitem">
        <span class="rs-item-time">${escapeHtml(fmtTime(seg.start))} – ${escapeHtml(fmtTime(seg.end))}</span>
        <span class="rs-item-title">${escapeHtml(seg.label)}</span>
        <span class="rs-item-owner">${seg.owner ? escapeHtml(seg.owner) : '<em>Unassigned</em>'}</span>
        <span class="rs-item-dur">${escapeHtml(formatDuration(ext ? ext.duration : 0))}</span>
        <span class="rs-item-flag">
          ${conflictReason
            ? `<span role="img" aria-label="Conflict: ${escapeHtml(conflictReason)}" title="${escapeHtml(conflictReason)}"
                     class="rs-flag-conflict">⚠️</span>`
            : parallelReason
              ? `<span role="img" aria-label="Parallel: ${escapeHtml(parallelReason)}" title="${escapeHtml(parallelReason)}"
                       class="rs-flag-parallel">⇉</span>`
              : ''}
        </span>
        <button class="btn-icon seg-remove-btn rs-item-del" type="button"
                data-day="${escapeHtml(day.id)}" data-seg="${escapeHtml(seg.id)}"
                aria-label="Remove ${escapeHtml(seg.label)}">✕</button>
      </div>
    `;
  }

  bindEvents() {
    const on = (sel, evt, fn) => {
      this.container.querySelectorAll(sel).forEach(el => el.addEventListener(evt, fn));
    };

    const seed = () => {
      this.days = this.seedDays();
      this.activeDayId = this.days[0].id;
      this.save();
      this.message = { kind: 'ok', text: 'Loaded the five-function Indian wedding structure.' };
      this.render();
    };
    on('#timeline-seed-btn', 'click', seed);
    on('#timeline-empty-seed', 'click', seed);

    on('#timeline-add-btn', 'click', () => {
      const last = this.days[this.days.length - 1];
      const nextDate = last ? addDaysISO(last.date, 1) : (eventState.get().startDate || todayISO());
      const id = 'day-' + Date.now();
      this.days.push({
        id,
        name: `Function ${this.days.length + 1}`,
        date: nextDate,
        segments: [],
        selections: { ...this.activeSelections }
      });
      if (!this.activeDayId) this.activeDayId = id;
      this.openAddFor = id;
      this.save();
      this.render();
    });

    on('.timeline-name-input', 'change', (e) => {
      const day = this.days.find(d => d.id === e.target.dataset.id);
      if (day) {
        day.name = e.target.value.trim() || 'Untitled function';
        this.save();
        this.render();
      }
    });

    on('.timeline-date-input', 'change', (e) => {
      const day = this.days.find(d => d.id === e.target.dataset.id);
      if (!day) return;
      const value = e.target.value;
      if (!parseISODate(value)) {
        this.message = { kind: 'err', text: 'That date is not valid — reverted.' };
        this.render();
        return;
      }
      const clash = this.days.find(d => d.id !== day.id && d.date === value);
      day.date = value;
      this.save();
      if (clash) {
        this.message = {
          kind: 'err',
          text: `“${clash.name}” is already on ${formatEventDate(value)}. Two functions on one date need distinct times.`
        };
      }
      this.render();
    });

    on('.timeline-remove-btn', 'click', (e) => {
      e.stopPropagation();
      const id = e.currentTarget.dataset.id;
      const day = this.days.find(d => d.id === id);
      if (day && day.segments.length && !window.confirm(`Remove “${day.name}” and its ${day.segments.length} timeline items?`)) return;
      this.days = this.days.filter(d => d.id !== id);
      if (this.openAddFor === id) this.openAddFor = null;
      if (this.activeDayId === id) {
        this.activeDayId = this.days.length ? this.days[0].id : null;
        if (this.activeDayId && this.onLoadDay) {
          this.onLoadDay(this.days[0].selections);
        }
      }
      this.save();
      this.render();
    });

    on('.timeline-load-btn', 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      this.activeDayId = id;
      const day = this.days.find(d => d.id === id);
      if (day && this.onLoadDay) this.onLoadDay(day.selections);
      this.render();
    });

    on('.timeline-save-design-btn', 'click', (e) => {
      this.saveDesignToDay(e.currentTarget.dataset.id);
    });

    // The add form is a disclosure: closed, the card is its items. Open, focus
    // lands in the item name so the keyboard path is one tab short.
    on('.rs-add-toggle', 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      this.openAddFor = this.openAddFor === id ? null : id;
      const wasOpened = this.openAddFor === id;
      this.render();
      if (wasOpened) {
        const input = this.container.querySelector(`.rs-day[data-id="${CSS.escape(id)}"] .seg-label-input`);
        if (input) input.focus();
      }
    });

    on('.seg-add-btn', 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      const day = this.days.find(d => d.id === id);
      if (!day) return;
      const card = e.currentTarget.closest('.rs-day');
      const label = card.querySelector('.seg-label-input').value.trim();
      const owner = card.querySelector('.seg-owner-input').value.trim();
      const start = card.querySelector('.seg-start-input').value;
      const end = card.querySelector('.seg-end-input').value;
      if (!label) {
        this.message = { kind: 'err', text: 'Give the timeline item a name first.' };
        this.render();
        return;
      }
      if (toMinutes(start) === null || toMinutes(end) === null) {
        this.message = { kind: 'err', text: 'Enter a valid start and end time.' };
        this.render();
        return;
      }
      day.segments.push({ id: 'seg-' + Date.now(), label, start, end, owner });
      this.save();
      this.render();
    });

    on('.seg-remove-btn', 'click', (e) => {
      const dayId = e.currentTarget.dataset.day;
      const segId = e.currentTarget.dataset.seg;
      const day = this.days.find(d => d.id === dayId);
      if (!day) return;
      day.segments = day.segments.filter(s => s.id !== segId);
      this.save();
      this.render();
    });
  }
}
