import { escapeHtml } from '../utils/format.js';
import { drawQRToCanvas } from '../utils/qr.js';

/**
 * Renders a REAL, scannable QR code (src/utils/qr.js — a full ISO/IEC 18004
 * encoder) pointing at a deep link into this planner.
 *
 * Honesty note: the QR encodes a genuine URL that opens the Helm 360 planner
 * on the scanning device. It does NOT launch a native AR session — nothing in
 * this build does — so the copy says "open on your phone", not "view in AR".
 */

// At a 264px canvas with a 4-module quiet zone, QR version 16 (81x81 modules)
// is the largest symbol that still gets >=3 device pixels per module — the
// practical floor for a phone camera reading a code off a laptop screen.
// Version 16 at ECC level L holds ~442 bytes, so that is the URL ceiling.
const MAX_URL_LENGTH = 430;
const MAX_VERSION = 16;

export class ARQRGenerator {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.currentUrl = '';
    this.lastSymbol = null;
    this._bound = false;
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  /**
   * Build the link the QR encodes. Selections travel as a compact
   * `slot~item!slot~item` string so the URL stays short enough to scan.
   */
  buildUrl() {
    const base = `${location.origin}${location.pathname}`;
    const pairs = Object.entries(this.activeSelections || {})
      .filter(([key, value]) => typeof value === 'string' && value && !key.startsWith('custom_text_'))
      .map(([key, value]) => `${key.replace(/^slot-/, '')}~${value}`);

    const withState = `${base}?view=360&state=${encodeURIComponent(pairs.join('!'))}`;
    if (pairs.length && withState.length <= MAX_URL_LENGTH) {
      return { url: withState, includesState: true, itemCount: pairs.length };
    }
    return { url: `${base}?view=360`, includesState: false, itemCount: pairs.length };
  }

  render() {
    const { url, includesState, itemCount } = this.buildUrl();
    this.currentUrl = url;

    this.container.innerHTML = `
      <div class="modal-overlay qr-modal-overlay">
        <div class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-modal-title"
             style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:92%; max-width:680px;
                    background:var(--bg-surface); color:var(--text-main); border-radius:var(--radius-md);
                    box-shadow:var(--shadow-lg); z-index:var(--z-modal); overflow:hidden; display:flex;
                    flex-wrap:wrap; border:1px solid var(--border-subtle);">

          <div style="flex:1 1 280px; padding:var(--space-6); display:flex; flex-direction:column; align-items:center;
                      border-right:1px solid var(--border-subtle);">
            <h2 id="qr-modal-title" style="margin:0 0 var(--space-1) 0; font-size:var(--fs-xl); text-align:center;">
              Scan to open on your phone
            </h2>
            <p style="color:var(--text-muted); text-align:center; font-size:var(--fs-sm); margin:0 0 var(--space-5) 0;">
              A real QR code. Point any phone camera at it to open this venue setup in the 360° planner.
            </p>

            <!-- QR modules MUST stay true black on true white regardless of theme:
                 contrast is what makes a code scannable, not a style choice. -->
            <div style="padding:var(--space-3); background:#ffffff; border-radius:var(--radius-sm); margin-bottom:var(--space-4);">
              <canvas id="qr-canvas" width="264" height="264"
                      role="img" aria-label="QR code linking to this venue setup"
                      style="display:block; width:236px; height:236px; image-rendering:pixelated;"></canvas>
            </div>

            <p id="qr-meta" style="margin:0 0 var(--space-3) 0; font-size:var(--fs-2xs); color:var(--text-dim); text-align:center;"></p>

            <button id="download-qr-btn" class="btn-primary"
                    style="width:100%; padding:var(--space-3); border-radius:var(--radius-xs); cursor:pointer; font-weight:600;">
              Download QR as PNG
            </button>
          </div>

          <div style="flex:1 1 280px; background:var(--bg-elevated); padding:var(--space-6); display:flex;
                      flex-direction:column; justify-content:center; gap:var(--space-4);">
            <div>
              <h3 style="margin:0 0 var(--space-2) 0; font-size:var(--fs-md);">Or copy the link</h3>
              <p style="margin:0 0 var(--space-2) 0; font-size:var(--fs-xs); color:var(--text-muted);">
                ${includesState
                  ? `Includes all ${itemCount} selected item${itemCount === 1 ? '' : 's'}.`
                  : itemCount
                    ? 'Opens the planner. The selection list was too long to fit in a scannable code, so it is not included.'
                    : 'Opens the planner. Nothing is selected yet, so no setup is attached.'}
              </p>
              <input id="qr-url-field" type="text" readonly aria-label="Shareable link" value="${escapeHtml(url)}"
                     style="width:100%; box-sizing:border-box; padding:var(--space-2); font-family:var(--font-mono);
                            font-size:var(--fs-2xs); background:var(--bg-input); color:var(--text-main);
                            border:1px solid var(--border-subtle); border-radius:var(--radius-xs);" />
              <button id="copy-qr-url-btn" class="btn-secondary"
                      style="margin-top:var(--space-2); width:100%; padding:var(--space-2); border-radius:var(--radius-xs); cursor:pointer;">
                Copy link
              </button>
              <p id="qr-copy-status" role="status" aria-live="polite"
                 style="margin:var(--space-2) 0 0 0; font-size:var(--fs-2xs); color:var(--accent-emerald); min-height:1em;"></p>
            </div>

            <p style="margin:0; font-size:var(--fs-2xs); color:var(--text-dim); line-height:1.5;">
              Opening the link shows the 360° walkthrough in the phone browser. Native AR (Scene Viewer /
              AR Quick Look) is not part of this build.
            </p>
          </div>

          <button id="close-qr-btn" aria-label="Close QR panel"
                  style="position:absolute; top:var(--space-3); right:var(--space-3); background:var(--bg-elevated);
                         color:var(--text-main); border:1px solid var(--border-subtle); border-radius:var(--radius-pill);
                         width:30px; height:30px; cursor:pointer; font-weight:bold; line-height:1;">&times;</button>
        </div>
      </div>
    `;

    this.paintQR();
    this.bindEvents();
  }

