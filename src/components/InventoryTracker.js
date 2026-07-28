import { ITEM_CATALOG } from '../data/catalog.js';

export class InventoryTracker {
  constructor(containerElement) {
    this.container = containerElement;
    this.inventory = JSON.parse(localStorage.getItem('helme_events_inventory')) || this.generateInitialStock();
    this.filterCategory = 'All';
  }
  
  generateInitialStock() {
    const stock = {};
    Object.values(ITEM_CATALOG).flat().forEach(item => {
      stock[item.id] = Math.floor(Math.random() * 196) + 5; // 5 to 200
    });
    localStorage.setItem('helme_events_inventory', JSON.stringify(stock));
    return stock;
  }
  
  render() {
    const categories = Object.keys(ITEM_CATALOG);
    
    this.container.innerHTML = `
      <div class="inventory-wrapper" style="padding:20px;">
        <div class="inventory-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
          <h2>📦 Inventory Tracker</h2>
          <select id="inv-category-filter">
            <option value="All">All Categories</option>
            ${categories.map(c => `<option value="${c}">${c.toUpperCase()}</option>`).join('')}
          </select>
        </div>
        <div class="inventory-alerts" id="inventory-alerts" style="margin-bottom:20px; padding:10px; border:1px solid #f87171; background:#fef2f2; border-radius:5px;"></div>
        <div class="inventory-grid" id="inventory-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:20px;"></div>
      </div>
    `;
    this.bindEvents();
    this.renderGrid();
  }
  
  renderGrid() {
    const grid = this.container.querySelector('#inventory-grid');
    const alerts = this.container.querySelector('#inventory-alerts');
    grid.innerHTML = '';
    alerts.innerHTML = '<h3 style="margin-top:0;">Low Stock Alerts</h3>';
    
    let lowStockCount = 0;
    
    Object.values(ITEM_CATALOG).flat().forEach(item => {
      if (this.filterCategory !== 'All' && item.category !== this.filterCategory) return;
      
      const stock = this.inventory[item.id] || 0;
      let colorStyle = 'border-top: 5px solid #22c55e;'; // Green
      if (stock < 10) {
        colorStyle = 'border-top: 5px solid #ef4444;'; // Red
        lowStockCount++;
        alerts.innerHTML += `<div class="alert-item" style="color:#b91c1c;">🚨 ${item.name} is running low! (${stock} left)</div>`;
      } else if (stock <= 50) {
        colorStyle = 'border-top: 5px solid #eab308;'; // Yellow
      }
      
      grid.innerHTML += `
        <div class="inventory-card" style="border:1px solid #e2e8f0; border-radius:5px; padding:10px; background:#fff; ${colorStyle}">
          <div style="height:120px; overflow:hidden; border-radius:3px; margin-bottom:10px;">
            <img src="${item.imageUrl}" alt="${item.name}" style="width:100%; height:100%; object-fit:cover;" onerror="this.src='https://via.placeholder.com/200?text=No+Image'" />
          </div>
          <div class="info">
            <h4 style="margin:0 0 5px 0; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</h4>
            <p style="margin:0; font-size:13px; color:#475569;">Stock Level: <strong>${stock}</strong></p>
          </div>
        </div>
      `;
    });
    
    if (lowStockCount === 0) {
      alerts.innerHTML += `<div class="alert-item" style="color:#15803d;">All items are well stocked!</div>`;
    }
  }
  
  bindEvents() {
    this.container.querySelector('#inv-category-filter').addEventListener('change', e => {
      this.filterCategory = e.target.value;
      this.renderGrid();
    });
  }
}
