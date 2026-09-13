/**
 * popover.js — the ONE anchored-overlay primitive for the whole shell.
 *
 * Why this exists
 * ---------------
 * Every dropdown in this app was anchored inside a container that clips its
 * children — `#roleBadgeSlot` and `#presetPopoverWrapper` carry `overflow:hidden`,
 * `.nav-actions-group` and `#studioActionStrip` scroll horizontally. An absolutely
 * positioned menu inside those is painted and then clipped to nothing, and even a
 * `position:fixed` one is clipped once an ancestor carries `backdrop-filter`
 * (which the header does — that makes it a containing block for fixed children).
 * The menus were never missing. They were invisible.
 *
 * The only durable fix is to stop anchoring in the DOM and start anchoring in
 * coordinates: the panel is rendered into a body-level layer that nothing clips,
 * and positioned against its trigger's rect on open, on scroll, and on resize.
 *
 * What it guarantees
 * ------------------
 *   • Never clipped: one `#helm-popover-layer` directly under <body>.
 *   • Stays put: repositions on scroll (capture phase, so inner scrollers count),
 *     on resize, and whenever the panel itself changes size.
 *   • Flips and shifts: prefers `below`, flips above when the viewport is short,
 *     shifts along the cross axis rather than hanging off screen, and caps its
 *     own height to the space that is actually available.
 *   • Closes honestly: Escape, outside pointerdown, a second click on the trigger.
 *   • Focus is managed, not trapped. Opening moves focus to the first item; closing
 *     returns it to the trigger — but only when focus is still inside the panel, so
 *     clicking elsewhere never yanks the caret back.
 *   • `aria-expanded` / `aria-controls` / `aria-haspopup` are kept in step.
 *   • Honours `prefers-reduced-motion`: no entry transform, no transition.
 *
 * Colour comes from tokens only; this file picks no colour of its own.
 */

const LAYER_ID = 'helm-popover-layer';
const STYLE_ID = 'helm-popover-styles';

const GAP = 8;     // trigger → panel
const MARGIN = 8;  // panel → viewport edge

let seq = 0;

/* ------------------------------------------------------------------ styles */

export function ensurePopoverStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#${LAYER_ID} {
  position: fixed;
  inset: 0;
  z-index: var(--z-popover, 700);
  pointer-events: none;
}
#${LAYER_ID} > .helm-popover {
  position: fixed;
  top: 0;
  left: 0;
  pointer-events: auto;
  box-sizing: border-box;
  max-width: calc(100vw - ${MARGIN * 2}px);
  overflow: auto;
  overscroll-behavior: contain;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 120ms ease, transform 120ms ease;
}
#${LAYER_ID} > .helm-popover[data-flip="above"] { transform: translateY(4px); }
#${LAYER_ID} > .helm-popover.is-shown { opacity: 1; transform: none; }
#${LAYER_ID} > .helm-popover[hidden] { display: none !important; }

/* A popover that brings no surface of its own gets the shared one. */
#${LAYER_ID} > .helm-popover.helm-popover-surface {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md, 14px);
  box-shadow: var(--shadow-lg);
  padding: var(--space-1, 4px);
}

