/**
 * eventsStyles.js — the single stylesheet for the Events grid and overview.
 *
 * Injected once on first render, exactly like homeStyles.js does it:
 * `src/style.css` belongs to the orchestrator, so this screen carries its own
 * styles rather than editing a file it does not own.
 *
 * Rules followed here:
 *  - Every colour is a token from src/style.css. No hex literal anywhere except
 *    inside a var() fallback, which mirrors the dark-theme value.
 *  - One accent: brass. Semantic colours are status only, never decoration.
 *  - Both themes legible; 1920 down to 390 where the cards go single column.
 *  - Every interactive thing is keyboard reachable and shows a focus ring.
 */

const STYLE_ID = 'helm-events-styles';

export function injectEventsStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
.ev {
  font-family: var(--font-attio, Inter, system-ui, sans-serif);
  color: var(--text-main, #f7f5f2);
  max-width: 1480px;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 40px) clamp(14px, 3vw, 34px) 72px;
  display: flex;
  flex-direction: column;
  gap: clamp(18px, 2.2vw, 28px);
}
.ev *, .ev *::before, .ev *::after { box-sizing: border-box; }
.ev :focus-visible {
  outline: none;
  box-shadow: var(--focus-ring, 0 0 0 3px rgba(224,177,85,0.38));
  border-radius: var(--radius-md, 12px);
}
.ev-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.02em;
}

