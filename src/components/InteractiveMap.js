import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class InteractiveMap {
  constructor(containerElement, onSelectZone, activeSelections) {
    this.container = containerElement;
    this.onSelectZone = onSelectZone;
    this.activeSelections = activeSelections;

    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.render();
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
    this.container.innerHTML = `
      <div class="map-wrapper realistic-map-theme">
        <!-- Photorealistic Aerial Drone Venue Map Canvas -->
        <div class="map-canvas-container photo-map-container">
          <img src="/images/venue_map_aerial.jpg" alt="Aerial Resort Venue Map" class="photo-map-img" />

          <!-- Hotspot Nodes Overlay -->
          <div class="dots-overlay">
            ${VENUE_ZONES.map(zone => {
              const cost = this.calculateZoneCost(zone);
              return `
                <div class="map-dot-wrapper photo-node-wrapper" style="left: ${zone.mapPos.x}%; top: ${zone.mapPos.y}%;" data-zone-id="${zone.id}">
                  
                  <!-- Interactive Photo Node Marker -->
                  <button class="photo-node-button" aria-label="Open ${zone.name}">
                    <img src="${zone.thumbnailUrl}" class="node-thumb" alt="${zone.name}" />
                    <span class="node-price-tag">$${cost.toLocaleString()}</span>
                  </button>

                  <!-- Attio-Style Photo Zone Card -->
                  <div class="dot-tooltip photo-zone-card">
                    <div class="card-media">
                      <img src="${zone.panoramaUrl}" alt="${zone.name}" class="card-banner-img" />
                      <span class="card-badge">360° Live</span>
                    </div>

                    <div class="card-content">
                      <div class="tooltip-header">
                        <h4>${zone.name}</h4>
                        <span class="tooltip-price">$${cost.toLocaleString()}</span>
                      </div>
                      <p class="zone-desc">${zone.subtitle}</p>

                      <div class="tooltip-slots photo-slots-list">
                        ${zone.slots.map(slot => {
                          const item = getItemById(this.activeSelections[slot.id] || slot.defaultItemId);
                          return `
                            <div class="tooltip-slot-item">
                              <span class="slot-label">${slot.label}:</span>
                              <strong class="slot-val">${item ? item.name : 'None'}</strong>
                            </div>
                          `;
                        }).join('')}
                      </div>

                      <button class="btn-launch btn-photo-launch" data-zone-id="${zone.id}">
                        Enter 360° Studio →
                      </button>
                    </div>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="map-overlay-title">
          <h3>📍 Aerial Venue Dashboard</h3>
          <p>Click any photo node on the aerial map to enter its 360° visualizer & swap setup objects.</p>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const wrappers = this.container.querySelectorAll('.photo-node-wrapper');
    wrappers.forEach(wrap => {
      wrap.addEventListener('click', () => {
        const zoneId = wrap.getAttribute('data-zone-id');
        if (zoneId && this.onSelectZone) {
          this.onSelectZone(zoneId);
        }
      });
    });

    const launchBtns = this.container.querySelectorAll('.btn-photo-launch');
    launchBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const zoneId = btn.getAttribute('data-zone-id');
        if (zoneId && this.onSelectZone) {
          this.onSelectZone(zoneId);
        }
      });
    });
  }
}
