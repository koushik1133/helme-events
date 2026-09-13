import { VENUE_ZONES } from '../data/zones.js';
import { formatMoney, escapeHtml } from '../utils/format.js';
import { buildQuote } from '../utils/quote.js';
import { zonesInScope } from '../data/eventState.js';

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

  /**
   * Zone costs come from ONE quote build, not one per card — and a zone that is
   * not in scope for this event type is labelled as such rather than priced at ₹0.
   */
  zoneCosts() {
    const allIds = VENUE_ZONES.map(z => z.id);
    const scope = new Set(zonesInScope(allIds));
    const quote = buildQuote(this.activeSelections, { zoneIds: allIds });
    const costs = new Map();
    quote.zones.forEach(z => costs.set(z.zoneId, z.zoneTotal));
    return { costs, scope };
  }

  render() {
    if (!this.isOpen) return;

    this.container.innerHTML = `
      <div class="swapper-modal-overlay">
        <div class="swapper-modal-card realistic-swapper-card venue-menu-card">
          
          <div class="swapper-modal-header">
            <div>
              <span class="swapper-modal-badge">📖 Visual Options Menu</span>
              <h3>Browse Venue Zones &amp; Experiences</h3>
              <p class="swapper-modal-subtitle">Select any venue zone to enter its 360° visualizer & customize items in place.</p>
            </div>
            <button class="btn-close-modal" id="btnCloseVenueMenu">&times;</button>
          </div>

          <div class="venue-menu-grid">
            ${VENUE_ZONES.length === 0 ? `
              <div class="venue-menu-empty">
                <strong>No venue zones available.</strong>
                <p>The venue catalogue could not be loaded. Reload the page or contact your Helm Events producer.</p>
              </div>
            ` : ''}
            ${(() => {
              const { costs, scope } = this.zoneCosts();
              return VENUE_ZONES.map(zone => {
              const cost = costs.get(zone.id) || 0;
              const inScope = scope.has(zone.id);
              return `
                <div class="venue-menu-item-card" data-zone-id="${zone.id}" tabindex="0" role="button" aria-label="Open ${escapeHtml(zone.name)} in the 360 studio">
                  <div class="venue-card-img-wrap">
                    <img src="${escapeHtml(zone.panoramaUrl)}" alt="${escapeHtml(zone.name)}" class="venue-card-img" />
                    <span class="venue-card-badge">${inScope
                      ? `Decor from ${formatMoney(cost)}`
                      : `Not in this event's scope • ${formatMoney(cost)} if added`}</span>
                  </div>
                  <div class="venue-card-body">
                    <h4>${escapeHtml(zone.name)}</h4>
                    <p>${escapeHtml(zone.subtitle)}</p>
                    <button class="btn-menu-launch" data-zone-id="${zone.id}">
                      Enter 360° Studio →
                    </button>
                  </div>
                </div>
              `;
              }).join('');
            })()}
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
      const activate = () => {
        const zoneId = card.getAttribute('data-zone-id');
        this.close();
        if (zoneId && this.onSelectZone) {
          this.onSelectZone(zoneId);
        }
      };
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-menu-launch')) return;
        activate();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activate();
        }
      });
    });
  }
}
