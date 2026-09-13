import { VENUE_ZONES } from '../data/zones.js';
import { ITEM_CATALOG, getItemById } from '../data/catalog.js';
import { formatMoney, escapeHtml } from '../utils/format.js';
import { buildQuote, slotQuantity, isLineRemoved } from '../utils/quote.js';
import { zonesInScope } from '../data/eventState.js';

/**
 * How much each event type cares about each equipment category. Higher weight =
 * the optimiser spends spare budget there first.
 */
const EVENT_WEIGHTS = {
  Wedding:   { backdrops: 1.6, stages: 1.5, lighting: 1.4, fountains: 1.3, tables: 1.1, chairs: 1.0, sofas: 1.0, audio: 0.8, podiums: 0.6 },
  Corporate: { audio: 1.6, podiums: 1.5, stages: 1.4, lighting: 1.2, chairs: 1.0, tables: 1.0, backdrops: 1.0, sofas: 0.8, fountains: 0.5 },
  Rally:     { audio: 1.8, stages: 1.6, podiums: 1.4, chairs: 1.1, lighting: 1.0, backdrops: 1.0, tables: 0.6, sofas: 0.4, fountains: 0.3 },
  Gala:      { lighting: 1.5, backdrops: 1.4, sofas: 1.3, tables: 1.3, chairs: 1.2, stages: 1.2, fountains: 1.2, audio: 1.0, podiums: 0.7 }
};

const DEFAULT_WEIGHT = 1;

