import { VENUE_ZONES } from '../data/zones.js';
import { zonesInScope, eventState } from '../data/eventState.js';
import { getItemById } from '../data/catalog.js';
import { formatMoney, formatNumber, escapeHtml } from '../utils/format.js';

/**
 * PUBLISHED ENGINEERING FACTORS
 * -----------------------------
 * Every number on this dashboard is derived from the factors below and the
 * quantities already in `src/data/zones.js`. A client WILL ask "where does
 * 118 kW come from?" — each factor therefore carries the reasoning that
 * justifies it, and the dashboard prints the ones it used.
 *
 * What was removed, deliberately, because it could not be defended:
 *  - "15 guests per chair unit". A chair slot's `quantity` IS a chair count
 *    (the banquet slot is 120 chairs), so one chair is one seat. The old
 *    factor inflated a 166-seat wedding to 2,890 seats.
 *  - "+200 guests per stage". A stage does not create seats.
 *  - "350 m coverage radius", a hardcoded constant presented as a measurement.
 *  - The "Security & Safety Index", an invented 5-tier ladder. Replaced with a
 *    crew count from a ratio an operations manager can actually staff against.
 */
export const ENGINEERING_FACTORS = {
  // --- Seating ---------------------------------------------------------
  // A chair is a seat. Tables are counted but never added to the seat total,
  // so the banquet's 12 tables + 120 chairs stays 120 seats, not 240.
  seatsPerSofa: 3,

  // --- Electrical (connected load, kW) ---------------------------------
  // Slot quantities are per-unit except lighting, which is catalogued as a
  // whole package per zone.
  kwPerLightingPackage: 6,     // LED wash + uplighting package incl. dimmer racks
  kwPerAudioUnit: 2.5,         // one horn / line-array cabinet and its amp channel
  kwPerStage: 15,              // truss motors, rigging, stage-deck distribution
  kwPerPodium: 1.5,            // LED podium, teleprompter, podium mic
  kwPerFountain: 2.2,          // circulation pump and submersible lighting
  diversityFactor: 0.8,        // not every circuit draws its full rating at once
  generatorHeadroom: 1.25,     // size the genset 25% above the working load
  ratedSupplyKw: 300,          // the house supply this venue is rated for

  // --- Acoustics -------------------------------------------------------
  // Incoherent sources sum at 10·log10(n): four cabinets are +6 dB, not ×4.
  // Coverage is the inverse-square distance at which that level decays to the
  // target level at the audience.
  splPerAudioUnitAt1m: 118,
  ambientSplDb: 85,
  targetSplAtAudienceDb: 85,
  maxRatedSplDb: 130,

  // --- Crew ------------------------------------------------------------
  // Ratios used for private-event staffing in the Indian market.
  guestsPerSecurityGuard: 100,
  guestsPerHospitalityCrew: 50
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
    this.showWorking = false;
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
    let seats = 0;
    let tables = 0;
    let connectedKw = 0;
    let totalCost = 0;
    let audioUnits = 0;
    const byCategory = {};
    const loadLines = [];

    // Only the zones this event actually uses — the dashboard used to average
    // the election rally and the summit podium into a wedding.
    const inScope = new Set(zonesInScope(VENUE_ZONES.map(z => z.id)));

    VENUE_ZONES.filter(zone => inScope.has(zone.id)).forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);
        if (!item) return;

        const qty = Number(slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1) || 1;
        const lineCost = Math.round(Number(item.price || 0) * qty);
        totalCost += lineCost;
        byCategory[item.category] = (byCategory[item.category] || 0) + lineCost;

        const addLoad = (kw, note) => {
          if (kw <= 0) return;
          connectedKw += kw;
          loadLines.push({ label: `${item.name} × ${qty}`, kw, note });
        };

        switch (item.category) {
          case 'chairs':
            seats += qty;
            break;
          case 'sofas':
            seats += qty * F.seatsPerSofa;
            break;
          case 'tables':
            tables += qty;
            break;
          case 'lighting':
            addLoad(F.kwPerLightingPackage * qty, `${F.kwPerLightingPackage} kW per package`);
            break;
          case 'stages':
            addLoad(F.kwPerStage * qty, `${F.kwPerStage} kW per stage`);
            break;
          case 'podiums':
            addLoad(F.kwPerPodium * qty, `${F.kwPerPodium} kW per podium`);
            break;
          case 'fountains':
            addLoad(F.kwPerFountain * qty, `${F.kwPerFountain} kW per pump`);
            break;
          case 'audio':
            audioUnits += qty;
            addLoad(F.kwPerAudioUnit * qty, `${F.kwPerAudioUnit} kW per cabinet`);
            break;
          default:
            break;
        }
      });
    });

    const workingKw = connectedKw * F.diversityFactor;
    const recommendedGenKw = Math.ceil((workingKw * F.generatorHeadroom) / 5) * 5;

    // Incoherent summation, then inverse-square decay to the target level.
    const splDb = audioUnits > 0
      ? Math.round(F.splPerAudioUnitAt1m + 10 * Math.log10(audioUnits))
      : F.ambientSplDb;
    const coverageRadiusMeters = audioUnits > 0
      ? Math.round(Math.pow(10, (splDb - F.targetSplAtAudienceDb) / 20))
      : 0;

    const plannedGuests = eventState.getGuestCount();
    const budgetTarget = eventState.getBudgetTarget();

    return {
      seats,
      tables,
      plannedGuests,
      capacityGap: plannedGuests - seats,
      connectedKw: Math.round(connectedKw),
      workingKw: Math.round(workingKw),
      recommendedGenKw,
      loadLines: loadLines.sort((a, b) => b.kw - a.kw),
      splDb,
      coverageRadiusMeters,
      audioUnits,
      securityGuards: Math.ceil(plannedGuests / F.guestsPerSecurityGuard),
      hospitalityCrew: Math.ceil(plannedGuests / F.guestsPerHospitalityCrew),
      totalCost,
      budgetTarget,
      perGuestCost: plannedGuests > 0 ? Math.round(totalCost / plannedGuests) : 0,
      byCategory
    };
  }

  render() {
    const F = ENGINEERING_FACTORS;
    const m = this.calculateMetrics();
    const pct = (value, max) => Math.max(0, Math.min(100, (value / Math.max(max, 1)) * 100));

    const overBudget = m.budgetTarget > 0 && m.totalCost > m.budgetTarget;
    const budgetLine = m.budgetTarget > 0
      ? `<small style="${overBudget ? 'color:var(--accent-rose);' : ''}">
           ${escapeHtml(formatMoney(m.totalCost))} of ${escapeHtml(formatMoney(m.budgetTarget))} target
           (${Math.round((m.totalCost / m.budgetTarget) * 100)}%)${overBudget
             ? ` — ${escapeHtml(formatMoney(m.totalCost - m.budgetTarget))} over`
             : ''}</small>`
      : `<small>${escapeHtml(formatMoney(m.totalCost))} configured · no budget target set in Event Details</small>`;

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

    const working = this.showWorking ? this.renderWorking(m) : '';

    this.container.innerHTML = `
      <div class="analytics-wrapper realistic-map-theme">
        <div class="analytics-header">
          <h3>📊 Capacity, Power, Audio &amp; Crew</h3>
          <p>
            Every figure below is computed from the items currently in the 360° Studio, the quantities in
            the venue spec and the shared event record — nothing on this page is hardcoded. These are
            planning estimates from published factors, not measured telemetry.
            <button class="btn-secondary" id="an-working-btn" type="button"
                    aria-expanded="${this.showWorking}"
                    style="font-size:.72rem; padding:.2rem .55rem; margin-left:.35rem;">
              ${this.showWorking ? 'Hide the working' : 'Show the working'}
            </button>
          </p>
        </div>

        <div class="kpi-cards-grid">
          <div class="kpi-card">
            <div class="kpi-head"><span>🪑 Seats Configured</span><small>vs ${formatNumber(m.plannedGuests)} planned</small></div>
            <div class="kpi-val">${formatNumber(m.seats)} <small>seats</small></div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill" style="width:${pct(m.seats, m.plannedGuests).toFixed(1)}%;"></div>
            </div>
            <small style="color:${m.capacityGap > 0 ? 'var(--accent-rose)' : 'var(--text-muted)'};">
              ${m.capacityGap > 0
                ? `${formatNumber(m.capacityGap)} guests would have nowhere to sit`
                : `${formatNumber(Math.abs(m.capacityGap))} seats spare`}
              ${m.tables ? ` · ${formatNumber(m.tables)} table${m.tables === 1 ? '' : 's'} configured` : ''}
            </small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>⚡ Electrical Load</span><small>working kW</small></div>
            <div class="kpi-val">${formatNumber(m.workingKw)} <small>kW</small></div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-indigo" style="width:${pct(m.workingKw, F.ratedSupplyKw).toFixed(1)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">
              ${formatNumber(m.connectedKw)} kW connected × ${F.diversityFactor} diversity ·
              of a ${F.ratedSupplyKw} kW supply ·
              <strong style="color:var(--text-main);">order a ${formatNumber(m.recommendedGenKw)} kVA genset</strong>
            </small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>🔊 Audio Coverage</span><small>SPL dB</small></div>
            <div class="kpi-val">
              ${m.splDb} <small>dB${m.coverageRadiusMeters ? ` @ 1 m · ~${formatNumber(m.coverageRadiusMeters)} m throw` : ''}</small>
            </div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-emerald" style="width:${pct(m.splDb, F.maxRatedSplDb).toFixed(1)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">
              ${m.audioUnits
                ? `${formatNumber(m.audioUnits)} cabinet(s) · ${F.splPerAudioUnitAt1m} dB each, summed at 10·log₁₀(n) ·
                   throw is the distance to ${F.targetSplAtAudienceDb} dB`
                : `No PA configured — ${F.ambientSplDb} dB ambient only`}
            </small>
          </div>

          <div class="kpi-card">
            <div class="kpi-head"><span>👮 Crew to Staff</span><small>from headcount</small></div>
            <div class="kpi-val" style="font-size:1.15rem;">
              ${formatNumber(m.securityGuards)} security · ${formatNumber(m.hospitalityCrew)} hospitality
            </div>
            <div class="kpi-bar-wrap">
              <div class="kpi-bar-fill bg-rose"
                   style="width:${pct(m.securityGuards + m.hospitalityCrew, 120).toFixed(1)}%;"></div>
            </div>
            <small style="color:var(--text-muted);">
              1 guard per ${F.guestsPerSecurityGuard} guests, 1 hospitality crew per
              ${F.guestsPerHospitalityCrew}, at ${formatNumber(m.plannedGuests)} guests
            </small>
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
            <span style="color:var(--text-main);">
              ${escapeHtml(formatMoney(m.perGuestCost))} per guest at ${formatNumber(m.plannedGuests)} guests
            </span>
          </div>` : ''}
        </div>

        ${working}
      </div>
    `;

    const btn = this.container.querySelector('#an-working-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        this.showWorking = !this.showWorking;
        this.render();
      });
    }
  }

  /** The audit trail behind the electrical KPI — a client can check every line. */
  renderWorking(m) {
    const F = ENGINEERING_FACTORS;
    const rows = m.loadLines.length
      ? m.loadLines.map(l => `
          <tr>
            <td style="padding:.3rem .6rem; color:var(--text-main);">${escapeHtml(l.label)}</td>
            <td style="padding:.3rem .6rem; color:var(--text-muted);">${escapeHtml(l.note)}</td>
            <td style="padding:.3rem .6rem; text-align:right; color:var(--text-main);
                       font-family:var(--font-mono);">${l.kw.toFixed(1)} kW</td>
          </tr>`).join('')
      : `<tr><td colspan="3" style="padding:.6rem; color:var(--text-muted);">
           Nothing in the current configuration draws power.
         </td></tr>`;

    return `
      <div style="margin-top:1rem; padding:1rem; background:var(--bg-surface); border:1px solid var(--border-subtle);
                  border-radius:var(--radius-md);">
        <h4 style="color:var(--text-main); margin:0 0 .5rem;">How the electrical figure is built</h4>
        <div style="overflow-x:auto;">
          <table style="width:100%; border-collapse:collapse; font-size:.8rem;">
            <thead>
              <tr style="text-align:left; color:var(--text-muted); border-bottom:1px solid var(--border-subtle);">
                <th style="padding:.3rem .6rem; font-weight:600;">Item</th>
                <th style="padding:.3rem .6rem; font-weight:600;">Factor applied</th>
                <th style="padding:.3rem .6rem; font-weight:600; text-align:right;">Load</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr style="border-top:1px solid var(--border-subtle); color:var(--text-main);">
                <td style="padding:.3rem .6rem;" colspan="2">Connected load</td>
                <td style="padding:.3rem .6rem; text-align:right; font-family:var(--font-mono);">
                  ${formatNumber(m.connectedKw)} kW</td>
              </tr>
              <tr style="color:var(--text-main);">
                <td style="padding:.3rem .6rem;" colspan="2">
                  × ${F.diversityFactor} diversity → working load</td>
                <td style="padding:.3rem .6rem; text-align:right; font-family:var(--font-mono);">
                  ${formatNumber(m.workingKw)} kW</td>
              </tr>
              <tr style="color:var(--text-main); font-weight:700;">
                <td style="padding:.3rem .6rem;" colspan="2">
                  × ${F.generatorHeadroom} headroom → genset to order</td>
                <td style="padding:.3rem .6rem; text-align:right; font-family:var(--font-mono);">
                  ${formatNumber(m.recommendedGenKw)} kVA</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p style="color:var(--text-dim); font-size:.75rem; margin:.6rem 0 0;">
          Seats count chairs one-for-one (a chair slot's quantity is a real chair count) and lounge sofas at
          ${F.seatsPerSofa} each. Tables are counted but never added to the seat total — the banquet's 12 tables
          and its 120 chairs are the same 120 seats, so adding both would double-count them.
        </p>
      </div>
    `;
  }
}
