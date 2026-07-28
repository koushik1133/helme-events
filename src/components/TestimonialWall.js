import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class TestimonialWall {
  constructor(containerElement) {
    this.container = containerElement;
    this.testimonials = JSON.parse(localStorage.getItem('helme_events_testimonials')) || [
      { id: 1, name: 'Alice Smith', company: 'TechCorp', type: 'Corporate', rating: 5, text: 'Amazing event setup!', date: '2023-10-12', guests: 200 },
      { id: 2, name: 'John Doe', company: '', type: 'Wedding', rating: 4, text: 'Beautiful mandap.', date: '2023-11-05', guests: 500 }
    ];
    this.filter = 'All';
  }

  render() {
    const filtered = this.filter === 'All' ? this.testimonials : this.testimonials.filter(t => t.type === this.filter);
    const avgRating = this.testimonials.length ? (this.testimonials.reduce((a, b) => a + b.rating, 0) / this.testimonials.length).toFixed(1) : 0;
    
    this.container.innerHTML = `
      <div class="testimonial-wall">
        <div class="testimonial-header">
          <h2>Client Reviews</h2>
          <div class="testimonial-avg-rating">Average Rating: ${avgRating} ⭐</div>
        </div>
        
        <div class="testimonial-filters">
          ${['All', 'Wedding', 'Corporate', 'Rally', 'Gala'].map(f => `
            <button class="btn-filter ${this.filter === f ? 'active' : ''}" data-filter="${f}">${f}</button>
          `).join('')}
        </div>

        <div class="testimonial-grid masonry">
          ${filtered.map(t => `
            <div class="testimonial-card">
              <div class="stars">${'⭐'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
              <h4>${t.name} ${t.company ? `(${t.company})` : ''}</h4>
              <span class="badge badge-${t.type.toLowerCase()}">${t.type}</span>
              <p>"${t.text}"</p>
              <div class="meta">
                <span>Date: ${t.date}</span> | <span>Guests: ${t.guests}</span>
              </div>
            </div>
          `).join('')}
        </div>

        <div class="testimonial-form-wrapper">
          <h3>Add Your Review</h3>
          <form id="testimonial-form">
            <input type="text" id="t-name" placeholder="Name" required />
            <input type="text" id="t-company" placeholder="Company (Optional)" />
            <select id="t-type" required>
              <option value="Wedding">Wedding</option>
              <option value="Corporate">Corporate</option>
              <option value="Rally">Rally</option>
              <option value="Gala">Gala</option>
            </select>
            <input type="number" id="t-rating" min="1" max="5" placeholder="Rating (1-5)" required />
            <input type="number" id="t-guests" placeholder="Guest Count" required />
            <textarea id="t-text" placeholder="Your review..." required></textarea>
            <button type="submit" class="btn-submit">Submit Review</button>
          </form>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelectorAll('.btn-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.filter = e.target.dataset.filter;
        this.render();
      });
    });

    const form = this.container.querySelector('#testimonial-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const newTestimonial = {
          id: Date.now(),
          name: this.container.querySelector('#t-name').value,
          company: this.container.querySelector('#t-company').value,
          type: this.container.querySelector('#t-type').value,
          rating: parseInt(this.container.querySelector('#t-rating').value, 10),
          guests: this.container.querySelector('#t-guests').value,
          text: this.container.querySelector('#t-text').value,
          date: new Date().toISOString().split('T')[0]
        };
        this.testimonials.push(newTestimonial);
        localStorage.setItem('helme_events_testimonials', JSON.stringify(this.testimonials));
        this.render();
      });
    }
  }
}
