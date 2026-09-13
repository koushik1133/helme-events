/**
 * Scoped stylesheet for the embeddable 3D floor-plan studio.
 *
 * Lives here rather than in src/style.css because this component is lazy-loaded
 * with three.js and is owned end-to-end by the studio3d module. Every colour is a
 * design token with a neutral fallback, so both themes work with no extra rules.
 */
const STYLE_ID = 'helm-studio3d-css';

const CSS = `
.h3d-root {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0px;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas: "bar bar" "stage panel";
  width: 100%;
  height: 100%;
  min-height: 0;
  background: var(--bg-surface, #16161a);
  color: var(--text-main, #f5f5f7);
  font-family: var(--font-attio, -apple-system, system-ui, sans-serif);
  border-radius: var(--radius-md, 16px);
  overflow: hidden;
  transition: grid-template-columns 260ms cubic-bezier(0.16, 1, 0.3, 1);
}
.h3d-root[data-mode="edit"] { grid-template-columns: minmax(0, 1fr) 320px; }

/* ------------------------------------------------------------------ top bar */
.h3d-bar {
  grid-area: bar;
  display: flex;
  align-items: center;
  gap: var(--space-3, 12px);
  padding: 10px var(--space-4, 16px);
  border-bottom: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.18));
  background: var(--bg-surface, #16161a);
  min-height: 52px;
}
.h3d-title {
  font-size: var(--fs-md, 0.875rem);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
}
.h3d-sub {
  font-size: var(--fs-2xs, 0.6875rem);
  color: var(--text-muted, #9a9aa0);
  margin: 0;
}
.h3d-bar-spacer { flex: 1 1 auto; }
.h3d-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: var(--fs-xs, 0.75rem);
  color: var(--text-muted, #9a9aa0);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.h3d-stats b { color: var(--text-main, #f5f5f7); font-weight: 600; }
.h3d-stats .h3d-cost { color: var(--accent-gold, #d9a406); font-weight: 600; }

/* ------------------------------------------------------------------ buttons */
.h3d-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font: inherit;
  font-size: var(--fs-xs, 0.75rem);
  font-weight: 500;
  line-height: 1;
  padding: 8px 12px;
  border-radius: var(--radius-xs, 6px);
  border: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.22));
  background: transparent;
  color: var(--text-main, #f5f5f7);
  cursor: pointer;
  transition: background 160ms ease, border-color 160ms ease;
}
.h3d-btn:hover { background: var(--glass-1, rgba(128, 128, 128, 0.1)); }
.h3d-btn[aria-pressed="true"] {
  border-color: var(--border-gold, rgba(217, 164, 6, 0.5));
  background: var(--tint-gold, rgba(217, 164, 6, 0.12));
  color: var(--accent-gold, #d9a406);
}
.h3d-btn--primary {
  background: var(--solid-gold, #d9a406);
  color: var(--on-gold, #1a1205);
  border-color: transparent;
  font-weight: 600;
}
.h3d-btn--primary:hover { filter: brightness(1.06); background: var(--solid-gold, #d9a406); }
.h3d-btn--danger { color: var(--accent-rose, #d9534f); border-color: var(--border-subtle, rgba(128, 128, 128, 0.22)); }
.h3d-btn--danger:hover { background: var(--tint-rose, rgba(217, 83, 79, 0.14)); }
.h3d-btn--block { width: 100%; }
.h3d-root :focus-visible {
  outline: 2px solid var(--focus-color, #409cff);
  outline-offset: 2px;
}

/* ------------------------------------------------------------------- canvas */
.h3d-stage { grid-area: stage; position: relative; min-width: 0; min-height: 0; }
.h3d-canvas {
  position: absolute;
  inset: 0;
  min-width: 0;
  min-height: 0;
  cursor: grab;
}
.h3d-canvas:active { cursor: grabbing; }
.h3d-canvas canvas { display: block; width: 100%; height: 100%; }
.h3d-hint {
  position: absolute;
  left: 50%;
  bottom: 12px;
  transform: translateX(-50%);
  max-width: min(620px, calc(100% - 24px));
  padding: 6px 12px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--bg-over-media, rgba(15, 23, 42, 0.86));
  color: var(--text-on-media, #fff);
  font-size: var(--fs-2xs, 0.6875rem);
  text-align: center;
  pointer-events: none;
  opacity: 0;
  transition: opacity 220ms ease;
}
.h3d-root[data-mode="edit"] .h3d-hint { opacity: 1; }
.h3d-hint kbd {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 0.95em;
  padding: 0 3px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.16);
}

/* -------------------------------------------------------------------- panel */
.h3d-panel {
  grid-area: panel;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  border-left: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.18));
  background: var(--bg-surface, #16161a);
  padding: var(--space-4, 16px);
  display: flex;
  flex-direction: column;
  gap: var(--space-5, 20px);
}
.h3d-root[data-mode="view"] .h3d-panel { display: none; }
.h3d-group { display: flex; flex-direction: column; gap: 8px; }
.h3d-group > h4 {
  margin: 0;
  font-size: var(--fs-2xs, 0.6875rem);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted, #9a9aa0);
}
.h3d-list { display: flex; flex-direction: column; gap: 6px; }
.h3d-asset {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  text-align: left;
  padding: 10px 12px;
}
.h3d-asset .h3d-price { color: var(--text-muted, #9a9aa0); font-variant-numeric: tabular-nums; }
.h3d-row { display: flex; flex-wrap: wrap; gap: 6px; }
.h3d-row .h3d-btn { flex: 1 1 auto; }

.h3d-empty {
  font-size: var(--fs-xs, 0.75rem);
  line-height: 1.5;
  color: var(--text-muted, #9a9aa0);
  padding: 12px;
  border: 1px dashed var(--border-subtle, rgba(128, 128, 128, 0.25));
  border-radius: var(--radius-sm, 10px);
  margin: 0;
}
.h3d-card {
  border: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.2));
  border-radius: var(--radius-sm, 10px);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.h3d-card-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.h3d-card-head h5 { margin: 0; font-size: var(--fs-sm, 0.8125rem); font-weight: 600; }
.h3d-badge {
  font-size: 0.625rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 3px 7px;
  border-radius: var(--radius-pill, 9999px);
  background: var(--glass-1, rgba(128, 128, 128, 0.12));
  color: var(--text-muted, #9a9aa0);
}
.h3d-meta {
  margin: 0;
  font-size: var(--fs-xs, 0.75rem);
  color: var(--text-muted, #9a9aa0);
  font-variant-numeric: tabular-nums;
}
.h3d-meta strong { color: var(--accent-gold, #d9a406); }
.h3d-swatches { display: flex; flex-wrap: wrap; gap: 6px; }
.h3d-swatch {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs, 6px);
  border: 1px solid var(--border-subtle, rgba(128, 128, 128, 0.3));
  cursor: pointer;
  padding: 0;
  transition: transform 140ms ease, box-shadow 140ms ease;
}
.h3d-swatch:hover { transform: translateY(-1px); }
.h3d-swatch[aria-pressed="true"] {
  box-shadow: 0 0 0 2px var(--bg-surface, #16161a), 0 0 0 4px var(--accent-gold, #d9a406);
}
.h3d-note {
  margin: 0;
  font-size: var(--fs-2xs, 0.6875rem);
  line-height: 1.5;
  color: var(--text-muted, #9a9aa0);
}

/* --------------------------------------------------------------- modal shim */
.h3d-root--modal {
  position: fixed;
  inset: 3vh 3vw;
  width: auto;
  height: auto;
  z-index: var(--z-modal, 500);
  box-shadow: var(--shadow-panel, 0 40px 100px rgba(0, 0, 0, 0.6));
}
.h3d-scrim {
  position: fixed;
  inset: 0;
  z-index: var(--z-overlay, 400);
  background: var(--scrim, rgba(0, 0, 0, 0.7));
}

@media (max-width: 760px) {
  .h3d-root[data-mode="edit"] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto minmax(0, 1fr) minmax(0, 40%);
    grid-template-areas: "bar" "stage" "panel";
  }
}
@media (prefers-reduced-motion: reduce) {
  .h3d-root, .h3d-hint { transition: none; }
}
`;

export function injectStudio3DStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = CSS;
  document.head.appendChild(el);
}
