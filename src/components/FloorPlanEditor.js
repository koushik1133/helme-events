import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import { readJSON, writeJSON, escapeHtml } from '../utils/format.js';
import { eventState } from '../data/eventState.js';

const LAYOUT_KEY = 'helm_floorplan_layout_v1';

/** Layout constants — the canvas is sized from these, never hardcoded. */
const COLS = 4;
const COL_PITCH = 250;
const ROW_PITCH = 170;
const MARGIN_X = 130;
const MARGIN_TOP = 96;
const ZONE_HEADER_H = 38;
const BOTTOM_PAD = 60;
const GRID_SIZE = 40;
const NODE_RADIUS = 38;

function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

export class FloorPlanEditor {
  constructor(containerElement, activeSelections, onUpdateSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onUpdateSelections = onUpdateSelections;
    this.canvas = null;
    this.ctx = null;
    this.selectedNode = null;
    this.nodes = [];
    this.zoneBands = [];
    this.undoStack = [];
    this.snapToGrid = true;
    this.savedLayout = readJSON(LAYOUT_KEY, {});
    if (!this.savedLayout || typeof this.savedLayout !== 'object') this.savedLayout = {};
    this.boundMouseUp = null;

    this.render();
  }

  destroy() {
    if (this.boundMouseUp) window.removeEventListener('mouseup', this.boundMouseUp);
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    // Rebuild node metadata but KEEP the client's arranged positions.
    this.initNodesFromZones({ preservePositions: true });
    this.resizeCanvasToContent();
    this.draw();
  }

