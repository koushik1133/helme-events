import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import { STYLE_PRESETS } from '../data/styles.js';
import { formatMoney, formatNumber, sumLines, escapeHtml } from '../utils/format.js';

/**
 * Event Brief Generator.
 *
 * The recommendation engine is a small, inspectable rule table — event type
 * picks the zones, theme picks the base style preset, budget sets a per-unit
 * price ceiling, and guest count drives the capacity note. It is deliberately
 * NOT labelled "AI": every output here is a deterministic function of the five
 * answers, and the brief says so.
 *
 * STATE CONTRACT: recommendations are emitted as a flat `slotId -> itemId`
 * map of plain STRINGS. Never `{itemId, quantity}` — quantities live on the
 * zone slot in src/data/zones.js.
 */

/** Which zones each event type actually uses. Other zones are left untouched. */
const EVENT_ZONES = {
  Wedding: ['zone-india-function', 'zone-entrance', 'zone-banquet', 'zone-fountain'],
  Corporate: ['zone-india-meeting', 'zone-entrance', 'zone-lounge'],
  Rally: ['zone-india-election', 'zone-stage'],
  Summit: ['zone-india-meeting', 'zone-lounge', 'zone-entrance'],
  Birthday: ['zone-lounge', 'zone-fountain', 'zone-entrance'],
  Anniversary: ['zone-banquet', 'zone-fountain', 'zone-entrance']
};

/** Theme answer → the style preset used as the first-choice for each slot. */
const THEME_PRESET = {
  Royal: 'style-mughal',
  Modern: 'style-minimalist',
  Rustic: 'style-rustic',
  Traditional: 'style-temple-gold',
  Futuristic: 'style-sangeet-neon'
};

/** Budget answer → per-unit price ceiling in whole rupees. */
const BUDGET_CEILING = {
  'Under ₹5L': 25000,
  '₹5-15L': 75000,
  '₹15-50L': 200000,
  '₹50L+': Number.POSITIVE_INFINITY
};

const EVENT_TYPES = Object.keys(EVENT_ZONES);
const THEMES = Object.keys(THEME_PRESET);
const BUDGETS = Object.keys(BUDGET_CEILING);

