import { ITEM_CATALOG } from '../data/catalog.js';
import { buildQuoteLines } from '../utils/quote.js';
import { formatMoney, formatNumber, readJSON, writeJSON, escapeHtml } from '../utils/format.js';

const INVENTORY_KEY = 'helme_events_inventory';

/**
 * Curated opening stock per category. Real hire houses hold thousands of
 * folding chairs and two or three mandaps — random counts made a 5,000-guest
 * rally quotable against "7 chairs". Derived deterministically from the
 * category and the item's price tier so the numbers are stable across reloads.
 */
const CATEGORY_STOCK = {
  chairs: 2400,
  sofas: 40,
  tables: 320,
  podiums: 12,
  fountains: 8,
  audio: 48,
  stages: 4,
  backdrops: 14,
  lighting: 60
};

function curatedStock(item) {
  const base = CATEGORY_STOCK[item.category] ?? 25;
  const price = Number(item.price) || 0;
  // Price tier scales the holding down: the dearer the piece, the fewer held.
  let factor = 1;
  if (price >= 300000) factor = 0.25;
  else if (price >= 100000) factor = 0.4;
  else if (price >= 25000) factor = 0.6;
  else if (price >= 5000) factor = 0.8;
  return Math.max(2, Math.round(base * factor));
}

export class InventoryTracker {
  constructor(containerElement) {
    this.container = containerElement;
    const saved = readJSON(INVENTORY_KEY, null);
    this.inventory = (saved && typeof saved === 'object' && !Array.isArray(saved))
      ? saved
      : this.generateInitialStock();
    this.storageWarning = '';
    this.filterCategory = 'All';
    this.searchQuery = '';
    this.sortBy = 'name-asc';
  }

  generateInitialStock() {
    const stock = {};
    Object.values(ITEM_CATALOG).flat().forEach(item => {
      stock[item.id] = curatedStock(item);
    });
    writeJSON(INVENTORY_KEY, stock);
    return stock;
  }

  persist() {
    if (writeJSON(INVENTORY_KEY, this.inventory)) {
      this.storageWarning = '';
      return true;
    }
    this.storageWarning = 'Stock change could not be saved — browser storage is full or unavailable.';
    return false;
  }

  getItems() {
    let items = Object.values(ITEM_CATALOG).flat();
    // Deduplicate shared podium/stage IDs
    const seen = new Set();
    items = items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    if (this.filterCategory !== 'All') {
      items = items.filter(i => i.category === this.filterCategory);
    }

    const q = this.searchQuery.trim().toLowerCase();
    if (q) {
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
      );
    }

    const stockOf = (id) => this.inventory[id] || 0;
    items.sort((a, b) => {
      switch (this.sortBy) {
        case 'name-desc': return b.name.localeCompare(a.name);
        case 'stock-asc': return stockOf(a.id) - stockOf(b.id);
        case 'stock-desc': return stockOf(b.id) - stockOf(a.id);
        case 'price-asc': return a.price - b.price;
        case 'price-desc': return b.price - a.price;
        case 'category': return a.category.localeCompare(b.category) || a.name.localeCompare(b.name);
        case 'name-asc':
        default: return a.name.localeCompare(b.name);
      }
    });

