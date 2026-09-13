/**
 * Structural styles for the workspace shell.
 *
 * These live here rather than in `src/style.css` for one reason: they describe
 * LAYOUT that the shell itself owns — which section is on screen, how the studio
 * stage splits between canvas and edit panel — and that has to stay correct
 * independently of the visual design pass. Colour comes from the shared tokens;
 * nothing here picks a colour of its own.
 *
 * Injected once, in the same way `EventDetailsPanel` and the CRM screens do.
 */

const STYLE_ID = 'helm-shell-styles';

export function ensureShellStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
/* ---------------------------------------------------------------- sections */
.plan-only.hidden { display: none !important; }

/* ------------------------------------------------------------ studio stage */
/*
  The stage is a two-column grid: the venue on the left, the edit panel on the
  right. In view mode the panel column collapses to zero, so the venue genuinely
  fills the frame — it is not covered and then revealed, it is the only thing
  there. In edit mode the panel takes a column and the canvas SHRINKS, which is
  what lets you watch the venue change while you edit it.
*/
.studio-stage {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 0;
  transition: grid-template-columns 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
  min-height: 0;
}

.studio-stage[data-mode="edit"] {
  grid-template-columns: minmax(0, 1fr) clamp(320px, 26vw, 420px);
}

.studio-canvas-wrap {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.canvas-360-holder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* The mode bar is a thin strip floating over the top of the canvas. It is the
   only thing allowed to overlap the venue, and it stays out of the middle. */
.studio-mode-bar-host {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  pointer-events: none;
}
.studio-mode-bar-host > * { pointer-events: auto; }

.studio-edit-panel-host {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--border-soft);
  background: var(--bg-surface);
}

.studio-edit-panel-host[hidden] { display: none; }

/* ------------------------------------------------------------------ mobile */
/*
  Below 840px a side dock leaves no venue. The panel becomes a bottom sheet: the
  venue keeps the top half, the panel takes the bottom half, and the venue is
  still visible while you change it — which is the requirement, not the shape.
*/
@media (max-width: 840px) {
  .studio-stage,
  .studio-stage[data-mode="edit"] {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: minmax(0, 1fr) 0;
  }
  .studio-stage[data-mode="edit"] {
    grid-template-rows: minmax(0, 1fr) min(52vh, 460px);
  }
  .studio-edit-panel-host {
    border-left: 0;
    border-top: 1px solid var(--border-soft);
  }
}

@media (prefers-reduced-motion: reduce) {
  .studio-stage { transition: none; }
}
`;
  document.head.appendChild(style);
}
