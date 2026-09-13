import { injectStudioStyles, ICONS, STUDIO_PANEL_WIDTH } from './studioStyles.js';
import { getItemById } from '../../data/catalog.js';
import { describeSwapEffect } from '../../data/sceneVariants.js';
import { cutoutFor } from '../../data/propOverlays.js';
import { STYLE_PRESETS } from '../../data/styles.js';
import { formatMoney, escapeHtml } from '../../utils/format.js';
import { MoodBoardMatcher } from '../MoodBoardMatcher.js';
import { BeforeAfterCompare } from '../BeforeAfterCompare.js';

const TABS = [
  { id: 'design', label: 'Design' },
  { id: 'styles', label: 'Styles' },
  { id: 'mood', label: 'Mood' },
  { id: 'compare', label: 'Compare' }
];

/**
 * The Edit-mode side panel.
 *
 * It DOCKS — it never overlays the venue. On open the host container gets
 * `.studio-edit-open` and `--studio-panel-w`, so anything inside it carrying
 * `.studio-canvas` shrinks by exactly the panel's width. Below 768px the dock
 * becomes a bottom sheet and the canvas shrinks vertically instead.
 *
 * Every choice happens INLINE: a slot expands in place to list its options.
 * There is no modal anywhere in this flow — that is the whole point.
 */
export class StudioEditPanel {
  constructor(container, options = {}) {
    injectStudioStyles();
    this.container = container;
    // The SHELL is the element that owns the layout: it gets `.studio-shell`
    // and, in edit mode, `.studio-edit-open`, so the canvas inside it shrinks.
    // Defaults to the container; pass `shell` when the panel is mounted into a
    // dedicated host that sits beside the canvas (the orchestrator's markup).
    this.shell = options.shell || container;
    this.shell.classList.add('studio-shell');

    this.onSelect = options.onSelect || (() => {});
    this.onClose = options.onClose || (() => {});
    this.onFocusSlot = options.onFocusSlot || (() => {});
    this.onApplySelections = options.onApplySelections || null;
    this.panelWidth = Number(options.panelWidth) || STUDIO_PANEL_WIDTH;

    this.zone = null;
    this.selections = {};
    this.expandedSlotId = null;
    this.activeTab = 'design';
    this.isOpen = false;
    this.returnFocusTo = null;
    this.status = '';

    // Folded-in tools, driven HEADLESSLY: both classes render fixed-position
    // modals, which is exactly what the owner complained about, so only their
    // data/analysis methods are used and this panel draws the UI itself.
    this._moodHost = document.createElement('div');
    this.mood = new MoodBoardMatcher(this._moodHost, this.selections, sel => this._applySelections(sel), () => this.zone?.id);
    this._compareHost = document.createElement('div');
    this.compare = new BeforeAfterCompare(this._compareHost, this.selections);
    this.compareSplit = 50;
    this._styleUndo = null;

    this.el = document.createElement('aside');
    this.el.className = 'studio-panel';
    this.el.setAttribute('role', 'region');
    this.el.setAttribute('aria-label', 'Edit this zone');
    this.el.hidden = true;
    this.el.dataset.open = 'false';
    this.el.innerHTML = `
      <div class="studio-panel__head">
        <div>
          <h2 class="studio-panel__title" data-el="title">Edit</h2>
          <p class="studio-panel__sub" data-el="sub"></p>
        </div>
        <button type="button" class="studio-btn studio-btn--quiet studio-btn--icon" data-act="close-x" aria-label="Close edit mode">${ICONS.close}</button>
      </div>
      <div class="studio-tabs" role="tablist" aria-label="Edit tools" data-el="tabs">
        ${TABS.map(t => `<button type="button" class="studio-tab" role="tab" id="studio-tab-${t.id}" aria-controls="studio-tabpanel" data-tab="${t.id}" aria-selected="${t.id === 'design'}" tabindex="${t.id === 'design' ? '0' : '-1'}">${escapeHtml(t.label)}</button>`).join('')}
      </div>
      <div class="studio-panel__body" id="studio-tabpanel" role="tabpanel" tabindex="-1" data-el="body"></div>
      <div class="studio-panel__foot">
        <div class="studio-panel__total">This zone<strong data-el="total">—</strong></div>
        <button type="button" class="studio-btn studio-btn--accent" data-act="done">Done</button>
      </div>
      <p class="studio-sr" role="status" aria-live="polite" data-el="live"></p>
    `;
    this.container.appendChild(this.el);

    this.body = this.el.querySelector('[data-el="body"]');
    this.el.addEventListener('click', e => this._onClick(e));
    this.el.addEventListener('keydown', e => this._onKeydown(e));
    this.el.addEventListener('change', e => this._onChange(e));
    this.el.addEventListener('pointerdown', e => this._onPointerDown(e));
    this._onDocKey = e => {
      if (e.key === 'Escape' && this.isOpen && !e.defaultPrevented) { e.preventDefault(); this.close(); }
    };
  }

