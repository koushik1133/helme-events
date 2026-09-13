import { TESTIMONIALS } from '../data/testimonials.js';
import { escapeHtml, formatNumber } from '../utils/format.js';

/**
 * Client references.
 *
 * This is a READ-ONLY reference sheet: past events Helm has delivered, with
 * the venue, city, guest count and budget bracket a prospect actually wants to
 * hear about. It is the pitch asset a salesperson already carries in a folder.
 *
 * What this deliberately is NOT: a review-collection wall. The previous
 * version shipped an "Add Your Review" form that wrote to the salesperson's
 * own browser and stamped the result "Unverified". Nobody types a review into
 * the seller's laptop mid-pitch, and a review wall a seller can edit is worth
 * nothing as social proof — so the form, and the localStorage path behind it,
 * are gone. Each card says plainly whether the booking is confirmed on file.
 */

const TYPE_LABELS = {
  wedding: 'Wedding',
  corporate: 'Corporate',
  rally: 'Political Rally',
  gala: 'Gala',
  summit: 'Summit'
};

/** Normalise the curated data to one shape. */
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
    this.references = (Array.isArray(TESTIMONIALS) ? TESTIMONIALS : []).map(normalise);
    this.filter = 'All';
    this._bound = false;
  }

  /** Filters are derived from the data, so no filter can render an empty tab. */
  get filters() {
    return ['All', ...new Set(this.references.map(t => t.eventType))];
  }

  labelFor(type) {
    return TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  render() {
    const all = this.references;

    if (all.length === 0) {
      this.container.innerHTML = `
        <div class="testimonial-wall" style="color:var(--text-main);">
          <div class="testimonial-header"><div><h2>Client References</h2></div></div>
          <p class="meta">No references are on file yet.</p>
        </div>`;
      return;
    }

    const filtered = this.filter === 'All' ? all : all.filter(t => t.eventType === this.filter);
    const avg = filtered.length
      ? (filtered.reduce((a, t) => a + t.rating, 0) / filtered.length).toFixed(1)
      : '—';

    this.container.innerHTML = `
      <div class="testimonial-wall" style="color:var(--text-main);">
        <div class="testimonial-header">
          <div>
            <h2>Client References</h2>
            <p class="meta">${filtered.length} delivered event${filtered.length === 1 ? '' : 's'}${
              this.filter === 'All' ? '' : ` in ${escapeHtml(this.labelFor(this.filter))}`
            } · ${filtered.filter(t => t.verified).length} with a confirmed booking on file</p>
          </div>
          <div class="testimonial-avg-rating" aria-label="Average rating for the current filter">
            ${avg} ⭐
          </div>
        </div>

        <div class="testimonial-filters" role="group" aria-label="Filter references by event type">
          ${this.filters.map(f => `
            <button type="button" class="btn-filter ${this.filter === f ? 'active' : ''}"
                    data-filter="${escapeHtml(f)}" aria-pressed="${this.filter === f}">
              ${escapeHtml(f === 'All' ? 'All' : this.labelFor(f))}
            </button>
          `).join('')}
        </div>

        <div class="testimonial-grid masonry">
          ${filtered.map(t => this.renderCard(t)).join('')}
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
            ? '<span class="badge badge-verified" title="Confirmed booking on file">✓ Verified booking</span>'
            : '<span class="badge badge-unverified" title="Reference given, booking not confirmed on file">Reference only</span>'}
        </div>
        <p>${escapeHtml(t.review)}</p>
        <div class="meta">${meta.join(' · ')}</div>
      </div>
    `;
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
  }
}
