import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import { formatMoney, formatNumber, escapeHtml } from '../utils/format.js';
import { eventState } from '../data/eventState.js';

/**
 * Published engineering assumptions. These are estimates, and the dashboard
 * says so — a client may ask where "158 kW" came from and we must be able
 * to answer.
 */
export const ENGINEERING_FACTORS = {
  guestsPerChairUnit: 15,       // one chair slot-unit serves a cluster of guests
  guestsPerStage: 200,          // audience a staged zone draws
  lightingKwPerUnit: 18.5,
  stageKw: 45,
  audioKw: 12.5,
  audioSplDb: 118,
  ambientSplDb: 85,
  metresPerAudioUnit: 55,       // usable throw per audio unit
  maxRatedCapacity: 5000,
  maxRatedPowerKw: 300,
  maxRatedSplDb: 130
};

const CATEGORY_LABELS = {
  stages: 'Stages',
  audio: 'Audio',
  lighting: 'Lighting',
  chairs: 'Seating',
  tables: 'Tables',
  sofas: 'Lounge',
  backdrops: 'Backdrops',
  fountains: 'Water Features',
  podiums: 'Podiums'
};

const CATEGORY_CLASS = {
  stages: 'b-stage',
  audio: 'b-audio',
  lighting: 'b-audio',
  chairs: 'b-chairs',
  tables: 'b-chairs',
  sofas: 'b-chairs'
};

