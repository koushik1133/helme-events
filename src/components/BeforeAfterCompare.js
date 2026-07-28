import { VENUE_ZONES } from '../data/zones.js';

export class BeforeAfterCompare {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.zone = VENUE_ZONES[0];
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.container.style.display = 'none';
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="compare-backdrop"></div>
      <div class="modal-content compare-modal" style="width: 80%; height: 80%; max-width: 1000px; padding: 20px; background: white; border-radius: 8px; position: fixed; top: 10%; left: 10%; z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.2); display: flex; flex-direction: column;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>📸 Before/After Split Comparison</h2>
          <select id="compare-zone-select" style="padding: 5px; font-size: 16px;">
            ${VENUE_ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('')}
          </select>
          <button id="compare-close-btn" class="btn-icon" style="font-size: 1.5em; border:none; background:none; cursor:pointer;">&times;</button>
        </div>
        
        <div class="compare-container" style="position: relative; flex: 1; overflow: hidden; border-radius: 8px; background: #000;">
          <!-- After Image (Bottom Layer) -->
          <img id="compare-after-img" src="${this.zone.panoramaUrl}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover;" />
          <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.6); color: white; padding: 5px 10px; border-radius: 4px;">After (Proposed)</div>
          
          <!-- Before Image (Top Layer, Clipped) -->
          <div id="compare-before-wrapper" style="position: absolute; top: 0; left: 0; width: 50%; height: 100%; overflow: hidden;">
            <img id="compare-before-img" src="${this.zone.panoramaUrl}" style="position: absolute; top: 0; left: 0; width: 100vw; max-width: 1000px; height: 100%; object-fit: cover; filter: grayscale(100%);" />
            <div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.6); color: white; padding: 5px 10px; border-radius: 4px;">Before (Empty)</div>
          </div>
          
          <!-- Draggable Divider -->
          <div id="compare-divider" style="position: absolute; top: 0; left: 50%; bottom: 0; width: 4px; background: white; cursor: ew-resize; transform: translateX(-50%); box-shadow: 0 0 5px rgba(0,0,0,0.5);">
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 30px; height: 30px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">
              <span style="font-size: 12px;">&lt;&gt;</span>
            </div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    this.container.querySelector('#compare-close-btn').addEventListener('click', () => this.close());
    this.container.querySelector('#compare-backdrop').addEventListener('click', () => this.close());

    this.container.querySelector('#compare-zone-select').addEventListener('change', (e) => {
      this.zone = VENUE_ZONES.find(z => z.id === e.target.value);
      this.container.querySelector('#compare-after-img').src = this.zone.panoramaUrl;
      this.container.querySelector('#compare-before-img').src = this.zone.panoramaUrl;
    });

    const divider = this.container.querySelector('#compare-divider');
    const beforeWrapper = this.container.querySelector('#compare-before-wrapper');
    const container = this.container.querySelector('.compare-container');
    let isDragging = false;

    divider.addEventListener('mousedown', (e) => {
      isDragging = true;
      e.preventDefault();
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = container.getBoundingClientRect();
      let x = e.clientX - rect.left;
      x = Math.max(0, Math.min(x, rect.width)); // clamp
      
      const percent = (x / rect.width) * 100;
      divider.style.left = `${percent}%`;
      beforeWrapper.style.width = `${percent}%`;
    });
  }
}
