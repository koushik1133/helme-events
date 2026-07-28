import { STYLE_PRESETS } from '../data/styles.js';

export class StyleLibrary {
  constructor(containerElement, activeSelections, onApplyStyle) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onApplyStyle = onApplyStyle;
    this.previousSelections = null;
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
      <div class="modal-backdrop" id="style-lib-backdrop"></div>
      <div class="modal-content style-lib-modal" style="width: 80%; max-width: 900px; max-height: 80vh; overflow-y: auto; padding: 20px; background: white; border-radius: 8px; position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2>💐 Floral & Decor Style Library</h2>
          <div>
            ${this.previousSelections ? `<button id="style-undo-btn" class="btn-secondary" style="margin-right: 10px;">↩️ Undo Apply</button>` : ''}
            <button id="style-lib-close-btn" class="btn-icon" style="font-size: 1.5em; border:none; background:none; cursor:pointer;">&times;</button>
          </div>
        </div>

        <div class="style-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">
          ${STYLE_PRESETS.map(preset => this.renderPresetCard(preset)).join('')}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderPresetCard(preset) {
    return `
      <div class="style-card" data-id="${preset.id}" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;">
        <div style="font-size: 3em; text-align: center; margin-bottom: 10px;">${preset.emoji}</div>
        <h3 style="margin: 0 0 10px 0; text-align: center;">${preset.name}</h3>
        <p style="font-size: 0.9em; color: #666; text-align: center; min-height: 40px;">${preset.description}</p>
        
        <div style="display: flex; height: 10px; margin-bottom: 15px; border-radius: 5px; overflow: hidden;">
          <div style="flex: 2; background: ${preset.colorPalette.primary};"></div>
          <div style="flex: 1; background: ${preset.colorPalette.secondary};"></div>
          <div style="flex: 1; background: ${preset.colorPalette.accent};"></div>
        </div>

        <button class="btn-primary style-apply-btn" data-id="${preset.id}" style="width: 100%;">Apply Style</button>
      </div>
    `;
  }

  bindEvents() {
    this.container.querySelector('#style-lib-close-btn').addEventListener('click', () => this.close());
    this.container.querySelector('#style-lib-backdrop').addEventListener('click', () => this.close());

    const undoBtn = this.container.querySelector('#style-undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => {
        if (this.previousSelections && this.onApplyStyle) {
          this.onApplyStyle(this.previousSelections);
          this.previousSelections = null;
          alert('Reverted to previous selections.');
          this.render();
        }
      });
    }

    this.container.querySelectorAll('.style-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px)';
        card.style.boxShadow = '0 5px 15px rgba(0,0,0,0.1)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'none';
        card.style.boxShadow = 'none';
      });
    });

    this.container.querySelectorAll('.style-apply-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const preset = STYLE_PRESETS.find(p => p.id === id);
        if (preset && this.onApplyStyle) {
          // Save current state for undo
          this.previousSelections = { ...this.activeSelections };
          
          // Call the callback with the new selections to merge
          this.onApplyStyle(preset.selections);
          
          alert(`Applied '${preset.name}' style preset!`);
          this.render(); // Re-render to show undo button
        }
      });
    });
  }
}
