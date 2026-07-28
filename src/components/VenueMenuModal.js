import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class VenueMenuModal {
  constructor(containerElement, onSelectZone, activeSelections) {
    this.container = containerElement;
    this.onSelectZone = onSelectZone;
    this.activeSelections = activeSelections;
    this.isOpen = false;
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    if (this.isOpen) this.render();
  }

  calculateZoneCost(zone) {
    let total = 0;
    zone.slots.forEach(slot => {
      const selectedItemId = this.activeSelections[slot.id] || slot.defaultItemId;
      const item = getItemById(selectedItemId);
      if (item) {
        total += item.price * slot.quantity;
      }
    });
    return total;
  }

  render() {
    if (!this.isOpen) return;

    this.container.innerHTML = `
      <div class="swapper-modal-overlay">
        <div class="swapper-modal-card realistic-swapper-card venue-menu-card">
          
          <div class="swapper-modal-header">
            <div>
              <span class="swapper-modal-badge">📖 Visual Options Menu</span>
              <h3>Browse 4K Venue Zones & Experiences</h3>
              <p class="swapper-modal-subtitle">Select any venue zone to enter its 360° visualizer & customize items in place.</p>
            </div>
            <button class="btn-close-modal" id="btnCloseVenueMenu">&times;</button>
          </div>

          <div class="venue-menu-grid">
            ${VENUE_ZONES.map(zone => {
              const cost = this.calculateZoneCost(zone);
              return `
                <div class="venue-menu-item-card" data-zone-id="${zone.id}">
                  <div class="venue-card-img-wrap">
                    <img src="${zone.panoramaUrl}" alt="${zone.name}" class="venue-card-img" />
                    <span class="venue-card-badge">$${cost.toLocaleString()}</span>
                  </div>
                  <div class="venue-card-body">
                    <h4>${zone.name}</h4>
                    <p>${zone.subtitle}</p>
                    <button class="btn-menu-launch" data-zone-id="${zone.id}">
                      Enter 360° Studio →
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('#btnCloseVenueMenu');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const launchBtns = this.container.querySelectorAll('.btn-menu-launch');
    launchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const zoneId = btn.getAttribute('data-zone-id');
        this.close();
        if (zoneId && this.onSelectZone) {
          this.onSelectZone(zoneId);
        }
      });
    });

    const itemCards = this.container.querySelectorAll('.venue-menu-item-card');
    itemCards.forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-menu-launch')) return;
        const zoneId = card.getAttribute('data-zone-id');
        this.close();
        if (zoneId && this.onSelectZone) {
          this.onSelectZone(zoneId);
        }
      });
    });
  }
}
