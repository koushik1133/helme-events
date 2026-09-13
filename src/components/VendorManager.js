import { VENUE_ZONES } from '../data/zones.js';
import {
  VENDORS,
  VENDOR_CATEGORY_LABELS,
  VENDOR_STATUS_LABELS
} from '../data/vendors.js';
import { eventState } from '../data/eventState.js';
import { formatMoney, formatNumber, readJSON, writeJSON, escapeHtml } from '../utils/format.js';

const ASSIGNMENTS_KEY = 'helme_events_vendor_assignments';
const CUSTOM_VENDORS_KEY = 'helme_events_vendors_custom';

const RATE_UNIT_LABELS = {
  plate: 'per plate',
  day: 'per day',
  event: 'per event',
  'unit/day': 'per unit / day'
};

export class VendorManager {
  constructor(containerElement) {
    this.container = containerElement;

    // Never mutate the imported module array — keep a local working copy.
    this.baseVendors = Array.isArray(VENDORS) ? VENDORS.slice() : [];
    this.customVendors = readJSON(CUSTOM_VENDORS_KEY, []);
    if (!Array.isArray(this.customVendors)) this.customVendors = [];

    const savedAssignments = readJSON(ASSIGNMENTS_KEY, {});
    this.assignments = savedAssignments && typeof savedAssignments === 'object' ? savedAssignments : {};

    this.filterCategory = 'All';
    this.filterStatus = 'All';
    this.searchQuery = '';
    this._bound = false;
  }

  get vendors() {
    return this.baseVendors.concat(this.customVendors);
  }

  /** Zone assignment falls back to the value shipped in the data file. */
  assignedZoneFor(vendor) {
    if (Object.prototype.hasOwnProperty.call(this.assignments, vendor.id)) {
      return this.assignments[vendor.id] || '';
    }
    return vendor.assignedZone || '';
  }

  categories() {
    return [...new Set(this.vendors.map(v => v.category).filter(Boolean))].sort();
  }

  statuses() {
    return [...new Set(this.vendors.map(v => v.status).filter(Boolean))].sort();
  }

  categoryLabel(key) {
    return VENDOR_CATEGORY_LABELS[key] || key;
  }

  statusLabel(key) {
    return VENDOR_STATUS_LABELS[key] || key;
  }

  rateLabel(vendor) {
    if (!Number.isFinite(Number(vendor.rate))) return '—';
    const unit = RATE_UNIT_LABELS[vendor.rateUnit] || '';
    return `${formatMoney(vendor.rate)}${unit ? ` <span class="vendor-rate-unit">${escapeHtml(unit)}</span>` : ''}`;
  }

  /**
   * What an assigned vendor costs for THIS event. Vendor assignments used to
   * be stored and never priced, which left the panel a read-only directory
   * with no way back into the sale.
   *
   * Per-plate rates multiply by the event's guest count; per-day rates by the
   * number of event days; per-event and per-unit/day rates are quoted once,
   * because how many units are hired is not something this panel knows.
   * Returns null when there is no rate to work from — an unknown cost is
   * shown as unknown, never as zero.
   */
  estimateFor(vendor) {
    const rate = Number(vendor.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;

    const guests = eventState.getGuestCount();
    const days = Math.max(1, eventState.getDayCount());

    switch (vendor.rateUnit) {
      case 'plate':
        return { amount: Math.round(rate * guests), basis: `${formatNumber(guests)} guests` };
      case 'day':
        return { amount: Math.round(rate * days), basis: `${days} day${days === 1 ? '' : 's'}` };
      case 'unit/day':
        return { amount: Math.round(rate * days), basis: `1 unit × ${days} day${days === 1 ? '' : 's'}` };
      default:
        return { amount: Math.round(rate), basis: 'per event' };
    }
  }

  /** Every vendor currently pinned to a zone, with its estimate. */
  assignedVendors() {
    return this.vendors
      .filter(v => this.assignedZoneFor(v))
      .map(v => ({
        vendor: v,
        zoneName: VENUE_ZONES.find(z => z.id === this.assignedZoneFor(v))?.name || '—',
        estimate: this.estimateFor(v)
      }));
  }

  filteredVendors() {
    let list = this.vendors;
    if (this.filterCategory !== 'All') list = list.filter(v => v.category === this.filterCategory);
    if (this.filterStatus !== 'All') list = list.filter(v => v.status === this.filterStatus);

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(v =>
        [v.name, v.city, v.state, v.contact?.person, v.contact?.email, v.gstin, this.categoryLabel(v.category)]
          .filter(Boolean)
          .some(field => String(field).toLowerCase().includes(q))
      );
    }
    return list;
  }