  paintQR() {
    const canvas = this.container.querySelector('#qr-canvas');
    const meta = this.container.querySelector('#qr-meta');
    if (!canvas) return;
    try {
      // ECC M (~15% recovery) for short links; drop to L on longer ones so the
      // symbol stays inside MAX_VERSION rather than becoming unreadably dense.
      this.lastSymbol = drawQRToCanvas(canvas, this.currentUrl, {
        ecl: this.currentUrl.length > 150 ? 'L' : 'M',
        maxVersion: MAX_VERSION,
        quietZone: 4,
        pixelSize: 264
      });
      canvas.style.width = `${this.lastSymbol.pixelSize}px`;
      canvas.style.height = `${this.lastSymbol.pixelSize}px`;
      if (meta) {
        meta.textContent =
          `QR version ${this.lastSymbol.version} · ${this.lastSymbol.size}×${this.lastSymbol.size} modules · error correction ${this.lastSymbol.ecl}`;
      }
    } catch (err) {
      this.lastSymbol = null;
      if (meta) meta.textContent = 'Could not render a QR code for this link — use the copyable link instead.';
      const btn = this.container.querySelector('#download-qr-btn');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'QR unavailable';
      }
      console.warn('[ARQRGenerator] QR encoding failed:', err);
    }
  }

  setStatus(message) {
    const el = this.container.querySelector('#qr-copy-status');
    if (el) el.textContent = message;
  }

  bindEvents() {
    // Bound once against the persistent container — re-rendering must never
    // stack another copy of this handler.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const closeBtn = e.target.closest('#close-qr-btn');
      if (closeBtn || e.target.classList.contains('qr-modal-overlay')) {
        this.close();
        return;
      }

      if (e.target.closest('#download-qr-btn')) {
        const canvas = this.container.querySelector('#qr-canvas');
        if (!canvas || !this.lastSymbol) return;
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = `helm_setup_qr_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      if (e.target.closest('#copy-qr-url-btn')) {
        const field = this.container.querySelector('#qr-url-field');
        if (!field) return;
        const done = () => this.setStatus('Link copied.');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(field.value).then(done, () => {
            field.select();
            this.setStatus('Press Ctrl/Cmd+C to copy the selected link.');
          });
        } else {
          field.select();
          this.setStatus('Press Ctrl/Cmd+C to copy the selected link.');
        }
      }
    });
  }
}
