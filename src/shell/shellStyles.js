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
  The stage splits between the venue and the edit panel. The panel module styles
  the stage as a flex row, so these rules use ID specificity to stay authoritative
  about SIZING regardless of injection order — two stylesheets each thinking they
  own the split is how the panel ended up 1px wide with the canvas at full width.

  In view mode the panel column is zero, so the venue genuinely fills the frame —
  it is not covered and then revealed, it is the only thing there. In edit mode the
  panel takes its width and the canvas SHRINKS, which is the point: you watch the
  venue change while you change it.
*/
#studioStage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: stretch;
  min-height: 0;
  overflow: hidden;
}

#studioStage > .studio-canvas-wrap {
  position: relative;
  flex: 1 1 0%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

#canvas360Holder {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* The mode bar is the ONLY thing allowed over the venue, and it hugs the top. */
#studioModeBarHost {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 20;
  pointer-events: none;
}
#studioModeBarHost > * { pointer-events: auto; }

#studioEditPanelHost {
  flex: 0 0 auto;
  width: clamp(320px, 26vw, 420px);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-left: 1px solid var(--border-soft);
  background: var(--bg-surface);
  transition: width 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
}

#studioStage:not([data-mode="edit"]) > #studioEditPanelHost {
  width: 0;
  border-left-width: 0;
}

#studioEditPanelHost[hidden] { display: none; }

/* ------------------------------------------------------------------ mobile */
/*
  Below 840px a side dock leaves no venue. The panel becomes a bottom sheet: the
  venue keeps the top half, the panel takes the bottom half, and the venue is
  still visible while you change it — which is the requirement, not the shape.
*/
@media (max-width: 840px) {
  #studioStage { flex-direction: column; }
  #studioStage > #studioEditPanelHost {
    width: auto;
    height: min(52vh, 460px);
    border-left: 0;
    border-top: 1px solid var(--border-soft);
    transition: height 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }
  #studioStage:not([data-mode="edit"]) > #studioEditPanelHost {
    width: auto;
    height: 0;
    border-top-width: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  #studioEditPanelHost { transition: none; }
}
`;
  document.head.appendChild(style);
}
