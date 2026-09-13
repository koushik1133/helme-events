import { ITEM_CATALOG, getItemById } from '../data/catalog.js';
import { VENUE_ZONES } from '../data/zones.js';
import { formatMoney, readJSON, writeJSON, escapeHtml } from '../utils/format.js';

const MOODBOARD_KEY = 'helme_events_moodboard';
const MAX_EDGE = 800;          // downscale before storing — quota protection
const SAMPLE_EDGE = 64;        // analysis canvas size
const PALETTE_SIZE = 5;

/** Inline SVG placeholder — no external CDN dependency. */
const PLACEHOLDER_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#334155"/><text x="30" y="35" font-size="22" text-anchor="middle" fill="#94a3b8">?</text></svg>'
  );

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHex({ r, g, b }) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

/**
 * "Redmean" weighted RGB distance — a cheap, well-known approximation of
 * perceptual colour difference. Range is roughly 0 (identical) to ~765.
 */
function colorDistance(a, b) {
  const rMean = (a.r + b.r) / 2;
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
  return Math.sqrt(
    (2 + rMean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rMean) / 256) * db * db
  );
}
const MAX_DISTANCE = colorDistance({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });

export class MoodBoardMatcher {
  constructor(containerElement, activeSelections, onApply, getCurrentZoneId) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply || (() => {});
    this.getCurrentZoneId = typeof getCurrentZoneId === 'function'
      ? getCurrentZoneId
      : () => (typeof window !== 'undefined' ? window.app?.currentZoneId : null);

    const saved = readJSON(MOODBOARD_KEY, []);
    this.images = Array.isArray(saved) ? saved : [];
    this.palette = [];
    this.matches = [];      // [{ slotId, slotLabel, item, score, distance }]
    this.statusMessage = '';
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

  zone() {
    const id = this.getCurrentZoneId();
    return VENUE_ZONES.find(z => z.id === id) || VENUE_ZONES[0];
  }

  setStatus(message) {
    this.statusMessage = message;
    const el = this.container.querySelector('#mb-status');
    if (el) el.textContent = message;
  }

  // ------------------------------------------------------------ rendering

  render() {
    const zone = this.zone();
    this.container.innerHTML = `
      <div class="modal-overlay moodboard-modal-overlay">
        <div class="moodboard-modal" role="dialog" aria-modal="true" aria-labelledby="mb-title"
          style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:92%; max-width:1000px; height:85vh; background:var(--bg-surface); color:var(--text-main); border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.5); z-index:2000; display:flex; flex-direction:column; overflow:hidden; border:1px solid var(--border-subtle);">

          <div style="padding:20px; background:var(--bg-elevated); border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center;">
            <h2 id="mb-title" style="margin:0;">🎨 Mood Board Colour Match</h2>
            <button type="button" id="close-mb-btn" aria-label="Close mood board" style="background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">&times;</button>
          </div>

          <div style="display:flex; flex:1; overflow:hidden; flex-wrap:wrap;">

            <div style="flex:2; min-width:320px; padding:20px; border-right:1px solid var(--border-subtle); display:flex; flex-direction:column; overflow:hidden;">
              <button type="button" id="mb-dropzone" style="border:2px dashed var(--border-subtle); border-radius:8px; padding:24px; text-align:center; cursor:pointer; background:var(--bg-elevated); color:var(--text-main); width:100%;">
                <span style="font-size:30px; display:block; margin-bottom:8px;" aria-hidden="true">📸</span>
                <strong>Drag &amp; drop inspiration images here</strong><br/>
                <span style="font-size:12px; color:var(--text-muted);">or click to browse — images are downscaled to ${MAX_EDGE}px before being stored</span>
              </button>
              <input type="file" id="mb-file-input" multiple accept="image/*" style="display:none;" aria-label="Upload inspiration images" />

              <div style="margin:16px 0; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                <h3 style="margin:0; font-size:1rem;">Inspiration Board</h3>
                <button type="button" id="mb-analyze-btn" class="btn-primary">🎨 Extract Colours &amp; Match</button>
              </div>

              <div id="mb-status" role="status" style="min-height:16px; font-size:12px; color:var(--text-muted); margin-bottom:8px;">${escapeHtml(this.statusMessage)}</div>

              <div id="mb-grid" style="flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; align-content:start;"></div>
            </div>

            <div style="flex:1; min-width:260px; padding:20px; background:var(--bg-elevated); display:flex; flex-direction:column; overflow:hidden;">
              <h3 style="margin-top:0; font-size:1rem;">Matches for ${escapeHtml(zone.name)}</h3>
              <p style="font-size:12px; color:var(--text-muted); margin:0 0 10px;">
                Dominant colours are read from your images with a canvas, then each option allowed in this
                zone is scored by colour distance. No model, no randomness — the same board always gives
                the same result.
              </p>

              <div id="mb-palette" style="display:flex; gap:6px; margin-bottom:12px; flex-wrap:wrap;"></div>

              <div id="mb-suggestions" style="flex:1; overflow-y:auto;"></div>

              <button type="button" id="mb-apply-btn" class="btn-primary" style="margin-top:16px; width:100%; padding:12px;" hidden>
                Apply Matched Items to ${escapeHtml(zone.name)}
              </button>
            </div>

          </div>
        </div>
      </div>
    `;

    this.renderImages();
    this.renderPalette();
    this.renderSuggestions();
    this.bindEvents();
  }