export class EventBriefGenerator {
  constructor(containerElement, activeSelections, onApply) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply;
    this.step = 1;
    this.formData = {};
    this.recommended = null;
    this.plan = null;
    this._bound = false;
  }

  open() {
    this.step = 1;
    this.formData = {};
    this.recommended = null;
    this.plan = null;
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  // ---------------------------------------------------------------- engine

  targetZones() {
    const ids = EVENT_ZONES[this.formData.eventType] || [];
    return VENUE_ZONES.filter(z => ids.includes(z.id));
  }

  /** Pick one item for a slot: preferred theme item if affordable, else the
   *  best piece that still fits the budget ceiling, else the cheapest option. */
  pickItem(slot, preset, ceiling) {
    const allowed = (slot.allowedItemIds && slot.allowedItemIds.length)
      ? slot.allowedItemIds
      : [slot.defaultItemId].filter(Boolean);

    const priced = allowed
      .map(id => ({ id, price: Number(getItemById(id)?.price ?? 0) }))
      .filter(entry => getItemById(entry.id));

    if (!priced.length) return slot.defaultItemId;

    const themeChoice = preset?.selections?.[slot.id];
    const themeEntry = priced.find(e => e.id === themeChoice);
    if (themeEntry && themeEntry.price <= ceiling) return themeEntry.id;

    const affordable = priced.filter(e => e.price <= ceiling);
    if (affordable.length) {
      // Best piece the budget allows.
      return affordable.sort((a, b) => b.price - a.price)[0].id;
    }
    // Nothing fits: be honest and quote the cheapest available.
    return priced.sort((a, b) => a.price - b.price)[0].id;
  }

  buildPlan() {
    const preset = STYLE_PRESETS.find(p => p.id === THEME_PRESET[this.formData.theme]);
    const ceiling = BUDGET_CEILING[this.formData.budget] ?? Number.POSITIVE_INFINITY;
    const zones = this.targetZones();

    const recommended = {};
    const lines = [];
    const changes = [];

    zones.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.pickItem(slot, preset, ceiling);
        // STRING — the state contract.
        recommended[slot.id] = itemId;

        const item = getItemById(itemId);
        const qty = Number(slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1);
        lines.push({ unitPrice: item?.price ?? 0, quantity: qty });

        const currentId = this.activeSelections[slot.id] || slot.defaultItemId;
        if (currentId !== itemId) {
          changes.push({
            zoneName: zone.name,
            slotLabel: slot.label,
            fromName: getItemById(currentId)?.name || '—',
            toName: item?.name || '—'
          });
        }
      });
    });

    const guests = Math.max(0, Number(this.formData.guests) || 0);
    const estimate = sumLines(lines);

    this.recommended = recommended;
    this.plan = { preset, ceiling, zones, changes, estimate, guests, slotCount: Object.keys(recommended).length };
    return this.plan;
  }

  // ---------------------------------------------------------------- brief

  generateBrief() {
    const plan = this.buildPlan();
    const { eventType, theme, budget, special } = this.formData;
    const guests = plan.guests;

    // Capacity maths the client can check — derived from the answer, not invented.
    const seatedTables = Math.ceil(guests / 10);
    const bufferPct = guests > 1000 ? 5 : 10;
    const seatingWithBuffer = Math.ceil(guests * (1 + bufferPct / 100));

    const ceilingText = Number.isFinite(plan.ceiling)
      ? `${formatMoney(plan.ceiling)} per unit`
      : 'no per-unit ceiling';

    return `
      <div class="event-brief-doc" style="line-height: 1.6;">
        <h2 style="border-bottom: 2px solid var(--border-subtle); padding-bottom: 10px;">Event Brief &amp; Executive Summary</h2>
        <p>
          A <strong>${escapeHtml(theme)}</strong>-themed <strong>${escapeHtml(eventType)}</strong> for
          <strong>${formatNumber(guests)}</strong> guests, specified against a budget band of
          <strong>${escapeHtml(budget)}</strong> (${escapeHtml(ceilingText)}).
        </p>
        <p style="font-size:12px; color:var(--text-muted);">
          Generated by a rule table, not a language model: event type selects the zones, theme selects
          the base style preset, budget sets the per-unit ceiling. The same five answers always produce
          the same brief.
        </p>

        <h3 style="margin-top: 20px;">Zones in scope (${plan.zones.length} of ${VENUE_ZONES.length})</h3>
        <ul style="padding-left: 20px;">
          ${plan.zones.map(z => `<li><strong>${escapeHtml(z.name)}</strong> — ${escapeHtml(z.subtitle)}</li>`).join('')}
        </ul>
        <p style="font-size:12px; color:var(--text-muted);">Zones outside this list are left exactly as you have them.</p>

        <h3 style="margin-top: 20px;">Recommended specification</h3>
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="text-align:left; border-bottom:1px solid var(--border-subtle);">
              <th style="padding:6px;">Zone</th><th style="padding:6px;">Element</th>
              <th style="padding:6px;">Item</th><th style="padding:6px; text-align:right;">Qty</th>
              <th style="padding:6px; text-align:right;">Line</th>
            </tr>
          </thead>
          <tbody>
            ${plan.zones.map(zone => zone.slots.map(slot => {
              const item = getItemById(this.recommended[slot.id]);
              const qty = Number(slot.quantityByItem?.[this.recommended[slot.id]] ?? slot.quantity ?? 1);
              return `
                <tr style="border-bottom:1px solid var(--border-subtle);">
                  <td style="padding:6px;">${escapeHtml(zone.name)}</td>
                  <td style="padding:6px;">${escapeHtml(slot.label)}</td>
                  <td style="padding:6px;">${escapeHtml(item?.name || '—')}</td>
                  <td style="padding:6px; text-align:right;">${formatNumber(qty)}</td>
                  <td style="padding:6px; text-align:right;">${formatMoney(Math.round((item?.price || 0) * qty))}</td>
                </tr>
              `;
            }).join('')).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="padding:8px; text-align:right;"><strong>Hire subtotal (ex-GST)</strong></td>
              <td style="padding:8px; text-align:right;"><strong>${formatMoney(plan.estimate)}</strong></td>
            </tr>
          </tfoot>
        </table>
        <p style="font-size:12px; color:var(--text-muted);">
          Hire of the listed items only, per event day. Excludes GST, transport, labour, catering and power.
        </p>

        <h3 style="margin-top: 20px;">Capacity notes</h3>
        <ul style="padding-left: 20px;">
          <li>${formatNumber(guests)} guests → approximately <strong>${formatNumber(seatedTables)}</strong> tables of 10.</li>
          <li>Seating specified with a ${bufferPct}% buffer: <strong>${formatNumber(seatingWithBuffer)}</strong> places.</li>
          <li>Quantities per element are taken from the venue's zone plan, not from this wizard.</li>
        </ul>

        <h3 style="margin-top: 20px;">Special requirements</h3>
        <p style="padding: 10px; border-left: 4px solid var(--border-subtle);">${escapeHtml(special || 'None noted during brief generation.')}</p>
      </div>
    `;
  }

  // ---------------------------------------------------------------- render

  stepContent() {
    switch (this.step) {
      case 1:
        return `
          <h3 style="margin-bottom: 15px;">Step 1 of 5: Event Type</h3>
          <select id="b-type" aria-label="Event type" style="width: 100%; padding: 10px; font-size: 16px;">
            ${EVENT_TYPES.map(t => `<option ${this.formData.eventType === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        `;
      case 2:
        return `
          <h3 style="margin-bottom: 15px;">Step 2 of 5: Guest Count</h3>
          <input type="number" id="b-guests" aria-label="Expected guest count" min="10" max="100000" step="10"
            value="${escapeHtml(this.formData.guests ?? 200)}" style="width: 100%; padding: 10px; font-size: 16px;" />
        `;
      case 3:
        return `
          <h3 style="margin-bottom: 15px;">Step 3 of 5: Budget Range</h3>
          <select id="b-budget" aria-label="Budget range" style="width: 100%; padding: 10px; font-size: 16px;">
            ${BUDGETS.map(b => `<option ${this.formData.budget === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        `;
      case 4:
        return `
          <h3 style="margin-bottom: 15px;">Step 4 of 5: Theme Preference</h3>
          <select id="b-theme" aria-label="Theme preference" style="width: 100%; padding: 10px; font-size: 16px;">
            ${THEMES.map(t => `<option ${this.formData.theme === t ? 'selected' : ''}>${t}</option>`).join('')}
          </select>
        `;
      case 5:
        return `
          <h3 style="margin-bottom: 15px;">Step 5 of 5: Special Requirements</h3>
          <textarea id="b-special" aria-label="Special requirements" placeholder="Dietary restrictions, colour requests, accessibility needs…"
            style="width: 100%; padding: 10px; font-size: 16px; height: 100px; resize: vertical;">${escapeHtml(this.formData.special || '')}</textarea>
        `;
      default:
        return `
          <div class="generated-brief" id="brief-content" style="max-height: 400px; overflow-y: auto; padding: 20px; border: 1px solid var(--border-subtle); border-radius: 8px;">
            ${this.generateBrief()}
          </div>
          <div id="brief-apply-note" role="status" style="margin-top:10px; font-size:12px; color:var(--text-muted);">
            “Apply to Venue” changes ${this.plan.changes.length} element${this.plan.changes.length === 1 ? '' : 's'} in
            ${this.plan.zones.length} zone${this.plan.zones.length === 1 ? '' : 's'} and asks you to confirm first.
            Zones outside the brief are not touched.
          </div>
        `;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content brief-modal" role="dialog" aria-modal="true" aria-labelledby="brief-title" style="max-width: 700px; width: 100%;">
          <div class="modal-header" style="border-bottom: 1px solid var(--border-subtle); padding-bottom: 10px; margin-bottom: 20px; display:flex; justify-content:space-between; align-items:center;">
            <h2 id="brief-title" style="margin: 0;">📝 Event Brief Generator</h2>
            <button type="button" class="btn-close" aria-label="Close brief generator">&times;</button>
          </div>
          <div class="modal-body brief-body">
            ${this.stepContent()}
          </div>
          <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid var(--border-subtle); padding-top: 15px;">
            ${this.step > 1 ? `<button type="button" class="btn-back btn-secondary">Back</button>` : ''}
            ${this.step < 5 ? `<button type="button" class="btn-next btn-primary">Next</button>` : ''}
            ${this.step === 5 ? `<button type="button" class="btn-generate btn-primary">Generate Brief</button>` : ''}
            ${this.step === 6 ? `
              <button type="button" class="btn-print btn-secondary">Print Brief</button>
              <button type="button" class="btn-apply-rec btn-primary">Apply to Venue</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  saveStepData() {
    const read = sel => this.container.querySelector(sel)?.value;
    if (this.step === 1) this.formData.eventType = read('#b-type');
    if (this.step === 2) this.formData.guests = read('#b-guests');
    if (this.step === 3) this.formData.budget = read('#b-budget');
    if (this.step === 4) this.formData.theme = read('#b-theme');
    if (this.step === 5) this.formData.special = read('#b-special');
  }

  /**
   * Print through a detached iframe. The old implementation replaced
   * document.body.innerHTML and then reloaded — which detached every listener,
   * killed the 360 viewer and discarded the session mid-demo.
   */
  printBrief() {
    const content = this.container.querySelector('#brief-content')?.innerHTML;
    if (!content) return;

    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(frame);

    const doc = frame.contentDocument;
    doc.open();
    doc.write(`<!doctype html><html><head><title>Event Brief</title><style>
      body { font-family: Georgia, 'Times New Roman', serif; color: #111; margin: 24px; line-height: 1.6; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th, td { padding: 6px; border-bottom: 1px solid #ddd; text-align: left; }
    </style></head><body>${content}</body></html>`);
    doc.close();

    const cleanup = () => frame.remove();
    frame.contentWindow.addEventListener('afterprint', cleanup, { once: true });
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // Safety net for browsers that never fire afterprint.
    setTimeout(cleanup, 60000);
  }

  applyRecommendations() {
    if (!this.onApply || !this.recommended || !this.plan) return;

    const { changes } = this.plan;
    if (changes.length === 0) {
      const note = this.container.querySelector('#brief-apply-note');
      if (note) note.textContent = 'Your venue already matches this brief — nothing to change.';
      return;
    }

    const preview = changes.slice(0, 6)
      .map(c => `• ${c.zoneName} — ${c.slotLabel}: ${c.fromName} → ${c.toName}`)
      .join('\n');
    const more = changes.length > 6 ? `\n…and ${changes.length - 6} more.` : '';

    const ok = window.confirm(
      `Apply this brief to ${this.plan.zones.length} zone(s)?\n\n` +
      `${changes.length} element(s) will change:\n${preview}${more}\n\n` +
      `Zones outside the brief are left untouched.`
    );
    if (!ok) return;

    // Flat slotId -> itemId strings only.
    this.onApply({ ...this.recommended });
    this.close();
  }

  bindEvents() {
    // The container persists across steps, so bind once and delegate.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const t = e.target;

      if (t.classList.contains('btn-close')) return this.close();
      if (t.classList.contains('modal-overlay')) return this.close();

      if (t.classList.contains('btn-next') || t.classList.contains('btn-generate')) {
        this.saveStepData();
        this.step++;
        this.render();
        return;
      }

      if (t.classList.contains('btn-back')) {
        this.saveStepData();
        this.step--;
        this.render();
        return;
      }

      if (t.classList.contains('btn-print')) return this.printBrief();
      if (t.classList.contains('btn-apply-rec')) return this.applyRecommendations();
    });
  }
}
