import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';

export class FloorPlanEditor {
  constructor(containerElement, activeSelections, onUpdateSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    this.onUpdateSelections = onUpdateSelections;
    this.canvas = null;
    this.ctx = null;
    this.selectedNode = null;
    this.nodes = [];

    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.initNodesFromZones();
    this.draw();
  }

  initNodesFromZones() {
    this.nodes = [];
    let idx = 0;

    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);

        const x = 120 + (idx % 4) * 220;
        const y = 140 + Math.floor(idx / 4) * 160;

        this.nodes.push({
          id: slot.id,
          zoneName: zone.name,
          slotLabel: slot.label,
          itemName: item ? item.name : 'Object',
          category: slot.category,
          x: x,
          y: y,
          radius: 38,
          color: item ? item.color : '#38bdf8',
          rotation: 0
        });

        idx++;
      });
    });
  }

  render() {
    this.container.innerHTML = `
      <div class="floor-plan-wrapper realistic-map-theme">
        <div class="floor-plan-header">
          <div>
            <h3>📐 Architectural 2D/3D Site Floor Plan Editor</h3>
            <p>Drag, position, rotate, & scale venue equipment nodes on the grid. Live synced to 360° Studio & Budget Invoice.</p>
          </div>
          <div class="floor-plan-toolbar">
            <button class="btn-floor-action" id="btnResetGrid">🔄 Reset Grid</button>
            <button class="btn-floor-action" id="btnRotateSelected">↪️ Rotate Selected (45°)</button>
          </div>
        </div>

        <div class="canvas-grid-container">
          <canvas id="floorPlanCanvas" width="1180" height="640"></canvas>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#floorPlanCanvas');
    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.initNodesFromZones();
      this.bindEvents();
      this.draw();
    }
  }

  draw() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1;
    const gridSize = 40;

    for (let x = 0; x < this.canvas.width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }

    for (let y = 0; y < this.canvas.height; y += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    this.nodes.forEach(node => {
      const isSelected = this.selectedNode === node;

      this.ctx.save();
      this.ctx.translate(node.x, node.y);
      this.ctx.rotate((node.rotation * Math.PI) / 180);

      this.ctx.beginPath();
      this.ctx.arc(0, 0, node.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color + '33';
      this.ctx.fill();
      this.ctx.lineWidth = isSelected ? 3 : 1.5;
      this.ctx.strokeStyle = isSelected ? '#fbbf24' : node.color;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.arc(0, 0, node.radius - 12, 0, Math.PI * 2);
      this.ctx.fillStyle = node.color;
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.moveTo(0, -node.radius);
      this.ctx.lineTo(0, -node.radius - 8);
      this.ctx.strokeStyle = '#fff';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.restore();

      this.ctx.font = 'bold 11px Inter, sans-serif';
      this.ctx.fillStyle = isSelected ? '#fbbf24' : '#f9fafb';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(node.itemName, node.x, node.y + node.radius + 16);

      this.ctx.font = '10px Inter, sans-serif';
      this.ctx.fillStyle = '#9ca3af';
      this.ctx.fillText(node.slotLabel, node.x, node.y + node.radius + 28);
    });
  }

  bindEvents() {
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      this.selectedNode = this.nodes.find(n => {
        const dx = mx - n.x;
        const dy = my - n.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });

      if (this.selectedNode) {
        isDragging = true;
        dragOffset = { x: mx - this.selectedNode.x, y: my - this.selectedNode.y };
      }

      this.draw();
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging && this.selectedNode) {
        const rect = this.canvas.getBoundingClientRect();
        this.selectedNode.x = e.clientX - rect.left - dragOffset.x;
        this.selectedNode.y = e.clientY - rect.top - dragOffset.y;
        this.draw();
      }
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    const resetBtn = this.container.querySelector('#btnResetGrid');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.initNodesFromZones();
        this.draw();
      });
    }

    const rotateBtn = this.container.querySelector('#btnRotateSelected');
    if (rotateBtn) {
      rotateBtn.addEventListener('click', () => {
        if (this.selectedNode) {
          this.selectedNode.rotation = (this.selectedNode.rotation + 45) % 360;
          this.draw();
        }
      });
    }
  }
}