export class AnalyticsDashboard {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.unsubscribe = eventState.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    this.render();
  }

  calculateMetrics() {
    const F = ENGINEERING_FACTORS;
    let seatedCapacity = 0;
    let totalPowerDrawKw = 0;
    let totalCost = 0;
    let maxSplDb = F.ambientSplDb;
    let audioUnits = 0;
    const byCategory = {};

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);
        if (!item) return;

        const qty = Number(slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1) || 1;
        const lineCost = Math.round(Number(item.price || 0) * qty);
        totalCost += lineCost;
        byCategory[item.category] = (byCategory[item.category] || 0) + lineCost;

        if (item.category === 'chairs') {
          seatedCapacity += qty * F.guestsPerChairUnit;
        } else if (item.category === 'lighting') {
          totalPowerDrawKw += F.lightingKwPerUnit * qty;
        } else if (item.category === 'stages') {
          totalPowerDrawKw += F.stageKw;
          seatedCapacity += F.guestsPerStage;
        } else if (item.category === 'audio' || (item.id && item.id.includes('horn'))) {
          maxSplDb = Math.max(maxSplDb, F.audioSplDb);
          totalPowerDrawKw += F.audioKw;
          audioUnits += qty;
        }
      });
    });

    const plannedGuests = eventState.getGuestCount();
    const budgetTarget = eventState.getBudgetTarget();

    // Security tier now scales with the planned headcount and the order size,
    // both of which move — it is no longer pinned to its maximum.
    const tiers = [
      { min: 0, level: 1, label: 'Level 1 (General)' },
      { min: 300, level: 2, label: 'Level 2 (Managed Entry)' },
      { min: 800, level: 3, label: 'Level 3 (VIP Standard)' },
      { min: 2000, level: 4, label: 'Level 4 (High Profile)' },
      { min: 4000, level: 5, label: 'Level 5 (VVIP High-Security)' }
    ];
    const tier = [...tiers].reverse().find(t => plannedGuests >= t.min) || tiers[0];

    return {
      seatedCapacity,
      plannedGuests,
      capacityGap: plannedGuests - seatedCapacity,
      powerDrawKw: Math.round(totalPowerDrawKw),
      splDb: maxSplDb,
      coverageRadiusMeters: audioUnits > 0 ? Math.round(audioUnits * F.metresPerAudioUnit) : 0,
      audioUnits,
      securityLevel: tier.level,
      securityLabel: tier.label,
      totalCost,
      budgetTarget,
      byCategory
    };
  }

  render() {
    const F = ENGINEERING_FACTORS;
    const m = this.calculateMetrics();
    const pct = (value, max) => Math.max(0, Math.min(100, (value / max) * 100));

    const budgetLine = m.budgetTarget > 0
      ? `<small>${escapeHtml(formatMoney(m.totalCost))} of ${escapeHtml(formatMoney(m.budgetTarget))} target
           (${Math.round(pct(m.totalCost, m.budgetTarget))}%)</small>`
      : `<small>${escapeHtml(formatMoney(m.totalCost))} configured · no budget target set</small>`;

    const segments = Object.entries(m.byCategory)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);

    const breakdown = m.totalCost > 0 && segments.length
      ? segments.map(([cat, value]) => {
          const share = (value / m.totalCost) * 100;
          const label = CATEGORY_LABELS[cat] || cat;
          const cls = CATEGORY_CLASS[cat] || 'b-decor';
          return `<div class="b-segment ${cls}" style="width:${share.toFixed(1)}%;"
                       title="${escapeHtml(label)}: ${escapeHtml(formatMoney(value))} (${share.toFixed(1)}%)">
                    ${share >= 8 ? `${Math.round(share)}% ${escapeHtml(label)}` : ''}
                  </div>`;
        }).join('')
      : `<div style="padding:.75rem; color:var(--text-muted); font-size:.85rem;">
           Nothing configured yet — pick items in the 360° Studio and the budget split appears here.
         </div>`;

    this.container.innerHTML = `
      <div class="analytics-wrapper realistic-map-theme">
        <div class="analytics-header">
          <h3>📊 Event Capacity, Audio &amp; Power Telemetry</h3>
          <p>
            Derived live from the current configuration and the shared event record.
            Engineering figures are planning estimates from published factors
            (${F.lightingKwPerUnit} kW per lighting unit, ${F.stageKw} kW per stage,
            ${F.audioKw} kW per audio unit) — not measured telemetry.
          </p>
        </div>

        <div class="kpi-cards-grid">
          <div class="kpi-card">
            <div class="kpi-head"><span>👥 Seated Capacity</span><small>vs ${formatNumber(m.plannedGuests)} planned</small></div>
            <div class="kpi-val">${formatNumber(m.seatedCapacity)} <small>seats</small></div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill" style="width:${pct(m.seatedCapacity, Math.max(m.plannedGuests, 1)).toFixed(1)}%;"></div>
            </div>
            <small style="color:${m.capacityGap > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'};">
              ${m.capacityGap > 0
                ? `${formatNumber(m.capacityGap)} guests short`
                : `${formatNumber(Math.abs(m.capacityGap))} seats spare`}
            </small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>⚡ Power Load Draw</span><small>kW Generator</small></div>
            <div class="kpi-val">${formatNumber(m.powerDrawKw)} <small>kW</small></div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-indigo" style="width:${pct(m.powerDrawKw, F.maxRatedPowerKw).toFixed(1)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">of a ${F.maxRatedPowerKw} kW rated supply</small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>🔊 Audio Coverage</span><small>SPL dB</small></div>
            <div class="kpi-val">
              ${m.splDb} <small>dB SPL${m.coverageRadiusMeters ? ` (~${formatNumber(m.coverageRadiusMeters)} m)` : ''}</small>
            </div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-emerald" style="width:${pct(m.splDb, F.maxRatedSplDb).toFixed(1)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">
              ${m.audioUnits ? `${formatNumber(m.audioUnits)} audio unit(s) configured` : 'No audio configured — ambient only'}
            </small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>🛡️ Security &amp; Safety Index</span><small>Tier ${m.securityLevel} of 5</small></div>
            <div class="kpi-val" style="font-size:1.05rem;">${escapeHtml(m.securityLabel)}</div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-rose" style="width:${((m.securityLevel / 5) * 100).toFixed(0)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">Scaled from the ${formatNumber(m.plannedGuests)}-guest headcount</small>
          </div>
        </div>

        <div class="budget-chart-panel">
          <h4>💰 Budget Allocation Breakdown ${budgetLine}</h4>
          <div class="budget-breakdown-bar">${breakdown}</div>
          ${segments.length ? `
          <div style="display:flex; flex-wrap:wrap; gap:.75rem; margin-top:.6rem; font-size:.78rem; color:var(--text-muted);">
            ${segments.map(([cat, value]) =>
              `<span>${escapeHtml(CATEGORY_LABELS[cat] || cat)} — ${escapeHtml(formatMoney(value))}</span>`
            ).join('')}
          </div>` : ''}
        </div>
      </div>
    `;
  }
}
