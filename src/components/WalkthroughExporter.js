import { VENUE_ZONES } from '../data/zones.js';
import { escapeHtml } from '../utils/format.js';

/**
 * Records a real walkthrough video from a canvas via MediaRecorder.
 *
 * This is genuine capture — `canvas.captureStream()` feeding a MediaRecorder
 * produces a real .webm file. Nothing here is a simulated progress bar.
 */

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;
const FPS = 30;

// Preferred containers/codecs, best first. The first supported one wins.
const CANDIDATE_TYPES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
  'video/mp4;codecs=avc1.42E01E',
  'video/mp4'
];

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return null;
  if (typeof MediaRecorder.isTypeSupported !== 'function') return '';
  for (const type of CANDIDATE_TYPES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return null;
}

export class WalkthroughExporter {
  constructor(containerElement) {
    this.container = containerElement;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.rafId = null;
    this.timerId = null;
    this.watchdogId = null;
    this.objectUrl = null;
    this.isRecording = false;
    this._pendingFrame = null;
    this._frameResolve = null;
    this._bound = false;
    this._onVisibility = () => this.kickLoop();
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.abort('closed');
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  /** Cancel every timer and stop the recorder — nothing may outlive the modal. */
  abort(reason) {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.timerId !== null) { clearTimeout(this.timerId); this.timerId = null; }
    if (this.watchdogId !== null) { clearTimeout(this.watchdogId); this.watchdogId = null; }
    document.removeEventListener('visibilitychange', this._onVisibility);
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* already stopping */ }
    }
    if (reason === 'closed' && this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.isRecording = false;
    this._pendingFrame = null;
    if (this._frameResolve) { const r = this._frameResolve; this._frameResolve = null; r(); }
  }

  render() {
    const supported = pickMimeType();

    this.container.innerHTML = `
      <div class="modal-overlay walkthrough-modal-overlay">
        <div class="walkthrough-modal" role="dialog" aria-modal="true" aria-labelledby="walk-title"
             style="position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:92%; max-width:720px;
                    background:var(--bg-surface); color:var(--text-main); border-radius:var(--radius-md);
                    box-shadow:var(--shadow-lg); z-index:var(--z-modal); overflow:hidden;
                    border:1px solid var(--border-subtle);">
          <div style="padding:var(--space-4) var(--space-5); background:var(--bg-elevated);
                      display:flex; justify-content:space-between; align-items:center;
                      border-bottom:1px solid var(--border-subtle);">
            <h2 id="walk-title" style="margin:0; font-size:var(--fs-lg);">🎬 Walkthrough Video Export</h2>
            <button type="button" id="close-walk-btn" aria-label="Close"
                    style="background:none; border:none; color:var(--text-muted); font-size:var(--fs-2xl); cursor:pointer; line-height:1;">&times;</button>
          </div>

          <div style="padding:var(--space-5);">
            ${supported === null ? `
              <p role="alert">
                Video export is not available in this browser — it does not support recording from a canvas
                (<code>MediaRecorder</code>). Chrome, Edge and Firefox all work; Safari currently does not.
              </p>
            ` : `
            <div style="display:flex; flex-wrap:wrap; gap:var(--space-5);">
              <div style="flex:1 1 240px; min-width:220px;">
                <h3 style="margin-top:0;">Zones to include</h3>
                <div id="zone-checkboxes" style="max-height:220px; overflow-y:auto; padding:var(--space-3);
                     border:1px solid var(--border-subtle); border-radius:var(--radius-xs);">
                  ${VENUE_ZONES.map(z => `
                    <label style="display:block; margin-bottom:var(--space-2);">
                      <input type="checkbox" class="zone-chk" value="${escapeHtml(z.id)}" checked />
                      ${escapeHtml(z.name)}
                    </label>
                  `).join('')}
                </div>

                <div style="margin-top:var(--space-4);">
                  <label for="export-speed"><strong>Seconds per zone</strong></label>
                  <select id="export-speed" style="padding:var(--space-2); margin-left:var(--space-2);">
                    <option value="1">5s — cinematic</option>
                    <option value="2" selected>3s — standard</option>
                    <option value="4">1.5s — quick</option>
                  </select>
                </div>

                <button type="button" id="start-record-btn" class="btn-primary"
                        style="margin-top:var(--space-5); width:100%; padding:var(--space-3);
                               border-radius:var(--radius-xs); font-weight:600; cursor:pointer;">
                  Start Rendering Walkthrough
                </button>
                <p id="walk-status" role="status" aria-live="polite" class="meta"></p>
              </div>

              <div style="flex:1 1 240px; min-width:220px; display:flex; flex-direction:column; align-items:center; gap:var(--space-3);">
                <canvas id="render-canvas" width="${OUTPUT_WIDTH}" height="${OUTPUT_HEIGHT}"
                        style="width:100%; border-radius:var(--radius-xs); border:1px solid var(--border-subtle);"></canvas>
                <p class="meta">${OUTPUT_WIDTH}×${OUTPUT_HEIGHT} · ${FPS} fps</p>

                <div id="progress-container" style="display:none; width:100%;">
                  <div style="font-size:var(--fs-xs); margin-bottom:var(--space-1); display:flex; justify-content:space-between;">
                    <span id="progress-text">Rendering…</span>
                    <span id="progress-pct">0%</span>
                  </div>
                  <div style="width:100%; height:8px; background:var(--bg-input); border-radius:var(--radius-pill); overflow:hidden;">
                    <div id="progress-bar" style="height:100%; width:0%; background:var(--solid-emerald); transition:width 0.2s;"></div>
                  </div>
                </div>

                <a id="download-link" class="btn-primary" download
                   style="display:none; width:100%; box-sizing:border-box; padding:var(--space-3);
                          text-align:center; text-decoration:none; border-radius:var(--radius-xs); font-weight:600;">
                  ⬇️ Download video
                </a>
              </div>
            </div>`}
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  setStatus(message) {
    const el = this.container.querySelector('#walk-status');
    if (el) el.textContent = message;
  }

  setProgress(pct) {
    const bar = this.container.querySelector('#progress-bar');
    const label = this.container.querySelector('#progress-pct');
    if (bar) bar.style.width = `${pct}%`;
    if (label) label.textContent = `${pct}%`;
  }

  resetButton(text = 'Start Rendering Walkthrough') {
    const btn = this.container.querySelector('#start-record-btn');
    if (!btn) return;
    btn.disabled = false;
    btn.style.opacity = '1';
    btn.textContent = text;
  }

  bindEvents() {
    // Bound once against the persistent container.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      if (e.target.closest('#close-walk-btn') || e.target.classList.contains('walkthrough-modal-overlay')) {
        this.close();
      } else if (e.target.closest('#start-record-btn')) {
        this.startRecording();
      }
    });
  }

  /**
   * Frame scheduler. rAF alone stalls forever in a backgrounded tab, which used
   * to wedge an export at 0% with the recorder still running; fall back to a
   * timer whenever the page is hidden, and keep a watchdog either way.
   */
  scheduleFrame(fn) {
    this._pendingFrame = fn;
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.timerId !== null) { clearTimeout(this.timerId); this.timerId = null; }

    const run = () => {
      // Cancel whichever sibling timer did not fire, so a frame never runs twice.
      if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
      if (this.timerId !== null) { clearTimeout(this.timerId); this.timerId = null; }
      const pending = this._pendingFrame;
      this._pendingFrame = null;
      if (pending && this.isRecording) pending();
    };

    if (document.hidden) {
      this.timerId = setTimeout(run, 1000 / FPS);
    } else {
      this.rafId = requestAnimationFrame(run);
      // Watchdog: if rAF has not fired in 500 ms (tab hidden mid-frame),
      // drive the frame from a timer instead of stalling.
      this.timerId = setTimeout(run, 500);
    }
  }

  kickLoop() {
    if (this.isRecording && this._pendingFrame) this.scheduleFrame(this._pendingFrame);
  }

  async startRecording() {
    const btn = this.container.querySelector('#start-record-btn');
    const canvas = this.container.querySelector('#render-canvas');
    if (!btn || !canvas) return;

    const mimeType = pickMimeType();
    if (mimeType === null) {
      this.setStatus('This browser cannot record video from a canvas. Try Chrome, Edge or Firefox.');
      return;
    }

    const checked = Array.from(this.container.querySelectorAll('.zone-chk:checked')).map(c => c.value);
    const selectedZones = VENUE_ZONES.filter(z => checked.includes(z.id));
    if (selectedZones.length === 0) {
      this.setStatus('Select at least one zone to include in the walkthrough.');
      return;
    }

    btn.disabled = true;
    btn.style.opacity = '0.5';
    btn.textContent = 'Rendering…';
    this.setStatus('');

    const speed = parseInt(this.container.querySelector('#export-speed').value, 10) || 2;
    const timePerZone = 6000 / speed; // 6s at 1x, 3s at 2x, 1.5s at 4x
    const ctx = canvas.getContext('2d');

    let stream;
    try {
      stream = canvas.captureStream(FPS);
      this.mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 5_000_000 } : undefined
      );
    } catch (err) {
      console.warn('[WalkthroughExporter] MediaRecorder failed to start:', err);
      this.setStatus('Could not start the recorder in this browser. Try Chrome, Edge or Firefox.');
      this.resetButton();
      return;
    }

    const extension = (this.mediaRecorder.mimeType || mimeType || 'video/webm').includes('mp4') ? 'mp4' : 'webm';
    this.recordedChunks = [];
    this.isRecording = true;

    this.mediaRecorder.ondataavailable = e => {
      if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onerror = err => {
      console.warn('[WalkthroughExporter] recorder error:', err);
      this.setStatus('Recording failed partway through. Nothing was saved.');
      this.abort('error');
      this.resetButton('Try again');
    };

    this.mediaRecorder.onstop = () => {
      this.isRecording = false;
      document.removeEventListener('visibilitychange', this._onVisibility);
      if (this.recordedChunks.length === 0) {
        this.setStatus('Recording produced no data. Nothing was saved.');
        this.resetButton('Try again');
        return;
      }
      const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'video/webm' });
      if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = URL.createObjectURL(blob);
      const link = this.container.querySelector('#download-link');
      if (link) {
        link.href = this.objectUrl;
        link.download = `helm_walkthrough_${Date.now()}.${extension}`;
        link.style.display = 'block';
      }
      const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
      this.setStatus(`Render complete — ${sizeMb} MB.`);
      this.resetButton('Render again');
    };

    const progContainer = this.container.querySelector('#progress-container');
    if (progContainer) progContainer.style.display = 'block';
    const link = this.container.querySelector('#download-link');
    if (link) link.style.display = 'none';
    this.setProgress(0);

    document.addEventListener('visibilitychange', this._onVisibility);

    try {
      this.mediaRecorder.start();
    } catch (err) {
      console.warn('[WalkthroughExporter] start() threw:', err);
      this.setStatus('Could not start recording in this browser.');
      this.abort('error');
      this.resetButton();
      return;
    }

    // Hard ceiling so a stalled image load can never leave the recorder running.
    const budget = selectedZones.length * timePerZone + 15000;
    this.watchdogId = setTimeout(() => {
      if (this.isRecording) {
        this.setStatus('Render timed out; saving what was captured.');
        this.finish();
      }
    }, budget);

    this.renderZones(selectedZones, ctx, canvas, timePerZone);
  }

  finish() {
    this.setProgress(100);
    this.isRecording = false;
    if (this._frameResolve) { const r = this._frameResolve; this._frameResolve = null; r(); }
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.timerId !== null) { clearTimeout(this.timerId); this.timerId = null; }
    if (this.watchdogId !== null) { clearTimeout(this.watchdogId); this.watchdogId = null; }
    this._pendingFrame = null;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try { this.mediaRecorder.stop(); } catch { /* already stopped */ }
    }
  }

  loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  async renderZones(zones, ctx, canvas, timePerZone) {
    for (let i = 0; i < zones.length; i++) {
      if (!this.isRecording) return;
      const zone = zones[i];
      this.setProgress(Math.floor((i / zones.length) * 100));
      const img = await this.loadImage(zone.panoramaUrl);
      if (!this.isRecording) return;
      await this.animateZone(zone, img, ctx, canvas, timePerZone);
    }
    if (this.isRecording) this.finish();
  }

  animateZone(zone, img, ctx, canvas, timePerZone) {
    return new Promise(resolve => {
      this._frameResolve = resolve;
      const startTime = Date.now();

      // Crop a 16:9 window out of the panorama and sweep it across the FULL
      // available width. The old code squashed a half-width crop into 16:9
      // (~2x horizontal distortion) and panned only 100 of ~688 pixels.
      let srcW = 0;
      let srcH = 0;
      let maxPan = 0;
      if (img) {
        const outAspect = canvas.width / canvas.height;
        srcH = img.height;
        srcW = Math.min(img.width, Math.round(srcH * outAspect));
        if (srcW < 1) srcW = img.width;
        maxPan = Math.max(0, img.width - srcW);
      }

      const frame = () => {
        if (!this.isRecording) { this._frameResolve = null; resolve(); return; }
        const elapsed = Date.now() - startTime;
        if (elapsed >= timePerZone) { this._frameResolve = null; resolve(); return; }

        const t = elapsed / timePerZone;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (img) {
          const panX = Math.round(t * maxPan);
          ctx.drawImage(img, panX, 0, srcW, srcH, 0, 0, canvas.width, canvas.height);
        }

        // Lower-third title card.
        const barHeight = Math.round(canvas.height * 0.13);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(barHeight * 0.42)}px Inter, -apple-system, sans-serif`;
        ctx.textBaseline = 'middle';
        ctx.fillText(zone.name, Math.round(canvas.width * 0.03), canvas.height - barHeight / 2);

        this.scheduleFrame(frame);
      };

      frame();
    });
  }
}
