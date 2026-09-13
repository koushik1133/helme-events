import { injectStudioStyles, ICONS } from './studioStyles.js';
import { escapeHtml } from '../../utils/format.js';

/**
 * The whole of the Studio chrome in view mode: back, the zone name, one
 * primary `Edit` action and a single `⋯` overflow. Four targets, not 33.
 *
 *   const bar = new StudioModeBar(shellEl, {
 *     onBack, onEdit, onMenu: [{ id, label, onSelect }]
 *   });
 *   bar.setZone(zone);
 *   bar.setMode('edit' | 'view');
 *   bar.focusEditButton();
 */
export class StudioModeBar {
  constructor(container, options = {}) {
    injectStudioStyles();
    this.container = container;
    this.onBack = options.onBack || null;
    this.onEdit = options.onEdit || (() => {});
    this.menuItems = Array.isArray(options.onMenu) ? options.onMenu : [];
    this.mode = 'view';
    this.zone = null;

    this.el = document.createElement('header');
    this.el.className = 'studio-modebar';
    this.el.innerHTML = this._template();
    this.container.appendChild(this.el);

    this._onClick = this._handleClick.bind(this);
    this._onDocClick = e => {
      if (!this.el.contains(e.target)) this._setMenu(false);
    };
    this._onKeydown = e => { if (e.key === 'Escape') this._setMenu(false); };
    this.el.addEventListener('click', this._onClick);
    document.addEventListener('click', this._onDocClick, true);
    this.el.addEventListener('keydown', this._onKeydown);
  }

  _template() {
    return `
      ${this.onBack ? `<button type="button" class="studio-btn studio-btn--glass studio-btn--icon" data-act="back" aria-label="Back to the venue map">${ICONS.back}</button>` : ''}
      <div class="studio-modebar__id">
        <h1 class="studio-modebar__name" data-el="name"></h1>
        <p class="studio-modebar__sub" data-el="sub"></p>
      </div>
      <div class="studio-modebar__spacer"></div>
      <button type="button" class="studio-btn studio-btn--accent" data-act="edit" data-el="edit" aria-pressed="false">${ICONS.edit}<span data-el="editlabel">Edit</span></button>
      ${this.menuItems.length ? `
      <div class="studio-modebar__overflow">
        <button type="button" class="studio-btn studio-btn--glass studio-btn--icon" data-act="menu" aria-haspopup="menu" aria-expanded="false" aria-label="More studio actions">${ICONS.more}</button>
        <div class="studio-menu" role="menu" data-el="menu" hidden>
          ${this.menuItems.map((m, i) => `<button type="button" role="menuitem" class="studio-menu__item" data-act="menuitem" data-idx="${i}">${escapeHtml(m.label)}</button>`).join('')}
        </div>
      </div>` : ''}
    `;
  }

  setZone(zone) {
    this.zone = zone || null;
    const name = this.el.querySelector('[data-el="name"]');
    const sub = this.el.querySelector('[data-el="sub"]');
    name.textContent = zone?.name ? String(zone.name).replace(/^[^\p{L}\p{N}]+/u, '') : 'Design Studio';
    sub.textContent = zone?.subtitle || '';
    sub.hidden = !zone?.subtitle;
  }

  /** 'view' keeps Edit as the single primary action; 'edit' shows it pressed. */
  setMode(mode) {
    this.mode = mode === 'edit' ? 'edit' : 'view';
    const btn = this.el.querySelector('[data-el="edit"]');
    btn.setAttribute('aria-pressed', String(this.mode === 'edit'));
    this.el.querySelector('[data-el="editlabel"]').textContent = this.mode === 'edit' ? 'Editing' : 'Edit';
  }

  focusEditButton() { this.el.querySelector('[data-el="edit"]')?.focus(); }

  _setMenu(open) {
    const menu = this.el.querySelector('[data-el="menu"]');
    const trigger = this.el.querySelector('[data-act="menu"]');
    if (!menu) return;
    menu.hidden = !open;
    trigger?.setAttribute('aria-expanded', String(open));
    if (open) menu.querySelector('.studio-menu__item')?.focus();
  }

  _handleClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'back') { this._setMenu(false); this.onBack?.(); }
    else if (act === 'edit') { this._setMenu(false); this.onEdit(); }
    else if (act === 'menu') { this._setMenu(this.el.querySelector('[data-el="menu"]').hidden); }
    else if (act === 'menuitem') {
      const item = this.menuItems[Number(btn.dataset.idx)];
      this._setMenu(false);
      item?.onSelect?.();
    }
  }

  destroy() {
    document.removeEventListener('click', this._onDocClick, true);
    this.el.remove();
  }
}
