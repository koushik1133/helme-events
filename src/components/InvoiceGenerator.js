import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class InvoiceGenerator {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.currency = 'USD';
    this.rates = { USD: 1, INR: 83, GBP: 0.79, AED: 3.67, SGD: 1.34 };
    this.symbols = { USD: '$', INR: '₹', GBP: '£', AED: 'د.إ', SGD: 'S$' };
  }

  open() {
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  generateLineItems() {
    let items = [];
    let subtotal = 0;
    
    for (const [slotId, selection] of Object.entries(this.activeSelections)) {
      const item = getItemById(selection.itemId);
      if (item) {
        let zoneName = 'Unknown Zone';
        VENUE_ZONES.forEach(z => {
          z.slots.forEach(s => {
            if (s.id === slotId) zoneName = z.name;
          });
        });
        
        const qty = selection.quantity || 1;
        const total = item.price * qty;
        subtotal += total;
        items.push({ name: item.name, zone: zoneName, qty, price: item.price, total });
      }
    }
    return { items, subtotal };
  }

  render() {
    const { items, subtotal } = this.generateLineItems();
    const rate = this.rates[this.currency];
    const sym = this.symbols[this.currency];
    
    const subtotalConv = subtotal * rate;
    const tax = subtotalConv * 0.1; // 10% tax
    const grandTotal = subtotalConv + tax;
    
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content invoice-modal" style="max-width: 800px; width: 100%;">
          <div class="modal-header">
            <h2>Invoice</h2>
            <select class="currency-selector" style="margin-left:auto; margin-right:15px;">
              ${Object.keys(this.rates).map(c => `<option value="${c}" ${c === this.currency ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
            <button class="btn-close">&times;</button>
          </div>
          <div class="modal-body invoice-body" id="invoice-print-area" style="padding: 20px; background: #fff; color: #000;">
            <div class="invoice-header" style="text-align: center; margin-bottom: 20px;">
              <h1 style="margin: 0; color: #333;">Helme Events Pvt Ltd</h1>
              <p style="margin: 5px 0;">Invoice #: INV-${Math.floor(Math.random()*10000)}<br>Date: ${new Date().toLocaleDateString()}</p>
            </div>
            <div class="invoice-bill-to" style="margin-bottom: 20px;">
              <h3 style="margin: 0 0 10px 0;">Bill To:</h3>
              <p style="margin: 0;">Client Name<br>123 Event Street<br>City, Country</p>
            </div>
            <table class="invoice-table" style="width:100%; text-align:left; border-collapse:collapse; margin-bottom: 20px;">
              <thead>
                <tr>
                  <th style="border-bottom:2px solid #ccc; padding:8px;">Item</th>
                  <th style="border-bottom:2px solid #ccc; padding:8px;">Zone</th>
                  <th style="border-bottom:2px solid #ccc; padding:8px;">Qty</th>
                  <th style="border-bottom:2px solid #ccc; padding:8px;">Unit Price</th>
                  <th style="border-bottom:2px solid #ccc; padding:8px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(i => `
                  <tr>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${i.name}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${i.zone}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${i.qty}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${sym}${(i.price * rate).toFixed(2)}</td>
                    <td style="border-bottom:1px solid #eee; padding:8px;">${sym}${(i.total * rate).toFixed(2)}</td>
                  </tr>
                `).join('')}
                ${items.length === 0 ? '<tr><td colspan="5" style="padding: 15px; text-align:center;">No items selected.</td></tr>' : ''}
              </tbody>
            </table>
            <div class="invoice-totals" style="margin-top:20px; text-align:right;">
              <p style="margin: 5px 0;">Subtotal: ${sym}${subtotalConv.toFixed(2)}</p>
              <p style="margin: 5px 0;">Tax (10%): ${sym}${tax.toFixed(2)}</p>
              <h3 style="margin: 10px 0;">Grand Total: ${sym}${grandTotal.toFixed(2)}</h3>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-print">Print Invoice</button>
            <button class="btn-download-html">Download HTML</button>
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
    
    this.container.querySelector('.currency-selector').addEventListener('change', (e) => {
      this.currency = e.target.value;
      this.render();
    });

    this.container.querySelector('.btn-print').addEventListener('click', () => {
      const printContents = this.container.querySelector('#invoice-print-area').innerHTML;
      const originalContents = document.body.innerHTML;
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      window.location.reload(); 
    });

    this.container.querySelector('.btn-download-html').addEventListener('click', () => {
      const html = `<html><head><title>Invoice</title><style>body{font-family:sans-serif;} table, th, td { border-collapse: collapse; }</style></head><body>${this.container.querySelector('#invoice-print-area').innerHTML}</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.html';
      a.click();
      URL.revokeObjectURL(url);
    });
  }
}
