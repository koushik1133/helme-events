import { TESTIMONIALS } from '../data/testimonials.js';
import { escapeHtml, formatNumber, readJSON, writeJSON } from '../utils/format.js';

const STORAGE_KEY = 'helme_events_testimonials';

const TYPE_LABELS = {
  wedding: 'Wedding',
  corporate: 'Corporate',
  rally: 'Political Rally',
  gala: 'Gala'
};

/** Normalise both seeded reviews and locally submitted ones to one shape. */
function normalise(entry) {
  const type = String(entry.eventType || entry.type || 'wedding').toLowerCase();
  return {
    id: entry.id,
    clientName: entry.clientName || entry.name || 'Anonymous client',
    company: entry.company || '',
    eventType: type,
    venue: entry.venue || '',
    city: entry.city || '',
    date: entry.date || '',
    rating: Math.max(1, Math.min(5, parseInt(entry.rating, 10) || 5)),
    guestCount: Number(entry.guestCount ?? entry.guests) || 0,
    budgetBracket: entry.budgetBracket || '',
    review: entry.review || entry.text || '',
    verified: entry.verified === true
  };
}

export class TestimonialWall {
  constructor(containerElement) {
    this.container = containerElement;
    // Locally submitted reviews sit on top of the curated set; they are never
    // marked verified.
    const submitted = readJSON(STORAGE_KEY, []);
    this.submitted = Array.isArray(submitted) ? submitted.map(normalise) : [];
    this.seeded = TESTIMONIALS.map(normalise);
    this.filter = 'All';
    this._bound = false;
  }

  get all() {
    return [...this.submitted, ...this.seeded];
  }

  /** Filters are derived from the data, so no filter can render an empty tab. */
  get filters() {
    const present = [...new Set(this.all.map(t => t.eventType))];
    return ['All', ...present];
  }

  labelFor(type) {
    return TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  render() {
    const all = this.all;
    const filtered = this.filter === 'All' ? all : all.filter(t => t.eventType === this.filter);
    const avg = filtered.length
      ? (filtered.reduce((a, t) => a + t.rating, 0) / filtered.length).toFixed(1)
      : '—';

    this.container.innerHTML = `
      <div class="testimonial-wall">
        <div class="testimonial-header">
          <div>
            <h2>Client Reviews</h2>
            <p class="meta">${filtered.length} review${filtered.length === 1 ? '' : 's'}${
              this.filter === 'All' ? '' : ` in ${escapeHtml(this.labelFor(this.filter))}`
            }</p>
          </div>
          <div class="testimonial-avg-rating" aria-label="Average rating for the current filter">
            ${avg} ⭐
          </div>
        </div>

        <div class="testimonial-filters" role="group" aria-label="Filter reviews by event type">
          ${this.filters.map(f => `
            <button type="button" class="btn-filter ${this.filter === f ? 'active' : ''}"
                    data-filter="${escapeHtml(f)}" aria-pressed="${this.filter === f}">
              ${escapeHtml(f === 'All' ? 'All' : this.labelFor(f))}
            </button>
          `).join('')}
        </div>

        <div class="testimonial-grid masonry">
          ${filtered.length === 0
            ? '<p class="meta">No reviews in this category yet.</p>'
            : filtered.map(t => this.renderCard(t)).join('')}
        </div>

        <div class="testimonial-form-wrapper">
          <h3>Add Your Review</h3>
          <form id="testimonial-form">
            <label for="t-name">Your name</label>
            <input type="text" id="t-name" name="name" placeholder="e.g. Aditi Deshmukh" required />

            <label for="t-company">Company or family name (optional)</label>
            <input type="text" id="t-company" name="company" placeholder="Optional" />

            <label for="t-venue">Venue</label>
            <input type="text" id="t-venue" name="venue" placeholder="e.g. Taj Falaknuma Palace" />

            <label for="t-city">City</label>
            <input type="text" id="t-city" name="city" placeholder="e.g. Hyderabad" />

            <label for="t-type">Event type</label>
            <select id="t-type" name="type" required>
              ${Object.entries(TYPE_LABELS).map(([value, label]) =>
                `<option value="${value}">${label}</option>`).join('')}
            </select>

            <label for="t-rating">Rating (1-5)</label>
            <input type="number" id="t-rating" name="rating" min="1" max="5" value="5" required />

            <label for="t-guests">Guest count</label>
            <input type="number" id="t-guests" name="guests" min="1" placeholder="e.g. 300" required />

            <label for="t-text">Your review</label>
            <textarea id="t-text" name="review" placeholder="What did we get right, and what would you change?" required></textarea>

            <button type="submit" class="btn-submit">Submit Review</button>
            <p id="t-form-status" role="status" aria-live="polite" class="meta"></p>
          </form>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderCard(t) {
    const meta = [
      t.venue && t.city ? `${escapeHtml(t.venue)}, ${escapeHtml(t.city)}` : escapeHtml(t.venue || t.city),
      t.date ? escapeHtml(t.date) : '',
      t.guestCount ? `${formatNumber(t.guestCount)} guests` : '',
      t.budgetBracket ? escapeHtml(t.budgetBracket) : ''
    ].filter(Boolean);

    return `
      <div class="testimonial-card">
        <div class="stars" aria-label="${t.rating} out of 5">${'⭐'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
        <h4>${escapeHtml(t.clientName)}${t.company ? ` — ${escapeHtml(t.company)}` : ''}</h4>
        <div class="testimonial-badges">
          <span class="badge badge-${escapeHtml(t.eventType)}">${escapeHtml(this.labelFor(t.eventType))}</span>
          ${t.verified
            ? '<span class="badge badge-verified" title="Confirmed booking on file">✓ Verified client</span>'
            : '<span class="badge badge-unverified" title="Submitted in this browser, not confirmed">Unverified</span>'}
        </div>
        <p>${escapeHtml(t.review)}</p>
        <div class="meta">${meta.join(' · ')}</div>
      </div>
    `;
  }

  setStatus(message) {
    const el = this.container.querySelector('#t-form-status');
    if (el) el.textContent = message;
  }

  bindEvents() {
    // Delegated, bound once to the persistent container — re-rendering must
    // never stack duplicate handlers.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const btn = e.target.closest('.btn-filter');
      if (!btn) return;
      this.filter = btn.dataset.filter;
      this.render();
    });

    this.container.addEventListener('submit', e => {
      const form = e.target.closest('#testimonial-form');
      if (!form) return;
      e.preventDefault();

      const value = id => (this.container.querySelector(id)?.value || '').trim();
      const entry = normalise({
        id: `local-${Date.now()}`,
        clientName: value('#t-name'),
        company: value('#t-company'),
        venue: value('#t-venue'),
        city: value('#t-city'),
        eventType: value('#t-type'),
        rating: value('#t-rating'),
        guestCount: value('#t-guests'),
        review: value('#t-text'),
        date: new Date().toISOString().split('T')[0],
        verified: false
      });

      if (!entry.review) {
        this.setStatus('Please write a review before submitting.');
        return;
      }

      this.submitted.unshift(entry);
      const saved = writeJSON(STORAGE_KEY, this.submitted);
      this.render();
      this.setStatus(saved
        ? 'Thanks — your review is on the wall, marked unverified until we confirm the booking.'
        : 'Review added for this session, but browser storage is full so it will not persist.');
    });
  }
}
