import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class ProposalsManager {
  constructor(containerElement, activeSelections, onLoadProposal) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onLoadProposal = onLoadProposal;
    this.proposals = JSON.parse(localStorage.getItem('event360_proposals') || '[]');

    if (this.proposals.length === 0) {
      this.proposals = [
        {
          id: 'prop-1',
          title: 'Grand Election Rally Jansabha 2026 - Mumbai',
          date: '2026-08-15',
          client: 'National Campaign Committee',
          total: 42800,
          selections: { ...activeSelections }
        },
        {
          id: 'prop-2',
          title: 'Royal Destination Wedding Sangeet & Mandap',
          date: '2026-11-20',
          client: 'Royal Palace Events Pvt Ltd',
          total: 38500,
          selections: { ...activeSelections }
        }
      ];
      localStorage.setItem('event360_proposals', JSON.stringify(this.proposals));
    }

    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
  }

  saveCurrentProposal(title, client) {
    let total = 0;
    VENUE_ZONES.forEach(z => z.slots.forEach(s => {
      const item = getItemById(this.activeSelections[s.id] || s.defaultItemId);
      if (item) total += item.price * s.quantity;
    }));

    const newProp = {
      id: 'prop-' + Date.now(),
      title: title || 'Custom Event Proposal ' + new Date().toLocaleDateString(),
      date: new Date().toISOString().split('T')[0],
      client: client || 'Corporate Client',
      total: total,
      selections: { ...this.activeSelections }
    };

    this.proposals.unshift(newProp);
    localStorage.setItem('event360_proposals', JSON.stringify(this.proposals));
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="proposals-wrapper realistic-map-theme">
        <div class="proposals-header">
          <div>
            <h3>📁 Saved Proposals & Printable B2B Contract Exporter</h3>
            <p>Save custom blueprints, manage contract drafts, and export official printable B2B event agreements.</p>
          </div>
          <button class="btn-save-proposal" id="btnSaveNewProposal">➕ Save Current Design as Proposal</button>
        </div>

        <div class="proposals-grid">
          ${this.proposals.map(prop => `
            <div class="proposal-card">
              <div class="prop-card-head">
                <span class="prop-badge">B2B CONTRACT DRAFT</span>
                <span class="prop-date">${prop.date}</span>
              </div>
              <h4 class="prop-title">${prop.title}</h4>
              <p class="prop-client">Client: <strong>${prop.client}</strong></p>
              <div class="prop-price-box">
                <span class="prop-total">$${prop.total.toLocaleString()}</span>
                <small>Est. Invoice Total</small>
              </div>

              <div class="prop-actions">
                <button class="btn-load-prop" data-prop-id="${prop.id}">📂 Load Design</button>
                <button class="btn-print-prop" onclick="window.print()">🖨️ Export Contract PDF</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const saveBtn = this.container.querySelector('#btnSaveNewProposal');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        const title = prompt('Enter Proposal Title:', 'Grand Gala Event Blueprint 2026');
        const client = prompt('Enter Client Name:', 'VVIP Corporate Client');
        if (title) {
          this.saveCurrentProposal(title, client);
        }
      });
    }

    const loadBtns = this.container.querySelectorAll('.btn-load-prop');
    loadBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const propId = btn.getAttribute('data-prop-id');
        const prop = this.proposals.find(p => p.id === propId);
        if (prop && this.onLoadProposal) {
          this.onLoadProposal(prop.selections);
        }
      });
    });
  }
}
