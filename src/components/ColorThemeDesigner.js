export class ColorThemeDesigner {
  constructor(containerElement, onApplied = null) {
    this.container = containerElement;
    this.onApplied = onApplied;
    const saved = localStorage.getItem('helme_events_palettes');
    this.savedPalettes = saved ? JSON.parse(saved) : [];
    this.currentColors = {
      primary: { h: 45, s: 90, l: 48 },
      secondary: { h: 30, s: 70, l: 36 },
      accent: { h: 210, s: 85, l: 52 }
    };
  }

  open() {
    this.container.style.display = 'block';
    this.container.style.zIndex = '8000';
    this.render();
  }

  close() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
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
      <div class="modal-backdrop" id="theme-designer-backdrop" style="position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:7999;"></div>
      <div class="modal-content theme-designer-modal" style="width:min(520px,92vw);padding:22px;background:var(--bg-surface);color:var(--text-main);border:1px solid var(--border-subtle);border-radius:16px;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:8000;box-shadow:0 20px 50px rgba(0,0,0,0.35);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
          <h2 style="margin:0;color:var(--text-main);font-size:1.15rem;">🎨 Real-Time Color Theme Designer</h2>
          <button id="theme-close-btn" class="btn-icon" style="font-size:1.5em;border:none;background:transparent;cursor:pointer;color:var(--text-main);">&times;</button>
        </div>

        <div class="theme-preview" style="display:flex;height:60px;margin-bottom:18px;border-radius:10px;overflow:hidden;border:1px solid var(--border-subtle);">
          <div id="preview-primary" style="flex:2;background:hsl(${this.currentColors.primary.h}, ${this.currentColors.primary.s}%, ${this.currentColors.primary.l}%);"></div>
          <div id="preview-secondary" style="flex:1;background:hsl(${this.currentColors.secondary.h}, ${this.currentColors.secondary.s}%, ${this.currentColors.secondary.l}%);"></div>
          <div id="preview-accent" style="flex:1;background:hsl(${this.currentColors.accent.h}, ${this.currentColors.accent.s}%, ${this.currentColors.accent.l}%);"></div>
        </div>

        <div class="color-controls">
          ${this.renderColorControl('Primary', 'primary')}
          ${this.renderColorControl('Secondary', 'secondary')}
          ${this.renderColorControl('Accent', 'accent')}
        </div>

        <div class="preset-palettes" style="margin-top:18px;">
          <h3 style="margin:0 0 10px;color:var(--text-main);font-size:0.95rem;">Presets</h3>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button class="btn-preset" data-preset="blush" type="button">🌸 Blush Pink</button>
            <button class="btn-preset" data-preset="ocean" type="button">🌊 Ocean Blue</button>
            <button class="btn-preset" data-preset="forest" type="button">🌲 Forest Green</button>
            <button class="btn-preset" data-preset="gold" type="button">👑 Royal Gold</button>
            <button class="btn-preset" data-preset="lavender" type="button">💜 Lavender</button>
          </div>
        </div>

        <div style="margin-top:22px;display:flex;justify-content:flex-end;gap:10px;">
          <button id="theme-save-btn" class="btn-secondary" type="button">Save to Palettes</button>
          <button id="theme-apply-btn" class="btn-primary" type="button">Apply to Venue</button>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderColorControl(label, key) {
    const c = this.currentColors[key];
    return `
      <div class="color-control-group" style="margin-bottom:14px;color:var(--text-main);">
        <label style="font-weight:700;display:block;margin-bottom:6px;color:var(--text-main);">${label} Color</label>
        <div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);">
          <span style="width:20px;">H</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="h" min="0" max="360" value="${c.h}" style="flex:1;">
        </div>
        <div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);">
          <span style="width:20px;">S</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="s" min="0" max="100" value="${c.s}" style="flex:1;">
        </div>
        <div style="display:flex;gap:10px;align-items:center;color:var(--text-muted);">
          <span style="width:20px;">L</span>
          <input type="range" class="theme-slider" data-key="${key}" data-prop="l" min="0" max="100" value="${c.l}" style="flex:1;">
        </div>
      </div>
    `;
  }

  updatePreview() {
    this.container.querySelector('#preview-primary').style.background = `hsl(${this.currentColors.primary.h}, ${this.currentColors.primary.s}%, ${this.currentColors.primary.l}%)`;
    this.container.querySelector('#preview-secondary').style.background = `hsl(${this.currentColors.secondary.h}, ${this.currentColors.secondary.s}%, ${this.currentColors.secondary.l}%)`;
    this.container.querySelector('#preview-accent').style.background = `hsl(${this.currentColors.accent.h}, ${this.currentColors.accent.s}%, ${this.currentColors.accent.l}%)`;
  }

  applyToDocument() {
    const pHex = this.hslToHex(this.currentColors.primary.h, this.currentColors.primary.s, this.currentColors.primary.l);
    const sHex = this.hslToHex(this.currentColors.secondary.h, this.currentColors.secondary.s, this.currentColors.secondary.l);
    const aHex = this.hslToHex(this.currentColors.accent.h, this.currentColors.accent.s, this.currentColors.accent.l);

    const root = document.documentElement;
    root.style.setProperty('--theme-primary', pHex);
    root.style.setProperty('--theme-secondary', sHex);
    root.style.setProperty('--theme-accent', aHex);
    // Wire into real UI tokens used across the app
    root.style.setProperty('--accent-indigo', aHex);
    root.style.setProperty('--btn-primary-bg', pHex);
    root.style.setProperty('--btn-primary-hover', sHex);
    root.style.setProperty('--gold-accent', pHex);
    root.style.setProperty('--border-strong', sHex);

    localStorage.setItem('helme_events_active_palette', JSON.stringify({
      primary: pHex, secondary: sHex, accent: aHex, hsl: this.currentColors
    }));

    return { primary: pHex, secondary: sHex, accent: aHex };
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
      blush: { primary: { h: 350, s: 85, l: 62 }, secondary: { h: 340, s: 55, l: 48 }, accent: { h: 0, s: 0, l: 35 } },
      ocean: { primary: { h: 200, s: 80, l: 42 }, secondary: { h: 180, s: 60, l: 38 }, accent: { h: 40, s: 90, l: 55 } },
      forest: { primary: { h: 140, s: 45, l: 32 }, secondary: { h: 90, s: 35, l: 40 }, accent: { h: 30, s: 70, l: 55 } },
      gold: { primary: { h: 45, s: 95, l: 48 }, secondary: { h: 30, s: 80, l: 36 }, accent: { h: 210, s: 80, l: 48 } },
      lavender: { primary: { h: 270, s: 55, l: 58 }, secondary: { h: 300, s: 40, l: 48 }, accent: { h: 220, s: 55, l: 52 } }
    };

    this.container.querySelectorAll('.btn-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = e.currentTarget.dataset.preset;
        const p = presets[key];
        if (p) {
          this.currentColors = JSON.parse(JSON.stringify(p));
          this.render();
        }
      });
    });

    this.container.querySelector('#theme-apply-btn').addEventListener('click', () => {
      const colors = this.applyToDocument();
      if (this.onApplied) this.onApplied(colors);
      this.close();
    });

    this.container.querySelector('#theme-save-btn').addEventListener('click', () => {
      this.savedPalettes.push(JSON.parse(JSON.stringify(this.currentColors)));
      localStorage.setItem('helme_events_palettes', JSON.stringify(this.savedPalettes));
      if (this.onApplied) this.onApplied({ saved: true });
    });
  }
}
