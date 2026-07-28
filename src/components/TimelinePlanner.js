import { VENUE_ZONES } from '../data/zones.js';

export class TimelinePlanner {
  constructor(containerElement, activeSelections, onLoadDay) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onLoadDay = onLoadDay;
    
    const saved = localStorage.getItem('helme_events_timeline');
    this.days = saved ? JSON.parse(saved) : [
      { id: 'day-1', name: 'Day 1', date: new Date().toISOString().split('T')[0], selections: { ...this.activeSelections } }
    ];
    this.activeDayId = this.days[0].id;
    
    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    const activeDay = this.days.find(d => d.id === this.activeDayId);
    if (activeDay) {
      activeDay.selections = { ...activeSelections };
      this.save();
    }
  }

  save() {
    localStorage.setItem('helme_events_timeline', JSON.stringify(this.days));
  }

  render() {
    this.container.innerHTML = `
      <div class="timeline-wrapper">
        <div class="timeline-header">
          <h2>📅 Multi-Day Event Timeline Planner</h2>
          <button class="btn-primary" id="timeline-add-btn">+ Add Day</button>
        </div>
        <div class="timeline-grid" id="timeline-grid">
          ${this.days.map(day => this.renderDayCard(day)).join('')}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderDayCard(day) {
    const isActive = day.id === this.activeDayId;
    return `
      <div class="timeline-card ${isActive ? 'active' : ''}" data-id="${day.id}">
        <div class="timeline-card-header">
          <input type="text" class="timeline-name-input" value="${day.name}" data-id="${day.id}" />
          ${this.days.length > 1 ? `<button class="btn-icon timeline-remove-btn" data-id="${day.id}">❌</button>` : ''}
        </div>
        <input type="date" class="timeline-date-input" value="${day.date}" data-id="${day.id}" />
        <div class="timeline-summary">
          ${Object.keys(day.selections).length} Items Configured
        </div>
        <button class="btn-secondary timeline-load-btn" data-id="${day.id}">
          ${isActive ? 'Currently Active' : 'Load Configuration'}
        </button>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelector('#timeline-add-btn').addEventListener('click', () => {
      const newId = 'day-' + Date.now();
      this.days.push({
        id: newId,
        name: `Day ${this.days.length + 1}`,
        date: new Date().toISOString().split('T')[0],
        selections: { ...this.activeSelections }
      });
      this.save();
      this.render();
    });

    this.container.querySelectorAll('.timeline-name-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const day = this.days.find(d => d.id === e.target.dataset.id);
        if (day) day.name = e.target.value;
        this.save();
      });
    });

    this.container.querySelectorAll('.timeline-date-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const day = this.days.find(d => d.id === e.target.dataset.id);
        if (day) day.date = e.target.value;
        this.save();
      });
    });

    this.container.querySelectorAll('.timeline-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = e.target.dataset.id;
        this.days = this.days.filter(d => d.id !== id);
        if (this.activeDayId === id && this.days.length > 0) {
          this.activeDayId = this.days[0].id;
          if (this.onLoadDay) this.onLoadDay(this.days[0].selections);
        }
        this.save();
        this.render();
      });
    });

    this.container.querySelectorAll('.timeline-load-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.activeDayId = id;
        const day = this.days.find(d => d.id === id);
        if (day && this.onLoadDay) {
          this.onLoadDay(day.selections);
        }
        this.render();
      });
    });
  }
}
