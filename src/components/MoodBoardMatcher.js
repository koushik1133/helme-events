import { ITEM_CATALOG } from '../data/catalog.js';

export class MoodBoardMatcher {
  constructor(containerElement, activeSelections, onApply) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.onApply = onApply || (() => {});
    this.images = JSON.parse(localStorage.getItem('helme_events_moodboard')) || [];
    this.matchedItems = [];
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
      <div class="moodboard-modal" style="position:fixed; top:10%; left:10%; right:10%; bottom:10%; background:white; border-radius:12px; box-shadow:0 10px 40px rgba(0,0,0,0.5); z-index:2000; display:flex; flex-direction:column; overflow:hidden;">
        
        <!-- Header -->
        <div style="padding:20px; background:#1e293b; color:white; display:flex; justify-content:space-between; align-items:center;">
          <h2 style="margin:0;">🖼️ AI Mood Board Matcher</h2>
          <button id="close-mb-btn" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">&times;</button>
        </div>
        
        <!-- Body -->
        <div style="display:flex; flex:1; overflow:hidden;">
          
          <!-- Left: Mood Board (Upload + Grid) -->
          <div style="flex:2; padding:20px; border-right:1px solid #e2e8f0; display:flex; flex-direction:column; overflow:hidden;">
            
            <!-- Dropzone -->
            <div id="mb-dropzone" style="border:2px dashed #cbd5e1; border-radius:8px; padding:30px; text-align:center; cursor:pointer; background:#f8fafc; transition:all 0.2s;">
              <span style="font-size:30px; display:block; margin-bottom:10px;">📸</span>
              <strong>Drag & Drop images here</strong><br/>
              <span style="font-size:12px; color:#64748b;">or click to browse files</span>
              <input type="file" id="mb-file-input" multiple accept="image/*" style="display:none;" />
            </div>
            
            <div style="margin:20px 0; display:flex; justify-content:space-between; align-items:center;">
              <h3 style="margin:0;">Inspiration Board</h3>
              <button id="mb-analyze-btn" style="padding:10px 20px; background:#6366f1; color:white; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">
                ✨ AI Analyze & Match
              </button>
            </div>
            
            <!-- Masonry Grid -->
            <div id="mb-grid" style="flex:1; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:10px; align-content:start;">
              <!-- Rendered by JS -->
            </div>
          </div>
          
          <!-- Right: Suggestions -->
          <div style="flex:1; padding:20px; background:#f8fafc; display:flex; flex-direction:column; overflow:hidden;">
            <h3 style="margin-top:0;">Suggested Catalog Items</h3>
            <p style="font-size:12px; color:#64748b;">Based on color extraction & style analysis.</p>
            
            <div id="mb-suggestions" style="flex:1; overflow-y:auto;">
              <!-- Rendered by JS -->
            </div>
            
            <button id="mb-apply-btn" style="margin-top:20px; width:100%; padding:15px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:bold; font-size:16px; cursor:pointer; display:none;">
              Apply Matched Style to Event
            </button>
          </div>
          
        </div>
      </div>
    `;
    
    this.renderImages();
    this.bindEvents();
  }
  
  renderImages() {
    const grid = this.container.querySelector('#mb-grid');
    grid.innerHTML = '';
    
    if (this.images.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; color:#94a3b8; padding:40px;">No images uploaded yet.</div>';
      return;
    }
    
    this.images.forEach((src, idx) => {
      grid.innerHTML += `
        <div style="position:relative; border-radius:6px; overflow:hidden; box-shadow:0 2px 4px rgba(0,0,0,0.1);">
          <img src="${src}" style="width:100%; height:150px; object-fit:cover; display:block;" />
          <button class="mb-del-img" data-idx="${idx}" style="position:absolute; top:5px; right:5px; background:rgba(0,0,0,0.5); color:white; border:none; border-radius:50%; width:24px; height:24px; cursor:pointer;">&times;</button>
        </div>
      `;
    });
  }
  
  handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = e => {
        this.images.push(e.target.result);
        localStorage.setItem('helme_events_moodboard', JSON.stringify(this.images));
        this.renderImages();
      };
      reader.readAsDataURL(file);
    });
  }
  
  analyzeImages() {
    if (this.images.length === 0) {
      alert("Upload some images first!");
      return;
    }
    
    // Simulate AI delay
    const btn = this.container.querySelector('#mb-analyze-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Analyzing...';
    btn.disabled = true;
    
    setTimeout(() => {
      this.extractColorsAndMatch();
      btn.innerHTML = originalText;
      btn.disabled = false;
    }, 1500);
  }
  
  extractColorsAndMatch() {
    // In a real app we'd draw to canvas and get average color.
    // For simulation, we randomly pick some items from the catalog.
    this.matchedItems = [];
    const allItems = Object.values(ITEM_CATALOG).flat();
    
    // Pick 3-5 random items to suggest
    const count = Math.floor(Math.random() * 3) + 3;
    for (let i = 0; i < count; i++) {
      const randomItem = allItems[Math.floor(Math.random() * allItems.length)];
      if (!this.matchedItems.find(x => x.id === randomItem.id)) {
        this.matchedItems.push(randomItem);
      }
    }
    
    this.renderSuggestions();
  }
  
  renderSuggestions() {
    const container = this.container.querySelector('#mb-suggestions');
    container.innerHTML = '';
    
    if (this.matchedItems.length === 0) return;
    
    this.matchedItems.forEach(item => {
      container.innerHTML += `
        <div style="display:flex; gap:10px; padding:10px; background:white; border:1px solid #e2e8f0; border-radius:6px; margin-bottom:10px;">
          <img src="${item.imageUrl}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;" onerror="this.src='https://via.placeholder.com/60'"/>
          <div>
            <div style="font-weight:bold; font-size:14px;">${item.name}</div>
            <div style="font-size:12px; color:#64748b;">${item.category}</div>
            <div style="display:inline-block; width:12px; height:12px; background:${item.color || '#ccc'}; border-radius:50%; margin-top:5px; border:1px solid #999;"></div>
          </div>
        </div>
      `;
    });
    
    this.container.querySelector('#mb-apply-btn').style.display = 'block';
  }
  
  bindEvents() {
    const dropzone = this.container.querySelector('#mb-dropzone');
    const fileInput = this.container.querySelector('#mb-file-input');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', e => {
      e.preventDefault();
      dropzone.style.borderColor = '#6366f1';
      dropzone.style.background = '#e0e7ff';
    });
    
    dropzone.addEventListener('dragleave', e => {
      e.preventDefault();
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.background = '#f8fafc';
    });
    
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '#cbd5e1';
      dropzone.style.background = '#f8fafc';
      this.handleFiles(e.dataTransfer.files);
    });
    
    fileInput.addEventListener('change', e => {
      this.handleFiles(e.target.files);
    });
    
    this.container.addEventListener('click', e => {
      if (e.target.id === 'close-mb-btn') {
        this.close();
      } else if (e.target.classList.contains('mb-del-img')) {
        const idx = parseInt(e.target.dataset.idx);
        this.images.splice(idx, 1);
        localStorage.setItem('helme_events_moodboard', JSON.stringify(this.images));
        this.renderImages();
      } else if (e.target.id === 'mb-analyze-btn') {
        this.analyzeImages();
      } else if (e.target.id === 'mb-apply-btn') {
        // Create mock selection payload
        const newSelections = { ...this.activeSelections };
        // We'll just pass the matched items out via callback
        this.onApply(this.matchedItems);
        this.close();
      }
    });
  }
}