@media (prefers-reduced-motion: reduce) {
  #${LAYER_ID} > .helm-popover,
  #${LAYER_ID} > .helm-popover[data-flip="above"] {
    transition: none;
    transform: none;
  }
}`;
  document.head.appendChild(style);
}

/** The single body-level layer. Created on first use. */
export function popoverLayer() {
  let layer = document.getElementById(LAYER_ID);
  if (!layer) {
    ensurePopoverStyles();
    layer = document.createElement('div');
    layer.id = LAYER_ID;
    document.body.appendChild(layer);
  }
  return layer;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

function focusables(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE))
    .filter(el => el.offsetParent !== null || el === document.activeElement);
}

/* ------------------------------------------------------------ the controller */

/**
 * @param {object} options
 * @param {HTMLElement|(()=>HTMLElement)} options.trigger  the anchor element.
 * @param {HTMLElement} [options.element] adopt existing markup instead of creating it.
 * @param {string} [options.className]   extra classes on the panel.
 * @param {boolean} [options.surface=true] paint the shared surface.
 * @param {string} [options.role='menu'] ARIA role for the panel.
 * @param {string} [options.label]       aria-label for the panel.
 * @param {'below'|'above'} [options.placement='below']
 * @param {'start'|'end'|'center'} [options.align='end'] cross-axis alignment.
 * @param {boolean} [options.matchTriggerWidth=false]
 * @param {number}  [options.minWidth]
 * @param {number}  [options.maxWidth]
 * @param {()=>(string|Node)} [options.render] content factory, run on every open.
 * @param {Function} [options.onOpen] @param {Function} [options.onClose]
 */
export function createPopover(options = {}) {
  const opts = {
    surface: true, role: 'menu', placement: 'below', align: 'end',
    matchTriggerWidth: false, ...options
  };

  // `element` ADOPTS markup that already exists in index.html (the design-preset
  // menu is authored there) and moves it into the layer, so the markup keeps its
  // one home and only the anchoring changes.
  const panel = opts.element || document.createElement('div');
  const id = panel.id || `helm-popover-${++seq}`;
  panel.id = id;
  panel.classList.add('helm-popover');
  if (opts.surface) panel.classList.add('helm-popover-surface');
  if (opts.className) opts.className.split(/\s+/).filter(Boolean).forEach(c => panel.classList.add(c));
  // The old show/hide mechanism was a `.hidden` class toggled by hand; the
  // popover owns visibility now, through the `hidden` attribute.
  panel.classList.remove('hidden');
  if (opts.role && !panel.getAttribute('role')) panel.setAttribute('role', opts.role);
  if (opts.label && !panel.getAttribute('aria-label')) panel.setAttribute('aria-label', opts.label);
  panel.hidden = true;
  popoverLayer().appendChild(panel);

  let open = false;
  let resizeObserver = null;

  const triggerEl = () => (typeof opts.trigger === 'function' ? opts.trigger() : opts.trigger);

  /* ----------------------------------------------------------- positioning */

  function position() {
    const trigger = triggerEl();
    if (!trigger || !trigger.isConnected) return;
    const r = trigger.getBoundingClientRect();

    // A trigger scrolled out of its own scroller should take its menu with it.
    if (r.bottom < -4 || r.top > window.innerHeight + 4) { close(); return; }

    panel.style.maxHeight = '';
    if (opts.matchTriggerWidth) panel.style.minWidth = `${Math.round(r.width)}px`;
    else if (opts.minWidth) panel.style.minWidth = `${opts.minWidth}px`;
    if (opts.maxWidth) {
      panel.style.maxWidth = `min(${opts.maxWidth}px, calc(100vw - ${MARGIN * 2}px))`;
    }

    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const spaceBelow = vh - r.bottom - GAP - MARGIN;
    const spaceAbove = r.top - GAP - MARGIN;

    let height = panel.offsetHeight;
    let above = opts.placement === 'above';
    // Flip only when the other side is genuinely roomier — a flip that gains
    // nothing just makes the menu jump.
    if (!above && height > spaceBelow && spaceAbove > spaceBelow) above = true;
    else if (above && height > spaceAbove && spaceBelow > spaceAbove) above = false;

    const room = Math.max(120, above ? spaceAbove : spaceBelow);
    if (height > room) {
      panel.style.maxHeight = `${Math.round(room)}px`;
      height = panel.offsetHeight;
    }
    panel.dataset.flip = above ? 'above' : 'below';

    const width = panel.offsetWidth;
    let left = opts.align === 'start' ? r.left
      : opts.align === 'center' ? r.left + (r.width - width) / 2
        : r.right - width;
    left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - width - MARGIN));

    const top = above ? Math.max(MARGIN, r.top - GAP - height) : r.bottom + GAP;

    // Inline, because a borrowed class (`.role-menu`, `.preset-popover-menu`)
    // may still carry the `right`/`bottom` anchoring it used in its old home.
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  /* --------------------------------------------------------------- content */

  function setContent(content) {
    if (content == null) return;
    if (typeof content === 'string') panel.innerHTML = content;
    else { panel.innerHTML = ''; panel.appendChild(content); }
    if (open) position();
  }

  /* ---------------------------------------------------------------- events */

  const onDocPointerDown = (event) => {
    if (!open) return;
    const trigger = triggerEl();
    if (panel.contains(event.target)) return;
    if (trigger && trigger.contains(event.target)) return; // the trigger toggles
    close({ restoreFocus: false });
  };

  const onDocKeydown = (event) => {
    if (!open) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      event.preventDefault();
      close();
      return;
    }
    if (!panel.contains(event.target)) return;
    if (event.key === 'Tab') {
      // Not a trap: leaving the panel by keyboard closes it, as a menu should.
      const items = focusables(panel);
      const last = items[items.length - 1];
      const first = items[0];
      if ((!event.shiftKey && event.target === last) || (event.shiftKey && event.target === first)) {
        close({ restoreFocus: false });
      }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' &&
        event.key !== 'Home' && event.key !== 'End') return;
    const items = focusables(panel);
    if (!items.length) return;
    event.preventDefault();
    const i = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (i + 1 + items.length) % items.length
          : (i - 1 + items.length) % items.length;
    items[next].focus();
  };

  const reposition = () => { if (open) position(); };

  /* ------------------------------------------------------------ open/close */

  function doOpen() {
    if (open) return;
    if (typeof opts.render === 'function') {
      const content = opts.render();
      if (content != null) setContent(content);
    }
    open = true;
    panel.hidden = false;
    position();
    // Two frames: one to let layout settle after `hidden` came off, one to let
    // the entry transition actually run from its start state.
    requestAnimationFrame(() => {
      position();
      panel.classList.add('is-shown');
    });

    const trigger = triggerEl();
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'true');
      trigger.setAttribute('aria-controls', id);
      if (!trigger.hasAttribute('aria-haspopup')) {
        trigger.setAttribute('aria-haspopup', opts.role === 'dialog' ? 'dialog' : 'menu');
      }
    }

    document.addEventListener('pointerdown', onDocPointerDown, true);
    document.addEventListener('keydown', onDocKeydown, true);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(reposition);
      resizeObserver.observe(panel);
      if (trigger) resizeObserver.observe(trigger);
    }

    if (opts.onOpen) opts.onOpen(panel);
    focusFirst();
  }

  function focusFirst() {
    const items = focusables(panel);
    if (items.length) items[0].focus();
    else {
      panel.tabIndex = -1;
      panel.focus({ preventScroll: true });
    }
  }

  function close({ restoreFocus = true } = {}) {
    if (!open) return;
    const hadFocus = panel.contains(document.activeElement);
    open = false;
    panel.classList.remove('is-shown');
    panel.hidden = true;

    const trigger = triggerEl();
    if (trigger) trigger.setAttribute('aria-expanded', 'false');

    document.removeEventListener('pointerdown', onDocPointerDown, true);
    document.removeEventListener('keydown', onDocKeydown, true);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition, true);
    if (resizeObserver) { resizeObserver.disconnect(); resizeObserver = null; }

    if (opts.onClose) opts.onClose(panel);
    // Only reclaim focus we actually held. Stealing it back after an outside
    // click is how "the page keeps jumping to the top bar" bugs are born.
    if (restoreFocus && hadFocus && trigger && trigger.isConnected) trigger.focus();
  }

  function destroy() {
    close({ restoreFocus: false });
    panel.remove();
  }

  return {
    id,
    element: panel,
    isOpen: () => open,
    open: doOpen,
    close,
    toggle: () => (open ? close() : doOpen()),
    setContent,
    update: reposition,
    destroy
  };
}

export default createPopover;
