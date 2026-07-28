import { VENUE_ZONES } from '../data/zones.js';

export class EventBriefGenerator {
  constructor(containerElement, activeSelections, onApply) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply;
    this.step = 1;
    this.formData = {};
  }

  open() {
    this.step = 1;
    this.formData = {};
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  generateBrief() {
    const recommended = {};
    VENUE_ZONES.forEach(z => {
      z.slots.forEach(s => {
        recommended[s.id] = { itemId: s.defaultItemId, quantity: s.quantity };
      });
    });
    this.recommended = recommended;
    
    return `
      <div style="font-family: serif; color: #333; line-height: 1.6;">
        <h2 style="border-bottom: 2px solid #2563eb; padding-bottom: 10px; color: #1e40af;">Event Brief & Executive Summary</h2>
        <p>We are proposing a grand <strong>${this.formData.theme}</strong>-themed <strong>${this.formData.eventType}</strong> designed for an estimated <strong>${this.formData.guests}</strong> guests, perfectly optimized for a budget range of <strong>${this.formData.budget}</strong>.</p>
        
        <h3 style="color: #1e40af; margin-top: 20px;">Recommended Layout</h3>
        <p>The event will flow across ${VENUE_ZONES.length} key premium zones to provide a dynamic guest experience.</p>
        <ul style="padding-left: 20px;">
          ${VENUE_ZONES.map(z => `<li><strong>${z.name}</strong> - ${z.subtitle}</li>`).join('')}
        </ul>
        
        <h3 style="color: #1e40af; margin-top: 20px;">Estimated Timeline</h3>
        <ul style="padding-left: 20px;">
          <li>08:00 AM - Vendor access & Setup commences</li>
          <li>02:00 PM - Setup completion & final walk-through</li>
          <li>05:00 PM - Guest Arrival & Welcome Drinks</li>
          <li>07:00 PM - Main Event & Performances</li>
          <li>09:00 PM - Dinner Service</li>
        </ul>
        
        <h3 style="color: #1e40af; margin-top: 20px;">Special Requirements</h3>
        <p style="background: #f8fafc; padding: 10px; border-left: 4px solid #2563eb;">${this.formData.special || 'No special requirements noted during brief generation.'}</p>
      </div>
    `;
  }

  render() {
    let content = '';
    if (this.step === 1) {
      content = `
        <h3 style="margin-bottom: 15px;">Step 1: Event Type</h3>
        <select id="b-type" style="width: 100%; padding: 10px; font-size: 16px;">
          <option>Wedding</option><option>Corporate</option><option>Rally</option><option>Summit</option><option>Birthday</option><option>Anniversary</option>
        </select>
      `;
    } else if (this.step === 2) {
      content = `
        <h3 style="margin-bottom: 15px;">Step 2: Guest Count</h3>
        <input type="number" id="b-guests" min="50" max="5000" value="200" style="width: 100%; padding: 10px; font-size: 16px;" />
      `;
    } else if (this.step === 3) {
      content = `
        <h3 style="margin-bottom: 15px;">Step 3: Budget Range</h3>
        <select id="b-budget" style="width: 100%; padding: 10px; font-size: 16px;">
          <option>Under ₹5L</option><option>₹5-15L</option><option>₹15-50L</option><option>₹50L+</option>
        </select>
      `;
    } else if (this.step === 4) {
      content = `
        <h3 style="margin-bottom: 15px;">Step 4: Theme Preference</h3>
        <select id="b-theme" style="width: 100%; padding: 10px; font-size: 16px;">
          <option>Royal</option><option>Modern</option><option>Rustic</option><option>Traditional</option><option>Futuristic</option>
        </select>
      `;
    } else if (this.step === 5) {
      content = `
        <h3 style="margin-bottom: 15px;">Step 5: Special Requirements</h3>
        <textarea id="b-special" placeholder="Any specific needs (e.g. dietary restrictions, specific colors)..." style="width: 100%; padding: 10px; font-size: 16px; height: 100px; resize: vertical;"></textarea>
      `;
    } else if (this.step === 6) {
      content = `
        <div class="generated-brief" id="brief-content" style="max-height: 400px; overflow-y: auto; padding: 20px; background: #fff; border: 1px solid #ccc; border-radius: 8px;">
          ${this.generateBrief()}
        </div>
      `;
    }

    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content brief-modal" style="max-width: 600px; width: 100%;">
          <div class="modal-header" style="border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px;">
            <h2 style="margin: 0;">📝 AI Event Brief Generator</h2>
            <button class="btn-close">&times;</button>
          </div>
          <div class="modal-body brief-body">
            ${content}
          </div>
          <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #eee; padding-top: 15px;">
            ${this.step > 1 && this.step < 6 ? `<button class="btn-back" style="padding: 8px 16px; background: #94a3b8; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Back</button>` : ''}
            ${this.step < 5 ? `<button class="btn-next" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Next</button>` : ''}
            ${this.step === 5 ? `<button class="btn-generate" style="padding: 8px 16px; background: #16a34a; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Generate Brief</button>` : ''}
            ${this.step === 6 ? `
              <button class="btn-print" style="padding: 8px 16px; background: #475569; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Print Brief</button>
              <button class="btn-apply-rec" style="padding: 8px 16px; background: #16a34a; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Apply Recommendations</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  saveStepData() {
    if (this.step === 1) this.formData.eventType = this.container.querySelector('#b-type').value;
    if (this.step === 2) this.formData.guests = this.container.querySelector('#b-guests').value;
    if (this.step === 3) this.formData.budget = this.container.querySelector('#b-budget').value;
    if (this.step === 4) this.formData.theme = this.container.querySelector('#b-theme').value;
    if (this.step === 5) this.formData.special = this.container.querySelector('#b-special').value;
  }

  bindEvents() {
    this.container.querySelector('.btn-close').addEventListener('click', () => this.close());
    
    const overlay = this.container.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }
    
    const nextBtn = this.container.querySelector('.btn-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.saveStepData();
        this.step++;
        this.render();
      });
    }

    const backBtn = this.container.querySelector('.btn-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.step--;
        this.render();
      });
    }

    const genBtn = this.container.querySelector('.btn-generate');
    if (genBtn) {
      genBtn.addEventListener('click', () => {
        this.saveStepData();
        this.step++;
        this.render();
      });
    }

    const printBtn = this.container.querySelector('.btn-print');
    if (printBtn) {
      printBtn.addEventListener('click', () => {
        const printContents = this.container.querySelector('#brief-content').innerHTML;
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
      });
    }

    const applyBtn = this.container.querySelector('.btn-apply-rec');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.onApply && this.recommended) {
          this.onApply(this.recommended);
        }
        this.close();
      });
    }
  }
}
