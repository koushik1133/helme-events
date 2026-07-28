import { VENUE_ZONES } from '../data/zones.js';

export class WalkthroughExporter {
  constructor(containerElement) {
    this.container = containerElement;
    this.mediaRecorder = null;
    this.recordedChunks = [];
  }
  
  open() {
    this.container.style.display = 'block';
    this.render();
  }
  
  close() {
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }
  
  render() {
    this.container.innerHTML = `
      <div class="modal-overlay walkthrough-modal-overlay">
        <div class="walkthrough-modal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:620px; background:var(--bg-surface); color:var(--text-main); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:2000; overflow:hidden; border:1px solid var(--border-subtle);">
          <div style="padding:15px 20px; background:var(--bg-elevated); color:var(--text-main); display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle);">
            <h2 style="margin:0; font-size:18px;">🎬 Walkthrough Video Export</h2>
            <button id="close-walk-btn" style="background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">&times;</button>
          </div>
        
        <div style="padding:20px;">
          <div style="display:flex; gap:20px;">
            <div style="flex:1;">
              <h3>Select Zones</h3>
              <div id="zone-checkboxes" style="max-height:200px; overflow-y:auto; border:1px solid #e2e8f0; padding:10px; border-radius:4px;">
                ${VENUE_ZONES.map(z => `
                  <label style="display:block; margin-bottom:5px;">
                    <input type="checkbox" class="zone-chk" value="${z.id}" checked /> ${z.name}
                  </label>
                `).join('')}
              </div>
              
              <div style="margin-top:15px;">
                <label><strong>Speed:</strong></label>
                <select id="export-speed" style="padding:5px;">
                  <option value="1">1x (Normal)</option>
                  <option value="2">2x (Fast)</option>
                  <option value="4">4x (Ultra)</option>
                </select>
              </div>
              
              <button id="start-record-btn" style="margin-top:20px; width:100%; padding:10px; background:#3b82f6; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                Start Rendering Walkthrough
              </button>
            </div>
            
            <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <canvas id="render-canvas" width="400" height="225" style="background:#0f172a; border-radius:4px; width:100%; max-width:300px;"></canvas>
              
              <div id="progress-container" style="display:none; width:100%; margin-top:15px;">
                <div style="font-size:12px; margin-bottom:5px; display:flex; justify-content:space-between;">
                  <span id="progress-text">Rendering...</span>
                  <span id="progress-pct">0%</span>
                </div>
                <div style="width:100%; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden;">
                  <div id="progress-bar" style="height:100%; width:0%; background:#22c55e; transition:width 0.2s;"></div>
                </div>
              </div>
              
              <a id="download-link" style="display:none; margin-top:15px; width:100%; padding:10px; background:#10b981; color:white; text-align:center; text-decoration:none; border-radius:4px; font-weight:bold;">
                ⬇️ Download Video (.webm)
              </a>
            </div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }
  
  bindEvents() {
    this.container.addEventListener('click', e => {
      if (e.target.id === 'close-walk-btn' || e.target.classList.contains('walkthrough-modal-overlay')) {
        this.close();
      } else if (e.target.id === 'start-record-btn') {
        this.startRecording();
      }
    });
  }
  
  async startRecording() {
    const btn = this.container.querySelector('#start-record-btn');
    btn.disabled = true;
    btn.style.opacity = '0.5';
    
    const checkboxes = Array.from(this.container.querySelectorAll('.zone-chk:checked'));
    const selectedZones = VENUE_ZONES.filter(z => checkboxes.find(c => c.value === z.id));
    
    if (selectedZones.length === 0) {
      alert("Please select at least one zone");
      btn.disabled = false;
      btn.style.opacity = '1';
      return;
    }
    
    const speed = parseInt(this.container.querySelector('#export-speed').value);
    const canvas = this.container.querySelector('#render-canvas');
    const ctx = canvas.getContext('2d');
    
    // Setup MediaRecorder
    const stream = canvas.captureStream(30); // 30 FPS
    this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    this.recordedChunks = [];
    
    this.mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) this.recordedChunks.push(e.data);
    };
    
    this.mediaRecorder.onstop = () => {
      const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = this.container.querySelector('#download-link');
      link.href = url;
      link.download = `event_walkthrough_${Date.now()}.webm`;
      link.style.display = 'block';
      
      btn.textContent = 'Render Complete!';
    };
    
    // UI updates
    const progContainer = this.container.querySelector('#progress-container');
    const progBar = this.container.querySelector('#progress-bar');
    const progPct = this.container.querySelector('#progress-pct');
    progContainer.style.display = 'block';
    this.container.querySelector('#download-link').style.display = 'none';
    
    this.mediaRecorder.start();
    
    // Simulation loop
    const timePerZone = 3000 / speed; // ms
    let currentZoneIdx = 0;
    
    const renderNextZone = () => {
      if (currentZoneIdx >= selectedZones.length) {
        this.mediaRecorder.stop();
        progBar.style.width = '100%';
        progPct.textContent = '100%';
        return;
      }
      
      const zone = selectedZones[currentZoneIdx];
      let pct = Math.floor((currentZoneIdx / selectedZones.length) * 100);
      progBar.style.width = `${pct}%`;
      progPct.textContent = `${pct}%`;
      
      // Load image and draw
      const img = new Image();
      img.onload = () => {
        // Animation variables
        let startTime = Date.now();
        
        const animate = () => {
          let elapsed = Date.now() - startTime;
          if (elapsed > timePerZone) {
            currentZoneIdx++;
            renderNextZone();
            return;
          }
          
          // Simple pan effect
          const panX = (elapsed / timePerZone) * 100;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          // Draw image panning slowly
          // Use natural dimensions to crop nicely
          ctx.drawImage(img, panX, 0, img.width / 2, img.height, 0, 0, canvas.width, canvas.height);
          
          // Draw text overlay
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
          ctx.fillStyle = 'white';
          ctx.font = '16px sans-serif';
          ctx.fillText(zone.name, 10, canvas.height - 15);
          
          requestAnimationFrame(animate);
        };
        animate();
      };
      
      // Fallback if image fails to load
      img.onerror = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = '20px sans-serif';
        ctx.fillText(zone.name, 20, canvas.height / 2);
        
        setTimeout(() => {
          currentZoneIdx++;
          renderNextZone();
        }, timePerZone);
      };
      
      img.src = zone.panoramaUrl;
    };
    
    renderNextZone();
  }
}
