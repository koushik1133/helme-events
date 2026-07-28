import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class AnalyticsDashboard {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;

    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.render();
  }

  calculateMetrics() {
    let totalGuestCapacity = 0;
    let totalPowerDrawKw = 0;
    let totalCost = 0;
    let maxSplDb = 85;

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);

        if (item) {
          totalCost += item.price * slot.quantity;

          if (item.category === 'chairs') {
            totalGuestCapacity += slot.quantity * 15;
          } else if (item.category === 'lighting') {
            totalPowerDrawKw += 18.5 * slot.quantity;
          } else if (item.category === 'stages') {
            totalPowerDrawKw += 45;
            totalGuestCapacity += 200;
          } else if (item.category === 'fountains' && item.id.includes('horn')) {
            maxSplDb = Math.max(maxSplDb, 118);
            totalPowerDrawKw += 12.5;
          }
        }
      });
    });

    const guestCapacityFormatted = Math.min(totalGuestCapacity, 5000);
    const securityLevel = totalCost > 25000 ? 'Level 5 (VVIP High-Security)' : (totalCost > 15000 ? 'Level 3 (VIP Standard)' : 'Level 1 (General)');

    return {
      guestCapacity: guestCapacityFormatted,
      powerDrawKw: Math.round(totalPowerDrawKw),
      splDb: maxSplDb,
      coverageRadiusMeters: 350,
      securityLevel: securityLevel,
      totalCost: totalCost
    };
  }

  render() {
    const metrics = this.calculateMetrics();

    this.container.innerHTML = `
      <div class="analytics-wrapper realistic-map-theme">
        <div class="analytics-header">
          <h3>📊 Event Capacity, Audio & Power Telemetry Dashboard</h3>
          <p>Real-time KPI metrics monitoring guest capacity, generator load, sound coverage, & VVIP security index.</p>
        </div>

        <div class="kpi-cards-grid">
          <div class="kpi-card">
            <div class="kpi-head"><span>👥 Guest Capacity</span><small>Max 5,000</small></div>
            <div class="kpi-val">${metrics.guestCapacity.toLocaleString()} <small>Attendees</small></div>
            <div class="kpi-bar-wrap"><div class="kpi-bar-fill" style="width: ${(metrics.guestCapacity / 5000) * 100}%;"></div></div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>⚡ Power Load Draw</span><small>kW Generator</small></div>
            <div class="kpi-val">${metrics.powerDrawKw} <small>kW</small></div>
            <div class="kpi-bar-wrap"><div class="kpi-bar-fill bg-indigo" style="width: ${Math.min((metrics.powerDrawKw / 300) * 100, 100)}%;"></div></div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>🔊 Audio Coverage</span><small>SPL dB</small></div>
            <div class="kpi-val">${metrics.splDb} <small>dB SPL (${metrics.coverageRadiusMeters}m)</small></div>
            <div class="kpi-bar-wrap"><div class="kpi-bar-fill bg-emerald" style="width: ${(metrics.splDb / 120) * 100}%;"></div></div>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>🛡️ Security & Safety Index</span><small>VVIP Level</small></div>
            <div class="kpi-val">${metrics.securityLevel}</div>
            <div class="kpi-bar-wrap"><div class="kpi-bar-fill bg-rose" style="width: 95%;"></div></div>
          </div>
        </div>

        <div class="budget-chart-panel">
          <h4>💰 Budget Allocation Breakdown</h4>
          <div class="budget-breakdown-bar">
            <div class="b-segment b-stage" style="width: 35%;" title="Stages: 35%">35% Stages</div>
            <div class="b-segment b-audio" style="width: 25%;" title="Audio & Lighting: 25%">25% Audio/Light</div>
            <div class="b-segment b-decor" style="width: 25%;" title="Decor & Floral: 25%">25% Decor</div>
            <div class="b-segment b-chairs" style="width: 15%;" title="Seating: 15%">15% Seating</div>
          </div>
        </div>
      </div>
    `;
  }
}
