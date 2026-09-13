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

/* ------------------------------------------------------- studio action strip */
/*
  Studio actions live below the header rather than in it. Putting them in the
  global chrome is what made the navbar four rows tall, and they are meaningless
  outside the Studio anyway.
*/
.studio-action-strip {
  display: flex;
  align-items: center;
  gap: var(--space-2, 8px);
  padding: var(--space-2, 8px) var(--space-4, 16px);
  border-bottom: 1px solid var(--border-soft);
  background: var(--bg-elevated);
  overflow-x: auto;
  scrollbar-width: none;
  flex: 0 0 auto;
}
.studio-action-strip::-webkit-scrollbar { display: none; }
.studio-action-strip.hidden { display: none !important; }
.studio-action-strip > * { flex: 0 0 auto; }

/* ------------------------------------------------------------ navbar order */
/*
  Priority when width runs out. The section switcher is the primary navigation of
  the whole product and must never be the thing that clips — at 1512 it was losing
  61px while search sat at its full width. Search gives up space first, then the
  brand, then the view tabs.
*/
.app-navbar > .section-switcher { flex: 0 1 auto; min-width: max-content; }
.app-navbar > .nav-search-wrapper { flex: 1 1 90px; min-width: 90px; }
.app-navbar > .nav-brand { flex: 0 1 auto; min-width: 0; }

/* The Plan tab group sits in the same slot as the Studio one. Without an explicit
   order it defaults to 0 and jumps in front of the brand. */
.app-navbar > .plan-only { order: 3; flex: 0 1 auto; min-width: 0; }
.app-navbar > .studio-only { order: 3; }

@media (max-width: 1180px) {
  /* Below this the switcher may scroll rather than force the row to wrap. */
  .app-navbar > .section-switcher { min-width: 0; overflow-x: auto; scrollbar-width: none; }
  .app-navbar > .section-switcher::-webkit-scrollbar { display: none; }
}

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

/* ---------------------------------------------------------------- hotspots */
/*
  In VIEW mode the venue is the product and nothing should compete with it. The
  hotspot cards — image, label and price per slot — collapse to a quiet beacon
  that only opens its card on hover or keyboard focus. In EDIT mode they are
  working controls again and stay open, because that is when you are aiming at them.

  This is presentation only: the cards keep their position, their data and their
  click handlers in both modes, so nothing about the interaction is lost.
*/
body[data-studio-mode="view"] .hs-card .hs-card-inner {
  opacity: 0;
  transform: scale(0.94);
  pointer-events: none;
  transition: opacity 160ms ease, transform 160ms ease;
}

body[data-studio-mode="view"] .hs-card:hover .hs-card-inner,
body[data-studio-mode="view"] .hs-card:focus-within .hs-card-inner {
  opacity: 1;
  transform: none;
  pointer-events: auto;
}

body[data-studio-mode="view"] .hs-beacon {
  opacity: 0.55;
  transform: scale(0.8);
  transition: opacity 160ms ease, transform 160ms ease;
}

body[data-studio-mode="view"] .hs-card:hover .hs-beacon,
body[data-studio-mode="view"] .hs-card:focus-within .hs-beacon {
  opacity: 1;
  transform: none;
}

/* The composited-layer notice is an EDITING disclosure. It belongs where the
   swap is being made, not across the venue during a client presentation. */
/* Viewer360 sets this element's display via inline cssText, so an ordinary rule
   loses to it — !important is the correct tool here, not a code smell. */
body[data-studio-mode="view"] .v360-composite-note { display: none !important; }

@media (prefers-reduced-motion: reduce) {
  body[data-studio-mode="view"] .hs-card .hs-card-inner,
  body[data-studio-mode="view"] .hs-beacon { transition: none; }
}

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
