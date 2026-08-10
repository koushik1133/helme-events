import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import confetti from 'canvas-confetti';

export class CartPaymentModal {
  constructor(containerElement, activeSelections, onPaymentSuccess) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onPaymentSuccess = onPaymentSuccess;
    this.isOpen = false;
    this.selectedPaymentMethod = 'card';
    this.isProcessing = false;
    this.isPaid = false;

    // Location & Localization Config
    this.selectedCountry = 'IN';
    this.selectedState = 'Maharashtra';
    this.clientName = 'Koushik Goud';
    this.clientCompany = 'Helm Events';
    this.clientEmail = 'hello@helmevents.com';
    this.clientPhone = '+91 98765 43210';
    this.streetAddress = 'Suite 402, Bandra Kurla Complex';
    this.city = 'Mumbai';
    this.zipCode = '400051';
    this.taxId = '27AAAAA0000A1Z5';

    this.countryData = {
      IN: { name: '🇮🇳 India', currency: 'INR', symbol: '₹', rate: 83, taxRate: 0.18, taxName: 'GST (18%)', states: ['Maharashtra', 'Telangana', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Gujarat'] },
      US: { name: '🇺🇸 United States', currency: 'USD', symbol: '$', rate: 1, taxRate: 0.0825, taxName: 'State Sales Tax (8.25%)', states: ['California', 'New York', 'Texas', 'Florida', 'Illinois'] },
      GB: { name: '🇬🇧 United Kingdom', currency: 'GBP', symbol: '£', rate: 0.79, taxRate: 0.20, taxName: 'UK VAT (20%)', states: ['Greater London', 'Manchester', 'Birmingham', 'Scotland'] },
      AE: { name: '🇦🇪 United Arab Emirates', currency: 'AED', symbol: 'AED ', rate: 3.67, taxRate: 0.05, taxName: 'UAE VAT (5%)', states: ['Dubai', 'Abu Dhabi', 'Sharjah'] },
      SG: { name: '🇸🇬 Singapore', currency: 'SGD', symbol: 'S$', rate: 1.35, taxRate: 0.09, taxName: 'SG GST (9%)', states: ['Central Region', 'Jurong East', 'Changi'] }
    };
  }

  open() {
    this.isOpen = true;
    this.isPaid = false;
    this.isProcessing = false;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  calculateTotals() {
    let subtotalUSD = 0;
    const itemsList = [];

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);
        if (item) {
          const lineTotal = item.price * slot.quantity;
          subtotalUSD += lineTotal;
          itemsList.push({
            zoneName: zone.name,
            slotLabel: slot.label,
            itemName: item.name,
            quantity: slot.quantity,
            unitPriceUSD: item.price,
            lineTotalUSD: lineTotal
          });
        }
      });
    });

    const cInfo = this.countryData[this.selectedCountry] || this.countryData['IN'];
    const conv = cInfo.rate;
    const symbol = cInfo.symbol;

    const subtotal = Math.round(subtotalUSD * conv);
    const tax = Math.round(subtotal * cInfo.taxRate);
    const grandTotal = subtotal + tax;
    const deposit = Math.round(grandTotal * 0.30);
    const balanceDue = grandTotal - deposit;

    return {
      subtotal,
      tax,
      deposit,
      balanceDue,
      grandTotal,
      itemsList,
      cInfo,
      symbol
    };
  }

  render() {
    if (!this.isOpen) return;
    const calc = this.calculateTotals();

    this.container.innerHTML = `
      <div class="cart-modal-overlay">
        <div class="cart-modal-card realistic-swapper-card">
          <div class="cart-modal-header">
            <div>
              <span class="cart-modal-badge">🛒 Global Equipment Cart & End-to-End Checkout</span>
              <h3>B2B Tax Invoice & Event Setup Reservation</h3>
              <p class="cart-modal-subtitle">Configure billing location, country taxes, itemized equipment, and deposit authorization.</p>
            </div>
            <button class="btn-close-modal" id="btnCloseCartModal">&times;</button>
          </div>

          ${this.isPaid ? `
            <div class="payment-success-box">
              <div class="success-icon">🎉</div>
              <h3>Payment Confirmed & Venue Reserved!</h3>
              <p class="receipt-id">Official Tax Invoice ID: <strong>INV-2026-${Math.floor(100000 + Math.random() * 900000)}</strong></p>
              
              <div class="receipt-summary">
                <div class="receipt-row"><span>Client / Company:</span><strong>${this.clientName} (${this.clientCompany})</strong></div>
                <div class="receipt-row"><span>Billing Address:</span><strong>${this.streetAddress}, ${this.city}, ${this.selectedState}, ${calc.cInfo.name} (${this.zipCode})</strong></div>
                <div class="receipt-row"><span>Tax ID / GSTIN:</span><strong>${this.taxId}</strong></div>
                <div class="receipt-row"><span>Grand Total (${calc.cInfo.currency}):</span><strong>${calc.symbol}${calc.grandTotal.toLocaleString()}</strong></div>
                <div class="receipt-row"><span>30% Deposit Paid:</span><strong>${calc.symbol}${calc.deposit.toLocaleString()}</strong></div>
                <div class="receipt-row"><span>Remaining Balance Due:</span><strong>${calc.symbol}${calc.balanceDue.toLocaleString()}</strong></div>
                <div class="receipt-row"><span>Status:</span><span class="status-badge-paid">CONFIRMED & RESERVED</span></div>
              </div>

              <div class="receipt-actions">
                <button class="btn-print-receipt" onclick="window.print()">🖨️ Print Official B2B Tax Invoice</button>
                <button class="btn-watch-progress" id="btnWatchSetupProgress">🌀 Watch Live 360° Setup Tour →</button>
              </div>
            </div>
          ` : `
            <div class="cart-grid-layout">
              <!-- Left Column: Country, Billing Address & Cart Items -->
              <div class="cart-items-column">
                <!-- Location & Localization Box -->
                <div class="location-selector-box">
                  <h4 class="column-title">🌍 Select Billing Country & State</h4>
                  <div class="form-row-dual">
                    <div class="form-group">
                      <label>Country / Region</label>
                      <select id="cartCountrySelect" class="cart-input">
                        ${Object.keys(this.countryData).map(code => `
                          <option value="${code}" ${code === this.selectedCountry ? 'selected' : ''}>
                            ${this.countryData[code].name} (${this.countryData[code].currency})
                          </option>
                        `).join('')}
                      </select>
                    </div>
                    <div class="form-group">
                      <label>State / Province</label>
                      <select id="cartStateSelect" class="cart-input">
                        ${calc.cInfo.states.map(st => `
                          <option value="${st}" ${st === this.selectedState ? 'selected' : ''}>${st}</option>
                        `).join('')}
                      </select>
                    </div>
                  </div>

                  <div class="form-row-dual">
                    <div class="form-group"><label>Client Name</label><input type="text" id="inputClientName" class="cart-input" value="${this.clientName}" /></div>
                    <div class="form-group"><label>Company Name</label><input type="text" id="inputClientCompany" class="cart-input" value="${this.clientCompany}" /></div>
                  </div>

                  <div class="form-row-dual">
                    <div class="form-group"><label>Street Address</label><input type="text" id="inputAddress" class="cart-input" value="${this.streetAddress}" /></div>
                    <div class="form-group"><label>City & PIN/ZIP Code</label><input type="text" id="inputCity" class="cart-input" value="${this.city} ${this.zipCode}" /></div>
                  </div>
                </div>

                <h4 class="column-title">📋 Itemized Equipment List (${calc.itemsList.length} items)</h4>
                <div class="cart-items-scroll">
                  ${calc.itemsList.map(item => {
                    const priceLocal = Math.round(item.lineTotalUSD * calc.cInfo.rate);
                    return `
                      <div class="cart-item-row">
                        <div class="cart-item-info">
                          <strong>${item.itemName}</strong>
                          <small>${item.zoneName} • ${item.slotLabel} (${item.quantity}x)</small>
                        </div>
                        <span class="cart-item-price">${calc.symbol}${priceLocal.toLocaleString()}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Right Column: Payment Method & Checkout Summary -->
              <div class="checkout-column">
                <h4 class="column-title">💳 Payment Method</h4>
                <div class="payment-methods-tabs">
                  <button class="pay-method-btn ${this.selectedPaymentMethod === 'card' ? 'active' : ''}" data-method="card">
                    💳 Credit Card
                  </button>
                  <button class="pay-method-btn ${this.selectedPaymentMethod === 'upi' ? 'active' : ''}" data-method="upi">
                    📲 UPI / NetBanking
                  </button>
                  <button class="pay-method-btn ${this.selectedPaymentMethod === 'po' ? 'active' : ''}" data-method="po">
                    📄 B2B Purchase Order
                  </button>
                </div>

                <div class="payment-form-box">
                  ${this.selectedPaymentMethod === 'card' ? `
                    <div class="form-group">
                      <label>Cardholder Name</label>
                      <input type="text" class="cart-input" value="${this.clientName}" />
                    </div>
                    <div class="form-group">
                      <label>Card Number</label>
                      <input type="text" class="cart-input" value="4532 8912 3456 8912" />
                    </div>
                    <div class="form-row-dual">
                      <div class="form-group"><label>Expiry</label><input type="text" class="cart-input" value="08/29" /></div>
                      <div class="form-group"><label>CVV</label><input type="password" class="cart-input" value="888" /></div>
                    </div>
                  ` : (this.selectedPaymentMethod === 'upi' ? `
                    <div class="form-group">
                      <label>UPI ID (GPay / PhonePe / Paytm / BHIM)</label>
                      <input type="text" class="cart-input" value="helmeevents@okicici" />
                    </div>
                    <p class="upi-hint">Instant 1-click verification & authorization via UPI App.</p>
                  ` : `
                    <div class="form-group">
                      <label>B2B Corporate PO Number</label>
                      <input type="text" class="cart-input" value="PO-2026-${this.selectedCountry}-091" />
                    </div>
                    <div class="form-group">
                      <label>Tax ID / GSTIN / VAT Number</label>
                      <input type="text" class="cart-input" value="${this.taxId}" />
                    </div>
                  `)}
                </div>

                <div class="checkout-summary-box">
                  <div class="summary-line"><span>Equipment Subtotal:</span><strong>${calc.symbol}${calc.subtotal.toLocaleString()}</strong></div>
                  <div class="summary-line"><span>${calc.cInfo.taxName}:</span><strong>${calc.symbol}${calc.tax.toLocaleString()}</strong></div>
                  <div class="summary-line highlight-line"><span>Grand Total:</span><strong class="total-val">${calc.symbol}${calc.grandTotal.toLocaleString()}</strong></div>
                  <div class="summary-line deposit-line"><span>30% Booking Advance:</span><strong class="deposit-val">${calc.symbol}${calc.deposit.toLocaleString()}</strong></div>
                </div>

                <button class="btn-pay-now" id="btnExecutePayment" ${this.isProcessing ? 'disabled' : ''}>
                  ${this.isProcessing ? '⏳ Authorizing Secure Payment...' : `🔒 Pay ${calc.symbol}${calc.deposit.toLocaleString()} Advance Deposit & Reserve Setup`}
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('#btnCloseCartModal');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }

    const countrySelect = this.container.querySelector('#cartCountrySelect');
    if (countrySelect) {
      countrySelect.addEventListener('change', (e) => {
        this.selectedCountry = e.target.value;
        const cInfo = this.countryData[this.selectedCountry];
        if (cInfo && cInfo.states.length > 0) {
          this.selectedState = cInfo.states[0];
        }
        this.render();
      });
    }

    const stateSelect = this.container.querySelector('#cartStateSelect');
    if (stateSelect) {
      stateSelect.addEventListener('change', (e) => {
        this.selectedState = e.target.value;
      });
    }

    const payMethodBtns = this.container.querySelectorAll('.pay-method-btn');
    payMethodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedPaymentMethod = btn.getAttribute('data-method');
        this.render();
      });
    });

    const payBtn = this.container.querySelector('#btnExecutePayment');
    if (payBtn) {
      payBtn.addEventListener('click', () => {
        this.isProcessing = true;
        this.render();

        setTimeout(() => {
          this.isProcessing = false;
          this.isPaid = true;
          this.render();

          confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 } });
        }, 1500);
      });
    }

    const tourBtn = this.container.querySelector('#btnWatchSetupProgress');
    if (tourBtn) {
      tourBtn.addEventListener('click', () => {
        this.close();
        if (this.onPaymentSuccess) {
          this.onPaymentSuccess();
        }
      });
    }
  }
}