  // ------------------------------------------------------------- public API

  /** Enter edit mode. `returnFocusTo` gets focus back on close. */
  open(zone, activeSelections = {}, { returnFocusTo = null } = {}) {
    this.returnFocusTo = returnFocusTo || document.activeElement;
    this.setZone(zone, activeSelections, { silent: true });
    this.isOpen = true;
    this.el.hidden = false;
    if (this.container !== this.shell) this.container.hidden = false;
    this.shell.style.setProperty('--studio-panel-w', `${this.panelWidth}px`);
    this.shell.classList.add('studio-edit-open');
    // Force a reflow so the transform transition actually runs, then dock.
    void this.el.offsetWidth;
    this.el.dataset.open = 'true';
    document.addEventListener('keydown', this._onDocKey);
    this._emitLayout(true);
    this.body.focus({ preventScroll: true });
  }

  /** Collapse back to view mode. */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.dataset.open = 'false';
    this.shell.classList.remove('studio-edit-open');
    document.removeEventListener('keydown', this._onDocKey);
    const hide = () => {
      if (this.isOpen) return;
      this.el.hidden = true;
      if (this.container !== this.shell) this.container.hidden = true;
    };
    setTimeout(hide, 300);
    this._emitLayout(false);
    this.onClose();
    const target = this.returnFocusTo;
    this.returnFocusTo = null;
    if (target && typeof target.focus === 'function') target.focus();
  }

  /** The zone (or the selections) changed underneath the panel. */
  setZone(zone, activeSelections = null, { silent = false } = {}) {
    const zoneChanged = zone?.id !== this.zone?.id;
    this.zone = zone || null;
    if (activeSelections) {
      this.selections = activeSelections;
      this.mood.activeSelections = activeSelections;
      this.compare.activeSelections = activeSelections;
    }
    if (zoneChanged) {
      this.expandedSlotId = null;
      if (this.zone) this.compare.zoneId = this.zone.id;
    }
    this.el.querySelector('[data-el="title"]').textContent = this.zone?.name
      ? String(this.zone.name).replace(/^[^\p{L}\p{N}]+/u, '')
      : 'Edit';
    const sub = this.el.querySelector('[data-el="sub"]');
    const n = this.zone?.slots?.length || 0;
    sub.textContent = n ? `${n} element${n === 1 ? '' : 's'} you can change` : '';
    this.render();
    if (!silent) this._say(`Now editing ${this.zone?.name || 'this zone'}.`);
  }

  /** A hotspot was clicked in the 360 — expand and scroll to that slot. */
  highlightSlot(slotId) {
    if (!slotId) return;
    if (this.activeTab !== 'design') this._setTab('design');
    this.expandedSlotId = slotId;
    this.render();
    const row = this.body.querySelector(`[data-slot="${CSS.escape(slotId)}"]`);
    if (!row) return;
    row.dataset.highlight = 'true';
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    row.querySelector('.studio-slot__btn')?.focus({ preventScroll: true });
    setTimeout(() => { row.dataset.highlight = 'false'; }, 1600);
  }

  destroy() {
    document.removeEventListener('keydown', this._onDocKey);
    this.shell.classList.remove('studio-edit-open', 'studio-shell');
    this.el.remove();
  }

  // --------------------------------------------------------------- helpers

  _emitLayout(open) {
    this.shell.dispatchEvent(new CustomEvent('studio:layout', {
      bubbles: true,
      detail: { open, panelWidth: open ? this.panelWidth : 0 }
    }));
  }

  _say(message) {
    const live = this.el.querySelector('[data-el="live"]');
    if (live) live.textContent = message;
  }

  _itemFor(slot) {
    return getItemById(this.selections[slot.id] || slot.defaultItemId) || null;
  }

  _qtyFor(slot, itemId) {
    return Number(slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1);
  }

  _thumb(item) {
    if (!item) return '';
    return cutoutFor(item.id)?.url || item.imageUrl || '';
  }

  _zoneTotal() {
    if (!this.zone) return 0;
    return this.zone.slots.reduce((sum, slot) => {
      const item = this._itemFor(slot);
      if (!item) return sum;
      return sum + Math.round(item.price * this._qtyFor(slot, item.id));
    }, 0);
  }

  _applySelections(map) {
    // STATE CONTRACT: flat slotId -> itemId strings, same as activeSelections.
    if (this.onApplySelections) this.onApplySelections({ ...map });
    else Object.entries(map).forEach(([slotId, itemId]) => this.onSelect(slotId, itemId));
    Object.assign(this.selections, map);
    this.render();
  }

  // -------------------------------------------------------------- rendering

  render() {
    this.el.querySelector('[data-el="total"]').textContent = formatMoney(this._zoneTotal());
    if (this.activeTab === 'design') this.body.innerHTML = this._renderDesign();
    else if (this.activeTab === 'styles') this.body.innerHTML = this._renderStyles();
    else if (this.activeTab === 'mood') { this.body.innerHTML = this._renderMood(); }
    else this.body.innerHTML = this._renderCompare();
  }

  _renderDesign() {
    const slots = this.zone?.slots || [];
    if (!slots.length) {
      return `<div class="studio-empty">Nothing in this zone is configurable yet.<br>Pick another zone from the venue map.</div>`;
    }
    return `<ul class="studio-slots">${slots.map(slot => this._renderSlot(slot)).join('')}</ul>`;
  }

  _renderSlot(slot) {
    const item = this._itemFor(slot);
    const expanded = this.expandedSlotId === slot.id;
    const qty = this._qtyFor(slot, item?.id);
    const line = item ? `${formatMoney(item.price)}${qty > 1 ? ` × ${qty}` : ''}` : 'Not selected';
    const ids = (slot.allowedItemIds?.length ? slot.allowedItemIds : [slot.defaultItemId]).filter(Boolean);

    return `
      <li class="studio-slot" data-slot="${escapeHtml(slot.id)}" data-expanded="${expanded}" data-highlight="false">
        <button type="button" class="studio-slot__btn" data-act="slot" data-slot-id="${escapeHtml(slot.id)}"
                aria-expanded="${expanded}" aria-controls="opts-${escapeHtml(slot.id)}">
          ${item ? `<img class="studio-thumb" src="${escapeHtml(this._thumb(item))}" alt="" loading="lazy">` : `<span class="studio-thumb"></span>`}
          <span class="studio-slot__text">
            <span class="studio-slot__label">${escapeHtml(slot.label)}</span>
            <span class="studio-slot__item">${escapeHtml(item?.name || '—')}</span>
            <span class="studio-slot__meta">${escapeHtml(line)}</span>
          </span>
          ${ICONS.chevron}
        </button>
        <ul class="studio-options" id="opts-${escapeHtml(slot.id)}" role="radiogroup"
            aria-label="Options for ${escapeHtml(slot.label)}" ${expanded ? '' : 'hidden'}>
          ${ids.map(id => this._renderOption(slot, id)).join('')}
        </ul>
      </li>`;
  }

  _renderOption(slot, itemId) {
    const item = getItemById(itemId);
    if (!item) return '';
    const chosen = (this.selections[slot.id] || slot.defaultItemId) === itemId;
    const qty = this._qtyFor(slot, itemId);
    const effect = describeSwapEffect(this.zone?.id, slot.id, itemId);
    const badge = effect === 'scene'
      ? `<span class="studio-badge studio-badge--scene"><span class="studio-badge__dot"></span>Re-shot 360 plate</span>`
      : `<span class="studio-badge"><span class="studio-badge__dot"></span>Composited layer</span>`;
    return `
      <li>
        <button type="button" class="studio-option" role="radio" aria-checked="${chosen}"
                tabindex="${chosen ? '0' : '-1'}"
                data-act="option" data-slot-id="${escapeHtml(slot.id)}" data-item-id="${escapeHtml(itemId)}">
          <img class="studio-option__thumb" src="${escapeHtml(this._thumb(item))}" alt="" loading="lazy">
          <span class="studio-option__text">
            <span class="studio-option__name">${escapeHtml(item.name)}</span>
            <span class="studio-option__price">${escapeHtml(formatMoney(item.price))}${qty > 1 ? ` × ${qty} · ${escapeHtml(formatMoney(item.price * qty))}` : ''}</span>
            ${badge}
          </span>
          ${ICONS.check}
        </button>
      </li>`;
  }

  _renderStyles() {
    return `
      <div class="studio-section">
        <p class="studio-section__lead">A preset re-dresses every slot in every zone at once. The venue behind this panel updates as soon as you apply one.</p>
        <div class="studio-status" role="status">${escapeHtml(this.status)}</div>
        ${this._styleUndo ? `<button type="button" class="studio-btn studio-btn--quiet" data-act="style-undo" style="width:100%;margin-bottom:var(--space-3)">Undo last preset</button>` : ''}
        <div class="studio-cards">
          ${STYLE_PRESETS.map(p => `
            <div class="studio-card">
              <div class="studio-card__name">${escapeHtml(p.name)}</div>
              <p class="studio-card__desc">${escapeHtml(p.description)}</p>
              <div class="studio-swatches" aria-hidden="true">
                <span style="flex:2;background:${escapeHtml(p.colorPalette.primary)}"></span>
                <span style="flex:1;background:${escapeHtml(p.colorPalette.secondary)}"></span>
                <span style="flex:1;background:${escapeHtml(p.colorPalette.accent)}"></span>
              </div>
              <button type="button" class="studio-btn studio-btn--quiet" data-act="style-apply" data-style-id="${escapeHtml(p.id)}">Apply ${escapeHtml(p.name)}</button>
            </div>`).join('')}
        </div>
      </div>`;
  }

  _renderMood() {
    const imgs = this.mood.images || [];
    const palette = this.mood.palette || [];
    const matches = this.mood.matches || [];
    return `
      <div class="studio-section">
        <p class="studio-section__lead">Drop in the client's reference photos. Their dominant colours are read on-device and matched against this zone's catalogue.</p>
        <div class="studio-status" role="status">${escapeHtml(this.mood.statusMessage || '')}</div>
        <button type="button" class="studio-drop" data-act="mood-pick">Add inspiration images</button>
        <input type="file" accept="image/*" multiple class="studio-sr" data-el="mood-file">
        ${imgs.length ? `<div class="studio-moodgrid">${imgs.map((src, i) => `
          <figure><img src="${escapeHtml(src)}" alt="Inspiration image ${i + 1}">
          <button type="button" data-act="mood-del" data-idx="${i}" aria-label="Remove inspiration image ${i + 1}">&times;</button></figure>`).join('')}</div>`
        : `<div class="studio-empty">No references yet.</div>`}
        ${palette.length ? `<div class="studio-palette" aria-label="Extracted palette">${palette.map(p => `<span style="background:${escapeHtml(p.hex)}" title="${escapeHtml(p.hex)}"></span>`).join('')}</div>` : ''}
        <button type="button" class="studio-btn studio-btn--quiet" data-act="mood-analyze" style="width:100%;margin-top:var(--space-4)" ${imgs.length ? '' : 'disabled'}>Read colours &amp; match</button>
        ${matches.length ? `
          <ul class="studio-slots" style="margin-top:var(--space-4)">
            ${matches.map(m => `<li class="studio-slot"><div class="studio-slot__btn" style="cursor:default">
              <img class="studio-thumb" src="${escapeHtml(this._thumb(m.item))}" alt="">
              <span class="studio-slot__text">
                <span class="studio-slot__label">${escapeHtml(m.slotLabel)}</span>
                <span class="studio-slot__item">${escapeHtml(m.item.name)}</span>
                <span class="studio-slot__meta">${escapeHtml(formatMoney(m.item.price))} · ${Math.round(m.score)}% colour match</span>
              </span></div></li>`).join('')}
          </ul>
          <button type="button" class="studio-btn studio-btn--accent" data-act="mood-apply" style="width:100%;margin-top:var(--space-3)">Apply these matches</button>` : ''}
      </div>`;
  }

  _renderCompare() {
    if (this.zone) this.compare.zoneId = this.zone.id;
    const before = this.compare.beforeUrl();
    const after = this.compare.afterUrl();
    const identical = before === after;
    const rows = this.compare.diffRows();
    const net = rows.reduce((s, r) => s + r.delta, 0);
    const changed = rows.filter(r => r.changed).length;

    return `
      <div class="studio-section">
        <p class="studio-section__lead">${identical
          ? 'This zone has no separate 360° plate for the current build, so both halves show the same base photograph. The itemised difference below is the real one.'
          : 'Left: the venue as it ships. Right: the 360° plate for the current build.'}</p>
        <div class="studio-compare" data-el="compare">
          <img src="${escapeHtml(after)}" alt="Current build of ${escapeHtml(this.zone?.name || 'this zone')}">
          <span class="studio-compare__tag" style="inset-inline-end:8px">After</span>
          <div class="studio-compare__before" style="width:${this.compareSplit}%;--studio-split:${this.compareSplit}">
            <img src="${escapeHtml(before)}" alt="Venue default build of ${escapeHtml(this.zone?.name || 'this zone')}">
            <span class="studio-compare__tag" style="inset-inline-start:8px">Before</span>
          </div>
          <div class="studio-compare__handle" role="slider" tabindex="0" aria-label="Comparison split"
               aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.compareSplit)}"
               style="inset-inline-start:${this.compareSplit}%"></div>
        </div>
        <p class="studio-section__lead" style="margin-top:var(--space-3)">
          ${changed} of ${rows.length} elements changed · net ${net >= 0 ? '+' : '−'}${escapeHtml(formatMoney(Math.abs(net)))}
        </p>
        <table class="studio-diff">
          <thead><tr><th scope="col">Element</th><th scope="col">Now</th><th scope="col" class="studio-diff__delta">Δ</th></tr></thead>
          <tbody>${rows.map(r => `<tr data-changed="${r.changed}">
            <td>${escapeHtml(r.label)}<br><span style="color:var(--text-dim)">${escapeHtml(r.before)}</span></td>
            <td>${escapeHtml(r.after)}</td>
            <td class="studio-diff__delta">${r.delta === 0 ? '—' : `${r.delta > 0 ? '+' : '−'}${escapeHtml(formatMoney(Math.abs(r.delta)))}`}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
  }

  // ----------------------------------------------------------------- events

  _setTab(id) {
    this.activeTab = id;
    this.el.querySelectorAll('.studio-tab').forEach(t => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    this.render();
  }

  _onClick(e) {
    const tab = e.target.closest('.studio-tab');
    if (tab) return this._setTab(tab.dataset.tab);

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    switch (act) {
      case 'done':
      case 'close-x':
        this.close();
        break;

      case 'slot': {
        const id = btn.dataset.slotId;
        this.expandedSlotId = this.expandedSlotId === id ? null : id;
        this.render();
        if (this.expandedSlotId) {
          this.onFocusSlot(id);
          const group = this.body.querySelector(`#opts-${CSS.escape(id)}`);
          group?.querySelector('[aria-checked="true"], .studio-option')?.focus({ preventScroll: true });
        }
        this.body.querySelector(`[data-slot="${CSS.escape(id)}"] .studio-slot__btn`)
          ?.setAttribute('aria-expanded', String(this.expandedSlotId === id));
        break;
      }

      case 'option': {
        const { slotId, itemId } = btn.dataset;
        this.selections[slotId] = itemId;
        this.onSelect(slotId, itemId);        // 360 updates live
        this.render();
        const again = this.body.querySelector(`[data-slot="${CSS.escape(slotId)}"] [data-item-id="${CSS.escape(itemId)}"]`);
        again?.focus({ preventScroll: true });
        this._say(`${getItemById(itemId)?.name || 'Item'} selected.`);
        break;
      }

      case 'style-apply': {
        const preset = STYLE_PRESETS.find(p => p.id === btn.dataset.styleId);
        if (!preset) break;
        this._styleUndo = { ...this.selections };
        this.status = `“${preset.name}” applied across every zone.`;
        this._applySelections(preset.selections);
        this._say(this.status);
        break;
      }

      case 'style-undo':
        if (this._styleUndo) {
          const prev = this._styleUndo;
          this._styleUndo = null;
          this.status = 'Reverted to your previous build.';
          this._applySelections(prev);
        }
        break;

      case 'mood-pick':
        this.el.querySelector('[data-el="mood-file"]')?.click();
        break;

      case 'mood-del': {
        const idx = Number(btn.dataset.idx);
        this.mood.images.splice(idx, 1);
        this.mood.matches = [];
        this.render();
        break;
      }

      case 'mood-analyze':
        btn.disabled = true;
        this.mood.analyzeImages().finally(() => this.render());
        break;

      case 'mood-apply': {
        const map = {};
        this.mood.matches.forEach(m => { map[m.slotId] = m.item.id; });
        this._applySelections(map);
        this._say('Mood-board matches applied.');
        break;
      }
      default: break;
    }
  }

  /** Drag the before/after split. No modal, no library — just a pointer. */
  _onPointerDown(e) {
    const box = e.target.closest('.studio-compare');
    if (!box) return;
    e.preventDefault();
    const move = ev => {
      const r = box.getBoundingClientRect();
      const pct = Math.max(0, Math.min(100, ((ev.clientX - r.left) / r.width) * 100));
      this.compareSplit = pct;
      const before = box.querySelector('.studio-compare__before');
      const handle = box.querySelector('.studio-compare__handle');
      before.style.width = `${pct}%`;
      before.style.setProperty('--studio-split', String(pct));
      handle.style.insetInlineStart = `${pct}%`;
      handle.setAttribute('aria-valuenow', String(Math.round(pct)));
    };
    move(e);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  _onChange(e) {
    if (e.target.matches('[data-el="mood-file"]')) {
      const files = e.target.files;
      e.target.value = '';
      this.mood.handleFiles(files).then(() => this.render());
    }
  }

  _onKeydown(e) {
    // Tab strip: left/right moves between tools.
    if (e.target.classList.contains('studio-tab')) {
      const order = TABS.map(t => t.id);
      const i = order.indexOf(e.target.dataset.tab);
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const next = order[(i + (e.key === 'ArrowRight' ? 1 : order.length - 1)) % order.length];
        this._setTab(next);
        this.el.querySelector(`[data-tab="${next}"]`)?.focus();
        return;
      }
    }

    // Option list: up/down moves, Enter/Space selects (native for buttons).
    const opt = e.target.closest('.studio-option');
    if (opt) {
      const list = [...opt.closest('.studio-options').querySelectorAll('.studio-option')];
      const i = list.indexOf(opt);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault(); list[(i + 1) % list.length].focus();
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault(); list[(i - 1 + list.length) % list.length].focus();
      } else if (e.key === 'Home') { e.preventDefault(); list[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); list[list.length - 1].focus(); }
      return;
    }

    // Compare split handle.
    if (e.target.classList.contains('studio-compare__handle')) {
      const step = e.shiftKey ? 10 : 2;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.compareSplit = Math.max(0, this.compareSplit - step); this.render(); this.body.querySelector('.studio-compare__handle')?.focus(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.compareSplit = Math.min(100, this.compareSplit + step); this.render(); this.body.querySelector('.studio-compare__handle')?.focus(); }
    }
  }
}