  render() {
    const categoryOptions = this.categories()
      .map(c => `<option value="${escapeHtml(c)}" ${this.filterCategory === c ? 'selected' : ''}>${escapeHtml(this.categoryLabel(c))}</option>`)
      .join('');
    const statusOptions = this.statuses()
      .map(s => `<option value="${escapeHtml(s)}" ${this.filterStatus === s ? 'selected' : ''}>${escapeHtml(this.statusLabel(s))}</option>`)
      .join('');
    const newVendorCategoryOptions = this.categories()
      .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(this.categoryLabel(c))}</option>`)
      .join('');

    this.container.innerHTML = `
      <div class="vendor-wrapper" style="padding:20px;color:var(--text-main);">
        <div class="vendor-header" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;color:var(--text-main);">🤝 Vendor Panel</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.85rem;">
              Empanelled production partners across India — rates exclusive of GST.
            </p>
          </div>
          <div class="vendor-filters" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <input id="vendor-search" type="search" aria-label="Search vendors" placeholder="Search name, city, contact…"
              value="${escapeHtml(this.searchQuery)}"
              style="min-width:200px;padding:8px 12px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
            <select id="vendor-cat-filter" aria-label="Filter by category"
              style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
              <option value="All">All Categories</option>
              ${categoryOptions}
            </select>
            <select id="vendor-status-filter" aria-label="Filter by status"
              style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
              <option value="All">All Statuses</option>
              ${statusOptions}
            </select>
            <button type="button" id="add-vendor-btn" class="btn-primary">+ Add Vendor</button>
          </div>
        </div>

        <div id="vendor-assigned" style="margin-bottom:14px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-elevated);border-radius:12px;"></div>

        <div id="vendor-meta" style="margin-bottom:10px;color:var(--text-muted);font-size:0.85rem;"></div>

        <div class="vendor-grid" style="overflow-x:auto;border:1px solid var(--border-subtle);border-radius:12px;">
          <table style="width:100%;min-width:900px;text-align:left;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid var(--border-subtle);background:var(--bg-elevated);">
                <th style="padding:10px;">Vendor</th>
                <th style="padding:10px;">Category</th>
                <th style="padding:10px;">Contact</th>
                <th style="padding:10px;">Rate</th>
                <th style="padding:10px;">Capacity</th>
                <th style="padding:10px;">Lead time</th>
                <th style="padding:10px;">Rating</th>
                <th style="padding:10px;">Status</th>
                <th style="padding:10px;">Assigned Zone</th>
                <th style="padding:10px;">Actions</th>
              </tr>
            </thead>
            <tbody id="vendor-tbody"></tbody>
          </table>
        </div>