    return items;
  }

  render() {
    const categories = Object.keys(ITEM_CATALOG);

    this.container.innerHTML = `
      <div class="inventory-wrapper" style="padding:20px;color:var(--text-main);">
        <div class="inventory-header" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div>
            <h2 style="margin:0;color:var(--text-main);">📦 Inventory Tracker</h2>
            <p style="margin:4px 0 0;color:var(--text-muted);font-size:0.85rem;">Search, sort, and adjust stock for every catalog item</p>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;">
            <input id="inv-search" type="search" placeholder="Search name, category…" value="${escapeHtml(this.searchQuery)}"
              style="min-width:200px;padding:8px 12px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);" />
            <select id="inv-category-filter" style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
              <option value="All">All Categories</option>
              ${categories.map(c => `<option value="${c}" ${this.filterCategory === c ? 'selected' : ''}>${c.toUpperCase()}</option>`).join('')}
            </select>
            <select id="inv-sort" style="padding:8px 10px;border-radius:10px;border:1px solid var(--border-subtle);background:var(--bg-elevated);color:var(--text-main);">
              <option value="name-asc" ${this.sortBy === 'name-asc' ? 'selected' : ''}>Sort: Name A→Z</option>
              <option value="name-desc" ${this.sortBy === 'name-desc' ? 'selected' : ''}>Sort: Name Z→A</option>
              <option value="stock-asc" ${this.sortBy === 'stock-asc' ? 'selected' : ''}>Sort: Stock Low→High</option>
              <option value="stock-desc" ${this.sortBy === 'stock-desc' ? 'selected' : ''}>Sort: Stock High→Low</option>
              <option value="price-asc" ${this.sortBy === 'price-asc' ? 'selected' : ''}>Sort: Price Low→High</option>
              <option value="price-desc" ${this.sortBy === 'price-desc' ? 'selected' : ''}>Sort: Price High→Low</option>
              <option value="category" ${this.sortBy === 'category' ? 'selected' : ''}>Sort: Category</option>
            </select>
          </div>
        </div>
        <div class="inventory-alerts" id="inventory-demand" style="margin-bottom:16px;padding:12px;border:1px solid var(--border-subtle);background:var(--bg-elevated);border-radius:10px;color:var(--text-main);"></div>
        <div class="inventory-alerts" id="inventory-alerts" style="margin-bottom:16px;padding:12px;border:1px solid var(--critical);background:var(--tint-critical);border-radius:10px;color:var(--text-main);"></div>
        <div class="inventory-meta" id="inventory-meta" style="margin-bottom:12px;color:var(--text-muted);font-size:0.85rem;"></div>
        <div class="inventory-grid" id="inventory-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;"></div>
      </div>
    `;
    this.bindEvents();
    this.renderGrid();
  }

  /**
   * How many of each catalog item the CURRENT quote actually asks for, keyed
   * by item id. This is the join that makes an inventory list belong in a
   * sales tool: the quote already knows the order and the tracker already
   * knows the holding, so together they say what must be sub-hired.
   */
  requirements() {
    const selections = (typeof window !== 'undefined' && window.app?.activeSelections) || {};
    const needed = {};
    try {
      buildQuoteLines(selections).forEach(line => {
        needed[line.itemId] = (needed[line.itemId] || 0) + Number(line.quantity || 0);
      });
    } catch (err) {
      console.warn('[InventoryTracker] could not price the current quote:', err);
    }
    return needed;
  }

  /** Lines where the quote asks for more than the shelf holds. */
  shortfalls() {
    const needed = this.requirements();
    const byId = new Map(this.allItems().map(i => [i.id, i]));
    return Object.entries(needed)
      .map(([id, qty]) => {
        const item = byId.get(id);
        if (!item) return null;
        const stock = this.inventory[id] || 0;
        return { item, required: qty, stock, gap: qty - stock };
      })
      .filter(row => row && row.gap > 0)
      .sort((a, b) => b.gap - a.gap);
  }

  /** Reorder threshold is relative to the curated holding, so 3 of 4 stages
   *  is healthy while 3 of 2,400 folding chairs is a crisis. */
  reorderLevel(item) {
    return Math.max(2, Math.round(curatedStock(item) * 0.25));
  }

  allItems() {
    const seen = new Set();
    return Object.values(ITEM_CATALOG).flat().filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  /** "This quote needs 300 Gold Chiavari; 180 on the shelf; sub-hire 120." */
  renderDemand() {
    const el = this.container.querySelector('#inventory-demand');
    if (!el) return;

    const needed = this.requirements();
    const lineCount = Object.keys(needed).length;

    if (lineCount === 0) {
      el.innerHTML =
        '<h3 style="margin:0 0 8px;color:var(--text-main);">Against the current quote</h3>' +
        '<div style="color:var(--text-muted);">Nothing is on the quote yet. Pick items in the 360° view and this panel will show what has to be sub-hired.</div>';
      return;
    }

    const short = this.shortfalls();
    el.innerHTML =
      '<h3 style="margin:0 0 8px;color:var(--text-main);">Against the current quote</h3>' +
      (short.length
        ? `<div style="color:var(--text-muted);margin-bottom:6px;">${short.length} of ${formatNumber(lineCount)} quoted line${lineCount === 1 ? '' : 's'} cannot be covered from stock:</div>` +
          short.map(r => `
            <div style="color:var(--critical);">
              ⚠️ ${escapeHtml(r.item.name)} — quote needs ${formatNumber(r.required)}, ${formatNumber(r.stock)} in stock,
              <strong>sub-hire ${formatNumber(r.gap)}</strong>
            </div>`).join('')
        : `<div style="color:var(--positive);">All ${formatNumber(lineCount)} quoted line${lineCount === 1 ? '' : 's'} can be covered from stock.</div>`);
  }

  renderGrid() {
    this.renderDemand();
    const grid = this.container.querySelector('#inventory-grid');
    const alerts = this.container.querySelector('#inventory-alerts');
    const meta = this.container.querySelector('#inventory-meta');
    const items = this.getItems();
    grid.innerHTML = '';

    // Alerts are computed over the WHOLE catalog, never the filtered view —
    // typing in the search box must not make a stock crisis disappear.
    const low = this.allItems().filter(item => (this.inventory[item.id] || 0) <= this.reorderLevel(item));
    alerts.innerHTML =
      '<h3 style="margin:0 0 8px;color:var(--text-main);">Low Stock Alerts</h3>' +
      (low.length
        ? low.map(item => `<div style="color:var(--critical);">🚨 ${escapeHtml(item.name)} — ${formatNumber(this.inventory[item.id] || 0)} in stock (reorder at ${formatNumber(this.reorderLevel(item))})</div>`).join('')
        : '<div style="color:var(--positive);">Every catalog line is above its reorder level.</div>');

    if (this.storageWarning) {
      alerts.innerHTML += `<div role="alert" style="margin-top:8px;color:var(--warning);">⚠️ ${escapeHtml(this.storageWarning)}</div>`;
    }

    if (items.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;padding:32px;text-align:center;color:var(--text-muted);">No catalog items match this search or category.</div>`;
      meta.textContent = 'Showing 0 items';
      return;
    }

    const cards = items.map(item => {
      const stock = this.inventory[item.id] || 0;
      const reorder = this.reorderLevel(item);
      let border = 'border-top:5px solid var(--positive);';
      if (stock <= reorder) border = 'border-top:5px solid var(--critical);';
      else if (stock <= reorder * 2) border = 'border-top:5px solid var(--warning);';

      return `
        <div class="inventory-card" data-item-id="${escapeHtml(item.id)}" style="border:1px solid var(--border-subtle);border-radius:12px;padding:12px;background:var(--bg-elevated);${border}">
          <div style="height:120px;overflow:hidden;border-radius:8px;margin-bottom:10px;background:var(--bg-surface);">
            <img src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.opacity=0.3" />
          </div>
          <h4 style="margin:0 0 4px;font-size:14px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</h4>
          <p style="margin:0 0 8px;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(item.category)} · ${formatMoney(item.price)}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong style="color:var(--text-main);">Stock: ${formatNumber(stock)}</strong>
            <div style="display:flex;gap:4px;">
              <button type="button" class="inv-adj" data-delta="-1" data-item-id="${escapeHtml(item.id)}" aria-label="Decrease stock of ${escapeHtml(item.name)} by 1" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;">−</button>
              <button type="button" class="inv-adj" data-delta="1" data-item-id="${escapeHtml(item.id)}" aria-label="Increase stock of ${escapeHtml(item.name)} by 1" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;">+</button>
              <button type="button" class="inv-adj" data-delta="10" data-item-id="${escapeHtml(item.id)}" aria-label="Increase stock of ${escapeHtml(item.name)} by 10" style="padding:0 8px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;font-size:11px;">+10</button>
            </div>
          </div>
        </div>
      `;
    });

    // One parse of the whole grid instead of re-parsing per item.
    grid.innerHTML = cards.join('');

    meta.textContent = `Showing ${items.length} item${items.length === 1 ? '' : 's'}`;
  }

  bindEvents() {
    // The container element persists across render() calls, so bind exactly
    // once and delegate. Re-binding per render is what multiplied every click.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const btn = e.target.closest?.('.inv-adj');
      if (!btn || !this.container.contains(btn)) return;
      const id = btn.getAttribute('data-item-id');
      const delta = Number(btn.getAttribute('data-delta'));
      this.inventory[id] = Math.max(0, (this.inventory[id] || 0) + delta);
      this.persist();
      this.renderGrid();
    });

    this.container.addEventListener('input', e => {
      if (e.target.id === 'inv-search') {
        this.searchQuery = e.target.value;
        this.renderGrid();
      }
    });

    this.container.addEventListener('change', e => {
      if (e.target.id === 'inv-category-filter') {
        this.filterCategory = e.target.value;
        this.renderGrid();
      } else if (e.target.id === 'inv-sort') {
        this.sortBy = e.target.value;
        this.renderGrid();
      }
    });
  }
}