/* ------------------------------------------------------------- page head */
.ev-head {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--space-4, 16px); flex-wrap: wrap;
}
.ev-head h1 {
  margin: 0; font-size: clamp(1.375rem, 2.6vw, 1.75rem);
  font-weight: 640; letter-spacing: -0.028em;
}
.ev-head p {
  margin: 6px 0 0; font-size: var(--fs-sm, 0.8125rem);
  color: var(--text-dim, #978f85);
}

/* -------------------------------------------------------------- toolbar */
.ev-toolbar {
  display: flex; align-items: center; gap: var(--space-3, 12px);
  flex-wrap: wrap;
}
.ev-segs {
  display: inline-flex; gap: var(--space-1, 4px);
  padding: 3px; border-radius: var(--radius-pill, 9999px);
  background: var(--bg-pill, #201e1b);
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
}
.ev-seg {
  appearance: none; border: 0; cursor: pointer;
  font: inherit; font-size: var(--fs-sm, 0.8125rem); font-weight: 520;
  color: var(--text-muted, #aca69d);
  background: transparent;
  height: var(--control-h, 32px); padding: 0 var(--space-4, 16px);
  border-radius: var(--radius-pill, 9999px);
  transition: var(--transition-fast, all 0.16s ease);
  white-space: nowrap;
}
.ev-seg:hover { color: var(--text-main, #f7f5f2); }
.ev-seg[aria-pressed="true"] {
  background: var(--bg-surface, #161513);
  color: var(--text-main, #f7f5f2);
  box-shadow: var(--shadow-card, 0 1px 2px rgba(0,0,0,0.4));
}
.ev-seg .ev-seg-n {
  margin-inline-start: 6px; font-size: var(--fs-2xs, 0.6875rem);
  color: var(--text-dim, #978f85); font-variant-numeric: tabular-nums;
}
.ev-spacer { flex: 1 1 auto; }
.ev-search {
  position: relative; flex: 0 1 260px; min-width: 180px;
}
.ev-search input, .ev-select {
  width: 100%; height: var(--control-h, 32px);
  font: inherit; font-size: var(--fs-sm, 0.8125rem);
  color: var(--text-main, #f7f5f2);
  background: var(--bg-input, #201e1b);
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
  border-radius: var(--radius-ms, 10px);
  padding: 0 var(--space-3, 12px);
}
.ev-select { width: auto; padding-inline-end: var(--space-6, 24px); cursor: pointer; }
.ev-search input::placeholder { color: var(--text-dim, #978f85); }
.ev-search input:focus, .ev-select:focus { border-color: var(--border-accent, rgba(224,177,85,0.34)); }
.ev-field { display: inline-flex; align-items: center; gap: var(--space-2, 8px); }
.ev-field label {
  font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #978f85);
}

/* ----------------------------------------------------------- card grid */
.ev-grid {
  display: grid; gap: clamp(14px, 1.6vw, 22px);
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}
.ev-card {
  display: flex; flex-direction: column; text-align: start;
  background: var(--bg-surface, #161513);
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
  border-radius: var(--radius-lg, 18px);
  overflow: hidden; cursor: pointer;
  transition: var(--transition-fast, all 0.16s ease);
}
.ev-card:hover {
  border-color: var(--border-strong, rgba(255,250,240,0.18));
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg, 0 18px 44px rgba(0,0,0,0.6));
}
.ev-card:focus-visible { transform: translateY(-2px); }
.ev-card-media {
  position: relative; aspect-ratio: 16 / 9;
  background: var(--bg-media, #1a1917); overflow: hidden;
}
.ev-card-media img, .ev-hero img {
  width: 100%; height: 100%; object-fit: cover; object-position: center;
  display: block;
}
.ev-card:hover .ev-card-media img { transform: scale(1.04); }
.ev-card-media img { transition: transform 0.35s cubic-bezier(0.16,1,0.3,1); }
.ev-card-media::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to top, var(--scrim, rgba(0,0,0,0.72)) 0%, transparent 58%);
}
.ev-card-media .ev-chip-row {
  position: absolute; inset-block-start: var(--space-3, 12px);
  inset-inline: var(--space-3, 12px);
  display: flex; justify-content: space-between; gap: var(--space-2, 8px); z-index: 1;
}
.ev-card-when {
  position: absolute; inset-block-end: var(--space-3, 12px);
  inset-inline-start: var(--space-3, 12px); z-index: 1;
  font-size: var(--fs-xs, 0.75rem); font-weight: 560;
  color: var(--text-on-media, #fff);
  text-shadow: 0 1px 3px rgba(0,0,0,0.6);
}
.ev-card-body {
  display: flex; flex-direction: column; gap: var(--space-2, 8px);
  padding: var(--space-4, 16px) var(--space-4, 16px) var(--space-3, 12px);
  flex: 1 1 auto;
}
.ev-overline {
  font-size: var(--fs-2xs, 0.6875rem); font-weight: 600;
  letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--text-dim, #978f85);
}
.ev-card-body h3 {
  margin: 0; font-size: var(--fs-lg, 1rem); font-weight: 600;
  letter-spacing: -0.02em; line-height: 1.32;
}
.ev-meta {
  display: flex; flex-direction: column; gap: 5px; margin-block-start: 2px;
  font-size: var(--fs-sm, 0.8125rem); color: var(--text-muted, #aca69d);
}
.ev-meta span { display: block; }
.ev-card-foot {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  border-block-start: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
}
.ev-card-foot .ev-amount {
  font-size: var(--fs-lg, 1rem); font-weight: 620; letter-spacing: -0.03em;
}
.ev-card-foot .ev-amount-label {
  font-size: var(--fs-2xs, 0.6875rem); color: var(--text-dim, #978f85);
  text-transform: uppercase; letter-spacing: 0.07em;
}

/* ---------------------------------------------------------------- chips */
.ev-chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: var(--control-h-sm, 26px); padding: 0 var(--space-3, 12px);
  border-radius: var(--radius-pill, 9999px);
  font-size: var(--fs-2xs, 0.6875rem); font-weight: 600;
  letter-spacing: 0.04em; text-transform: uppercase;
  background: var(--glass-2, rgba(255,250,240,0.09));
  border: 1px solid var(--border-glass, rgba(255,250,240,0.12));
  color: var(--text-main, #f7f5f2);
  white-space: nowrap;
}
.ev-chip--onmedia {
  background: var(--bg-over-media, rgba(12,11,10,0.86));
  color: var(--text-on-media, #fff);
  border-color: transparent;
  backdrop-filter: blur(8px);
}
.ev-chip--positive { color: var(--positive, #4bd07a); background: var(--tint-positive, rgba(75,208,122,0.14)); border-color: transparent; }
.ev-chip--warning  { color: var(--warning, #f0b429);  background: var(--tint-warning, rgba(240,180,41,0.14));  border-color: transparent; }
.ev-chip--critical { color: var(--critical, #ff7b6e); background: var(--tint-critical, rgba(255,123,110,0.14)); border-color: transparent; }
.ev-chip--accent   { color: var(--accent, #e0b155);   background: var(--tint-accent, rgba(224,177,85,0.14));   border-color: transparent; }

/* --------------------------------------------------------- empty state */
.ev-empty {
  border: 1px dashed var(--border-strong, rgba(255,250,240,0.18));
  border-radius: var(--radius-lg, 18px);
  padding: clamp(32px, 6vw, 64px) var(--space-6, 24px);
  text-align: center; display: flex; flex-direction: column;
  align-items: center; gap: var(--space-3, 12px);
  background: var(--glass-1, rgba(255,250,240,0.05));
}
.ev-empty h2 {
  margin: 0; font-size: var(--fs-lg, 1rem); font-weight: 600;
  letter-spacing: -0.02em;
}
.ev-empty p {
  margin: 0; max-width: 46ch; font-size: var(--fs-sm, 0.8125rem);
  color: var(--text-dim, #978f85); line-height: 1.6;
}

/* -------------------------------------------------------------- buttons */
.ev-btn {
  appearance: none; cursor: pointer; font: inherit;
  font-size: var(--fs-sm, 0.8125rem); font-weight: 540;
  height: var(--control-h, 32px); padding: 0 var(--space-4, 16px);
  border-radius: var(--radius-ms, 10px);
  display: inline-flex; align-items: center; justify-content: center; gap: var(--space-2, 8px);
  background: var(--btn-secondary-bg, #201e1b);
  color: var(--btn-secondary-text, #f7f5f2);
  border: 1px solid var(--btn-secondary-border, rgba(255,250,240,0.09));
  transition: var(--transition-fast, all 0.16s ease);
  white-space: nowrap;
}
.ev-btn:hover { background: var(--btn-secondary-hover, #2a2724); }
.ev-btn--primary {
  background: var(--btn-primary-bg, #e0b155); color: var(--btn-primary-text, #201a08);
  border-color: transparent; font-weight: 600;
}
.ev-btn--primary:hover { background: var(--btn-primary-hover, #eec069); }
.ev-btn--quiet {
  background: transparent; border-color: transparent;
  color: var(--text-muted, #aca69d); padding-inline: var(--space-2, 8px);
}
.ev-btn--quiet:hover { background: var(--btn-quiet-hover, rgba(255,250,240,0.05)); color: var(--text-main, #f7f5f2); }

/* ================================================== OVERVIEW ========== */
.ev-back { align-self: flex-start; }
.ev-hero {
  position: relative; border-radius: var(--radius-lg, 18px);
  overflow: hidden; background: var(--bg-media, #1a1917);
  aspect-ratio: 21 / 9; min-height: 220px;
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
}
.ev-hero::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to top, var(--scrim, rgba(0,0,0,0.72)) 4%, transparent 62%);
}
.ev-hero-text {
  position: absolute; z-index: 1; inset-inline: clamp(16px, 3vw, 32px);
  inset-block-end: clamp(16px, 3vw, 28px);
  display: flex; flex-direction: column; gap: var(--space-2, 8px);
}
.ev-hero-text h1 {
  margin: 0; font-size: clamp(1.375rem, 3.2vw, 2rem); font-weight: 640;
  letter-spacing: -0.03em; color: var(--text-on-media, #fff);
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
}
.ev-hero-text .ev-hero-sub {
  font-size: var(--fs-sm, 0.8125rem); color: var(--text-on-media-dim, rgba(255,255,255,0.82));
  text-shadow: 0 1px 6px rgba(0,0,0,0.5);
}
.ev-hero-chips {
  position: absolute; z-index: 1; inset-block-start: clamp(14px, 2vw, 20px);
  inset-inline-start: clamp(16px, 3vw, 32px);
  display: flex; gap: var(--space-2, 8px); flex-wrap: wrap;
}

.ev-cols {
  display: grid; gap: clamp(16px, 2vw, 24px);
  grid-template-columns: minmax(0, 1fr) minmax(280px, 340px);
  align-items: start;
}
.ev-stack { display: flex; flex-direction: column; gap: clamp(16px, 2vw, 24px); min-width: 0; }

.ev-panel {
  background: var(--bg-surface, #161513);
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
  border-radius: var(--radius-card, 14px);
  padding: clamp(16px, 2vw, 22px);
  display: flex; flex-direction: column; gap: var(--space-4, 16px);
}
.ev-panel > h2 {
  margin: 0; font-size: var(--fs-md, 0.875rem); font-weight: 600;
  letter-spacing: -0.01em;
}
.ev-panel-head {
  display: flex; align-items: baseline; justify-content: space-between; gap: var(--space-3, 12px);
}
.ev-panel-head h2 { margin: 0; font-size: var(--fs-md, 0.875rem); font-weight: 600; }
.ev-panel-head .ev-note { font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #978f85); }

.ev-facts {
  display: grid; gap: var(--space-4, 16px) var(--space-5, 20px);
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}
.ev-fact dt {
  font-size: var(--fs-2xs, 0.6875rem); font-weight: 600;
  letter-spacing: 0.07em; text-transform: uppercase;
  color: var(--text-dim, #978f85); margin: 0 0 5px;
}
.ev-fact dd {
  margin: 0; font-size: var(--fs-md, 0.875rem); color: var(--text-main, #f7f5f2);
  line-height: 1.45; overflow-wrap: anywhere;
}
.ev-fact dd small { display: block; color: var(--text-dim, #978f85); font-size: var(--fs-xs, 0.75rem); margin-block-start: 3px; }

/* run of show */
.ev-runs { display: flex; flex-direction: column; gap: 0; }
.ev-run {
  display: grid; grid-template-columns: 92px minmax(0, 1fr) auto;
  gap: var(--space-3, 12px); align-items: baseline;
  padding: var(--space-3, 12px) 0;
  border-block-start: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
  font-size: var(--fs-sm, 0.8125rem);
}
.ev-run:first-child { border-block-start: 0; padding-block-start: 0; }
.ev-run-date { color: var(--text-main, #f7f5f2); font-weight: 560; }
.ev-run-date small { display: block; color: var(--text-dim, #978f85); font-weight: 420; }
.ev-run-what { color: var(--text-main, #f7f5f2); }
.ev-run-what small { display: block; color: var(--text-dim, #978f85); margin-block-start: 2px; }
.ev-run-side { color: var(--text-muted, #aca69d); text-align: end; white-space: nowrap; }

/* money */
.ev-money {
  display: grid; gap: var(--space-4, 16px);
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
}
.ev-money-cell dt {
  font-size: var(--fs-2xs, 0.6875rem); letter-spacing: 0.07em;
  text-transform: uppercase; color: var(--text-dim, #978f85); margin: 0 0 6px; font-weight: 600;
}
.ev-money-cell dd {
  margin: 0; font-size: var(--fs-xl, 1.25rem); font-weight: 620; letter-spacing: -0.03em;
}
.ev-money-cell dd small { display: block; font-size: var(--fs-xs, 0.75rem); font-weight: 420; color: var(--text-dim, #978f85); letter-spacing: 0; margin-block-start: 4px; }
.ev-money-cell--overdue dd { color: var(--critical, #ff7b6e); }
.ev-bar {
  height: 6px; border-radius: var(--radius-pill, 9999px);
  background: var(--glass-2, rgba(255,250,240,0.09)); overflow: hidden;
}
.ev-bar > i { display: block; height: 100%; background: var(--accent, #e0b155); border-radius: inherit; }

/* actions rail */
.ev-actions { display: flex; flex-direction: column; gap: var(--space-2, 8px); }
.ev-action {
  appearance: none; cursor: pointer; font: inherit; text-align: start;
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-3, 12px);
  padding: var(--space-3, 12px) var(--space-4, 16px);
  background: var(--bg-elevated, #201e1b);
  border: 1px solid var(--border-subtle, rgba(255,250,240,0.09));
  border-radius: var(--radius-ms, 10px);
  color: var(--text-main, #f7f5f2);
  transition: var(--transition-fast, all 0.16s ease);
}
.ev-action:hover { background: var(--bg-surface-hover, #201e1b); border-color: var(--border-strong, rgba(255,250,240,0.18)); }
.ev-action strong { display: block; font-size: var(--fs-sm, 0.8125rem); font-weight: 580; }
.ev-action small { display: block; font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #978f85); margin-block-start: 2px; }
.ev-action .ev-arrow { color: var(--text-dim, #978f85); flex: 0 0 auto; }
.ev-action--primary {
  background: var(--tint-accent, rgba(224,177,85,0.14));
  border-color: var(--border-accent, rgba(224,177,85,0.34));
}
.ev-action--primary strong { color: var(--accent, #e0b155); }
/* The hint sits on --tint-accent, not on the plain card surface, and --text-dim
   was only ever checked against the latter — it lands at 4.4:1 on the tint in
   dark. --text-muted is the correct role for a hint anyway. */
.ev-action--primary small { color: var(--text-muted, #aca69d); }

.ev-contact { display: flex; flex-direction: column; gap: var(--space-3, 12px); }
.ev-contact-row { font-size: var(--fs-sm, 0.8125rem); }
.ev-contact-row strong { font-weight: 560; display: block; }
.ev-contact-row small { color: var(--text-dim, #978f85); display: block; margin-block-start: 2px; }
.ev-contact-row a { color: var(--text-muted, #aca69d); text-decoration: none; }
.ev-contact-row a:hover { color: var(--accent, #e0b155); text-decoration: underline; }

.ev-locked {
  font-size: var(--fs-sm, 0.8125rem); color: var(--text-dim, #978f85);
  line-height: 1.6; margin: 0;
}

/* --------------------------------------------------------- responsive */
@media (max-width: 1080px) {
  .ev-cols { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 720px) {
  .ev-grid { grid-template-columns: minmax(0, 1fr); }
  .ev-hero { aspect-ratio: 4 / 3; }
  .ev-toolbar { align-items: stretch; }
  .ev-search { flex: 1 1 100%; }
  .ev-segs { width: 100%; overflow-x: auto; scrollbar-width: none; }
  .ev-segs::-webkit-scrollbar { display: none; }
  .ev-run { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .ev-run-side { text-align: start; }
}
@media (prefers-reduced-motion: reduce) {
  .ev-card, .ev-card-media img, .ev-btn, .ev-action, .ev-seg { transition: none; }
  .ev-card:hover { transform: none; }
  .ev-card:hover .ev-card-media img { transform: none; }
}
`;

export default injectEventsStyles;