        <div id="vendor-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-modal-title" hidden
          style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); background:var(--bg-surface); color:var(--text-main); padding:20px; border:1px solid var(--border-subtle); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.45); z-index:1000; width:min(420px, 92vw);">
          <h3 id="vendor-modal-title" style="margin:0 0 14px;">Add Vendor</h3>
          <input type="text" id="v-name" aria-label="Vendor name" placeholder="Vendor name" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
          <select id="v-category" aria-label="Vendor category" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
            ${newVendorCategoryOptions}
          </select>
          <input type="text" id="v-city" aria-label="City" placeholder="City" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
          <input type="tel" id="v-phone" aria-label="Phone number" placeholder="Phone (+91 …)" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
          <input type="email" id="v-email" aria-label="Email address" placeholder="Email" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
          <input type="number" id="v-rate" aria-label="Rate in whole rupees" min="0" step="1" placeholder="Rate (₹, whole rupees)" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
          <select id="v-rate-unit" aria-label="Rate unit" style="display:block;width:100%;box-sizing:border-box;margin-bottom:10px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
            <option value="event">per event</option>
            <option value="plate">per plate</option>
            <option value="day">per day</option>
            <option value="unit/day">per unit / day</option>
          </select>
          <select id="v-status" aria-label="Vendor status" style="display:block;width:100%;box-sizing:border-box;margin-bottom:14px;padding:8px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
            <option value="available">Available</option>
            <option value="pending">Quote Pending</option>
            <option value="booked">Booked</option>
          </select>
          <div id="vendor-modal-error" role="alert" style="color:#f87171;font-size:12px;min-height:16px;margin-bottom:8px;"></div>
          <div style="display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="v-cancel" class="btn-secondary">Cancel</button>
            <button type="button" id="v-save" class="btn-primary">Save Vendor</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderTable();
  }

  /** Assigned vendors priced against the live event record. */
  renderAssigned() {
    const el = this.container.querySelector('#vendor-assigned');
    if (!el) return;

    const rows = this.assignedVendors();

    if (rows.length === 0) {
      el.innerHTML =
        '<h3 style="margin:0 0 6px;font-size:0.95rem;color:var(--text-main);">Assigned to this event</h3>' +
        '<p style="margin:0;color:var(--text-muted);font-size:0.85rem;">No vendor is assigned to a zone yet. Pick a zone in the table below and the sub-contract estimate appears here.</p>';
      return;
    }

    const known = rows.filter(r => r.estimate);
    const total = known.reduce((sum, r) => sum + r.estimate.amount, 0);
    const unpriced = rows.length - known.length;

    el.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:0.95rem;color:var(--text-main);">Assigned to this event</h3>
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px;">
        ${rows.map(r => `
          <div style="display:flex;justify-content:space-between;gap:12px;font-size:0.85rem;">
            <span>${escapeHtml(r.vendor.name)} <span style="color:var(--text-muted);">· ${escapeHtml(r.zoneName)}</span></span>
            <span style="white-space:nowrap;">${r.estimate
              ? `${formatMoney(r.estimate.amount)} <span style="color:var(--text-muted);font-size:0.8em;">(${escapeHtml(r.estimate.basis)})</span>`
              : '<span style="color:var(--text-muted);">rate on request</span>'}</span>
          </div>`).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border-subtle);padding-top:8px;font-size:0.9rem;">
        <strong>Estimated sub-contract cost</strong>
        <strong>${formatMoney(total)}</strong>
      </div>
      <p style="margin:6px 0 0;color:var(--text-muted);font-size:0.75rem;">
        Exclusive of GST, and based on ${formatNumber(eventState.getGuestCount())} guests over
        ${Math.max(1, eventState.getDayCount())} day${Math.max(1, eventState.getDayCount()) === 1 ? '' : 's'}.
        ${unpriced ? `${unpriced} assigned vendor${unpriced === 1 ? ' has' : 's have'} no published rate and ${unpriced === 1 ? 'is' : 'are'} excluded from this total.` : ''}
        This estimate is not part of the client quote.
      </p>
    `;
  }

  renderTable() {
    this.renderAssigned();
    const tbody = this.container.querySelector('#vendor-tbody');
    const meta = this.container.querySelector('#vendor-meta');
    if (!tbody) return;
    tbody.innerHTML = '';

    const filtered = this.filteredVendors();

    if (meta) {
      meta.textContent = `Showing ${filtered.length} of ${this.vendors.length} vendor${this.vendors.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="10" style="padding:32px;text-align:center;color:var(--text-muted);">
            No vendors match these filters. Clear the search or pick “All Categories”.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(v => {
      const assigned = this.assignedZoneFor(v);
      const zoneOptions = `<option value="">Unassigned</option>` + VENUE_ZONES.map(z =>
        `<option value="${escapeHtml(z.id)}" ${assigned === z.id ? 'selected' : ''}>${escapeHtml(z.name)}</option>`
      ).join('');

      const phone = escapeHtml(v.contact?.phone || '—');
      const email = escapeHtml(v.contact?.email || '');
      const person = escapeHtml(v.contact?.person || '');
      const location = [v.city, v.state].filter(Boolean).map(escapeHtml).join(', ');

      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-subtle)';
      tr.innerHTML = `
        <td style="padding:10px;">
          <strong>${escapeHtml(v.name)}</strong>
          ${location ? `<div style="font-size:12px;color:var(--text-muted);">${location}</div>` : ''}
          ${v.gstin ? `<div style="font-size:11px;color:var(--text-muted);">GSTIN ${escapeHtml(v.gstin)}</div>` : ''}
        </td>
        <td style="padding:10px;">${escapeHtml(this.categoryLabel(v.category))}</td>
        <td style="padding:10px;">
          ${person ? `<div>${person}</div>` : ''}
          <div style="font-size:12px;">${phone}</div>
          ${email ? `<div style="font-size:12px;color:var(--text-muted);">${email}</div>` : ''}
        </td>
        <td style="padding:10px;white-space:nowrap;">${this.rateLabel(v)}</td>
        <td style="padding:10px;">${v.capacity ? `${formatNumber(v.capacity)} ${escapeHtml(v.capacityUnit || '')}` : '—'}</td>
        <td style="padding:10px;">${Number.isFinite(Number(v.leadTimeDays)) ? `${v.leadTimeDays} days` : '—'}</td>
        <td style="padding:10px;white-space:nowrap;">${Number(v.rating || 0).toFixed(1)} ⭐${v.reviewCount ? `<div style="font-size:11px;color:var(--text-muted);">${formatNumber(v.reviewCount)} reviews</div>` : ''}</td>
        <td style="padding:10px;"><span class="badge badge-${escapeHtml(String(v.status || '').toLowerCase())}">${escapeHtml(this.statusLabel(v.status))}</span></td>
        <td style="padding:10px;">
          <select id="assign-${escapeHtml(v.id)}" data-vid="${escapeHtml(v.id)}" class="zone-assign-select"
            aria-label="Assign ${escapeHtml(v.name)} to a zone"
            style="padding:6px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
            ${zoneOptions}
          </select>
        </td>
        <td style="padding:10px;">
          ${this.customVendors.some(c => c.id === v.id)
            ? `<button type="button" class="btn-delete" data-id="${escapeHtml(v.id)}" aria-label="Delete ${escapeHtml(v.name)}">Delete</button>`
            : `<span style="font-size:11px;color:var(--text-muted);">Empanelled</span>`}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  persistAssignments() {
    if (!writeJSON(ASSIGNMENTS_KEY, this.assignments)) {
      this.flashError('Could not save the zone assignment — browser storage is full.');
    }
  }

  persistCustomVendors() {
    if (!writeJSON(CUSTOM_VENDORS_KEY, this.customVendors)) {
      this.flashError('Could not save this vendor — browser storage is full.');
      return false;
    }
    return true;
  }

  flashError(message) {
    const meta = this.container.querySelector('#vendor-meta');
    if (meta) {
      meta.textContent = message;
      meta.style.color = '#f87171';
    }
  }

  bindEvents() {
    // The container persists across renders, so bind exactly once and use
    // event delegation. Re-binding here per render is what made one click
    // fire N times after N section visits.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('input', e => {
      if (e.target.id === 'vendor-search') {
        this.searchQuery = e.target.value;
        this.renderTable();
      }
    });

    this.container.addEventListener('change', e => {
      if (e.target.id === 'vendor-cat-filter') {
        this.filterCategory = e.target.value;
        this.renderTable();
      } else if (e.target.id === 'vendor-status-filter') {
        this.filterStatus = e.target.value;
        this.renderTable();
      } else if (e.target.classList.contains('zone-assign-select')) {
        this.assignments[e.target.dataset.vid] = e.target.value;
        this.persistAssignments();
        // Only the summary needs redrawing — re-rendering the table here would
        // blur the select the user just used.
        this.renderAssigned();
      }
    });

    this.container.addEventListener('click', e => {
      const modal = this.container.querySelector('#vendor-modal');

      if (e.target.id === 'add-vendor-btn') {
        if (modal) {
          modal.hidden = false;
          this.container.querySelector('#v-name')?.focus();
        }
        return;
      }

      if (e.target.id === 'v-cancel') {
        if (modal) modal.hidden = true;
        return;
      }

      if (e.target.id === 'v-save') {
        const err = this.container.querySelector('#vendor-modal-error');
        const name = this.container.querySelector('#v-name').value.trim();
        if (!name) {
          if (err) err.textContent = 'A vendor name is required.';
          return;
        }
        const rateRaw = this.container.querySelector('#v-rate').value;
        const rate = Math.max(0, Math.round(Number(rateRaw) || 0));

        this.customVendors.push({
          id: 'v_' + Date.now(),
          name,
          category: this.container.querySelector('#v-category').value,
          city: this.container.querySelector('#v-city').value.trim(),
          state: '',
          contact: {
            person: '',
            phone: this.container.querySelector('#v-phone').value.trim(),
            email: this.container.querySelector('#v-email').value.trim()
          },
          gstin: '',
          rating: 0,
          reviewCount: 0,
          rate,
          rateUnit: this.container.querySelector('#v-rate-unit').value,
          capacity: null,
          capacityUnit: '',
          leadTimeDays: null,
          status: this.container.querySelector('#v-status').value,
          assignedZone: null
        });

        if (this.persistCustomVendors()) {
          if (err) err.textContent = '';
          if (modal) modal.hidden = true;
          this.render();
        }
        return;
      }

      if (e.target.classList.contains('btn-delete')) {
        const id = e.target.dataset.id;
        const vendor = this.customVendors.find(v => v.id === id);
        if (!vendor) return;
        if (!window.confirm(`Remove "${vendor.name}" from the vendor panel?`)) return;
        this.customVendors = this.customVendors.filter(v => v.id !== id);
        delete this.assignments[id];
        this.persistCustomVendors();
        this.persistAssignments();
        this.render();
      }
    });
  }
}
