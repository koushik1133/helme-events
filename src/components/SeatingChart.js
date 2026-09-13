import { readJSON, writeJSON, escapeHtml, formatNumber } from '../utils/format.js';
import { eventState } from '../data/eventState.js';

const STORE_KEY = 'helm_events_guests_v2';
const LEGACY_KEY = 'helme_events_guests';

/** Authentic Indian wedding seating groups. */
export const GUEST_GROUPS = [
  "Bride's Family",
  "Groom's Family",
  'Baraatis',
  'VIP / Dais',
  'Friends',
  'Vendors & Crew',
  'Other'
];

const SEATS_PER_TABLE = 10; // Standard Indian banquet round table.
const MIN_TABLES = 4;
const TABLE_CELL_PX = 130;  // drawing room per table, so seats stay clickable

/** Read a CSS custom property so the canvas follows the active theme. */
function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/**
 * RFC-4180-ish CSV parser: handles CRLF, quoted fields containing commas,
 * and doubled quotes inside a quoted field.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text ?? '').replace(/^﻿/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') { inQuotes = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') { if (src[i + 1] === '\n') i++; rows.push([...row, field]); row = []; field = ''; continue; }
    if (ch === '\n') { rows.push([...row, field]); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) rows.push([...row, field]);
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

/** Quote a CSV field only when it needs it. */
export function csvCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export class SeatingChart {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.guests = this.loadGuests();
    this.selectedGuestId = null;
    this.message = null;
    this.filter = '';

    this.unsubscribe = eventState.subscribe((snap, changed) => {
      if (changed.includes('guestCount')) this.render();
    });

    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  loadGuests() {
    let stored = readJSON(STORE_KEY, null);
    if (!Array.isArray(stored)) stored = readJSON(LEGACY_KEY, null);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(g => g && typeof g === 'object' && typeof g.name === 'string')
      .map(g => ({
        id: typeof g.id === 'string' ? g.id : 'g' + Math.random().toString(36).slice(2, 11),
        name: g.name,
        group: GUEST_GROUPS.includes(g.group) ? g.group : 'Other',
        rsvp: ['yes', 'no', 'pending'].includes(g.rsvp) ? g.rsvp : 'pending',
        tableNumber: Number.isFinite(Number(g.tableNumber)) && g.tableNumber ? Number(g.tableNumber) : null,
        seatNumber: Number.isFinite(Number(g.seatNumber)) && g.seatNumber ? Number(g.seatNumber) : null
      }));
  }

  /**
   * Table count is derived, never invented: whichever is larger of the shared
   * event guest count and the number of guests who still need a seat, divided
   * by real per-table capacity. A guest who has declined does not need a chair,
   * so RSVP "no" is excluded from the attending count.
   */
  attendingCount() {
    return this.guests.filter(g => g.rsvp !== 'no').length;
  }

  calculateTables() {
    const planned = eventState.getGuestCount() || 0;
    const people = Math.max(planned, this.attendingCount());
    return Math.max(MIN_TABLES, Math.ceil(people / SEATS_PER_TABLE));
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    this.render();
  }

  save() {
    writeJSON(STORE_KEY, this.guests);
  }

  /** Drop assignments that point at tables which no longer exist. */
  reconcileAssignments() {
    const orphans = this.guests.filter(g => g.tableNumber && g.tableNumber > this.tableCount);
    orphans.forEach(g => { g.tableNumber = null; g.seatNumber = null; });
    if (orphans.length) {
      this.save();
      return orphans.map(g => g.name);
    }
    return [];
  }

  render() {
    this.tableCount = this.calculateTables();
    const orphaned = this.reconcileAssignments();
    if (orphaned.length) {
      this.message = {
        kind: 'warn',
        text: `The table count changed — ${orphaned.length} guest${orphaned.length === 1 ? '' : 's'} moved back to Unassigned (${orphaned.slice(0, 3).join(', ')}${orphaned.length > 3 ? '…' : ''}).`
      };
    }

    const planned = eventState.getGuestCount();
    const capacity = this.tableCount * SEATS_PER_TABLE;
    const seated = this.guests.filter(g => g.tableNumber).length;
    const rsvpYes = this.guests.filter(g => g.rsvp === 'yes').length;
    const rsvpNo = this.guests.filter(g => g.rsvp === 'no').length;
    const rsvpPending = this.guests.filter(g => g.rsvp === 'pending').length;

    // Grow the canvas with the table count instead of squeezing 60 tables into
    // 600px, where the seats become 4px targets. The pane scrolls instead.
    const cols = Math.ceil(Math.sqrt(this.tableCount));
    const canvasPx = Math.max(600, cols * TABLE_CELL_PX);

    this.container.innerHTML = `
      <div class="seating-wrapper" style="display:flex; gap:20px; height:100%;">
        <div style="flex:2; display:flex; flex-direction:column; min-width:0;">
          <h2 style="color:var(--text-main);">👥 Guest Seating Chart Builder</h2>
          <p style="color:var(--text-muted); font-size:.85rem; margin:.25rem 0 .75rem;">
            Seated <strong style="color:var(--text-main);">${formatNumber(seated)}</strong> of
            ${formatNumber(this.guests.length)} guests on record ·
            ${formatNumber(this.tableCount)} tables × ${SEATS_PER_TABLE} seats =
            ${formatNumber(capacity)} seats · planned headcount ${formatNumber(planned)}
            ${planned > capacity ? `<span style="color:var(--accent-rose);"> — ${formatNumber(planned - capacity)} over capacity</span>` : ''}
          </p>
          <p style="color:var(--text-muted); font-size:.8rem; margin:0 0 .5rem;">
            RSVP: <strong style="color:var(--accent-emerald);">${formatNumber(rsvpYes)} yes</strong> ·
            ${formatNumber(rsvpPending)} awaiting reply ·
            ${formatNumber(rsvpNo)} declined.
            Tables are sized for the ${formatNumber(Math.max(planned, this.attendingCount()))} still attending —
            change the headcount in <strong>Event Details</strong> and this chart re-sizes.
          </p>
          ${this.renderMessage()}
          <div class="seating-canvas-container"
               style="position:relative; height:auto; max-height:600px; overflow:auto;">
            <canvas id="seating-canvas" width="${canvasPx}" height="${canvasPx}"
              aria-label="Seating chart: ${this.tableCount} tables of ${SEATS_PER_TABLE} seats, ${formatNumber(seated)} seats taken"
              style="background:var(--bg-surface); border:1px solid var(--border-subtle);
                     border-radius:var(--radius-sm); cursor:pointer; max-width:none;
                     display:block;"></canvas>
          </div>
        </div>
        <div class="seating-sidebar" style="flex:1; display:flex; flex-direction:column; gap:10px; min-width:0;">
          <h3 style="color:var(--text-main);">Guest List (${formatNumber(this.guests.length)})</h3>
          <div style="display:flex; gap:5px;">
            <input type="text" id="seating-guest-name" placeholder="Guest Name" aria-label="Guest name"
              style="flex:1; min-width:0; padding:6px; background:var(--bg-input); color:var(--text-main);
                     border:1px solid var(--border-subtle); border-radius:var(--radius-xs);">
            <select id="seating-guest-group" aria-label="Guest group"
              style="padding:6px; background:var(--bg-input); color:var(--text-main);
                     border:1px solid var(--border-subtle); border-radius:var(--radius-xs);">
              ${GUEST_GROUPS.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('')}
            </select>
            <button class="btn-primary" id="seating-add-guest" type="button">Add</button>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="btn-secondary" id="seating-import-btn" type="button" style="flex:1;">Import CSV</button>
            <button class="btn-secondary" id="seating-export-btn" type="button" style="flex:1;">Export CSV</button>
          </div>
          <input type="search" id="seating-filter" placeholder="Filter by name or group" aria-label="Filter guest list"
            value="${escapeHtml(this.filter)}"
            style="padding:6px; background:var(--bg-input); color:var(--text-main);
                   border:1px solid var(--border-subtle); border-radius:var(--radius-xs);">
          <div class="seating-guest-list" id="seating-guest-list"
               style="overflow-y:auto; flex:1; border:1px solid var(--border-subtle); padding:10px;
                      border-radius:var(--radius-sm); background:var(--bg-surface);">
          </div>
          <p style="font-size:.8rem; color:var(--text-muted);">
            Click a guest, then click a seat to assign them. Seating onto a taken seat asks first.
          </p>
        </div>
      </div>
      <div id="seating-import-modal" hidden
           style="position:fixed; inset:0; background:var(--scrim); display:flex; align-items:center;
                  justify-content:center; z-index:999;">
        <div role="dialog" aria-modal="true" aria-label="Import guests from CSV"
             style="background:var(--bg-surface); color:var(--text-main); padding:1.25rem; border-radius:var(--radius-md);
                    width:min(520px, 92vw); border:1px solid var(--border-subtle); box-shadow:var(--shadow-lg);">
          <h3 style="margin-bottom:.5rem;">Import guests from CSV</h3>
          <p style="font-size:.8rem; color:var(--text-muted); margin-bottom:.5rem;">
            One guest per line: <code>Name,Group</code>. A <code>Name,Group</code> header row is skipped.
            Quote any name containing a comma.
          </p>
          <textarea id="seating-import-text" rows="8" aria-label="CSV content"
            style="width:100%; padding:.5rem; font-family:var(--font-mono); font-size:.8rem;
                   background:var(--bg-input); color:var(--text-main); border:1px solid var(--border-subtle);
                   border-radius:var(--radius-xs);" placeholder="Name,Group
Asha Mehta,Bride's Family
&quot;Shah, Ravi&quot;,Baraatis"></textarea>
          <div style="display:flex; gap:.5rem; justify-content:flex-end; margin-top:.75rem;">
            <button class="btn-secondary" id="seating-import-cancel" type="button">Cancel</button>
            <button class="btn-primary" id="seating-import-confirm" type="button">Import</button>
          </div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#seating-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.message = null;
    this.bindEvents();
    this.renderGuestList();
    this.drawCanvas();
  }

  renderMessage() {
    if (!this.message) return '';
    const color = this.message.kind === 'warn' ? 'var(--accent-gold)' : 'var(--text-main)';
    return `<div role="status" style="margin-bottom:.5rem; padding:.5rem .75rem; font-size:.8rem;
              border:1px solid ${color}; color:${color}; border-radius:var(--radius-xs);">
              ${escapeHtml(this.message.text)}
            </div>`;
  }

  visibleGuests() {
    const q = this.filter.trim().toLowerCase();
    if (!q) return this.guests;
    return this.guests.filter(g =>
      g.name.toLowerCase().includes(q) || g.group.toLowerCase().includes(q));
  }

  renderGuestList() {
    const listEl = this.container.querySelector('#seating-guest-list');
    if (!listEl) return;

    if (!this.guests.length) {
      listEl.innerHTML = `
        <div style="text-align:center; color:var(--text-muted); padding:1.5rem .5rem;">
          <div style="font-size:1.75rem;">🪑</div>
          <p style="margin:.5rem 0; font-weight:600; color:var(--text-main);">No guests yet</p>
          <p style="font-size:.8rem;">Add a guest above, or import your list with <em>Import CSV</em>.</p>
        </div>`;
      return;
    }

    const visible = this.visibleGuests();
    if (!visible.length) {
      listEl.innerHTML = `
        <div style="text-align:center; color:var(--text-muted); padding:1.5rem .5rem;">
          <p style="margin:.5rem 0; color:var(--text-main);">No guest matches “${escapeHtml(this.filter)}”.</p>
          <p style="font-size:.8rem;">Clear the filter to see all ${formatNumber(this.guests.length)} guests.</p>
        </div>`;
      return;
    }

    const RSVP_LABEL = { yes: 'Attending', pending: 'Awaiting reply', no: 'Declined' };
    const RSVP_COLOR = { yes: 'var(--accent-emerald)', pending: 'var(--text-muted)', no: 'var(--accent-rose)' };

    listEl.innerHTML = visible.map(g => {
      const selected = g.id === this.selectedGuestId;
      return `
      <div class="seating-guest-card ${selected ? 'selected' : ''}" data-id="${escapeHtml(g.id)}"
           style="padding:8px; border:1px solid ${selected ? 'var(--accent-indigo)' : 'var(--border-subtle)'};
                  margin-bottom:5px; border-radius:var(--radius-xs);
                  background:${selected ? 'var(--bg-surface-hover)' : 'var(--bg-surface)'};">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:.5rem;">
          <button type="button" class="guest-select-btn" data-id="${escapeHtml(g.id)}"
                  aria-pressed="${selected}"
                  aria-label="${escapeHtml(g.name)}, ${escapeHtml(g.group)}, ${escapeHtml(RSVP_LABEL[g.rsvp])}, ${g.tableNumber ? `seated at table ${g.tableNumber} seat ${g.seatNumber}` : 'unassigned'}. Select to seat."
                  style="flex:1; min-width:0; text-align:left; background:none; border:0; padding:0;
                         cursor:pointer; color:var(--text-main); font: inherit;">
            <strong style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(g.name)}</strong>
            <span style="font-size:.72rem; color:var(--text-muted);">${escapeHtml(g.group)}</span>
          </button>
          <button type="button" class="guest-delete-btn btn-icon" data-id="${escapeHtml(g.id)}"
                  aria-label="Remove ${escapeHtml(g.name)} from the guest list"
                  style="font-size:.7rem;">🗑️</button>
        </div>
        <div style="display:flex; align-items:center; gap:.4rem; margin-top:.35rem;">
          <select class="guest-rsvp-select" data-id="${escapeHtml(g.id)}"
                  aria-label="RSVP for ${escapeHtml(g.name)}"
                  style="font-size:.7rem; padding:.1rem .2rem; background:var(--bg-input);
                         color:${RSVP_COLOR[g.rsvp]}; border:1px solid var(--border-subtle);
                         border-radius:var(--radius-xs);">
            ${['yes', 'pending', 'no'].map(v =>
              `<option value="${v}" ${g.rsvp === v ? 'selected' : ''}>${RSVP_LABEL[v]}</option>`).join('')}
          </select>
          <span style="flex:1; font-size:.72rem; color:${g.tableNumber ? 'var(--accent-emerald)' : 'var(--text-dim)'};">
            ${g.tableNumber ? `Table ${g.tableNumber}, Seat ${g.seatNumber}` : 'Unassigned'}
          </span>
          ${g.tableNumber
            ? `<button type="button" class="guest-unseat-btn btn-icon" data-id="${escapeHtml(g.id)}"
                       aria-label="Unseat ${escapeHtml(g.name)}" style="font-size:.65rem;">Unseat</button>`
            : ''}
        </div>
      </div>`;
    }).join('');

    listEl.querySelectorAll('.guest-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedGuestId = this.selectedGuestId === btn.dataset.id ? null : btn.dataset.id;
        this.renderGuestList();
      });
    });

    listEl.querySelectorAll('.guest-rsvp-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const guest = this.guests.find(g => g.id === sel.dataset.id);
        if (!guest) return;
        guest.rsvp = sel.value;
        // A guest who has declined should not keep holding a chair.
        if (guest.rsvp === 'no' && guest.tableNumber) {
          guest.tableNumber = null;
          guest.seatNumber = null;
          this.message = { kind: 'warn', text: `${guest.name} declined — their seat has been freed.` };
        }
        this.save();
        this.render();
      });
    });

    listEl.querySelectorAll('.guest-unseat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const guest = this.guests.find(g => g.id === btn.dataset.id);
        if (!guest) return;
        guest.tableNumber = null;
        guest.seatNumber = null;
        this.save();
        this.message = { kind: 'warn', text: `${guest.name} moved back to Unassigned.` };
        this.render();
      });
    });

    listEl.querySelectorAll('.guest-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const guest = this.guests.find(g => g.id === btn.dataset.id);
        if (!guest) return;
        if (!window.confirm(`Remove ${guest.name} from the guest list?`)) return;
        this.guests = this.guests.filter(g => g.id !== guest.id);
        if (this.selectedGuestId === guest.id) this.selectedGuestId = null;
        this.save();
        this.message = { kind: 'warn', text: `${guest.name} removed from the guest list.` };
        this.render();
      });
    });
  }

  /** Geometry for the current table count — one source for draw and hit-test. */
  layout() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const cols = Math.ceil(Math.sqrt(this.tableCount));
    const rows = Math.ceil(this.tableCount / cols);
    const cellW = width / cols;
    const cellH = height / rows;
    const tableRadius = Math.max(12, Math.min(cellW, cellH) * 0.22);
    const seatRadius = Math.max(4, tableRadius * 0.22);
    const tables = [];
    for (let i = 0; i < this.tableCount; i++) {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + cellH / 2;
      tables.push({ id: i + 1, cx, cy, radius: tableRadius });
    }
    return { tables, tableRadius, seatRadius, seatOrbit: tableRadius + seatRadius + 6 };
  }

  seatPosition(table, seatIndex, seatOrbit) {
    const angle = (seatIndex / SEATS_PER_TABLE) * Math.PI * 2 - Math.PI / 2;
    return {
      x: table.cx + Math.cos(angle) * seatOrbit,
      y: table.cy + Math.sin(angle) * seatOrbit
    };
  }

  drawCanvas() {
    if (!this.ctx) return;
    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    // THEME NOTE — the canvas cannot inherit CSS, so every colour here is read
    // back off the live custom properties. It used to draw the table with
    // --bg-surface-hover and an empty seat with --bg-input, which are the SAME
    // value in the dark theme (#201e1b): the whole chart collapsed into one
    // grey and an empty seat became invisible against the table it belonged
    // to. The table is now the canvas ground (--bg-surface) lifted by the
    // themed --glass-3 veil, which goes LIGHTER in dark and DARKER in light,
    // so an empty --bg-input seat separates from the table in both themes and
    // in opposite directions. Occupied stays the themed --positive.
    const ground = token('--bg-surface', '#161513');
    const veil = token('--glass-3', 'rgba(255,250,240,0.14)');
    const line = token('--border-strong', 'rgba(255,255,255,0.2)');
    const text = token('--text-main', '#f5f5f7');
    const occupied = token('--positive', '#4bd07a');
    const free = token('--bg-input', '#2c2c2e');

    const { tables, seatRadius, seatOrbit } = this.layout();
    this.geometry = { tables, seatRadius, seatOrbit };

    tables.forEach((t, i) => {
      ctx.beginPath();
      ctx.arc(t.cx, t.cy, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = ground;   // opaque base so the veil composites predictably
      ctx.fill();
      ctx.fillStyle = veil;
      ctx.fill();
      ctx.strokeStyle = line;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = text;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`T${i + 1}`, t.cx, t.cy);

      for (let s = 0; s < SEATS_PER_TABLE; s++) {
        const { x, y } = this.seatPosition(t, s, seatOrbit);
        const guest = this.guests.find(g => g.tableNumber === t.id && g.seatNumber === s + 1);
        ctx.beginPath();
        ctx.arc(x, y, seatRadius, 0, Math.PI * 2);
        ctx.fillStyle = guest ? occupied : free;
        ctx.fill();
        // An occupied seat carries its own state ring as well as its fill, so
        // the taken/empty distinction survives even where the two fills are
        // close together on screen.
        ctx.strokeStyle = guest ? occupied : line;
        ctx.lineWidth = guest ? 2 : 1;
        ctx.stroke();
      }
    });
  }

  /** Canvas coordinates from a pointer event, scaled for CSS resizing (mobile). */
  canvasPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  handleCanvasClick(e) {
    if (!this.geometry) return;
    if (!this.selectedGuestId) {
      this.message = { kind: 'warn', text: 'Pick a guest from the list first, then click a seat.' };
      this.render();
      return;
    }
    const { x, y } = this.canvasPoint(e);
    const hitRadius = Math.max(12, this.geometry.seatRadius + 6);

    for (const t of this.geometry.tables) {
      for (let s = 0; s < SEATS_PER_TABLE; s++) {
        const pos = this.seatPosition(t, s, this.geometry.seatOrbit);
        if (Math.hypot(x - pos.x, y - pos.y) > hitRadius) continue;

        const guest = this.guests.find(g => g.id === this.selectedGuestId);
        if (!guest) return;
        const occupant = this.guests.find(g => g.tableNumber === t.id && g.seatNumber === s + 1);
        if (occupant && occupant.id !== guest.id) {
          const ok = window.confirm(
            `Table ${t.id}, Seat ${s + 1} is taken by ${occupant.name}.\n\n` +
            `Move ${occupant.name} back to Unassigned and seat ${guest.name} here?`
          );
          if (!ok) return;
          occupant.tableNumber = null;
          occupant.seatNumber = null;
          this.message = { kind: 'warn', text: `${occupant.name} was moved back to Unassigned.` };
        }
        guest.tableNumber = t.id;
        guest.seatNumber = s + 1;
        // Keep momentum: auto-advance to the next guest who still needs a seat.
        // Anyone who has declined is skipped — they do not need one.
        const next = this.guests.find(g => !g.tableNumber && g.rsvp !== 'no' && g.id !== guest.id);
        this.selectedGuestId = next ? next.id : null;
        this.save();
        this.render();
        return;
      }
    }
  }

  addGuests(entries) {
    let added = 0;
    entries.forEach(({ name, group }) => {
      const clean = String(name || '').trim();
      if (!clean) return;
      this.guests.push({
        id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: clean,
        group: GUEST_GROUPS.includes(group) ? group : 'Other',
        rsvp: 'pending',
        tableNumber: null,
        seatNumber: null
      });
      added++;
    });
    if (added) this.save();
    return added;
  }

  bindEvents() {
    const q = (sel) => this.container.querySelector(sel);

    q('#seating-add-guest').addEventListener('click', () => {
      const nameInput = q('#seating-guest-name');
      const group = q('#seating-guest-group').value;
      const added = this.addGuests([{ name: nameInput.value, group }]);
      if (!added) {
        this.message = { kind: 'warn', text: 'Enter a guest name first.' };
      }
      this.render();
    });

    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    const filterEl = q('#seating-filter');
    if (filterEl) {
      // Re-render only the list, so typing never steals focus from the box.
      filterEl.addEventListener('input', () => {
        this.filter = filterEl.value;
        this.renderGuestList();
      });
    }

    const modal = q('#seating-import-modal');
    q('#seating-import-btn').addEventListener('click', () => {
      modal.hidden = false;
      q('#seating-import-text').focus();
    });
    q('#seating-import-cancel').addEventListener('click', () => { modal.hidden = true; });
    q('#seating-import-confirm').addEventListener('click', () => {
      const rows = parseCsv(q('#seating-import-text').value);
      if (!rows.length) {
        this.message = { kind: 'warn', text: 'Nothing to import — the CSV was empty.' };
        modal.hidden = true;
        this.render();
        return;
      }
      // Skip a header row.
      const first = rows[0].map(c => String(c).trim().toLowerCase());
      if (first[0] === 'name') rows.shift();
      const added = this.addGuests(rows.map(r => ({ name: r[0], group: (r[1] || '').trim() })));
      modal.hidden = true;
      this.message = {
        kind: 'warn',
        text: added ? `Imported ${added} guest${added === 1 ? '' : 's'}.` : 'No valid rows found in that CSV.'
      };
      this.render();
    });

    q('#seating-export-btn').addEventListener('click', () => {
      if (!this.guests.length) {
        this.message = { kind: 'warn', text: 'Nothing to export — add some guests first.' };
        this.render();
        return;
      }
      const lines = [['Name', 'Group', 'RSVP', 'Table', 'Seat'].join(',')].concat(
        this.guests.map(g => [
          csvCell(g.name), csvCell(g.group), csvCell(g.rsvp),
          csvCell(g.tableNumber || ''), csvCell(g.seatNumber || '')
        ].join(','))
      );
      const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guests.csv';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    });
  }
}