export class BudgetOptimizer {
  constructor(containerElement, activeSelections, onApply) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply;
    this.budget = null; // set from the current configuration on first open
    this.eventType = 'Wedding';
    this.result = null;
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    this.result = null;
    if (this.container.style.display === 'flex') this.render();
  }

  open() {
    if (this.budget === null) {
      // Seed the budget at 85% of the current configuration — a target worth optimising to.
      const current = buildQuote(this.activeSelections).subtotal;
      this.budget = Math.max(1, Math.round(current * 0.85));
    }
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  /** Every slot with its candidate items (allowed list first, category as fallback). */
  slotOptions() {
    const options = [];
    // Only the zones this event actually uses, and only the lines still in the
    // basket — otherwise the "optimised" total is not comparable with the
    // current quote the user is looking at.
    const scope = new Set(zonesInScope(VENUE_ZONES.map(z => z.id)));
    VENUE_ZONES.filter(zone => scope.has(zone.id)).forEach(zone => {
      zone.slots.forEach(slot => {
        if (isLineRemoved(slot.id)) return;
        const allowed = Array.isArray(slot.allowedItemIds)
          ? slot.allowedItemIds.map(id => getItemById(id)).filter(Boolean)
          : [];
        const items = (allowed.length ? allowed : (ITEM_CATALOG[slot.category] || []))
          .slice()
          .sort((a, b) => a.price - b.price);
        if (!items.length) return;
        options.push({
          zoneName: zone.name,
          slotId: slot.id,
          slotLabel: slot.label,
          category: slot.category,
          // Quantity follows the same rule as the quote: per-line override,
          // then per-item quantity, then guest-count scaling.
          quantityFor: item => slotQuantity(slot, item.id),
          items
        });
      });
    });
    return options;
  }

  /**
   * Multiple-choice knapsack, solved greedily:
   *  1. start from the cheapest feasible configuration,
   *  2. if that already exceeds the budget, report it honestly and stop,
   *  3. otherwise repeatedly buy the best-value single-step upgrade that still fits.
   */
  optimize() {
    const weights = EVENT_WEIGHTS[this.eventType] || {};
    const options = this.slotOptions();

    // 1. Cheapest feasible configuration.
    const chosenIndex = new Map();
    let total = 0;
    options.forEach(opt => {
      chosenIndex.set(opt.slotId, 0);
      total += opt.items[0].price * opt.quantityFor(opt.items[0]);
    });

    const minimumTotal = total;
    const feasible = minimumTotal <= this.budget;
    const upgrades = [];

    if (feasible) {
      // 2. Greedy upgrade pass.
      let remaining = this.budget - total;
      let improved = true;
      while (improved) {
        improved = false;
        let best = null;
        options.forEach(opt => {
          const idx = chosenIndex.get(opt.slotId);
          const next = opt.items[idx + 1];
          if (!next) return;
          const stepCost = (next.price * opt.quantityFor(next)) - (opt.items[idx].price * opt.quantityFor(opt.items[idx]));
          if (stepCost <= 0 || stepCost > remaining) return;
          const weight = weights[opt.category] || DEFAULT_WEIGHT;
          const score = weight / stepCost; // value per rupee
          if (!best || score > best.score) {
            best = { opt, idx, next, stepCost, score };
          }
        });
        if (best) {
          chosenIndex.set(best.opt.slotId, best.idx + 1);
          remaining -= best.stepCost;
          total += best.stepCost;
          upgrades.push({
            slotLabel: best.opt.slotLabel,
            zoneName: best.opt.zoneName,
            from: best.opt.items[best.idx].name,
            to: best.next.name,
            cost: best.stepCost
          });
          improved = true;
        }
      }
    }

    // Selections are FLAT slotId -> itemId STRINGS, per the state contract.
    const optimized = {};
    const lines = options.map(opt => {
      const item = opt.items[chosenIndex.get(opt.slotId)];
      const quantity = opt.quantityFor(item);
      optimized[opt.slotId] = item.id;
      return {
        slotId: opt.slotId,
        slotLabel: opt.slotLabel,
        zoneName: opt.zoneName,
        itemName: item.name,
        quantity,
        unitPrice: item.price,
        lineTotal: Math.round(item.price * quantity)
      };
    });

    return {
      optimized,
      lines,
      total: Math.round(total),
      minimumTotal: Math.round(minimumTotal),
      feasible,
      overBy: Math.max(0, Math.round(minimumTotal) - this.budget),
      headroom: feasible ? this.budget - Math.round(total) : 0,
      upgrades
    };
  }

  currentConfiguration() {
    const quote = buildQuote(this.activeSelections);
    return {
      total: quote.subtotal,
      lines: quote.lines.map(l => ({
        slotLabel: l.slotLabel,
        zoneName: l.zoneName,
        itemName: l.itemName,
        quantity: l.quantity,
        lineTotal: l.lineTotal
      }))
    };
  }

  renderList(lines) {
    if (!lines.length) {
      return '<p style="opacity:.75;">No equipment configured.</p>';
    }
    return `
      <ul class="opt-line-list" style="list-style:none; padding:0; margin:0; max-height:260px; overflow:auto;">
        ${lines.map(l => `
          <li style="display:flex; justify-content:space-between; gap:10px; padding:4px 0; border-bottom:1px solid rgba(0,0,0,.06);">
            <span>
              <strong>${escapeHtml(l.itemName)}</strong><br />
              <small style="opacity:.7;">${escapeHtml(l.zoneName)} • ${escapeHtml(l.slotLabel)} • ${l.quantity}×</small>
            </span>
            <span style="white-space:nowrap;">${formatMoney(l.lineTotal)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  }

  render() {
    const current = this.currentConfiguration();
    const r = this.result;

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content budget-modal" style="max-width: 900px; width: 100%;">
          <div class="modal-header">
            <h2>Budget Optimizer</h2>
            <button class="btn-close" type="button" aria-label="Close budget optimizer">&times;</button>
          </div>
          <div class="modal-body budget-body">
            <p style="margin:0 0 14px; opacity:.8; font-size:13px;">
              Rule-based optimiser: it starts from the cheapest valid configuration, then spends the remaining
              budget on the upgrades that matter most for the selected event type. All amounts exclude GST.
            </p>

            <div class="optimizer-inputs" style="display:flex; gap:15px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;">
              <label for="opt-budget">Budget (₹, excl. GST)<br />
                <input type="number" id="opt-budget" min="0" step="1000" value="${this.budget}" style="padding:6px; width:160px;" />
              </label>
              <label for="opt-type">Event type<br />
                <select id="opt-type" style="padding:6px;">
                  ${Object.keys(EVENT_WEIGHTS).map(t => `<option value="${t}" ${this.eventType === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </label>
              <button class="btn-optimize" type="button" style="padding:8px 14px; background:#2563eb; color:#fff; border:none; border-radius:4px; cursor:pointer;">Optimize</button>
            </div>

            ${r ? `
              <div class="optimizer-verdict" role="status" style="margin-bottom:16px; padding:12px 14px; border-radius:8px; border:1px solid ${r.feasible ? '#16a34a' : '#ef4444'}; background:${r.feasible ? 'rgba(22,163,74,.12)' : 'rgba(239,68,68,.12)'};">
                ${r.feasible ? `
                  <strong>Optimised within budget.</strong>
                  Total ${formatMoney(r.total)} against a budget of ${formatMoney(this.budget)} —
                  ${formatMoney(r.headroom)} unspent. ${r.upgrades.length} upgrade${r.upgrades.length === 1 ? '' : 's'} applied
                  for a ${escapeHtml(this.eventType)} brief.
                ` : `
                  <strong>This budget cannot be met.</strong>
                  The cheapest possible configuration is ${formatMoney(r.minimumTotal)}, which is
                  ${formatMoney(r.overBy)} over your budget of ${formatMoney(this.budget)}.
                  The configuration below is that cheapest option — applying it will still exceed the budget.
                `}
              </div>
            ` : ''}

            <div class="optimizer-results" id="opt-results" style="display:${r ? 'flex' : 'none'}; gap:20px; margin-top:10px; background:#f8fafc; color:#0f172a; padding:15px; border-radius:8px;">
              <div class="result-col" style="flex:1; min-width:0;">
                <h3 style="border-bottom:1px solid #ccc; padding-bottom:5px;">Current selection</h3>
                <h4 style="margin:8px 0;">${formatMoney(current.total)}</h4>
                ${this.renderList(current.lines)}
              </div>
              <div class="result-col" style="flex:1; min-width:0;">
                <h3 style="border-bottom:1px solid #ccc; padding-bottom:5px; color:${r && !r.feasible ? '#b91c1c' : '#16a34a'};">
                  ${r && !r.feasible ? 'Cheapest possible' : 'Optimised'}
                </h3>
                <h4 style="margin:8px 0; color:${r && !r.feasible ? '#b91c1c' : '#16a34a'};">
                  ${r ? formatMoney(r.total) : '—'}
                  ${r ? `<small style="font-weight:400; opacity:.75;">(${r.total <= current.total ? '−' : '+'}${formatMoney(Math.abs(current.total - r.total), { symbol: false })} vs current)</small>` : ''}
                </h4>
                ${r ? this.renderList(r.lines) : ''}
              </div>
            </div>

            ${r && r.feasible && r.upgrades.length ? `
              <div class="optimizer-upgrades" style="margin-top:16px;">
                <h4 style="margin:0 0 6px;">Where the remaining budget went</h4>
                <ul style="margin:0; padding-left:20px;">
                  ${r.upgrades.slice(0, 8).map(u => `
                    <li>${escapeHtml(u.slotLabel)} (${escapeHtml(u.zoneName)}): ${escapeHtml(u.from)} → <strong>${escapeHtml(u.to)}</strong> (+${formatMoney(u.cost)})</li>
                  `).join('')}
                  ${r.upgrades.length > 8 ? `<li>+ ${r.upgrades.length - 8} more upgrades</li>` : ''}
                </ul>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button class="btn-apply-ai" type="button" style="display:${r ? 'inline-block' : 'none'}; background:${r && !r.feasible ? '#b91c1c' : '#16a34a'}; color:#fff;">
              ${r && !r.feasible ? 'Apply cheapest configuration anyway' : 'Apply optimised configuration'}
            </button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('.btn-close').addEventListener('click', () => this.close());

    const overlay = this.container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    this.container.querySelector('.btn-optimize').addEventListener('click', () => {
      const raw = Number(this.container.querySelector('#opt-budget').value);
      this.budget = Number.isFinite(raw) && raw > 0 ? Math.round(raw) : this.budget;
      this.eventType = this.container.querySelector('#opt-type').value;
      this.result = this.optimize();
      this.render();
    });

    const applyBtn = this.container.querySelector('.btn-apply-ai');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.onApply && this.result) {
          this.onApply(this.result.optimized);
        }
        this.close();
      });
    }
  }
}
