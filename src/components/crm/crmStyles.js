/**
 * crmStyles.js — the CRM's own stylesheet, injected once.
 *
 * It lives here rather than in src/style.css because this module owns no file
 * in there. Every colour is a CSS custom property defined by the app theme, so
 * light and dark both work and nothing here needs a second rule. There is not
 * a single literal hex in this file — that is deliberate and must stay true.
 */

const STYLE_ID = 'helm-crm-styles';

const CSS = `
.crm { color: var(--text-main); font-family: var(--font-attio); padding: var(--space-6); }
.crm *, .crm *::before, .crm *::after { box-sizing: border-box; }
.crm-head { display: flex; flex-wrap: wrap; gap: var(--space-4); align-items: flex-end; justify-content: space-between; margin-bottom: var(--space-5); }
.crm-title { font-size: var(--fs-2xl); font-weight: 600; margin: 0; letter-spacing: -0.01em; }
.crm-sub { font-size: var(--fs-sm); color: var(--text-muted); margin: var(--space-1) 0 0; max-width: 62ch; }

/* KPI strip — never more than five, every one of them a link into a list. */
.crm-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: var(--space-3); margin-bottom: var(--space-5); }
.crm-kpi { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: var(--space-4); text-align: left; font: inherit; color: inherit; cursor: pointer; transition: var(--transition-fast); }
.crm-kpi:hover { background: var(--bg-surface-hover); }
.crm-kpi:focus-visible, .crm :focus-visible { outline: 2px solid var(--focus-color); outline-offset: 2px; box-shadow: var(--focus-ring); }
.crm-kpi-label { display: block; font-size: var(--fs-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
.crm-kpi-value { display: block; font-family: var(--font-mono); font-size: var(--fs-2xl); font-variant-numeric: tabular-nums; margin-top: var(--space-2); }
.crm-kpi-note { display: block; font-size: var(--fs-xs); color: var(--text-dim); margin-top: var(--space-1); }
.crm-kpi[data-tone="danger"] .crm-kpi-value { color: var(--accent-rose); }
.crm-kpi[data-tone="good"] .crm-kpi-value { color: var(--accent-emerald); }
.crm-kpi[data-tone="warn"] .crm-kpi-value { color: var(--accent-amber); }

.crm-toolbar { display: flex; flex-wrap: wrap; gap: var(--space-2); align-items: center; margin-bottom: var(--space-4); }
.crm-input, .crm-select { background: var(--bg-input); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font: inherit; font-size: var(--fs-sm); }
.crm-input { min-width: 240px; }
.crm-btn { background: var(--btn-secondary-bg); color: var(--btn-secondary-text); border: 1px solid var(--btn-secondary-border); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font: inherit; font-size: var(--fs-sm); cursor: pointer; transition: var(--transition-fast); }
.crm-btn:hover { background: var(--btn-secondary-hover); }
.crm-btn[data-variant="primary"] { background: var(--btn-primary-bg); color: var(--btn-primary-text); border-color: transparent; }
.crm-btn[data-variant="primary"]:hover { background: var(--btn-primary-hover); }

.crm-card { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: var(--space-4); }
.crm-section { margin-bottom: var(--space-6); }
.crm-section-title { font-size: var(--fs-lg); font-weight: 600; margin: 0 0 var(--space-1); }
.crm-section-note { font-size: var(--fs-xs); color: var(--text-muted); margin: 0 0 var(--space-3); max-width: 78ch; }

.crm-table-wrap { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-card); background: var(--bg-surface); }
.crm-table { width: 100%; border-collapse: collapse; font-size: var(--fs-sm); }
.crm-table th, .crm-table td { text-align: left; padding: var(--space-3); border-bottom: 1px solid var(--border-subtle); white-space: nowrap; }
.crm-table th { font-size: var(--fs-xs); text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); font-weight: 600; position: sticky; top: 0; background: var(--bg-surface); }
.crm-table tbody tr:last-child td { border-bottom: 0; }
.crm-table tbody tr:hover { background: var(--bg-surface-hover); }
.crm-num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; text-align: right; }
.crm-wrap-cell { white-space: normal; min-width: 220px; }

.crm-link { background: none; border: 0; padding: 0; font: inherit; color: var(--accent-indigo); cursor: pointer; text-align: left; }
.crm-link:hover { text-decoration: underline; }

.crm-chip { display: inline-flex; align-items: center; gap: var(--space-1); font-size: var(--fs-2xs); padding: 2px var(--space-2); border-radius: var(--radius-pill); border: 1px solid var(--border-subtle); color: var(--text-muted); }
.crm-chip[data-tone="good"] { background: var(--tint-emerald); color: var(--accent-emerald); border-color: transparent; }
.crm-chip[data-tone="danger"] { background: var(--tint-rose); color: var(--accent-rose); border-color: transparent; }
.crm-chip[data-tone="warn"] { background: var(--tint-gold); color: var(--accent-gold); border-color: transparent; }
.crm-chip[data-tone="info"] { background: var(--tint-indigo); color: var(--accent-indigo); border-color: transparent; }
.crm-chip[data-tone="muted"] { background: var(--bg-pill); }

.crm-empty { border: 1px dashed var(--border-strong); border-radius: var(--radius-card); padding: var(--space-8) var(--space-6); text-align: center; color: var(--text-muted); }
.crm-empty h3 { margin: 0 0 var(--space-2); font-size: var(--fs-lg); color: var(--text-main); }
.crm-empty p { margin: 0 auto var(--space-4); max-width: 52ch; font-size: var(--fs-sm); }

/* Two-phase board. One board, two swimlanes — sales and production are
   different pipelines with different owners and they must LOOK different. */
.crm-lane { margin-bottom: var(--space-6); }
.crm-lane-head { display: flex; align-items: baseline; gap: var(--space-3); margin-bottom: var(--space-3); }
.crm-lane-head h3 { margin: 0; font-size: var(--fs-md); text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
.crm-board { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(230px, 1fr); gap: var(--space-3); overflow-x: auto; padding-bottom: var(--space-3); }
.crm-col { background: var(--bg-app); border: 1px solid var(--border-subtle); border-radius: var(--radius-card); padding: var(--space-3); min-height: 140px; }
.crm-col[data-dropping="true"] { border-color: var(--accent-indigo); background: var(--tint-indigo); }
.crm-col-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: var(--space-3); gap: var(--space-2); }
.crm-col-name { font-size: var(--fs-sm); font-weight: 600; }
.crm-col-meta { font-size: var(--fs-2xs); color: var(--text-muted); font-family: var(--font-mono); }
.crm-deal { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-ms); padding: var(--space-3); margin-bottom: var(--space-2); cursor: grab; display: block; width: 100%; text-align: left; font: inherit; color: inherit; }
.crm-deal:hover { background: var(--bg-surface-hover); }
.crm-deal[data-dragging="true"] { opacity: 0.5; }
.crm-deal-title { font-size: var(--fs-sm); font-weight: 600; margin-bottom: 2px; }
.crm-deal-client { font-size: var(--fs-xs); color: var(--text-muted); }
.crm-deal-row { display: flex; justify-content: space-between; align-items: center; margin-top: var(--space-2); gap: var(--space-2); }
.crm-deal-value { font-family: var(--font-mono); font-size: var(--fs-sm); font-variant-numeric: tabular-nums; }

.crm-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--space-4); }
.crm-kv { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: var(--space-2) var(--space-3); font-size: var(--fs-sm); }
.crm-kv dt { color: var(--text-muted); }
.crm-kv dd { margin: 0; word-break: break-word; }
.crm-trail { list-style: none; margin: 0; padding: 0; }
.crm-trail li { display: flex; gap: var(--space-3); padding: var(--space-3) 0; border-bottom: 1px solid var(--border-subtle); font-size: var(--fs-sm); }
.crm-trail li:last-child { border-bottom: 0; }
.crm-trail time { color: var(--text-dim); font-family: var(--font-mono); font-size: var(--fs-xs); white-space: nowrap; }

.crm-note { font-size: var(--fs-xs); color: var(--text-dim); border-left: 2px solid var(--border-strong); padding-left: var(--space-3); margin: var(--space-3) 0; max-width: 80ch; line-height: 1.5; }
.crm-bar { height: 6px; border-radius: var(--radius-pill); background: var(--bg-pill); overflow: hidden; }
.crm-bar span { display: block; height: 100%; background: var(--accent-emerald); }

@media (max-width: 860px) {
  .crm { padding: var(--space-4); }
  .crm-split { grid-template-columns: minmax(0, 1fr); }
  .crm-kv { grid-template-columns: minmax(0, 1fr); gap: 0 0; }
  .crm-kv dt { margin-top: var(--space-3); font-size: var(--fs-xs); }
}
@media (prefers-reduced-motion: reduce) {
  .crm * { transition: none !important; }
}
`;

export function injectCrmStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

export default injectCrmStyles;
