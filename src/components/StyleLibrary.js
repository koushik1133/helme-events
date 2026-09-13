import { STYLE_PRESETS } from '../data/styles.js';
import { getItemById } from '../data/catalog.js';
import { escapeHtml } from '../utils/format.js';

export class StyleLibrary {
  constructor(containerElement, activeSelections, onApplyStyle) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onApplyStyle = onApplyStyle;
    this.previousSelections = null;
    this.statusMessage = '';
    this._bound = false;
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
      <div class="modal-content style-lib-modal" role="dialog" aria-modal="true" aria-labelledby="style-lib-title"
        style="width: 80%; max-width: 900px; max-height: 80vh; overflow-y: auto; padding: 20px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: 8px; position: fixed; top: 10vh; left: 50%; transform: translateX(-50%); z-index: 1000; box-shadow: 0 4px 20px rgba(0,0,0,0.35);">

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; gap: 12px;">
          <h2 id="style-lib-title" style="margin:0;">💐 Floral &amp; Decor Style Library</h2>
          <div style="display:flex; align-items:center; gap:10px;">
            ${this.previousSelections ? `<button type="button" id="style-undo-btn" class="btn-secondary">↩️ Undo Apply</button>` : ''}
            <button type="button" id="style-lib-close-btn" class="btn-icon" aria-label="Close style library" style="font-size: 1.5em; border:none; background:none; color: var(--text-muted); cursor:pointer;">&times;</button>
          </div>
        </div>

        <p style="margin:0 0 6px; font-size:12px; color:var(--text-muted);">
          Each preset is a complete build — it re-dresses all 25 slots across all 8 zones.
        </p>
        <div id="style-status" role="status" style="min-height:16px; font-size:12px; color:var(--text-muted); margin-bottom:14px;">${escapeHtml(this.statusMessage)}</div>

        <div class="style-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px;">
          ${STYLE_PRESETS.map(preset => this.renderPresetCard(preset)).join('')}
        </div>
      </div>
    `;
    this.bindEvents();
  }

  /** A few named pieces so the card shows what the preset actually does. */
  highlights(preset) {
    const ids = ['slot-function-mandap', 'slot-banquet-chairs', 'slot-banquet-lighting'];
    return ids
      .map(slotId => getItemById(preset.selections[slotId])?.name)
      .filter(Boolean)
      .slice(0, 3);
  }

  renderPresetCard(preset) {
    const slotCount = Object.keys(preset.selections).length;
    const highlights = this.highlights(preset);
    return `
      <div class="style-card" data-id="${escapeHtml(preset.id)}" style="border: 1px solid var(--border-subtle); background: var(--bg-elevated); border-radius: 8px; padding: 15px; transition: transform 0.2s, box-shadow 0.2s;">
        <div style="font-size: 3em; text-align: center; margin-bottom: 10px;" aria-hidden="true">${preset.emoji}</div>
        <h3 style="margin: 0 0 10px 0; text-align: center; color: var(--text-main);">${escapeHtml(preset.name)}</h3>
        <p style="font-size: 0.9em; color: var(--text-muted); text-align: center; min-height: 48px;">${escapeHtml(preset.description)}</p>

        <div style="display: flex; height: 10px; margin-bottom: 10px; border-radius: 5px; overflow: hidden;" aria-hidden="true">
          <div style="flex: 2; background: ${preset.colorPalette.primary};"></div>
          <div style="flex: 1; background: ${preset.colorPalette.secondary};"></div>
          <div style="flex: 1; background: ${preset.colorPalette.accent};"></div>
        </div>

        <ul style="margin:0 0 12px; padding-left:16px; font-size:11px; color:var(--text-muted); line-height:1.5;">
          ${highlights.map(name => `<li>${escapeHtml(name)}</li>`).join('')}
          <li>Covers ${slotCount} slots across 8 zones</li>
        </ul>

        <button type="button" class="btn-primary style-apply-btn" data-id="${escapeHtml(preset.id)}"
          aria-label="Apply the ${escapeHtml(preset.name)} style to the whole venue" style="width: 100%;">Apply Style</button>
      </div>
    `;
  }

  setStatus(message) {
    this.statusMessage = message;
    const el = this.container.querySelector('#style-status');
    if (el) el.textContent = message;
  }

  bindEvents() {
    // Hover polish is bound to freshly rendered nodes each time; the delegated
    // click handler below is bound once against the persistent container.
    this.container.querySelectorAll('.style-card').forEach(card => {
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-5px)';
        card.style.boxShadow = '0 5px 15px rgba(0,0,0,0.25)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = 'none';
        card.style.boxShadow = 'none';
      });
    });

    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const target = e.target;

      if (target.id === 'style-lib-close-btn' || target.id === 'style-lib-backdrop') {
        this.close();
        return;
      }

      if (target.id === 'style-undo-btn') {
        if (this.previousSelections && this.onApplyStyle) {
          this.onApplyStyle(this.previousSelections);
          this.previousSelections = null;
          this.statusMessage = 'Reverted to your previous selections.';
          this.render();
        }
        return;
      }

      if (target.classList.contains('style-apply-btn')) {
        const preset = STYLE_PRESETS.find(p => p.id === target.dataset.id);
        if (!preset || !this.onApplyStyle) return;

        // Snapshot for undo. Only string values — the state contract.
        this.previousSelections = { ...this.activeSelections };
        this.onApplyStyle({ ...preset.selections });
        this.statusMessage = `Applied “${preset.name}” across all 8 zones. Use Undo Apply to revert.`;
        this.render();
      }
    });
  }
}
