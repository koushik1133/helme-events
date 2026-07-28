export class WeatherSimulator {
  constructor(containerElement, studio360Container) {
    this.container = containerElement;
    this.studio360Container = studio360Container;
  }
  
  render() {
    this.container.innerHTML = `
      <div class="weather-panel" style="padding:15px; background:white; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:20px; display:flex; gap:10px; align-items:center;">
        <span style="font-weight:bold; margin-right:10px;">🌦️ Environment:</span>
        <button class="weather-btn" data-mode="morning" style="padding:8px 12px; border-radius:20px; border:1px solid #cbd5e1; background:white; cursor:pointer;">☀️ Morning</button>
        <button class="weather-btn" data-mode="sunset" style="padding:8px 12px; border-radius:20px; border:1px solid #cbd5e1; background:white; cursor:pointer;">🌅 Sunset</button>
        <button class="weather-btn" data-mode="night" style="padding:8px 12px; border-radius:20px; border:1px solid #cbd5e1; background:white; cursor:pointer;">🌙 Night</button>
        <button class="weather-btn" data-mode="rain" style="padding:8px 12px; border-radius:20px; border:1px solid #cbd5e1; background:white; cursor:pointer;">🌧️ Rain</button>
      </div>
      <div id="weather-banner" style="display:none; padding:10px; background:#e0f2fe; color:#0369a1; border-left:4px solid #0284c7; margin-bottom:15px; font-weight:bold;">
        💡 Suggestion: Consider adding a Rain Cover Tent from the catalog!
      </div>
    `;
    
    // Add rain overlay div to studio container if not exists
    if (this.studio360Container && !this.studio360Container.querySelector('.rain-overlay')) {
      const rainDiv = document.createElement('div');
      rainDiv.className = 'rain-overlay';
      rainDiv.style.cssText = `
        position:absolute; top:0; left:0; right:0; bottom:0;
        pointer-events:none; display:none; z-index:10;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><line x1="5" y1="0" x2="5" y2="10" stroke="rgba(255,255,255,0.4)" stroke-width="1" /></svg>');
        background-repeat: repeat;
        animation: rainDrop 0.3s linear infinite;
      `;
      // inject keyframes
      const style = document.createElement('style');
      style.innerHTML = `@keyframes rainDrop { 0% { background-position: 0 0; } 100% { background-position: 5px 20px; } }`;
      document.head.appendChild(style);
      
      this.studio360Container.appendChild(rainDiv);
    }
    
    this.bindEvents();
  }
  
  bindEvents() {
    this.container.addEventListener('click', e => {
      if (e.target.classList.contains('weather-btn')) {
        const btns = this.container.querySelectorAll('.weather-btn');
        btns.forEach(b => { b.style.background = 'white'; b.style.color = 'black'; });
        e.target.style.background = '#3b82f6';
        e.target.style.color = 'white';
        
        this.applyWeather(e.target.dataset.mode);
      }
    });
  }
  
  applyWeather(mode) {
    if (!this.studio360Container) return;
    
    const banner = this.container.querySelector('#weather-banner');
    const rainOverlay = this.studio360Container.querySelector('.rain-overlay');
    let filter = '';
    
    banner.style.display = 'none';
    if (rainOverlay) rainOverlay.style.display = 'none';
    
    switch (mode) {
      case 'morning':
        filter = 'brightness(1.1) saturate(1.1)';
        break;
      case 'sunset':
        filter = 'sepia(0.3) brightness(0.9) hue-rotate(-10deg)';
        break;
      case 'night':
        filter = 'brightness(0.4) saturate(0.7) hue-rotate(200deg)';
        break;
      case 'rain':
        filter = 'brightness(0.6) contrast(1.1)';
        banner.style.display = 'block';
        if (rainOverlay) rainOverlay.style.display = 'block';
        break;
    }
    
    // Assuming the 360 viewer has a canvas or container we can filter
    // Try to find canvas, fallback to studio container
    const target = this.studio360Container.querySelector('canvas') || this.studio360Container;
    target.style.transition = 'filter 1s ease';
    target.style.filter = filter;
  }
}