  /**
   * Lay nodes out in per-zone bands so every zone — including the three India
   * verticals — is visible, and size the canvas to the content afterwards.
   */
  initNodesFromZones({ preservePositions = true, resetSaved = false } = {}) {
    const previous = new Map(this.nodes.map(n => [n.id, n]));
    this.nodes = [];
    this.zoneBands = [];
    if (resetSaved) {
      this.savedLayout = {};
      writeJSON(LAYOUT_KEY, this.savedLayout);
    }

    let y = MARGIN_TOP;

    VENUE_ZONES.forEach(zone => {
      const rows = Math.ceil(zone.slots.length / COLS);
      const bandTop = y - ZONE_HEADER_H;
      this.zoneBands.push({
        name: zone.name,
        top: bandTop,
        height: ZONE_HEADER_H + rows * ROW_PITCH
      });

      zone.slots.forEach((slot, i) => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);

        const defaultX = MARGIN_X + (i % COLS) * COL_PITCH;
        const defaultY = y + Math.floor(i / COLS) * ROW_PITCH;

        const saved = this.savedLayout[slot.id];
        const prev = preservePositions ? previous.get(slot.id) : null;
        const source = prev || saved;

        this.nodes.push({
          id: slot.id,
          zoneId: zone.id,
          zoneName: zone.name,
          slotLabel: slot.label,
          itemId: itemId,
          itemName: item ? item.name : 'Object',
          category: slot.category,
          defaultX,
          defaultY,
          x: source && Number.isFinite(Number(source.x)) ? Number(source.x) : defaultX,
          y: source && Number.isFinite(Number(source.y)) ? Number(source.y) : defaultY,
          radius: source && Number.isFinite(Number(source.radius)) ? Number(source.radius) : NODE_RADIUS,
          color: item ? item.color : '#38bdf8',
          rotation: source && Number.isFinite(Number(source.rotation)) ? Number(source.rotation) : 0
        });
      });

      y += rows * ROW_PITCH + ZONE_HEADER_H;
    });

    this.contentHeight = y + BOTTOM_PAD;
  }

  canvasSize() {
    const widest = Math.max(
      MARGIN_X + (COLS - 1) * COL_PITCH + 160,
      ...this.nodes.map(n => n.x + n.radius + 60),
      900
    );
    const tallest = Math.max(
      this.contentHeight || 640,
      ...this.nodes.map(n => n.y + n.radius + 80)
    );
    return { width: Math.ceil(widest), height: Math.ceil(tallest) };
  }

  resizeCanvasToContent() {
    if (!this.canvas) return;
    const { width, height } = this.canvasSize();
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.canvas.style.width = `${Math.round(width * this.zoom)}px`;
    this.canvas.style.height = `${Math.round(height * this.zoom)}px`;
  }

  persistLayout() {
    this.savedLayout = {};
    this.nodes.forEach(n => {
      this.savedLayout[n.id] = {
        x: Math.round(n.x), y: Math.round(n.y),
        radius: Math.round(n.radius), rotation: n.rotation
      };
    });
    writeJSON(LAYOUT_KEY, this.savedLayout);
  }

  pushUndo() {
    this.undoStack.push(this.nodes.map(n => ({
      id: n.id, x: n.x, y: n.y, radius: n.radius, rotation: n.rotation
    })));
    if (this.undoStack.length > 40) this.undoStack.shift();
  }

  undo() {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    const byId = new Map(snapshot.map(s => [s.id, s]));
    this.nodes.forEach(n => {
      const s = byId.get(n.id);
      if (s) { n.x = s.x; n.y = s.y; n.radius = s.radius; n.rotation = s.rotation; }
    });
    this.persistLayout();
    this.resizeCanvasToContent();
    this.draw();
    return true;
  }

  /** The floor plan is a real editing surface — tell the rest of the app. */
  emitSync() {
    if (typeof this.onUpdateSelections !== 'function') return;
    const selections = { ...this.activeSelections };
    this.nodes.forEach(n => { if (n.itemId) selections[n.id] = n.itemId; });
    this.onUpdateSelections(selections);
  }

  render() {
    this.zoom = this.zoom || 1;

    this.container.innerHTML = `
      <div class="floor-plan-wrapper realistic-map-theme">
        <div class="floor-plan-header">
          <div>
            <h3>📐 2D Site Floor Plan Editor</h3>
            <p>
              Drag, rotate, resize and snap venue equipment across every zone. Positions are saved to this
              browser and pushed back to the 360° Studio and the budget when you press Sync.
              <span style="color:var(--text-dim);">(2D only — there is no 3D view in this build.)</span>
            </p>
          </div>
          <div class="floor-plan-toolbar">
            <button class="btn-floor-action" id="btnUndo" type="button">↩️ Undo</button>
            <button class="btn-floor-action" id="btnSnap" type="button" aria-pressed="true">🧲 Snap: On</button>
            <button class="btn-floor-action" id="btnZoomOut" type="button" aria-label="Zoom out">➖</button>
            <button class="btn-floor-action" id="btnZoomIn" type="button" aria-label="Zoom in">➕</button>
            <button class="btn-floor-action" id="btnRotateSelected" type="button">↪️ Rotate 45°</button>
            <button class="btn-floor-action" id="btnSync" type="button">🔗 Sync to Studio</button>
            <button class="btn-floor-action" id="btnResetGrid" type="button">🔄 Reset Layout</button>
          </div>
        </div>
        <div id="floorPlanStatus" role="status"
             style="padding:.35rem .75rem; font-size:.8rem; color:var(--text-muted);"></div>
        <div class="canvas-grid-container" style="overflow:auto; max-height:70vh;">
          <canvas id="floorPlanCanvas" tabindex="0"
                  aria-label="Venue floor plan. Click a node to select, arrow keys to nudge."></canvas>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#floorPlanCanvas');
    this.statusEl = this.container.querySelector('#floorPlanStatus');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.initNodesFromZones({ preservePositions: false });
    this.resizeCanvasToContent();
    this.bindEvents();
    this.draw();
    this.setStatus(`${this.nodes.length} equipment nodes across ${VENUE_ZONES.length} zones — all visible.`);
  }

  setStatus(text) {
    if (this.statusEl) this.statusEl.textContent = text;
  }

  draw() {
    if (!this.ctx || !this.canvas) return;
    const ctx = this.ctx;
    const { width, height } = this.canvas;

    const gridColor = token('--border-subtle', 'rgba(255,255,255,0.1)');
    const textMain = token('--text-main', '#f5f5f7');
    const textMuted = token('--text-muted', '#a1a1a6');
    const accent = token('--accent-gold', '#ffd60a');
    const surface = token('--bg-app', '#000000');

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = surface;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += GRID_SIZE) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // Zone bands, so the three India verticals are labelled and findable.
    this.zoneBands.forEach(band => {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(20, band.top);
      ctx.lineTo(width - 20, band.top);
      ctx.stroke();

      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillStyle = textMuted;
      ctx.textAlign = 'left';
      ctx.fillText(band.name.toUpperCase(), 24, band.top + 22);
    });

    this.nodes.forEach(node => {
      const isSelected = this.selectedNode === node;

      ctx.save();
      ctx.translate(node.x, node.y);
      ctx.rotate((node.rotation * Math.PI) / 180);

      // A rectangular footprint makes rotation visible (a circle did not).
      const w = node.radius * 1.9;
      const h = node.radius * 1.25;
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fillStyle = node.color + '33';
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = isSelected ? accent : node.color;
      ctx.stroke();

      ctx.beginPath();
      ctx.rect(-w / 2 + 8, -h / 2 + 6, w - 16, h - 12);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Facing marker.
      ctx.beginPath();
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(0, -h / 2 - 10);
      ctx.strokeStyle = isSelected ? accent : node.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = isSelected ? accent : textMain;
      ctx.textAlign = 'center';
      ctx.fillText(node.itemName, node.x, node.y + node.radius + 16);

      ctx.font = '10px Inter, sans-serif';
      ctx.fillStyle = textMuted;
      ctx.fillText(node.slotLabel, node.x, node.y + node.radius + 28);
    });
  }

  pointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
      y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
    };
  }

  clampNode(node) {
    const r = node.radius;
    node.x = Math.max(r, Math.min(this.canvas.width - r, node.x));
    node.y = Math.max(r, Math.min(this.canvas.height - r, node.y));
  }

  bindEvents() {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let movedDuringDrag = false;

    this.canvas.addEventListener('mousedown', (e) => {
      const { x, y } = this.pointerPos(e);
      this.selectedNode = this.nodes
        .slice()
        .reverse()
        .find(n => Math.hypot(x - n.x, y - n.y) <= n.radius);

      if (this.selectedNode) {
        isDragging = true;
        movedDuringDrag = false;
        this.pushUndo();
        dragOffset = { x: x - this.selectedNode.x, y: y - this.selectedNode.y };
        this.setStatus(`Selected: ${this.selectedNode.itemName} — ${this.selectedNode.zoneName} / ${this.selectedNode.slotLabel}`);
      } else {
        this.undoStack.pop();
      }
      this.canvas.focus();
      this.draw();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (!isDragging || !this.selectedNode) return;
      const { x, y } = this.pointerPos(e);
      this.selectedNode.x = x - dragOffset.x;
      this.selectedNode.y = y - dragOffset.y;
      if (this.snapToGrid) {
        this.selectedNode.x = Math.round(this.selectedNode.x / GRID_SIZE) * GRID_SIZE;
        this.selectedNode.y = Math.round(this.selectedNode.y / GRID_SIZE) * GRID_SIZE;
      }
      this.clampNode(this.selectedNode);
      movedDuringDrag = true;
      this.draw();
    });

    this.boundMouseUp = () => {
      if (isDragging && movedDuringDrag) this.persistLayout();
      else if (isDragging) this.undoStack.pop();
      isDragging = false;
    };
    window.addEventListener('mouseup', this.boundMouseUp);

    // Wheel scales the selected node — the header promises "scale".
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.selectedNode) return;
      e.preventDefault();
      this.pushUndo();
      const delta = e.deltaY < 0 ? 3 : -3;
      this.selectedNode.radius = Math.max(16, Math.min(90, this.selectedNode.radius + delta));
      this.persistLayout();
      this.draw();
    }, { passive: false });

    this.canvas.addEventListener('keydown', (e) => {
      if (!this.selectedNode) return;
      const step = this.snapToGrid ? GRID_SIZE : 4;
      const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (map[e.key]) {
        e.preventDefault();
        this.pushUndo();
        this.selectedNode.x += map[e.key][0];
        this.selectedNode.y += map[e.key][1];
        this.clampNode(this.selectedNode);
        this.persistLayout();
        this.draw();
      } else if (e.key.toLowerCase() === 'r') {
        this.pushUndo();
        this.selectedNode.rotation = (this.selectedNode.rotation + 45) % 360;
        this.persistLayout();
        this.draw();
      }
    });

    const bind = (id, fn) => {
      const el = this.container.querySelector(id);
      if (el) el.addEventListener('click', fn);
    };

    bind('#btnUndo', () => {
      this.setStatus(this.undo() ? 'Undid the last change.' : 'Nothing left to undo.');
    });

    bind('#btnSnap', (e) => {
      this.snapToGrid = !this.snapToGrid;
      e.currentTarget.textContent = `🧲 Snap: ${this.snapToGrid ? 'On' : 'Off'}`;
      e.currentTarget.setAttribute('aria-pressed', String(this.snapToGrid));
    });

    bind('#btnZoomIn', () => {
      this.zoom = Math.min(1.6, this.zoom + 0.15);
      this.resizeCanvasToContent();
      this.setStatus(`Zoom ${Math.round(this.zoom * 100)}%`);
    });
    bind('#btnZoomOut', () => {
      this.zoom = Math.max(0.4, this.zoom - 0.15);
      this.resizeCanvasToContent();
      this.setStatus(`Zoom ${Math.round(this.zoom * 100)}%`);
    });

    bind('#btnRotateSelected', () => {
      if (!this.selectedNode) {
        this.setStatus('Select a node on the plan first.');
        return;
      }
      this.pushUndo();
      this.selectedNode.rotation = (this.selectedNode.rotation + 45) % 360;
      this.persistLayout();
      this.draw();
    });

    bind('#btnSync', () => {
      this.emitSync();
      eventState.set({ venue: eventState.get().venue }, { source: 'FloorPlanEditor' });
      this.setStatus('Floor plan pushed to the 360° Studio and the budget.');
    });

    bind('#btnResetGrid', () => {
      if (!window.confirm('Reset every node to its default position? Your arranged layout will be lost.')) return;
      this.pushUndo();
      this.initNodesFromZones({ preservePositions: false, resetSaved: true });
      this.resizeCanvasToContent();
      this.persistLayout();
      this.draw();
      this.setStatus('Layout reset to defaults.');
    });
  }
}
