export class ESignatureFlow {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.isSigned = localStorage.getItem('helme_events_contracts') === 'signed';
  }

  open() {
    this.render();
    this.container.style.display = 'flex';
  }

  close() {
    this.container.innerHTML = '';
    this.container.style.display = 'none';
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content contract-modal">
          <div class="modal-header">
            <h2>Digital Contract & E-Signature</h2>
            <button class="btn-close">&times;</button>
          </div>
          <div class="modal-body contract-body">
            <h3>Event Details</h3>
            <p>Equipment List based on selections.</p>
            <h3>Payment Terms</h3>
            <p>30% advance, 70% on completion.</p>
            <h3>Cancellation Policy & Terms</h3>
            <p>Standard terms and conditions apply.</p>
            
            <div class="signature-section">
              <h4>Sign Here</h4>
              <canvas id="signature-pad" width="400" height="200" style="border: 1px solid #ccc; background: #fff; cursor: crosshair;"></canvas>
              <div style="margin-top:10px;">
                <button class="btn-clear-sig">Clear Signature</button>
              </div>
            </div>
            
            <div class="terms-check" style="margin-top:20px;">
              <input type="checkbox" id="agree-terms" />
              <label for="agree-terms">I agree to the terms and conditions</label>
            </div>
            <div class="date-stamp" style="margin-top:10px; font-weight:bold;">Date: ${new Date().toLocaleDateString()}</div>
          </div>
          <div class="modal-footer">
            <button class="btn-sign-download" disabled>Sign & Download Contract</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  bindEvents() {
    const closeBtn = this.container.querySelector('.btn-close');
    closeBtn.addEventListener('click', () => this.close());

    const canvas = this.container.querySelector('#signature-pad');
    const ctx = canvas.getContext('2d');
    let isDrawing = false;
    let hasDrawn = false;

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const startDrawing = (e) => {
      isDrawing = true;
      hasDrawn = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      e.preventDefault();
    };

    const draw = (e) => {
      if (!isDrawing) return;
      const pos = getPos(e);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      e.preventDefault();
    };

    const stopDrawing = (e) => {
      isDrawing = false;
      if (e) e.preventDefault();
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, {passive: false});
    canvas.addEventListener('touchmove', draw, {passive: false});
    canvas.addEventListener('touchend', stopDrawing);

    this.container.querySelector('.btn-clear-sig').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    });

    const agreeCheck = this.container.querySelector('#agree-terms');
    const btnDownload = this.container.querySelector('.btn-sign-download');
    
    agreeCheck.addEventListener('change', (e) => {
      btnDownload.disabled = !e.target.checked;
    });

    btnDownload.addEventListener('click', () => {
      if (!hasDrawn) {
        alert("Please provide your signature.");
        return;
      }
      localStorage.setItem('helme_events_contracts', 'signed');
      const sigData = canvas.toDataURL('image/png');
      const contractHtml = `
        <html>
        <head><title>Signed Contract</title></head>
        <body style="font-family: sans-serif; padding: 40px;">
          <h1>Event Contract</h1>
          <p>Payment Terms: 30% advance, 70% on completion.</p>
          <p>Equipment Selections: ${Object.keys(this.activeSelections).length} slots configured.</p>
          <h3>Signature</h3>
          <img src="${sigData}" style="border: 1px solid #ccc; max-width:400px;"/>
          <p>Signed on: ${new Date().toLocaleDateString()}</p>
        </body>
        </html>
      `;
      const blob = new Blob([contractHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contract.html';
      a.click();
      URL.revokeObjectURL(url);
      this.close();
    });
  }
}
