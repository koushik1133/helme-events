/**
 * Studio chrome styles — injected once, at import time of the components that
 * need them. Nothing here may use a literal colour: every value is a token
 * from src/style.css so both themes and WCAG AA come for free.
 *
 * One accent only: brass/gold (`--solid-gold` / `--accent-gold` / `--tint-gold`).
 * No emoji, no second accent, no competing gradient.
 */

const STYLE_ID = 'studio-chrome-styles';

export const STUDIO_PANEL_WIDTH = 380;

const CSS = `
/* ==========================================================================
   Layout contract
   The panel NEVER overlays the venue. When it opens, the host container gets
   .studio-edit-open plus the custom properties below, and anything inside it
   marked .studio-canvas (or [data-studio-canvas]) shrinks to make room.
   ========================================================================== */
.studio-shell { position: relative; }

/* The orchestrator's markup, styled here so it needs no rules of its own. */
.studio-stage { position: relative; display: flex; width: 100%; height: 100%; overflow: hidden; }
.studio-canvas-wrap { position: relative; flex: 1 1 auto; min-width: 0; height: 100%; }
.studio-mode-bar-host { position: absolute; inset-block-start: 0; inset-inline: 0; z-index: var(--z-hud); }
.studio-edit-panel-host { position: static; }

.studio-shell.studio-edit-open .studio-canvas,
.studio-shell.studio-edit-open .studio-canvas-wrap,
.studio-shell.studio-edit-open [data-studio-canvas] {
  width: calc(100% - var(--studio-panel-w, 380px));
  transition: width 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.studio-shell .studio-canvas,
.studio-shell .studio-canvas-wrap,
.studio-shell [data-studio-canvas] {
  transition: width 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

/* ------------------------------------------------------------------ mode bar */
.studio-modebar {
  position: absolute;
  inset-block-start: 0;
  inset-inline: 0;
  z-index: var(--z-hud);
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  pointer-events: none;
  background: linear-gradient(to bottom, rgba(0,0,0,0.42), rgba(0,0,0,0));
}
.studio-modebar > * { pointer-events: auto; }
.studio-modebar__spacer { flex: 1; pointer-events: none; }

.studio-modebar__id { min-width: 0; }
.studio-modebar__name {
  margin: 0;
  font-family: var(--font-attio);
  font-size: var(--fs-lg);
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-on-media);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.studio-modebar__sub {
  margin: 2px 0 0;
  font-size: var(--fs-xs);
  color: var(--text-on-media-dim);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.studio-btn {
  display: inline-flex; align-items: center; justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-attio);
  font-size: var(--fs-md);
  font-weight: 550;
  line-height: 1;
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  border: 1px solid transparent;
  cursor: pointer;
  transition: var(--transition-fast);
  white-space: nowrap;
}
.studio-btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.studio-btn--glass {
  background: var(--bg-over-media);
  color: var(--text-on-media);
  border-color: var(--border-terminal);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
}
.studio-btn--glass:hover { background: var(--glass-3); }

.studio-btn--accent {
  background: var(--solid-gold);
  color: var(--on-gold);
  border-color: transparent;
  font-weight: 600;
}
.studio-btn--accent:hover { filter: brightness(1.06); }

.studio-btn--quiet {
  background: transparent;
  color: var(--text-muted);
  border-color: var(--border-subtle);
}
.studio-btn--quiet:hover { background: var(--glass-1); color: var(--text-main); }

.studio-btn--icon { width: 38px; height: 38px; padding: 0; border-radius: var(--radius-pill); }
.studio-btn[aria-pressed="true"] { background: var(--solid-gold); color: var(--on-gold); border-color: transparent; }

.studio-icon { width: 17px; height: 17px; flex: none; stroke-width: 1.7; }

/* overflow menu */
.studio-menu {
  position: absolute;
  inset-block-start: calc(100% + var(--space-2));
  inset-inline-end: 0;
  min-width: 210px;
  padding: var(--space-2);
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-ms);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  z-index: var(--z-popover);
}
.studio-menu[hidden] { display: none; }
.studio-menu__item {
  display: block; width: 100%; text-align: start;
  padding: 9px 12px;
  font-family: var(--font-attio); font-size: var(--fs-md);
  color: var(--text-main);
  background: none; border: 0; border-radius: var(--radius-xs);
  cursor: pointer;
}
.studio-menu__item:hover { background: var(--glass-1); }
.studio-menu__item:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.studio-modebar__overflow { position: relative; }

/* ------------------------------------------------------------------- panel */
.studio-panel {
  position: absolute;
  inset-block: 0;
  inset-inline-end: 0;
  width: var(--studio-panel-w, 380px);
  display: flex;
  flex-direction: column;
  background: var(--bg-surface);
  border-inline-start: 1px solid var(--border-subtle);
  color: var(--text-main);
  font-family: var(--font-attio);
  z-index: var(--z-drawer);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}
.studio-panel[data-open="true"] { transform: none; }
.studio-panel[hidden] { display: none; }

.studio-panel__head {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-5) var(--space-5) var(--space-4);
}
.studio-panel__title { margin: 0; font-size: var(--fs-lg); font-weight: 600; letter-spacing: -0.01em; }
.studio-panel__sub { margin: 3px 0 0; font-size: var(--fs-xs); color: var(--text-muted); }
.studio-panel__head .studio-btn { margin-inline-start: auto; }

.studio-tabs {
  display: flex; gap: var(--space-1);
  padding: 0 var(--space-5) var(--space-4);
}
.studio-tab {
  flex: 1; min-width: 0; white-space: nowrap;
  padding: 7px 6px;
  font-family: inherit; font-size: var(--fs-xs); font-weight: 550;
  color: var(--text-muted);
  background: transparent; border: 0; border-radius: var(--radius-xs);
  cursor: pointer; transition: var(--transition-fast);
}
.studio-tab:hover { color: var(--text-main); background: var(--glass-1); }
.studio-tab[aria-selected="true"] { color: var(--accent-gold); background: var(--tint-gold); }
.studio-tab:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.studio-panel__body {
  flex: 1; min-height: 0;
  overflow-y: auto; overscroll-behavior: contain;
  padding: 0 var(--space-4) var(--space-6);
}
.studio-panel__foot {
  display: flex; align-items: center; gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-block-start: 1px solid var(--border-subtle);
  background: var(--bg-surface);
}
.studio-panel__total { font-size: var(--fs-xs); color: var(--text-muted); }
.studio-panel__total strong { display: block; font-size: var(--fs-lg); color: var(--text-main); font-variant-numeric: tabular-nums; }
.studio-panel__foot .studio-btn { margin-inline-start: auto; }

/* --------------------------------------------------------------- slot rows */
.studio-slots { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-2); }

.studio-slot { border-radius: var(--radius-ms); }
.studio-slot[data-expanded="true"] { background: var(--glass-1); }
.studio-slot[data-highlight="true"] { box-shadow: inset 0 0 0 1px var(--border-gold); }

.studio-slot__btn {
  display: flex; align-items: center; gap: var(--space-3);
  width: 100%; padding: var(--space-3);
  background: transparent; border: 0; border-radius: var(--radius-ms);
  text-align: start; cursor: pointer; color: inherit;
  transition: var(--transition-fast);
}
.studio-slot__btn:hover { background: var(--glass-1); }
.studio-slot__btn:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.studio-thumb {
  width: 52px; height: 52px; flex: none;
  border-radius: var(--radius-sm);
  object-fit: cover;
  background: var(--bg-pill);
  border: 1px solid var(--border-subtle);
}
.studio-slot__text { min-width: 0; flex: 1; }
.studio-slot__label { font-size: var(--fs-2xs); letter-spacing: 0.04em; text-transform: uppercase; color: var(--text-dim); }
.studio-slot__item { font-size: var(--fs-md); font-weight: 550; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.studio-slot__meta { font-size: var(--fs-xs); color: var(--text-muted); margin-top: 2px; font-variant-numeric: tabular-nums; }
.studio-slot__chev { flex: none; color: var(--text-dim); transition: transform 0.2s ease; }
.studio-slot[data-expanded="true"] .studio-slot__chev { transform: rotate(180deg); }

/* --------------------------------------------------------- inline options */
.studio-options {
  list-style: none; margin: 0;
  padding: 0 var(--space-3) var(--space-3);
  display: flex; flex-direction: column; gap: var(--space-1);
}
.studio-options[hidden] { display: none; }

.studio-options li { min-width: 0; }
.studio-option {
  display: flex; min-width: 0; align-items: center; gap: var(--space-3);
  width: 100%; padding: var(--space-2);
  background: transparent; border: 1px solid transparent; border-radius: var(--radius-sm);
  text-align: start; cursor: pointer; color: inherit;
  transition: var(--transition-fast);
}
.studio-option:hover { background: var(--bg-surface-hover); }
.studio-option:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.studio-option[aria-checked="true"] { background: var(--tint-gold); border-color: var(--border-gold); }
.studio-option__thumb { width: 44px; height: 44px; flex: none; border-radius: var(--radius-xs); object-fit: cover; background: var(--bg-pill); }
.studio-option__text { min-width: 0; flex: 1; }
.studio-option__name { font-size: var(--fs-sm); font-weight: 550; line-height: 1.35; overflow-wrap: anywhere; }
.studio-option__price { font-size: var(--fs-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; margin-top: 1px; }
.studio-option__check { flex: none; color: var(--accent-gold); opacity: 0; }
.studio-option[aria-checked="true"] .studio-option__check { opacity: 1; }

.studio-badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 7px; margin-top: 4px;
  font-size: var(--fs-2xs); font-weight: 550; letter-spacing: 0.02em;
  border-radius: var(--radius-pill);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  background: var(--glass-1);
}
.studio-badge--scene { color: var(--accent-gold); border-color: var(--border-gold); background: var(--tint-gold); }
.studio-badge__dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

/* ------------------------------------------------------------ folded tools */
.studio-section { padding: var(--space-2) var(--space-1) var(--space-4); }
.studio-section__lead { font-size: var(--fs-xs); color: var(--text-muted); line-height: 1.55; margin: 0 0 var(--space-4); }
.studio-cards { display: grid; grid-template-columns: 1fr; gap: var(--space-3); }
.studio-card {
  padding: var(--space-4);
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-ms);
}
.studio-card__name { font-size: var(--fs-md); font-weight: 600; }
.studio-card__desc { font-size: var(--fs-xs); color: var(--text-muted); line-height: 1.5; margin: 4px 0 var(--space-3); }
.studio-swatches { display: flex; height: 8px; border-radius: var(--radius-pill); overflow: hidden; margin-bottom: var(--space-3); }
.studio-card .studio-btn { width: 100%; }

.studio-empty {
  padding: var(--space-8) var(--space-4);
  text-align: center; font-size: var(--fs-sm); color: var(--text-muted); line-height: 1.6;
}
.studio-status { min-height: 16px; font-size: var(--fs-xs); color: var(--text-muted); margin-bottom: var(--space-3); }

.studio-drop {
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--border-strong); border-radius: var(--radius-ms);
  text-align: center; font-size: var(--fs-sm); color: var(--text-muted);
  cursor: pointer; background: transparent; width: 100%; font-family: inherit;
}
.studio-drop:hover, .studio-drop[data-active="true"] { border-color: var(--border-gold); color: var(--text-main); }
.studio-drop:focus-visible { outline: none; box-shadow: var(--focus-ring); }

.studio-moodgrid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-2); margin-top: var(--space-3); }
.studio-moodgrid figure { position: relative; margin: 0; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-subtle); }
.studio-moodgrid img { width: 100%; height: 84px; object-fit: cover; display: block; }
.studio-moodgrid button {
  position: absolute; inset-block-start: 4px; inset-inline-end: 4px;
  width: 22px; height: 22px; border-radius: 50%;
  background: var(--scrim); color: #fff; border: 0; cursor: pointer; line-height: 1;
}
.studio-palette { display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-3); }
.studio-palette span { width: 26px; height: 26px; border-radius: var(--radius-xs); border: 1px solid var(--border-subtle); }

.studio-compare { position: relative; border-radius: var(--radius-ms); overflow: hidden; background: var(--bg-media); aspect-ratio: 4 / 3; touch-action: none; }
.studio-compare img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.studio-compare__before { position: absolute; inset-block: 0; inset-inline-start: 0; overflow: hidden; }
.studio-compare__before img { width: calc(10000% / var(--studio-split, 50)); max-width: none; }
.studio-compare__handle {
  position: absolute; inset-block: 0; width: 3px; background: var(--solid-gold);
  transform: translateX(-1.5px); cursor: ew-resize; touch-action: none;
}
.studio-compare__handle::after {
  content: ''; position: absolute; inset-block-start: 50%; inset-inline-start: 50%;
  width: 26px; height: 26px; margin: -13px 0 0 -13px;
  border-radius: 50%; background: var(--solid-gold); box-shadow: var(--shadow-card);
}
.studio-compare__handle:focus-visible { outline: none; box-shadow: var(--focus-ring); }
.studio-compare__tag {
  position: absolute; inset-block-start: 8px;
  padding: 3px 8px; border-radius: var(--radius-pill);
  background: var(--bg-over-media); color: var(--text-on-media); font-size: var(--fs-2xs);
}
.studio-diff { width: 100%; border-collapse: collapse; margin-top: var(--space-4); font-size: var(--fs-xs); }
.studio-diff th { text-align: start; font-weight: 550; color: var(--text-dim); padding: 6px 4px; border-block-end: 1px solid var(--border-subtle); }
.studio-diff td { padding: 7px 4px; border-block-end: 1px solid var(--border-subtle); color: var(--text-muted); vertical-align: top; }
.studio-diff tr[data-changed="true"] td { color: var(--text-main); }
.studio-diff .studio-diff__delta { text-align: end; font-variant-numeric: tabular-nums; white-space: nowrap; }

.studio-sr {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
}

/* -------------------------------------------------------------- responsive */
@media (max-width: 1180px) {
  .studio-shell.studio-edit-open { --studio-panel-w: 336px; }
}

/* Below 768 the dock becomes a bottom sheet: the canvas shrinks vertically
   instead of horizontally, so the venue is still fully visible above it. */
@media (max-width: 767px) {
  .studio-shell.studio-edit-open { --studio-panel-w: 0px; }
  .studio-stage { flex-direction: column; }
  .studio-shell.studio-edit-open .studio-canvas,
  .studio-shell.studio-edit-open .studio-canvas-wrap,
  .studio-shell.studio-edit-open [data-studio-canvas] {
    width: 100%;
    height: calc(100% - var(--studio-sheet-h, 58%));
  }
  .studio-panel {
    inset-block-start: auto;
    inset-inline: 0;
    inset-block-end: 0;
    width: 100%;
    height: var(--studio-sheet-h, 58%);
    border-inline-start: 0;
    border-block-start: 1px solid var(--border-subtle);
    border-start-start-radius: var(--radius-lg);
    border-start-end-radius: var(--radius-lg);
    transform: translateY(100%);
    box-shadow: var(--shadow-panel);
  }
  .studio-panel[data-open="true"] { transform: none; }
  .studio-panel__head { padding-block-start: var(--space-4); }
  .studio-modebar { padding: var(--space-3) var(--space-4); }
  .studio-modebar__name { font-size: var(--fs-md); }
}

@media (prefers-reduced-motion: reduce) {
  .studio-panel, .studio-canvas, [data-studio-canvas], .studio-slot__chev { transition: none; }
}
`;

/** Inject once per document. Safe to call from every module that needs it. */
export function injectStudioStyles(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const tag = doc.createElement('style');
  tag.id = STYLE_ID;
  tag.textContent = CSS;
  doc.head.appendChild(tag);
}

/** Minimal stroke icons — no emoji anywhere in the chrome. */
export const ICONS = {
  back: '<svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
  edit: '<svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  more: '<svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
  chevron: '<svg class="studio-icon studio-slot__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
  check: '<svg class="studio-icon studio-option__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>',
  close: '<svg class="studio-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>'
};
