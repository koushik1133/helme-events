export class ARQRGenerator {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
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
      <div class="modal-overlay qr-modal-overlay">
        <div class="qr-modal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:650px; background:var(--bg-surface); color:var(--text-main); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.4); z-index:2000; overflow:hidden; display:flex; border:1px solid var(--border-subtle);">
        
        <div style="flex:1; padding:30px; display:flex; flex-direction:column; align-items:center; border-right:1px solid #e2e8f0;">
          <h2 style="margin:0 0 5px 0; text-align:center;">✨ AR Preview</h2>
          <p style="color:#64748b; text-align:center; font-size:14px; margin-bottom:20px;">Scan this code with your phone to view the event setup in Augmented Reality.</p>
          
          <div style="padding:15px; background:white; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 6px rgba(0,0,0,0.05); margin-bottom:20px;">
            <canvas id="qr-canvas" width="200" height="200"></canvas>
          </div>
          
          <button id="download-qr-btn" style="width:100%; padding:12px; background:#0f172a; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">
            Download QR as PNG
          </button>
        </div>
        
        <div style="flex:1; background:#f8fafc; padding:30px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
          <div style="width:160px; height:320px; border:8px solid #334155; border-radius:24px; position:relative; background:black; overflow:hidden; box-shadow:0 10px 20px rgba(0,0,0,0.2);">
            <div style="position:absolute; top:5px; left:50%; transform:translateX(-50%); width:50px; height:15px; background:#334155; border-radius:0 0 10px 10px; z-index:2;"></div>
            <div style="width:100%; height:100%; background:linear-gradient(45deg, #1e293b, #0f172a); display:flex; flex-direction:column; align-items:center; justify-content:center;">
              <span style="font-size:40px; margin-bottom:10px;">📱</span>
              <span style="color:white; font-size:12px; text-align:center; padding:0 20px;">Point camera to scan the code</span>
              
              <div style="margin-top:20px; width:100px; height:100px; border:2px dashed #4ade80; border-radius:8px; animation: pulse 2s infinite;"></div>
            </div>
          </div>
        </div>
        
        <button id="close-qr-btn" style="position:absolute; top:15px; right:15px; background:white; border:1px solid #e2e8f0; border-radius:50%; width:30px; height:30px; cursor:pointer; font-weight:bold; box-shadow:0 2px 4px rgba(0,0,0,0.1);">&times;</button>
      </div>
      <style>
        @keyframes pulse {
          0% { border-color: rgba(74, 222, 128, 0.4); }
          50% { border-color: rgba(74, 222, 128, 1); }
          100% { border-color: rgba(74, 222, 128, 0.4); }
        }
      </style>
    `;
    
    this.generateFakeQR();
    this.bindEvents();
  }
  
  generateFakeQR() {
    const canvas = this.container.querySelector('#qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const size = 200;
    const grid = 20; // 20x20 blocks
    const blockSize = size / grid;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, size, size);
    
    // Draw position markers (the big squares in corners)
    const drawMarker = (x, y) => {
      ctx.fillStyle = 'black';
      ctx.fillRect(x * blockSize, y * blockSize, 7 * blockSize, 7 * blockSize);
      ctx.fillStyle = 'white';
      ctx.fillRect((x + 1) * blockSize, (y + 1) * blockSize, 5 * blockSize, 5 * blockSize);
      ctx.fillStyle = 'black';
      ctx.fillRect((x + 2) * blockSize, (y + 2) * blockSize, 3 * blockSize, 3 * blockSize);
    };
    
    drawMarker(1, 1); // Top left
    drawMarker(12, 1); // Top right
    drawMarker(1, 12); // Bottom left
    
    // Hash state for fake data
    const stateStr = JSON.stringify(this.activeSelections);
    let hash = 0;
    for (let i = 0; i < stateStr.length; i++) {
      hash = ((hash << 5) - hash) + stateStr.charCodeAt(i);
      hash |= 0;
    }
    
    // Random seeded pattern
    const random = (seed) => {
      var x = Math.sin(seed++) * 10000;
      return x - Math.floor(x);
    };
    
    let seed = hash;
    ctx.fillStyle = 'black';
    for (let i = 0; i < grid; i++) {
      for (let j = 0; j < grid; j++) {
        // Skip marker areas
        if ((i < 9 && j < 9) || (i > 10 && j < 9) || (i < 9 && j > 10)) continue;
        
        if (random(seed++) > 0.5) {
          ctx.fillRect(i * blockSize, j * blockSize, blockSize, blockSize);
        }
      }
    }
  }
  
  bindEvents() {
    this.container.addEventListener('click', e => {
      if (e.target.id === 'close-qr-btn' || e.target.classList.contains('qr-modal-overlay')) {
        this.close();
      } else if (e.target.id === 'download-qr-btn') {
        const canvas = this.container.querySelector('#qr-canvas');
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `ar_experience_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    });
  }
}
