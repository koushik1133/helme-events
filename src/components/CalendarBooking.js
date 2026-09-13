import { readJSON, writeJSON, escapeHtml } from '../utils/format.js';
import { eventState, todayISO, formatEventDate, parseISODate } from '../data/eventState.js';

const STORE_KEY = 'helm_events_bookings_v2';
const LEGACY_KEY = 'helme_events_bookings';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

export class CalendarBooking {
  constructor(containerElement) {
    this.container = containerElement;
    this.bookings = this.loadBookings();
    // ALWAYS day-1 normalised: setMonth() on a date carrying day 31 skips February.
    const now = new Date();
    this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
    this.selectedDates = [];
    this.editingId = null;
    this.showPast = false;
    this.message = null;
    this.bound = false;
  }

  /** bookings: [{ id, date, name, venue }] — a date can hold more than one event. */
  loadBookings() {
    const stored = readJSON(STORE_KEY, null);
    if (Array.isArray(stored)) {
      return stored
        .filter(b => b && typeof b === 'object' && parseISODate(b.date))
        .map(b => ({
          id: typeof b.id === 'string' ? b.id : 'bk' + Math.random().toString(36).slice(2, 10),
          date: b.date,
          name: String(b.name ?? 'Untitled event'),
          venue: String(b.venue ?? '')
        }));
    }
    // Migrate the legacy flat {date: name} map.
    const legacy = readJSON(LEGACY_KEY, null);
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return Object.entries(legacy)
        .filter(([date]) => parseISODate(date))
        .map(([date, name], i) => ({
          id: `bk-legacy-${i}`,
          date,
          name: String(name ?? 'Untitled event'),
          venue: ''
        }));
    }
    return [];
  }

  save() {
    writeJSON(STORE_KEY, this.bookings);
  }

  bookingsOn(dateStr) {
    return this.bookings.filter(b => b.date === dateStr);
  }

  render() {
    const ev = eventState.get();
    this.container.innerHTML = `
      <div class="calendar-wrapper" style="padding:20px; color:var(--text-main);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:1rem; flex-wrap:wrap;">
          <div>
            <h2 style="color:var(--text-main);">📆 Calendar &amp; Event Booking</h2>
            <p style="font-size:.8rem; color:var(--text-muted); margin-top:.25rem;">
              Booking for ${escapeHtml(ev.venue)} · past dates cannot be booked.
            </p>
          </div>
          <div style="display:flex; align-items:center; gap:.5rem;">
            <button class="btn-secondary" id="cal-prev" type="button" aria-label="Previous month">&laquo; Prev</button>
            <span id="cal-month-year" style="font-weight:bold; font-size:1.05rem; min-width:11ch; text-align:center;"></span>
            <button class="btn-secondary" id="cal-next" type="button" aria-label="Next month">Next &raquo;</button>
            <button class="btn-secondary" id="cal-today" type="button">Today</button>
          </div>
        </div>

        <div style="display:flex; gap:20px; flex-wrap:wrap;">
          <div style="flex:2; min-width:320px;">
            <div id="calendar-grid" role="grid" aria-label="Booking calendar"
                 style="display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; text-align:center;"></div>
          </div>
          <div style="flex:1; min-width:260px; background:var(--bg-surface); padding:15px;
                      border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
            <h3 style="color:var(--text-main);">Book Selected Dates</h3>
            <p style="font-size:.75rem; color:var(--text-muted); margin:.25rem 0 .5rem;">
              Select one or more future dates, then name the event.
            </p>
            <div id="selected-dates-display"
                 style="margin-bottom:10px; font-weight:600; color:var(--text-main); font-size:.85rem;"></div>
            <input type="text" id="event-name" placeholder="Event Name" aria-label="Event name"
              style="width:100%; padding:8px; margin-bottom:8px; box-sizing:border-box; background:var(--bg-input);
                     color:var(--text-main); border:1px solid var(--border-subtle); border-radius:var(--radius-xs);" />
            <input type="text" id="event-venue" placeholder="Venue / hall (optional)" aria-label="Venue"
              style="width:100%; padding:8px; margin-bottom:10px; box-sizing:border-box; background:var(--bg-input);
                     color:var(--text-main); border:1px solid var(--border-subtle); border-radius:var(--radius-xs);" />
            <button class="btn-primary" id="book-dates-btn" type="button" style="width:100%;">
              ${this.editingId ? 'Save Changes' : 'Book Event'}
            </button>
            ${this.editingId
              ? `<button class="btn-secondary" id="cancel-edit-btn" type="button" style="width:100%; margin-top:6px;">Cancel edit</button>`
              : ''}
            <div id="booking-warning" role="alert"
                 style="color:var(--accent-rose); font-size:.75rem; margin-top:10px; display:none;"></div>

            <hr style="margin:18px 0; border:0; border-top:1px solid var(--border-subtle);" />

            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 style="color:var(--text-main);">${this.showPast ? 'All Bookings' : 'Upcoming Bookings'}</h3>
              <button class="btn-secondary" id="toggle-past-btn" type="button" style="font-size:.72rem; padding:.25rem .5rem;">
                ${this.showPast ? 'Hide past' : 'Show past'}
              </button>
            </div>
            <div id="bookings-list" style="font-size:.8rem; margin-top:.5rem;"></div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderCalendar();
    if (this.message) {
      this.showWarning(this.message);
      this.message = null;
    }
  }

  showWarning(text) {
    const warning = this.container.querySelector('#booking-warning');
    if (!warning) return;
    warning.textContent = text;
    warning.style.display = text ? 'block' : 'none';
  }

  renderCalendar() {
    const grid = this.container.querySelector('#calendar-grid');
    const monthYearSpan = this.container.querySelector('#cal-month-year');
    const bookingsList = this.container.querySelector('#bookings-list');
    if (!grid) return;

    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    const today = todayISO();

    monthYearSpan.textContent = `${MONTH_NAMES[month]} ${year}`;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = dayNames.map(d =>
      `<div style="font-weight:600; padding:10px; background:var(--bg-pill); color:var(--text-muted);
                   border-radius:var(--radius-xs); font-size:.75rem;">${d}</div>`
    ).join('');

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) html += '<div></div>';

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const onDate = this.bookingsOn(dateStr);
      const isSelected = this.selectedDates.includes(dateStr);
      const isPast = dateStr < today;
      const isToday = dateStr === today;

      let style = 'padding:18px 8px; border:1px solid var(--border-subtle); position:relative; ' +
        'border-radius:var(--radius-xs); color:var(--text-main); background:var(--bg-surface);';
      if (isPast) {
        // THEME NOTE — a past day used to be faded with opacity:.4, which fades
        // the date number along with the cell: measured 2.52:1 in light and
        // 3.60:1 in dark, under the 4.5:1 minimum in BOTH themes. "Past" is now
        // carried by the tertiary text role on the recessed surface, which is
        // legible in both themes (5.4:1 light, 5.6:1 dark) and still reads as
        // quieter than a live day.
        style += 'color:var(--text-dim); background:var(--bg-surface-hover); cursor:not-allowed;';
      } else {
        style += 'cursor:pointer;';
      }
      if (isToday) style += 'outline:1px solid var(--accent-indigo);';
      if (isSelected) style += 'background:var(--bg-surface-hover); border-color:var(--accent-gold); font-weight:700;';
      else if (onDate.length) style += 'border-color:var(--accent-rose);';

      // pointer-events:none so clicking the dot still hits the day cell.
      const dot = onDate.length
        ? `<div aria-hidden="true" style="pointer-events:none; position:absolute; bottom:5px; left:50%;
             transform:translateX(-50%); width:6px; height:6px; background:var(--accent-rose); border-radius:50%;"></div>`
        : '';

      const label = onDate.length
        ? `${day}, ${onDate.length} booking${onDate.length === 1 ? '' : 's'}`
        : String(day);

      html += `<div class="cal-day" role="gridcell" data-date="${dateStr}"
                    ${isPast ? 'aria-disabled="true"' : 'tabindex="0"'}
                    aria-selected="${isSelected}" aria-label="${escapeHtml(label)}"
                    style="${style}">${day}${dot}</div>`;
    }

    grid.innerHTML = html;

    const today2 = todayISO();
    const visible = this.bookings
      .filter(b => this.showPast || b.date >= today2)
      .sort((a, b) => (a.date === b.date ? a.name.localeCompare(b.name) : (a.date < b.date ? -1 : 1)));

    bookingsList.innerHTML = visible.length
      ? visible.map(b => `
          <div style="padding:6px 0; border-bottom:1px solid var(--border-subtle); display:flex;
                      justify-content:space-between; gap:.5rem; align-items:center;
                      ${b.date < today2 ? 'background:var(--bg-surface-hover);' : ''}">
            <div style="min-width:0;">
              <strong style="color:${b.date < today2 ? 'var(--text-dim)' : 'var(--text-main)'};">${escapeHtml(formatEventDate(b.date))}</strong>
              <div style="color:${b.date < today2 ? 'var(--text-dim)' : 'var(--text-muted)'}; overflow:hidden; text-overflow:ellipsis;">
                ${escapeHtml(b.name)}${b.venue ? ` · ${escapeHtml(b.venue)}` : ''}
              </div>
            </div>
            <div style="display:flex; gap:.25rem;">
              <button class="btn-icon booking-edit-btn" type="button" data-id="${escapeHtml(b.id)}"
                      aria-label="Edit ${escapeHtml(b.name)}">✏️</button>
              <button class="btn-icon booking-delete-btn" type="button" data-id="${escapeHtml(b.id)}"
                      aria-label="Cancel ${escapeHtml(b.name)}">🗑️</button>
            </div>
          </div>`).join('')
      : `<p style="color:var(--text-muted);">${this.showPast ? 'No bookings yet.' : 'No upcoming bookings. Select a date to book one.'}</p>`;

    this.updateSelectedDisplay();
  }

  updateSelectedDisplay() {
    const display = this.container.querySelector('#selected-dates-display');
    if (!display) return;
    if (!this.selectedDates.length) {
      display.textContent = 'No dates selected';
      return;
    }
    const sorted = [...this.selectedDates].sort();
    const shown = sorted.slice(0, 3).map(formatEventDate).join(', ');
    display.textContent = `${sorted.length} date(s): ${shown}${sorted.length > 3 ? ` +${sorted.length - 3} more` : ''}`;
  }

  bindEvents() {
    if (this.bound) return;
    this.bound = true;

    const handleDay = (cell) => {
      const dateStr = cell.dataset.date;
      this.showWarning('');
      if (dateStr < todayISO()) {
        this.showWarning('That date is in the past — pick today or later.');
        return;
      }
      const idx = this.selectedDates.indexOf(dateStr);
      if (idx === -1) this.selectedDates.push(dateStr);
      else this.selectedDates.splice(idx, 1);
      this.renderCalendar();
    };

    this.container.addEventListener('click', (e) => {
      const dayCell = e.target.closest('.cal-day');
      if (dayCell) { handleDay(dayCell); return; }

      const editBtn = e.target.closest('.booking-edit-btn');
      if (editBtn) { this.startEdit(editBtn.dataset.id); return; }

      const delBtn = e.target.closest('.booking-delete-btn');
      if (delBtn) { this.deleteBooking(delBtn.dataset.id); return; }

      const id = e.target.id || (e.target.closest('button') || {}).id;
      if (id === 'cal-prev') {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() - 1, 1);
        this.renderCalendar();
      } else if (id === 'cal-next') {
        this.currentDate = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 1);
        this.renderCalendar();
      } else if (id === 'cal-today') {
        const now = new Date();
        this.currentDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.renderCalendar();
      } else if (id === 'toggle-past-btn') {
        this.showPast = !this.showPast;
        this.render();
      } else if (id === 'cancel-edit-btn') {
        this.editingId = null;
        this.selectedDates = [];
        this.render();
      } else if (id === 'book-dates-btn') {
        this.commitBooking();
      }
    });

    this.container.addEventListener('keydown', (e) => {
      const dayCell = e.target.closest ? e.target.closest('.cal-day') : null;
      if (dayCell && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        handleDay(dayCell);
      }
    });
  }

  startEdit(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return;
    this.editingId = id;
    this.selectedDates = [booking.date];
    const d = parseISODate(booking.date);
    if (d) this.currentDate = new Date(d.getFullYear(), d.getMonth(), 1);
    this.render();
    this.container.querySelector('#event-name').value = booking.name;
    this.container.querySelector('#event-venue').value = booking.venue || '';
  }

  deleteBooking(id) {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) return;
    if (!window.confirm(`Cancel “${booking.name}” on ${formatEventDate(booking.date)}?`)) return;
    this.bookings = this.bookings.filter(b => b.id !== id);
    if (this.editingId === id) this.editingId = null;
    this.save();
    this.render();
  }

  commitBooking() {
    const nameEl = this.container.querySelector('#event-name');
    const venueEl = this.container.querySelector('#event-venue');
    const name = nameEl.value.trim();
    const venue = venueEl.value.trim();

    this.showWarning('');
    if (!name) { this.showWarning('Give the event a name.'); return; }
    if (!this.selectedDates.length) { this.showWarning('Select at least one date.'); return; }
    if (this.selectedDates.some(d => d < todayISO())) {
      this.showWarning('One of the selected dates is in the past.');
      return;
    }

    if (this.editingId) {
      const booking = this.bookings.find(b => b.id === this.editingId);
      if (booking) {
        booking.name = name;
        booking.venue = venue;
        booking.date = this.selectedDates[0];
      }
      this.editingId = null;
    } else {
      // A second event on the same date is allowed (different hall/time) but
      // the planner is told it is a double-booking before it happens.
      const clashes = this.selectedDates.filter(d => this.bookingsOn(d).length);
      if (clashes.length) {
        const ok = window.confirm(
          `${clashes.length} of the selected dates already has an event:\n` +
          clashes.map(d => `${formatEventDate(d)} — ${this.bookingsOn(d).map(b => b.name).join(', ')}`).join('\n') +
          '\n\nBook alongside it anyway?'
        );
        if (!ok) return;
      }
      this.selectedDates.forEach(d => {
        this.bookings.push({
          id: 'bk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          date: d,
          name,
          venue
        });
      });
    }

    this.save();

    // Keep the shared event record in step with the event that was JUST booked.
    //
    // This used to span every upcoming booking in the book, so holding a rally
    // in December and a wedding in February made "the event" four months long,
    // and Timeline, Seating and the invoice all inherited that nonsense. Only
    // the dates of this booking define this event.
    const booked = [...this.selectedDates].sort();
    if (booked.length) {
      eventState.set(
        {
          eventName: name,
          startDate: booked[0],
          endDate: booked[booked.length - 1],
          venue: venue || eventState.get().venue
        },
        { source: 'CalendarBooking' }
      );
    }

    this.selectedDates = [];
    this.render();
  }
}
