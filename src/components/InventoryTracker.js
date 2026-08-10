import { ITEM_CATALOG } from '../data/catalog.js';

export class InventoryTracker {
  constructor(containerElement) {
    this.container = containerElement;
    this.inventory = JSON.parse(localStorage.getItem('helme_events_inventory')) || this.generateInitialStock();
    this.filterCategory = 'All';
    this.searchQuery = '';
    this.sortBy = 'name-asc';
  }

  generateInitialStock() {
    const stock = {};
    Object.values(ITEM_CATALOG).flat().forEach(item => {
      stock[item.id] = Math.floor(Math.random() * 196) + 5;
    });
    localStorage.setItem('helme_events_inventory', JSON.stringify(stock));
    return stock;
  }

  persist() {
    localStorage.setItem('helme_events_inventory', JSON.stringify(this.inventory));
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
            <input id="inv-search" type="search" placeholder="Search name, category…" value="${this.searchQuery.replace(/"/g, '&quot;')}"
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
        <div class="inventory-alerts" id="inventory-alerts" style="margin-bottom:16px;padding:12px;border:1px solid rgba(248,113,113,0.45);background:rgba(254,242,242,0.08);border-radius:10px;color:var(--text-main);"></div>
        <div class="inventory-meta" id="inventory-meta" style="margin-bottom:12px;color:var(--text-muted);font-size:0.85rem;"></div>
        <div class="inventory-grid" id="inventory-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;"></div>
      </div>
    `;
    this.bindEvents();
    this.renderGrid();
  }

  renderGrid() {
    const grid = this.container.querySelector('#inventory-grid');
    const alerts = this.container.querySelector('#inventory-alerts');
    const meta = this.container.querySelector('#inventory-meta');
    const items = this.getItems();
    grid.innerHTML = '';
    alerts.innerHTML = '<h3 style="margin:0 0 8px;color:var(--text-main);">Low Stock Alerts</h3>';

    let lowStockCount = 0;
    items.forEach(item => {
      const stock = this.inventory[item.id] || 0;
      let border = 'border-top:5px solid #22c55e;';
      if (stock < 10) {
        border = 'border-top:5px solid #ef4444;';
        lowStockCount++;
        alerts.innerHTML += `<div style="color:#f87171;">🚨 ${item.name} is running low! (${stock} left)</div>`;
      } else if (stock <= 50) {
        border = 'border-top:5px solid #eab308;';
      }

      grid.innerHTML += `
        <div class="inventory-card" data-item-id="${item.id}" style="border:1px solid var(--border-subtle);border-radius:12px;padding:12px;background:var(--bg-elevated);${border}">
          <div style="height:120px;overflow:hidden;border-radius:8px;margin-bottom:10px;background:#111;">
            <img src="${item.imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.opacity=0.3" />
          </div>
          <h4 style="margin:0 0 4px;font-size:14px;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${item.name}">${item.name}</h4>
          <p style="margin:0 0 8px;font-size:12px;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${item.category} · $${item.price}</p>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <strong style="color:var(--text-main);">Stock: ${stock}</strong>
            <div style="display:flex;gap:4px;">
              <button type="button" class="inv-adj" data-delta="-1" data-item-id="${item.id}" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;">−</button>
              <button type="button" class="inv-adj" data-delta="1" data-item-id="${item.id}" style="width:28px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;">+</button>
              <button type="button" class="inv-adj" data-delta="10" data-item-id="${item.id}" style="padding:0 8px;height:28px;border-radius:8px;border:1px solid var(--border-subtle);background:var(--bg-surface);color:var(--text-main);cursor:pointer;font-size:11px;">+10</button>
            </div>
          </div>
        </div>
      `;
    });

    if (lowStockCount === 0) {
      alerts.innerHTML += `<div style="color:#4ade80;">All listed items are well stocked.</div>`;
    }

    meta.textContent = `Showing ${items.length} item${items.length === 1 ? '' : 's'}`;

    grid.querySelectorAll('.inv-adj').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-item-id');
        const delta = Number(btn.getAttribute('data-delta'));
        this.inventory[id] = Math.max(0, (this.inventory[id] || 0) + delta);
        this.persist();
        this.renderGrid();
      });
    });
  }

  bindEvents() {
    const search = this.container.querySelector('#inv-search');
    const cat = this.container.querySelector('#inv-category-filter');
    const sort = this.container.querySelector('#inv-sort');

    search?.addEventListener('input', e => {
      this.searchQuery = e.target.value;
      this.renderGrid();
    });
    cat?.addEventListener('change', e => {
      this.filterCategory = e.target.value;
      this.renderGrid();
    });
    sort?.addEventListener('change', e => {
      this.sortBy = e.target.value;
      this.renderGrid();
    });
  }
}
