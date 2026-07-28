import { VENUE_ZONES } from '../data/zones.js';
import { ITEM_CATALOG } from '../data/catalog.js';

export class BudgetOptimizer {
  constructor(containerElement, activeSelections, onApply) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply;
    this.budget = 5000;
    this.eventType = 'Wedding';
  }

  open() {
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }
  
  optimize() {
    const optimized = {};
    
    const catItems = {};
    for (const cat in ITEM_CATALOG) {
      catItems[cat] = [...ITEM_CATALOG[cat]].sort((a, b) => a.price - b.price);
    }

    let totalOptimizedCost = 0;
    let totalSlots = 0;
    VENUE_ZONES.forEach(z => totalSlots += z.slots.length);
    
    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const items = catItems[slot.category] || [];
        if (items.length > 0) {
          let selected = items[0];
          let maxAffordablePrice = (this.budget / totalSlots) / (slot.quantity || 1);
          
          for (const item of items) {
            if (item.price <= maxAffordablePrice) {
              selected = item;
            }
          }
          
          optimized[slot.id] = { itemId: selected.id, quantity: slot.quantity || 1 };
          totalOptimizedCost += selected.price * (slot.quantity || 1);
        }
      });
    });

    return { optimized, totalOptimizedCost };
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content budget-modal" style="max-width: 800px; width: 100%;">
          <div class="modal-header">
            <h2>🤖 AI Budget Optimizer</h2>
            <button class="btn-close">&times;</button>
          </div>
          <div class="modal-body budget-body">
            <div class="optimizer-inputs" style="display:flex; gap: 15px; align-items: center; margin-bottom: 20px;">
              <label>Budget ($): <input type="number" id="opt-budget" value="${this.budget}" style="padding: 5px; width: 120px;" /></label>
              <label>Event Type: 
                <select id="opt-type" style="padding: 5px;">
                  <option ${this.eventType==='Wedding'?'selected':''}>Wedding</option>
                  <option ${this.eventType==='Corporate'?'selected':''}>Corporate</option>
                  <option ${this.eventType==='Rally'?'selected':''}>Rally</option>
                  <option ${this.eventType==='Gala'?'selected':''}>Gala</option>
                </select>
              </label>
              <button class="btn-optimize" style="padding: 6px 12px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Optimize</button>
            </div>
            <div class="optimizer-results" id="opt-results" style="display:none; gap: 20px; margin-top:20px; background: #f8fafc; padding: 15px; border-radius: 8px;">
              <div class="result-col" style="flex:1;">
                <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">Current Selection</h3>
                <div id="current-list"></div>
              </div>
              <div class="result-col" style="flex:1;">
                <h3 style="border-bottom: 1px solid #ccc; padding-bottom: 5px; color: #16a34a;">AI Optimized</h3>
                <div id="optimized-list"></div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-apply-ai" style="display:none; background: #16a34a; color: #fff;">Apply AI Config</button>
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
    
    let optimizedSelections = null;

    this.container.querySelector('.btn-optimize').addEventListener('click', () => {
      this.budget = parseInt(this.container.querySelector('#opt-budget').value, 10);
      this.eventType = this.container.querySelector('#opt-type').value;
      
      const { optimized, totalOptimizedCost } = this.optimize();
      optimizedSelections = optimized;
      
      this.container.querySelector('#opt-results').style.display = 'flex';
      this.container.querySelector('.btn-apply-ai').style.display = 'inline-block';
      
      this.container.querySelector('#optimized-list').innerHTML = `
        <h4 style="color: #16a34a;">Total Estimated: $${totalOptimizedCost.toFixed(2)}</h4>
        <ul style="padding-left: 20px;">
          ${Object.keys(optimized).slice(0,5).map(k => `<li>Slot ${k}: ${optimized[k].itemId}</li>`).join('')}
          ${Object.keys(optimized).length > 5 ? '<li>...</li>' : ''}
        </ul>
      `;
      
      let currCost = 0;
      for (const [slotId, sel] of Object.entries(this.activeSelections)) {
          // estimate cost if possible
      }

      this.container.querySelector('#current-list').innerHTML = `
        <p>Your current configuration cost needs to be evaluated.</p>
        <ul style="padding-left: 20px;">
          ${Object.keys(this.activeSelections).slice(0,5).map(k => `<li>Slot ${k}: ${this.activeSelections[k].itemId}</li>`).join('')}
          ${Object.keys(this.activeSelections).length > 5 ? '<li>...</li>' : ''}
        </ul>
      `;
    });

    this.container.querySelector('.btn-apply-ai').addEventListener('click', () => {
      if (this.onApply && optimizedSelections) {
        this.onApply(optimizedSelections);
      }
      this.close();
    });
  }
}
