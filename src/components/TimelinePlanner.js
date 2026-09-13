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

  /** Duplicate dates and intra-day time overlaps, computed fresh on each render. */
  analyse() {
    const byDate = new Map();
    this.days.forEach(d => {
      if (!byDate.has(d.date)) byDate.set(d.date, []);
      byDate.get(d.date).push(d);
    });

    const duplicateDates = [...byDate.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([date, list]) => ({ date, names: list.map(d => d.name) }));

    const conflicts = new Map(); // segmentId -> reason
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
          if (all[j].start < all[i].end) {
            conflicts.set(all[i].seg.id, `Overlaps “${all[j].seg.label}”`);
            conflicts.set(all[j].seg.id, `Overlaps “${all[i].seg.label}”`);
          }
        }
      }
    });

    return { duplicateDates, conflicts };
  }

  render() {
    const { duplicateDates, conflicts } = this.analyse();
    const ev = eventState.get();
    const totalSegments = this.days.reduce((n, d) => n + d.segments.length, 0);

    const banner = this.message
      ? `<div role="status" style="margin-bottom:1rem; padding:.6rem .9rem; border-radius:var(--radius-sm);
           border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-main); font-size:.85rem;">
           ${escapeHtml(this.message.text)}
         </div>`
      : '';

    const dupWarning = duplicateDates.length
      ? `<div role="alert" style="margin-bottom:1rem; padding:.6rem .9rem; border-radius:var(--radius-sm);
           border:1px solid var(--accent-rose); color:var(--accent-rose); font-size:.85rem;">
           ⚠️ Two functions share the same date:
           ${duplicateDates.map(d => `${escapeHtml(formatEventDate(d.date))} — ${escapeHtml(d.names.join(' & '))}`).join('; ')}.
           Give each function its own date, or merge them into one day.
         </div>`
      : '';

    const conflictCount = conflicts.size;
    const conflictWarning = conflictCount
      ? `<div role="alert" style="margin-bottom:1rem; padding:.6rem .9rem; border-radius:var(--radius-sm);
           border:1px solid var(--accent-gold); color:var(--accent-gold); font-size:.85rem;">
           ⏱️ ${conflictCount} timeline item${conflictCount === 1 ? '' : 's'} overlap another item on the same day — highlighted below.
         </div>`
      : '';

    const body = this.days.length
      ? `<div class="timeline-grid" id="timeline-grid">
           ${this.days.map((day, i) => this.renderDayCard(day, i, conflicts)).join('')}
         </div>`
      : this.renderEmptyState();

    this.container.innerHTML = `
      <div class="timeline-wrapper">
        <div class="timeline-header">
          <div>
            <h2>📅 Multi-Day Event Run-of-Show</h2>
            <p style="color:var(--text-muted); font-size:.85rem; margin-top:.25rem;">
              ${escapeHtml(ev.eventName)} · ${this.days.length} function${this.days.length === 1 ? '' : 's'}
              · ${totalSegments} timeline item${totalSegments === 1 ? '' : 's'}
              ${this.days.length ? `· ${escapeHtml(formatEventDate(this.days[0].date))} – ${escapeHtml(formatEventDate(this.days[this.days.length - 1].date))}` : ''}
            </p>
          </div>
          <div style="display:flex; gap:.5rem;">
            <button class="btn-secondary" id="timeline-seed-btn" type="button">Load Indian wedding template</button>
            <button class="btn-primary" id="timeline-add-btn" type="button">+ Add Function Day</button>
          </div>
        </div>
        ${banner}${dupWarning}${conflictWarning}
        ${body}
      </div>
    `;
    this.message = null;
    this.bindEvents();
  }

  renderEmptyState() {
    return `
      <div style="padding:2.5rem; text-align:center; border:1px dashed var(--border-strong);
                  border-radius:var(--radius-md); color:var(--text-muted); background:var(--bg-surface);">
        <div style="font-size:2rem;">📅</div>
        <h3 style="color:var(--text-main); margin:.5rem 0;">No functions planned yet</h3>
        <p style="max-width:40ch; margin:0 auto 1rem;">
          Add your haldi, mehendi, sangeet, baraat and reception days — each with real start and end
          times — and the planner will sort them by date and flag any overlaps.
        </p>
        <button class="btn-primary" id="timeline-empty-seed" type="button">Start from the Indian wedding template</button>
      </div>
    `;
  }

  renderDayCard(day, index, conflicts) {
    const isActive = day.id === this.activeDayId;
    const extents = day.segments.map(segmentExtent).filter(Boolean);
    const dayMinutes = extents.reduce((n, e) => n + e.duration, 0);
    const itemCount = Object.keys(day.selections || {}).length;

    return `
      <div class="timeline-card ${isActive ? 'active' : ''}" data-id="${escapeHtml(day.id)}">
        <div class="timeline-card-header">
          <input type="text" class="timeline-name-input" aria-label="Function name"
                 value="${escapeHtml(day.name)}" data-id="${escapeHtml(day.id)}" />
          <button class="btn-icon timeline-remove-btn" type="button"
                  aria-label="Remove ${escapeHtml(day.name)}" data-id="${escapeHtml(day.id)}">❌</button>
        </div>

        <input type="date" class="timeline-date-input" aria-label="Date for ${escapeHtml(day.name)}"
               value="${escapeHtml(day.date)}" data-id="${escapeHtml(day.id)}" />

        <div class="timeline-summary">
          Day ${index + 1} · ${day.segments.length} item${day.segments.length === 1 ? '' : 's'}
          · ${formatDuration(dayMinutes)} scheduled
          · ${itemCount} design item${itemCount === 1 ? '' : 's'} saved
        </div>

        <div style="display:flex; flex-direction:column; gap:.35rem; margin:.5rem 0;">
          ${day.segments.length
            ? day.segments
                .slice()
                .sort((a, b) => (toMinutes(a.start) ?? 0) - (toMinutes(b.start) ?? 0))
                .map(seg => this.renderSegment(day, seg, conflicts.get(seg.id)))
                .join('')
            : `<p style="color:var(--text-muted); font-size:.8rem; margin:.25rem 0;">
                 No run-of-show items yet — add the first one below.
               </p>`}
        </div>

        <div style="display:flex; gap:.35rem; flex-wrap:wrap; margin-bottom:.5rem;">
          <input type="text" class="seg-label-input" data-id="${escapeHtml(day.id)}" placeholder="e.g. Varmala"
                 aria-label="New item name" style="flex:1 1 8rem; min-width:0; padding:.35rem; font-size:.8rem;
                 background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-subtle);
                 border-radius:var(--radius-xs);" />
          <input type="time" class="seg-start-input" data-id="${escapeHtml(day.id)}" value="19:00"
                 aria-label="New item start time" style="padding:.35rem; font-size:.8rem; background:var(--bg-input);
                 color:var(--text-main); border:1px solid var(--border-subtle); border-radius:var(--radius-xs);" />
          <input type="time" class="seg-end-input" data-id="${escapeHtml(day.id)}" value="20:00"
                 aria-label="New item end time" style="padding:.35rem; font-size:.8rem; background:var(--bg-input);
                 color:var(--text-main); border:1px solid var(--border-subtle); border-radius:var(--radius-xs);" />
          <button class="btn-secondary seg-add-btn" type="button" data-id="${escapeHtml(day.id)}"
                  style="font-size:.8rem; padding:.35rem .6rem;">+ Item</button>
        </div>

        <div style="display:flex; gap:.35rem; flex-wrap:wrap;">
          <button class="btn-secondary timeline-load-btn" type="button" data-id="${escapeHtml(day.id)}">
            ${isActive ? 'Currently Active' : 'Load Design'}
          </button>
          <button class="btn-secondary timeline-save-design-btn" type="button" data-id="${escapeHtml(day.id)}"
                  title="Overwrite this day's saved design with what is live in the 360° Studio">
            Save Current Design
          </button>
        </div>
      </div>
    `;
  }

  renderSegment(day, seg, conflictReason) {
    const ext = segmentExtent(seg);
    const border = conflictReason ? 'var(--accent-gold)' : 'var(--border-subtle)';
    return `
      <div style="display:flex; align-items:center; gap:.5rem; padding:.35rem .5rem;
                  border:1px solid ${border}; border-radius:var(--radius-xs); background:var(--bg-surface-hover);">
        <span style="font-family:var(--font-mono); font-size:.72rem; color:var(--text-muted); white-space:nowrap;">
          ${escapeHtml(fmtTime(seg.start))} – ${escapeHtml(fmtTime(seg.end))}
        </span>
        <span style="flex:1; min-width:0; font-size:.8rem; color:var(--text-main); overflow:hidden; text-overflow:ellipsis;">
          ${escapeHtml(seg.label)}
          ${seg.owner ? `<em style="color:var(--text-dim); font-style:normal;"> · ${escapeHtml(seg.owner)}</em>` : ''}
        </span>
        <span style="font-size:.72rem; color:var(--text-dim); white-space:nowrap;">
          ${escapeHtml(formatDuration(ext ? ext.duration : 0))}
        </span>
        ${conflictReason
          ? `<span title="${escapeHtml(conflictReason)}" style="color:var(--accent-gold); font-size:.75rem;">⚠️</span>`
          : ''}
        <button class="btn-icon seg-remove-btn" type="button"
                data-day="${escapeHtml(day.id)}" data-seg="${escapeHtml(seg.id)}"
                aria-label="Remove ${escapeHtml(seg.label)}" style="font-size:.7rem;">✕</button>
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

    on('.seg-add-btn', 'click', (e) => {
      const id = e.currentTarget.dataset.id;
      const day = this.days.find(d => d.id === id);
      if (!day) return;
      const card = e.currentTarget.closest('.timeline-card');
      const label = card.querySelector('.seg-label-input').value.trim();
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
      day.segments.push({
        id: 'seg-' + Date.now(),
        label,
        start,
        end,
        owner: ''
      });
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
