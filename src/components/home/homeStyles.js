/**
 * homeStyles.js — the single stylesheet for the role-based home screen.
 *
 * Injected once, on first render, exactly like EventDetailsPanel does it.
 * `src/style.css` belongs to the orchestrator, so the home screen carries its
 * own styles rather than editing a file it does not own.
 *
 * Rules followed here:
 *  - Every colour is a CSS custom property from src/style.css. No hex literals
 *    except inside the var() fallbacks, which mirror the dark-theme value.
 *  - Both themes must be legible: nothing relies on a fixed light/dark colour.
 *  - Numbers use tabular figures so columns of rupees line up.
 */

const STYLE_ID = 'helm-home-styles';

export function injectHomeStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

const CSS = `
.hh {
  --hh-gap: var(--space-5, 20px);
  font-family: var(--font-attio, Inter, system-ui, sans-serif);
  color: var(--text-main, #f5f5f7);
  max-width: 1280px;
  margin: 0 auto;
  padding: clamp(18px, 3vw, 38px) clamp(14px, 3vw, 32px) 64px;
  display: flex;
  flex-direction: column;
  gap: clamp(18px, 2.4vw, 30px);
}
.hh *, .hh *::before, .hh *::after { box-sizing: border-box; }
.hh :focus-visible {
  outline: none;
  box-shadow: var(--focus-ring, 0 0 0 3px rgba(64,156,255,0.55));
  border-radius: var(--radius-ms, 12px);
}
.hh-num {
  font-variant-numeric: tabular-nums;
  font-feature-settings: 'tnum' 1;
  letter-spacing: -0.02em;
}

/* ---------------------------------------------------------- greeting row */
.hh-top {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: var(--space-4, 16px); flex-wrap: wrap;
}
.hh-greet h1 {
  margin: 0; font-size: clamp(1.25rem, 2.4vw, 1.6rem);
  font-weight: 640; letter-spacing: -0.025em;
}
.hh-greet p {
  margin: 5px 0 0; font-size: var(--fs-sm, 0.8125rem);
  color: var(--text-dim, #98989d);
}
.hh-rolechip {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px 6px 9px; border-radius: var(--radius-pill, 999px);
  background: var(--glass-1, rgba(255,255,255,0.07));
  border: 1px solid var(--border-glass, rgba(255,255,255,0.14));
  font-size: var(--fs-xs, 0.75rem); font-weight: 560;
  color: var(--text-muted, #a1a1a6); white-space: nowrap;
}
.hh-rolechip .hh-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent-indigo, #409cff); }

/* ------------------------------------------------------------- hero band */
.hh-hero {
  position: relative; overflow: hidden;
  display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr);
  gap: clamp(16px, 3vw, 40px); align-items: center;
  padding: clamp(20px, 3vw, 34px);
  border-radius: var(--radius-lg, 24px);
  border: 1px solid var(--border-glass, rgba(255,255,255,0.14));
  background:
    radial-gradient(120% 160% at 0% 0%, var(--tint-indigo, rgba(10,132,255,0.16)), transparent 62%),
    var(--bg-surface, #1c1c1e);
  box-shadow: var(--shadow-card, 0 4px 20px rgba(0,0,0,0.4));
}
.hh-hero::after {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(180deg, var(--accent-indigo, #409cff), transparent);
  opacity: 0.9;
}
.hh-hero.is-warn { background: radial-gradient(120% 160% at 0% 0%, var(--tint-amber, rgba(251,191,36,0.15)), transparent 62%), var(--bg-surface, #1c1c1e); }
.hh-hero.is-warn::after { background: linear-gradient(180deg, var(--accent-amber, #fbbf24), transparent); }
.hh-hero-label {
  margin: 0; font-size: var(--fs-xs, 0.75rem); font-weight: 620;
  letter-spacing: 0.09em; text-transform: uppercase;
  color: var(--text-dim, #98989d);
}
.hh-hero-value {
  margin: 10px 0 0; font-weight: 680; line-height: 0.98;
  font-size: clamp(2.35rem, 6.4vw, 4rem);
}
.hh-hero-sub { margin: 12px 0 0; font-size: var(--fs-md, 0.875rem); color: var(--text-muted, #a1a1a6); max-width: 46ch; }
.hh-hero-cta { margin-top: 18px; display: flex; gap: 10px; flex-wrap: wrap; }

.hh-hero-side { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.hh-fact {
  display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
  padding: 11px 14px; border-radius: var(--radius-ms, 12px);
  background: var(--glass-1, rgba(255,255,255,0.07));
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
}
.hh-fact dt { margin: 0; font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d); }
.hh-fact dd { margin: 0; font-size: var(--fs-lg, 1rem); font-weight: 620; }

/* --------------------------------------------------------------- buttons */
.hh-btn {
  display: inline-flex; align-items: center; gap: 7px; cursor: pointer;
  padding: 9px 15px; border-radius: var(--radius-pill, 999px);
  font-family: inherit; font-size: var(--fs-sm, 0.8125rem); font-weight: 570;
  border: 1px solid var(--btn-secondary-border, rgba(255,255,255,0.12));
  background: var(--btn-secondary-bg, #2c2c2e);
  color: var(--btn-secondary-text, #f5f5f7);
  transition: var(--transition-fast, all 0.2s ease);
}
.hh-btn:hover { background: var(--btn-secondary-hover, #3a3a3c); }
.hh-btn.is-primary {
  background: var(--btn-primary-bg, #0a6ed9);
  color: var(--btn-primary-text, #fff);
  border-color: transparent;
}
.hh-btn.is-primary:hover { background: var(--btn-primary-hover, #1a7ee9); }

/* ------------------------------------------------------------- KPI tiles */
.hh-kpis {
  display: grid; gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}
.hh-tile {
  position: relative; text-align: left; cursor: pointer;
  display: flex; flex-direction: column; gap: 6px; min-width: 0;
  padding: 16px 17px 15px; font-family: inherit;
  border-radius: var(--radius-card, 18px);
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
  background: var(--bg-surface, #1c1c1e);
  color: inherit;
  transition: var(--transition-fast, all 0.2s ease);
}
.hh-tile:hover {
  background: var(--bg-surface-hover, #2c2c2e);
  border-color: var(--border-strong, rgba(255,255,255,0.2));
  transform: translateY(-1px);
}
.hh-tile-k {
  font-size: var(--fs-xs, 0.75rem); font-weight: 580; letter-spacing: 0.03em;
  color: var(--text-dim, #98989d);
  display: flex; align-items: center; gap: 7px;
}
.hh-tile-v { font-size: clamp(1.35rem, 2.6vw, 1.75rem); font-weight: 660; line-height: 1.05; }
.hh-tile-m { font-size: var(--fs-xs, 0.75rem); color: var(--text-muted, #a1a1a6); }
.hh-tile-go {
  position: absolute; top: 14px; right: 14px; font-size: 0.9rem;
  color: var(--text-dim, #98989d); opacity: 0; transform: translateX(-3px);
  transition: var(--transition-fast, all 0.2s ease);
}
.hh-tile:hover .hh-tile-go, .hh-tile:focus-visible .hh-tile-go { opacity: 1; transform: none; }
.hh-tile .hh-swatch { width: 8px; height: 8px; border-radius: 2px; background: var(--accent-indigo, #409cff); }
.hh-tile[data-tone="rose"] .hh-swatch { background: var(--accent-rose, #ff6961); }
.hh-tile[data-tone="amber"] .hh-swatch { background: var(--accent-amber, #fbbf24); }
.hh-tile[data-tone="emerald"] .hh-swatch { background: var(--accent-emerald, #30d158); }
.hh-tile[data-tone="violet"] .hh-swatch { background: var(--accent-violet, #a78bfa); }
.hh-tile[data-tone="rose"] { border-color: var(--tint-rose, rgba(255,69,58,0.15)); }

/* ------------------------------------------------------------ section box */
.hh-card {
  border-radius: var(--radius-card, 18px);
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
  background: var(--bg-surface, #1c1c1e);
  overflow: hidden;
}
.hh-card-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 15px 18px; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
}
.hh-card-head h2 {
  margin: 0; font-size: var(--fs-md, 0.875rem); font-weight: 640; letter-spacing: -0.01em;
  display: flex; align-items: center; gap: 9px;
}
.hh-count {
  font-size: var(--fs-xs, 0.75rem); font-weight: 620; padding: 2px 8px;
  border-radius: var(--radius-pill, 999px);
  background: var(--glass-2, rgba(255,255,255,0.12)); color: var(--text-muted, #a1a1a6);
}
.hh-count.is-hot { background: var(--tint-rose, rgba(255,69,58,0.15)); color: var(--accent-rose, #ff6961); }
.hh-card-head .hh-link {
  background: none; border: 0; cursor: pointer; font-family: inherit; padding: 4px 6px;
  font-size: var(--fs-xs, 0.75rem); font-weight: 560; color: var(--accent-indigo, #409cff);
}
.hh-card-head .hh-link:hover { text-decoration: underline; }

/* --------------------------------------------------- "needs you" list */
.hh-needs { list-style: none; margin: 0; padding: 0; }
.hh-need {
  display: grid; grid-template-columns: 4px minmax(0,1fr) auto auto;
  align-items: center; gap: 14px; width: 100%;
  padding: 13px 18px; text-align: left; cursor: pointer;
  background: none; border: 0; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
  color: inherit; font-family: inherit;
  transition: background 0.15s ease;
}
.hh-needs li:last-child .hh-need { border-bottom: 0; }
.hh-need:hover { background: var(--glass-1, rgba(255,255,255,0.07)); }
.hh-need-bar { width: 4px; height: 30px; border-radius: 3px; background: var(--accent-indigo, #409cff); }
.hh-need[data-sev="critical"] .hh-need-bar { background: var(--accent-rose, #ff6961); }
.hh-need[data-sev="warn"] .hh-need-bar { background: var(--accent-amber, #fbbf24); }
.hh-need[data-sev="info"] .hh-need-bar { background: var(--accent-sky, #38bdf8); }
.hh-need-t { display: block; font-size: var(--fs-md, 0.875rem); font-weight: 570; line-height: 1.35; }
.hh-need-m { display: block; font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d); margin-top: 3px; }
.hh-need-r { font-size: var(--fs-md, 0.875rem); font-weight: 620; white-space: nowrap; text-align: right; }
.hh-need-r small { display: block; font-size: var(--fs-xs, 0.75rem); font-weight: 500; color: var(--text-dim, #98989d); }
.hh-need-go { color: var(--text-dim, #98989d); font-size: 0.85rem; }

/* clock pill for enquiry ageing */
.hh-clock {
  display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;
  padding: 3px 9px; border-radius: var(--radius-pill, 999px);
  font-size: var(--fs-xs, 0.75rem); font-weight: 640;
  background: var(--tint-emerald, rgba(48,209,88,0.15)); color: var(--accent-emerald, #30d158);
}
.hh-clock[data-sla="warn"] { background: var(--tint-amber, rgba(251,191,36,0.15)); color: var(--accent-amber, #fbbf24); }
.hh-clock[data-sla="late"] { background: var(--tint-rose, rgba(255,69,58,0.15)); color: var(--accent-rose, #ff6961); }

/* ------------------------------------------------------------ two column */
.hh-split { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); gap: clamp(14px, 2vw, 22px); align-items: start; }

/* -------------------------------------------------------- calendar strip */
.hh-days { display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 8px; padding: 14px; }
.hh-day {
  min-height: 92px; padding: 9px 8px; cursor: pointer; text-align: left; font-family: inherit;
  border-radius: var(--radius-sm, 10px); color: inherit;
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
  background: var(--glass-1, rgba(255,255,255,0.07));
  display: flex; flex-direction: column; gap: 5px; min-width: 0;
  transition: var(--transition-fast, all 0.2s ease);
}
.hh-day:hover { background: var(--glass-2, rgba(255,255,255,0.12)); }
.hh-day.is-today { border-color: var(--accent-indigo, #409cff); }
.hh-day-d { font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d); }
.hh-day-n { font-size: var(--fs-lg, 1rem); font-weight: 620; line-height: 1; }
.hh-chip {
  font-size: 0.66rem; font-weight: 580; padding: 3px 6px; border-radius: 5px;
  background: var(--tint-indigo, rgba(10,132,255,0.16)); color: var(--accent-indigo, #409cff);
  overflow: hidden; line-height: 1.25; text-align: left;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.hh-chip[data-kind="live"] { background: var(--tint-rose, rgba(255,69,58,0.15)); color: var(--accent-rose, #ff6961); }
.hh-chip[data-kind="money"] { background: var(--tint-emerald, rgba(48,209,88,0.15)); color: var(--accent-emerald, #30d158); }

/* -------------------------------------------------------------- activity */
.hh-acts { list-style: none; margin: 0; padding: 6px 0; }
.hh-act { display: flex; gap: 11px; padding: 9px 18px; align-items: flex-start; }
.hh-act-i {
  flex: 0 0 auto; width: 22px; height: 22px; border-radius: 50%; margin-top: 1px;
  display: grid; place-items: center; font-size: 0.62rem; font-weight: 700;
  background: var(--glass-2, rgba(255,255,255,0.12)); color: var(--text-muted, #a1a1a6);
}
.hh-act-t { display: block; font-size: var(--fs-sm, 0.8125rem); line-height: 1.45; }
.hh-act-w { display: block; font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d); margin-top: 2px; }

/* ----------------------------------------------------- receivables table */
.hh-tablewrap { overflow-x: auto; }
.hh-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm, 0.8125rem); min-width: 660px; }
.hh-table th, .hh-table td { padding: 11px 14px; text-align: left; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.1)); }
.hh-table th {
  font-size: var(--fs-xs, 0.75rem); font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase;
  color: var(--text-dim, #98989d); background: var(--glass-1, rgba(255,255,255,0.07));
  position: sticky; top: 0;
}
.hh-table td.hh-r, .hh-table th.hh-r { text-align: right; font-variant-numeric: tabular-nums; }
.hh-table tbody tr { cursor: pointer; }
.hh-table tbody tr:hover { background: var(--glass-1, rgba(255,255,255,0.07)); }
.hh-table tfoot td { font-weight: 660; border-bottom: 0; background: var(--glass-1, rgba(255,255,255,0.07)); }
.hh-age { font-weight: 620; }
.hh-age[data-b="0"] { color: var(--text-muted, #a1a1a6); }
.hh-age[data-b="30"] { color: var(--accent-amber, #fbbf24); }
.hh-age[data-b="60"] { color: var(--accent-rose, #ff6961); }
.hh-age[data-b="90"] { color: var(--accent-rose, #ff6961); }
.hh-sub { font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d); margin-top: 2px; }

/* ------------------------------------------------------------ empty state */
.hh-empty { padding: 34px 22px; text-align: center; }
.hh-empty-mark {
  width: 42px; height: 42px; margin: 0 auto 12px; border-radius: var(--radius-ms, 12px);
  display: grid; place-items: center; font-size: 1.1rem;
  background: var(--glass-1, rgba(255,255,255,0.07));
  border: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
  color: var(--text-muted, #a1a1a6);
}
.hh-empty h3 { margin: 0 0 6px; font-size: var(--fs-md, 0.875rem); font-weight: 620; }
.hh-empty p { margin: 0 auto; max-width: 44ch; font-size: var(--fs-sm, 0.8125rem); color: var(--text-dim, #98989d); line-height: 1.5; }
.hh-empty .hh-btn { margin-top: 16px; }
.hh-empty.is-good .hh-empty-mark { background: var(--tint-emerald, rgba(48,209,88,0.15)); color: var(--accent-emerald, #30d158); border-color: transparent; }

/* ------------------------------------------------------------ honest note */
.hh-honest {
  font-size: var(--fs-xs, 0.75rem); color: var(--text-dim, #98989d);
  line-height: 1.55; text-align: center; padding-top: 4px;
}

/* ------------------------------------------------------------ responsive */
@media (max-width: 900px) {
  .hh-hero { grid-template-columns: minmax(0, 1fr); }
  .hh-split { grid-template-columns: minmax(0, 1fr); }
  .hh-days { grid-template-columns: repeat(4, minmax(0,1fr)); }
}
@media (max-width: 560px) {
  .hh-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .hh-days { grid-template-columns: repeat(2, minmax(0,1fr)); }
  .hh-tile-go { display: none; }
  .hh-need { grid-template-columns: 4px minmax(0,1fr) auto; gap: 10px; padding: 12px 14px; }
  .hh-need-go { display: none; }
  .hh-top { align-items: flex-start; }
}
@media (prefers-reduced-motion: reduce) {
  .hh-tile, .hh-btn, .hh-day, .hh-tile-go { transition: none; }
  .hh-tile:hover { transform: none; }
}
`;
