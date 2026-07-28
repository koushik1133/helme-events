export class SeatingChart {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    
    const saved = localStorage.getItem('helme_events_guests');
    this.guests = saved ? JSON.parse(saved) : [];
    
    this.tableCount = this.calculateTables();
    this.selectedGuestId = null;
    
    this.render();
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections;
    this.tableCount = this.calculateTables();
    this.drawCanvas();
  }

  calculateTables() {
    // Basic heuristic: check for table slots in activeSelections, otherwise default to 8
    let count = 8;
    for (const val of Object.values(this.activeSelections)) {
      if (val && val.includes('table')) {
        // We'll just increase count a bit for demo purposes if tables are selected
        count = 12;
      }
    }
    return count;
  }

  save() {
    localStorage.setItem('helme_events_guests', JSON.stringify(this.guests));
  }

  render() {
    this.container.innerHTML = `
      <div class="seating-wrapper" style="display: flex; gap: 20px; height: 100%;">
        <div class="seating-canvas-container" style="flex: 2; position: relative;">
          <h2>👥 Guest Seating Chart Builder</h2>
          <canvas id="seating-canvas" width="600" height="600" style="background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; cursor: pointer;"></canvas>
        </div>
        <div class="seating-sidebar" style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
          <h3>Guest List (${this.guests.length})</h3>
          <div style="display: flex; gap: 5px;">
            <input type="text" id="seating-guest-name" placeholder="Guest Name" style="flex: 1; padding: 5px;">
            <select id="seating-guest-group" style="padding: 5px;">
              <option value="Bride">Bride</option>
              <option value="Groom">Groom</option>
              <option value="VIP">VIP</option>
              <option value="Other">Other</option>
            </select>
            <button class="btn-primary" id="seating-add-guest">Add</button>
          </div>
          <div style="display: flex; gap: 5px;">
             <button class="btn-secondary" id="seating-import-btn" style="flex: 1;">Import CSV</button>
             <button class="btn-secondary" id="seating-export-btn" style="flex: 1;">Export CSV</button>
          </div>
          <div class="seating-guest-list" id="seating-guest-list" style="overflow-y: auto; flex: 1; border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
            <!-- Guest list renders here -->
          </div>
          <p style="font-size: 0.85em; color: #666;">Click a guest in the list, then click a seat on a table to assign them.</p>
        </div>
      </div>
    `;
    this.canvas = this.container.querySelector('#seating-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    this.bindEvents();
    this.renderGuestList();
    this.drawCanvas();
  }

  renderGuestList() {
    const listEl = this.container.querySelector('#seating-guest-list');
    listEl.innerHTML = this.guests.map(g => `
      <div class="seating-guest-card ${g.id === this.selectedGuestId ? 'selected' : ''}" data-id="${g.id}" style="padding: 8px; border: 1px solid #eee; margin-bottom: 5px; border-radius: 4px; background: ${g.id === this.selectedGuestId ? '#e3f2fd' : '#fff'}; cursor: pointer;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong>${g.name}</strong>
          <span style="font-size: 0.8em; color: #888;">${g.group}</span>
        </div>
        <div style="font-size: 0.8em; color: ${g.tableNumber ? '#2e7d32' : '#c62828'};">
          ${g.tableNumber ? `Table ${g.tableNumber}, Seat ${g.seatNumber}` : 'Unassigned'}
        </div>
      </div>
    `).join('');
    
    listEl.querySelectorAll('.seating-guest-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedGuestId = card.dataset.id;
        this.renderGuestList(); // Update selection styling
      });
    });
  }

  drawCanvas() {
    const width = this.canvas.width;
    const height = this.canvas.height;
    this.ctx.clearRect(0, 0, width, height);
    
    const cols = Math.ceil(Math.sqrt(this.tableCount));
    const rows = Math.ceil(this.tableCount / cols);
    const cellW = width / cols;
    const cellH = height / rows;
    const tableRadius = Math.min(cellW, cellH) * 0.25;
    const seatsPerTable = 8;
    
    this.tablePositions = []; // Store for click detection

    for (let i = 0; i < this.tableCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * cellW + cellW / 2;
      const cy = row * cellH + cellH / 2;
      
      this.tablePositions.push({ id: i + 1, cx, cy, radius: tableRadius });
      
      // Draw Table
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, tableRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = '#fff';
      this.ctx.fill();
      this.ctx.strokeStyle = '#ccc';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      this.ctx.fillStyle = '#333';
      this.ctx.font = '14px sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`T${i + 1}`, cx, cy);
      
      // Draw Seats
      for (let s = 0; s < seatsPerTable; s++) {
        const angle = (s / seatsPerTable) * Math.PI * 2;
        const seatR = tableRadius + 15;
        const sx = cx + Math.cos(angle) * seatR;
        const sy = cy + Math.sin(angle) * seatR;
        
        // Check if assigned
        const occupant = this.guests.find(g => g.tableNumber === i + 1 && g.seatNumber === s + 1);
        
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = occupant ? '#4caf50' : '#e0e0e0';
        this.ctx.fill();
        this.ctx.strokeStyle = occupant ? '#2e7d32' : '#9e9e9e';
        this.ctx.stroke();
      }
    }
  }

  bindEvents() {
    this.container.querySelector('#seating-add-guest').addEventListener('click', () => {
      const nameInput = this.container.querySelector('#seating-guest-name');
      const groupInput = this.container.querySelector('#seating-guest-group');
      if (nameInput.value.trim()) {
        this.guests.push({
          id: 'g' + Date.now(),
          name: nameInput.value.trim(),
          group: groupInput.value,
          rsvp: 'pending',
          tableNumber: null,
          seatNumber: null
        });
        nameInput.value = '';
        this.save();
        this.renderGuestList();
        this.container.querySelector('h3').textContent = `Guest List (${this.guests.length})`;
      }
    });

    this.canvas.addEventListener('click', (e) => {
      if (!this.selectedGuestId) return;
      
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Find clicked table/seat
      const seatsPerTable = 8;
      for (const t of this.tablePositions) {
        for (let s = 0; s < seatsPerTable; s++) {
          const angle = (s / seatsPerTable) * Math.PI * 2;
          const seatR = t.radius + 15;
          const sx = t.cx + Math.cos(angle) * seatR;
          const sy = t.cy + Math.sin(angle) * seatR;
          
          const dist = Math.hypot(x - sx, y - sy);
          if (dist < 12) {
            // Clicked this seat
            const guest = this.guests.find(g => g.id === this.selectedGuestId);
            if (guest) {
              // Unassign current occupant if any
              const currentOccupant = this.guests.find(g => g.tableNumber === t.id && g.seatNumber === s + 1);
              if (currentOccupant) {
                currentOccupant.tableNumber = null;
                currentOccupant.seatNumber = null;
              }
              guest.tableNumber = t.id;
              guest.seatNumber = s + 1;
              
              this.selectedGuestId = null; // Reset selection
              this.save();
              this.renderGuestList();
              this.drawCanvas();
            }
            return;
          }
        }
      }
    });
    
    this.container.querySelector('#seating-import-btn').addEventListener('click', () => {
      const csv = prompt("Paste CSV (Name,Group):", "John Doe,VIP\\nJane Smith,Bride");
      if (csv) {
        csv.split('\\n').forEach(line => {
          const [name, group] = line.split(',');
          if (name) {
            this.guests.push({
              id: 'g' + Math.random().toString(36).substr(2, 9),
              name: name.trim(),
              group: group ? group.trim() : 'Other',
              rsvp: 'pending',
              tableNumber: null,
              seatNumber: null
            });
          }
        });
        this.save();
        this.renderGuestList();
        this.container.querySelector('h3').textContent = `Guest List (${this.guests.length})`;
      }
    });
    
    this.container.querySelector('#seating-export-btn').addEventListener('click', () => {
      const csv = ['Name,Group,Table,Seat'].concat(
        this.guests.map(g => `${g.name},${g.group},${g.tableNumber || ''},${g.seatNumber || ''}`)
      ).join('\\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'guests.csv';
      a.click();
    });
  }
}
