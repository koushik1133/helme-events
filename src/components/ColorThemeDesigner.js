export class ColorThemeDesigner {
  constructor(containerElement) {
    this.container = containerElement;
    const saved = localStorage.getItem('helme_events_palettes');
    this.savedPalettes = saved ? JSON.parse(saved) : [];
    this.currentColors = {
      primary: { h: 0, s: 50, l: 50 },
      secondary: { h: 120, s: 50, l: 50 },
      accent: { h: 240, s: 50, l: 50 }
    };
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.container.style.display = 'none';
  }

  hslToHex(h, s, l) {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = n => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="theme-designer-backdrop"></div>
      <div class="modal-content theme-designer-modal" style="width: 500px; padding: 20px; background: white; border-radius: 8px; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>🎨 Real-Time Color Theme Designer</h2>
          <button id="theme-close-btn" class="btn-icon" style="font-size: 1.5em; border:none; background:none; cursor:pointer;">&times;</button>
        </div>
        
        <div class="theme-preview" style="display: flex; height: 60px; margin-bottom: 20px; border-radius: 8px; overflow: hidden;">
          <div id="preview-primary" style="flex: 2; background: hsl(${this.currentColors.primary.h}, ${this.currentColors.primary.s}%, ${this.currentColors.primary.l}%);"></div>
          <div id="preview-secondary" style="flex: 1; background: hsl(${this.currentColors.secondary.h}, ${this.currentColors.secondary.s}%, ${this.currentColors.secondary.l}%);"></div>
          <div id="preview-accent" style="flex: 1; background: hsl(${this.currentColors.accent.h}, ${this.currentColors.accent.s}%, ${this.currentColors.accent.l}%);"></div>
        </div>

        <div class="color-controls">
          ${this.renderColorControl('Primary', 'primary')}
          ${this.renderColorControl('Secondary', 'secondary')}
          ${this.renderColorControl('Accent', 'accent')}
        </div>

        <div class="preset-palettes" style="margin-top: 20px;">
          <h3>Presets</h3>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="btn-preset" data-preset="blush">🌸 Blush Pink</button>
            <button class="btn-preset" data-preset="ocean">🌊 Ocean Blue</button>
            <button class="btn-preset" data-preset="forest">🌲 Forest Green</button>
            <button class="btn-preset" data-preset="gold">👑 Royal Gold</button>
            <button class="btn-preset" data-preset="lavender">💜 Lavender</button>
          </div>
        </div>

        <div style="margin-top: 25px; display: flex; justify-content: flex-end; gap: 10px;">
          <button id="theme-save-btn" class="btn-secondary">Save to Palettes</button>
          <button id="theme-apply-btn" class="btn-primary">Apply to Venue</button>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderColorControl(label, key) {
    const c = this.currentColors[key];
    return `
      <div class="color-control-group" style="margin-bottom: 15px;">
        <label style="font-weight: bold; display: block; margin-bottom: 5px;">${label} Color</label>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="width: 20px;">H</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="h" min="0" max="360" value="${c.h}" style="flex: 1;">
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="width: 20px;">S</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="s" min="0" max="100" value="${c.s}" style="flex: 1;">
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
          <span style="width: 20px;">L</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="l" min="0" max="100" value="${c.l}" style="flex: 1;">
        </div>
      </div>
    `;
  }

  updatePreview() {
    this.container.querySelector('#preview-primary').style.background = `hsl(${this.currentColors.primary.h}, ${this.currentColors.primary.s}%, ${this.currentColors.primary.l}%)`;
    this.container.querySelector('#preview-secondary').style.background = `hsl(${this.currentColors.secondary.h}, ${this.currentColors.secondary.s}%, ${this.currentColors.secondary.l}%)`;
    this.container.querySelector('#preview-accent').style.background = `hsl(${this.currentColors.accent.h}, ${this.currentColors.accent.s}%, ${this.currentColors.accent.l}%)`;
  }

  bindEvents() {
    this.container.querySelector('#theme-close-btn').addEventListener('click', () => this.close());
    this.container.querySelector('#theme-designer-backdrop').addEventListener('click', () => this.close());

    this.container.querySelectorAll('.theme-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const key = e.target.dataset.key;
        const prop = e.target.dataset.prop;
        this.currentColors[key][prop] = parseInt(e.target.value, 10);
        this.updatePreview();
      });
    });

    const presets = {
      blush: { primary: {h:350, s:100, l:88}, secondary: {h:340, s:60, l:70}, accent: {h:0, s:0, l:40} },
      ocean: { primary: {h:200, s:80, l:40}, secondary: {h:180, s:60, l:60}, accent: {h:40, s:100, l:70} },
      forest: { primary: {h:120, s:40, l:30}, secondary: {h:90, s:30, l:50}, accent: {h:30, s:60, l:70} },
      gold: { primary: {h:45, s:100, l:50}, secondary: {h:30, s:80, l:40}, accent: {h:0, s:100, l:30} },
      lavender: { primary: {h:270, s:60, l:70}, secondary: {h:300, s:40, l:80}, accent: {h:220, s:50, l:60} }
    };

    this.container.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const p = presets[e.target.dataset.preset];
        if (p) {
          this.currentColors = JSON.parse(JSON.stringify(p));
          this.render(); // Re-render to update sliders
        }
      });
    });

    this.container.querySelector('#theme-apply-btn').addEventListener('click', () => {
      const pHex = this.hslToHex(this.currentColors.primary.h, this.currentColors.primary.s, this.currentColors.primary.l);
      const sHex = this.hslToHex(this.currentColors.secondary.h, this.currentColors.secondary.s, this.currentColors.secondary.l);
      const aHex = this.hslToHex(this.currentColors.accent.h, this.currentColors.accent.s, this.currentColors.accent.l);
      
      document.documentElement.style.setProperty('--theme-primary', pHex);
      document.documentElement.style.setProperty('--theme-secondary', sHex);
      document.documentElement.style.setProperty('--theme-accent', aHex);
      
      alert('Theme applied to venue!');
      this.close();
    });

    this.container.querySelector('#theme-save-btn').addEventListener('click', () => {
      this.savedPalettes.push(JSON.parse(JSON.stringify(this.currentColors)));
      localStorage.setItem('helme_events_palettes', JSON.stringify(this.savedPalettes));
      alert('Palette saved!');
    });
  }
}
