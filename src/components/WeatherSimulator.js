export class WeatherSimulator {
  constructor(containerElement, studio360Container) {
    this.container = containerElement;
    this.studio360Container = studio360Container;
    this.isOpen = false;
    this.currentMode = 'morning';
  }

  open() {
    this.isOpen = true;
    this.render();
  }

  close() {
    this.isOpen = false;
    this.container.innerHTML = '';
  }

  render() {
    if (!this.isOpen) {
      this.container.innerHTML = '';
      return;
    }

    this.container.innerHTML = `
      <div class="modal-overlay weather-modal-overlay">
        <div class="modal-card weather-modal-card">
          <div class="modal-header">
            <div class="modal-title-group">
              <span class="modal-badge">ENV SIMULATOR</span>
              <h3>🌦️ Weather & Time-of-Day Simulator</h3>
            </div>
            <button class="modal-close-btn" id="closeWeatherBtn">&times;</button>
          </div>

          <div class="modal-body">
            <p class="modal-desc">Select lighting and weather conditions to preview the 360° venue atmosphere in real-time:</p>
            
            <div class="weather-options-grid">
              <button class="weather-opt-card ${this.currentMode === 'morning' ? 'active' : ''}" data-mode="morning">
                <span class="weather-icon">☀️</span>
                <strong>Morning Daylight</strong>
                <small>Crisp bright natural sun</small>
              </button>
              <button class="weather-opt-card ${this.currentMode === 'sunset' ? 'active' : ''}" data-mode="sunset">
                <span class="weather-icon">🌅 Golden Sunset</span>
                <strong>Golden Hour</strong>
                <small>Warm amber twilight glow</small>
              </button>
              <button class="weather-opt-card ${this.currentMode === 'night' ? 'active' : ''}" data-mode="night">
                <span class="weather-icon">🌙 Midnight Gala</span>
                <strong>Night Atmosphere</strong>
                <small>Deep blue night lighting</small>
              </button>
              <button class="weather-opt-card ${this.currentMode === 'rain' ? 'active' : ''}" data-mode="rain">
                <span class="weather-icon">🌧️ Monsoon Rain</span>
                <strong>Monsoon Rain</strong>
                <small>Live rain overlay effect</small>
              </button>
            </div>

            <div id="weather-banner" class="weather-suggestion-banner ${this.currentMode === 'rain' ? 'show' : ''}">
              💡 <strong>Pro Tip:</strong> Consider adding a <em>Rain Cover Tent</em> from the equipment catalog for outdoor lawn zones!
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" id="resetWeatherBtn">Reset Default</button>
            <button class="btn-primary" id="applyWeatherDoneBtn">Done</button>
          </div>
        </div>
      </div>
    `;

    this.ensureRainOverlay();
    this.bindEvents();
  }

  ensureRainOverlay() {
    if (this.studio360Container && !this.studio360Container.querySelector('.rain-overlay')) {
      const rainDiv = document.createElement('div');
      rainDiv.className = 'rain-overlay';
      rainDiv.style.cssText = `
        position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        pointer-events: none; display: none; z-index: 10;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><line x1="5" y1="0" x2="5" y2="10" stroke="rgba(255,255,255,0.4)" stroke-width="1" /></svg>');
        background-repeat: repeat;
        animation: rainDrop 0.3s linear infinite;
      `;
      const style = document.createElement('style');
      style.innerHTML = `@keyframes rainDrop { 0% { background-position: 0 0; } 100% { background-position: 5px 20px; } }`;
      document.head.appendChild(style);
      this.studio360Container.appendChild(rainDiv);
    }
  }

  bindEvents() {
    const overlay = this.container.querySelector('.weather-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close();
      });
    }

    const closeBtn = this.container.querySelector('#closeWeatherBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());

    const doneBtn = this.container.querySelector('#applyWeatherDoneBtn');
    if (doneBtn) doneBtn.addEventListener('click', () => this.close());

    const resetBtn = this.container.querySelector('#resetWeatherBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.applyWeather('morning');
        this.render();
      });
    }

    const cards = this.container.querySelectorAll('.weather-opt-card');
    cards.forEach(card => {
      card.addEventListener('click', () => {
        const mode = card.dataset.mode;
        this.applyWeather(mode);
        this.render();
      });
    });
  }

  applyWeather(mode) {
    this.currentMode = mode;
    if (!this.studio360Container) return;

    const rainOverlay = this.studio360Container.querySelector('.rain-overlay');
    let filter = '';

    if (rainOverlay) rainOverlay.style.display = 'none';

    switch (mode) {
      case 'morning':
        filter = 'brightness(1.05) saturate(1.05)';
        break;
      case 'sunset':
        filter = 'sepia(0.3) brightness(0.9) hue-rotate(-10deg)';
        break;
      case 'night':
        filter = 'brightness(0.45) saturate(0.75) hue-rotate(190deg)';
        break;
      case 'rain':
        filter = 'brightness(0.65) contrast(1.1)';
        if (rainOverlay) rainOverlay.style.display = 'block';
        break;
    }

    const target = this.studio360Container.querySelector('canvas') || this.studio360Container;
    if (target) {
      target.style.transition = 'filter 0.6s ease';
      target.style.filter = filter;
    }
  }
}