  renderImages() {
    const grid = this.container.querySelector('#mb-grid');
    if (!grid) return;

    if (this.images.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:40px;">
        No images yet. Add a few reference photos of the look the client wants.
      </div>`;
      return;
    }

    grid.innerHTML = this.images.map((src, idx) => `
      <div style="position:relative; border-radius:6px; overflow:hidden; border:1px solid var(--border-subtle);">
        <img src="${escapeHtml(src)}" alt="Inspiration image ${idx + 1}" style="width:100%; height:150px; object-fit:cover; display:block;" />
        <button type="button" class="mb-del-img" data-idx="${idx}" aria-label="Remove inspiration image ${idx + 1}"
          style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>
      </div>
    `).join('');
  }

  renderPalette() {
    const el = this.container.querySelector('#mb-palette');
    if (!el) return;
    if (!this.palette.length) {
      el.innerHTML = `<span style="font-size:12px; color:var(--text-muted);">No palette extracted yet.</span>`;
      return;
    }
    el.innerHTML = this.palette.map(p => `
      <div title="${escapeHtml(p.hex)} — ${Math.round(p.share * 100)}% of the board"
        style="display:flex; align-items:center; gap:4px; font-size:10px; color:var(--text-muted);">
        <span style="display:inline-block; width:22px; height:22px; border-radius:5px; background:${escapeHtml(p.hex)}; border:1px solid var(--border-subtle);"></span>
        ${Math.round(p.share * 100)}%
      </div>
    `).join('');
  }

  renderSuggestions() {
    const el = this.container.querySelector('#mb-suggestions');
    const applyBtn = this.container.querySelector('#mb-apply-btn');
    if (!el) return;

    if (!this.matches.length) {
      el.innerHTML = `<div style="font-size:12px; color:var(--text-muted); padding:20px 0;">
        Add images and press “Extract Colours &amp; Match” to see which catalog pieces fit the palette.
      </div>`;
      if (applyBtn) applyBtn.hidden = true;
      return;
    }

    el.innerHTML = this.matches.map(m => `
      <div style="display:flex; gap:10px; padding:10px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:6px; margin-bottom:10px;">
        <img src="${escapeHtml(m.item.imageUrl || '')}" alt="" style="width:60px; height:60px; object-fit:cover; border-radius:4px; flex-shrink:0;"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_IMG}'" />
        <div style="min-width:0;">
          <div style="font-size:11px; color:var(--text-muted);">${escapeHtml(m.slotLabel)}</div>
          <div style="font-weight:bold; font-size:14px;">${escapeHtml(m.item.name)}</div>
          <div style="font-size:12px; color:var(--text-muted);">${formatMoney(m.item.price)} · ${Math.round(m.score)}% colour match</div>
          <span style="display:inline-block; width:12px; height:12px; background:${escapeHtml(m.item.color || '#888')}; border-radius:50%; margin-top:5px; border:1px solid var(--border-subtle);"
            title="Item colour ${escapeHtml(m.item.color || 'unknown')}"></span>
        </div>
      </div>
    `).join('');

    if (applyBtn) applyBtn.hidden = false;
  }

  // ------------------------------------------------------------ uploading

  /** Downscale to MAX_EDGE before storing — full-size phone photos blow the
   *  ~5 MB localStorage quota after two or three uploads. */
  downscale(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('unreadable image'));
      img.src = dataUrl;
    });
  }

  async handleFiles(files) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;

    this.setStatus(`Processing ${list.length} image${list.length === 1 ? '' : 's'}…`);

    for (const file of list) {
      try {
        const raw = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = e => resolve(e.target.result);
          reader.onerror = () => reject(new Error('read failed'));
          reader.readAsDataURL(file);
        });
        const small = await this.downscale(raw);
        this.images.push(small);

        if (!writeJSON(MOODBOARD_KEY, this.images)) {
          this.images.pop();
          writeJSON(MOODBOARD_KEY, this.images);
          this.setStatus('Browser storage is full — remove an image from the board and try again.');
          this.renderImages();
          return;
        }
      } catch {
        this.setStatus(`“${file.name}” could not be read as an image.`);
      }
    }

    this.setStatus('');
    this.renderImages();
  }

  // ------------------------------------------------------------ analysis

  loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('load failed'));
      img.src = src;
    });
  }

  /** Dominant colours across the whole board, by coarse RGB bucketing. */
  async extractPalette() {
    const canvas = document.createElement('canvas');
    canvas.width = SAMPLE_EDGE;
    canvas.height = SAMPLE_EDGE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const buckets = new Map();
    let counted = 0;

    for (const src of this.images) {
      let img;
      try {
        img = await this.loadImage(src);
      } catch {
        continue;
      }
      ctx.clearRect(0, 0, SAMPLE_EDGE, SAMPLE_EDGE);
      ctx.drawImage(img, 0, 0, SAMPLE_EDGE, SAMPLE_EDGE);

      let data;
      try {
        data = ctx.getImageData(0, 0, SAMPLE_EDGE, SAMPLE_EDGE).data;
      } catch {
        continue; // tainted canvas — should not happen for data: URLs
      }

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // Skip near-black and near-white, which dominate photos without
        // describing the palette anyone is actually choosing.
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max < 24 || min > 238) continue;
        const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
        const entry = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 };
        entry.r += r; entry.g += g; entry.b += b; entry.n += 1;
        buckets.set(key, entry);
        counted++;
      }
    }

    if (!counted) return [];

    return [...buckets.values()]
      .sort((a, b) => b.n - a.n)
      .slice(0, PALETTE_SIZE)
      .map(e => ({
        hex: rgbToHex({ r: e.r / e.n, g: e.g / e.n, b: e.b / e.n }),
        rgb: { r: e.r / e.n, g: e.g / e.n, b: e.b / e.n },
        share: e.n / counted
      }));
  }

  /** Score one catalog item against the extracted palette. 0–100. */
  scoreItem(item) {
    const itemRgb = hexToRgb(item.color);
    if (!itemRgb || !this.palette.length) return null;
    // Nearest palette colour, weighted so a colour covering more of the board
    // counts for more. Lower is better.
    const weighted = this.palette.map(p => colorDistance(itemRgb, p.rgb) * (1 - Math.min(0.4, p.share * 0.6)));
    const best = Math.min(...weighted);
    return Math.max(0, Math.min(100, 100 - (best / MAX_DISTANCE) * 100));
  }

  async analyzeImages() {
    if (this.images.length === 0) {
      this.setStatus('Add at least one inspiration image first.');
      return;
    }

    const btn = this.container.querySelector('#mb-analyze-btn');
    const original = btn ? btn.textContent : '';
    if (btn) { btn.textContent = 'Reading colours…'; btn.disabled = true; }

    try {
      this.palette = await this.extractPalette();

      if (!this.palette.length) {
        this.matches = [];
        this.setStatus('No usable colour was found in these images — they may be pure black or white.');
      } else {
        const zone = this.zone();
        const catalogIds = new Set(Object.values(ITEM_CATALOG).flat().map(i => i.id));

        this.matches = zone.slots.map(slot => {
          const allowed = (slot.allowedItemIds && slot.allowedItemIds.length
            ? slot.allowedItemIds
            : [slot.defaultItemId]
          ).filter(id => catalogIds.has(id));

          const scored = allowed
            .map(id => ({ item: getItemById(id), score: this.scoreItem(getItemById(id)) }))
            .filter(entry => entry.item && entry.score !== null)
            .sort((a, b) => b.score - a.score);

          if (!scored.length) return null;
          return { slotId: slot.id, slotLabel: slot.label, item: scored[0].item, score: scored[0].score };
        }).filter(Boolean);

        this.setStatus(`${this.palette.length} dominant colour${this.palette.length === 1 ? '' : 's'} read from ${this.images.length} image${this.images.length === 1 ? '' : 's'}.`);
      }
    } catch {
      this.matches = [];
      this.setStatus('Colour extraction failed in this browser.');
    } finally {
      if (btn) { btn.textContent = original; btn.disabled = false; }
      this.renderPalette();
      this.renderSuggestions();
    }
  }

  applyMatches() {
    if (!this.matches.length) return;

    // STATE CONTRACT: a flat map of slotId -> itemId STRINGS. The previous
    // implementation handed an ARRAY to Object.assign, which wrote "0", "1"…
    // keys into activeSelections and changed nothing in the venue.
    const selections = {};
    this.matches.forEach(m => { selections[m.slotId] = m.item.id; });

    this.onApply(selections);
    this.close();
  }

  // ------------------------------------------------------------ events

  bindEvents() {
    // The container persists between open() calls — bind once, delegate.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', e => {
      const t = e.target;

      if (t.id === 'close-mb-btn' || t.classList.contains('moodboard-modal-overlay')) {
        this.close();
        return;
      }

      if (t.closest?.('#mb-dropzone')) {
        this.container.querySelector('#mb-file-input')?.click();
        return;
      }

      const del = t.closest?.('.mb-del-img');
      if (del) {
        const idx = parseInt(del.dataset.idx, 10);
        if (Number.isInteger(idx)) {
          this.images.splice(idx, 1);
          writeJSON(MOODBOARD_KEY, this.images);
          this.renderImages();
        }
        return;
      }

      if (t.id === 'mb-analyze-btn') return this.analyzeImages();
      if (t.id === 'mb-apply-btn') return this.applyMatches();
    });

    this.container.addEventListener('change', e => {
      if (e.target.id === 'mb-file-input') {
        this.handleFiles(e.target.files);
        e.target.value = '';
      }
    });

    const setDropzoneActive = active => {
      const dz = this.container.querySelector('#mb-dropzone');
      if (dz) dz.style.borderColor = active ? 'var(--accent-indigo)' : 'var(--border-subtle)';
    };

    this.container.addEventListener('dragover', e => {
      if (!e.target.closest?.('#mb-dropzone')) return;
      e.preventDefault();
      setDropzoneActive(true);
    });
    this.container.addEventListener('dragleave', e => {
      if (!e.target.closest?.('#mb-dropzone')) return;
      e.preventDefault();
      setDropzoneActive(false);
    });
    this.container.addEventListener('drop', e => {
      if (!e.target.closest?.('#mb-dropzone')) return;
      e.preventDefault();
      setDropzoneActive(false);
      this.handleFiles(e.dataTransfer.files);
    });
  }
}
