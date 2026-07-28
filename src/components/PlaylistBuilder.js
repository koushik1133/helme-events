export class PlaylistBuilder {
  constructor(containerElement) {
    this.container = containerElement;
    
    // Mock song library if missing
    this.songLibrary = [
      { id: 's1', title: 'A Thousand Years', artist: 'Christina Perri', genre: 'Acoustic', duration: '4:30', bpm: 80 },
      { id: 's2', title: 'Perfect', artist: 'Ed Sheeran', genre: 'Acoustic', duration: '4:23', bpm: 95 },
      { id: 's3', title: 'Uptown Funk', artist: 'Bruno Mars', genre: 'Pop', duration: '4:30', bpm: 115 },
      { id: 's4', title: 'Don\'t Stop Believin\'', artist: 'Journey', genre: 'Rock', duration: '4:11', bpm: 119 },
      { id: 's5', title: 'Canon in D', artist: 'Pachelbel', genre: 'Classical', duration: '5:00', bpm: 70 },
      { id: 's6', title: 'Mr. Brightside', artist: 'The Killers', genre: 'Rock', duration: '3:42', bpm: 148 },
      { id: 's7', title: 'Levitating', artist: 'Dua Lipa', genre: 'Pop', duration: '3:23', bpm: 103 },
      { id: 's8', title: 'Fly Me To The Moon', artist: 'Frank Sinatra', genre: 'Jazz', duration: '2:27', bpm: 119 }
    ];
    
    this.playlists = JSON.parse(localStorage.getItem('helme_events_playlists')) || {
      'Ceremony': [],
      'Cocktail Hour': [],
      'Reception': [],
      'After-Party': []
    };
    
    this.activeLane = 'Ceremony';
    this.audioCtx = null;
  }
  
  render() {
    const lanes = Object.keys(this.playlists);
    
    this.container.innerHTML = `
      <div class="playlist-wrapper" style="padding:20px; display:flex; gap:20px; height:600px; font-family:sans-serif;">
        
        <!-- Library Panel -->
        <div style="flex:1; background:white; border:1px solid #e2e8f0; border-radius:8px; display:flex; flex-direction:column; overflow:hidden;">
          <div style="padding:15px; background:#f8fafc; border-bottom:1px solid #e2e8f0;">
            <h3 style="margin:0 0 10px 0;">🎵 Song Library</h3>
            <input type="text" id="song-search" placeholder="Search title or artist..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:4px; box-sizing:border-box;" />
          </div>
          <div id="library-list" style="flex:1; overflow-y:auto; padding:10px;">
            <!-- Rendered by JS -->
          </div>
        </div>
        
        <!-- Playlists Panel -->
        <div style="flex:2; display:flex; flex-direction:column;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 style="margin:0;">Event Playlists</h2>
            <button id="export-playlist-btn" style="padding:8px 15px; background:#10b981; color:white; border:none; border-radius:4px; cursor:pointer;">💾 Export JSON</button>
          </div>
          
          <!-- Lane Tabs -->
          <div style="display:flex; border-bottom:1px solid #e2e8f0; margin-bottom:15px;">
            ${lanes.map(l => `
              <button class="lane-tab ${l === this.activeLane ? 'active' : ''}" data-lane="${l}" 
                style="padding:10px 20px; background:${l === this.activeLane ? '#3b82f6' : 'transparent'}; color:${l === this.activeLane ? 'white' : '#64748b'}; border:none; border-radius:4px 4px 0 0; cursor:pointer; font-weight:bold;">
                ${l}
              </button>
            `).join('')}
          </div>
          
          <!-- Active Lane View -->
          <div id="active-lane-view" style="flex:1; background:white; border:1px solid #e2e8f0; border-radius:8px; padding:15px; overflow-y:auto;">
             <!-- Rendered by JS -->
          </div>
        </div>
      </div>
    `;
    
    this.renderLibrary();
    this.renderActiveLane();
    this.bindEvents();
  }
  
  renderLibrary(searchQuery = '') {
    const list = this.container.querySelector('#library-list');
    list.innerHTML = '';
    
    const filtered = this.songLibrary.filter(s => 
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.artist.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    filtered.forEach(song => {
      list.innerHTML += `
        <div class="song-card" style="padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-weight:bold; font-size:14px;">${song.title}</div>
            <div style="font-size:12px; color:#64748b;">${song.artist} • ${song.genre} • ${song.duration}</div>
          </div>
          <div style="display:flex; gap:5px;">
            <button class="play-preview-btn" data-bpm="${song.bpm}" style="background:none; border:none; font-size:18px; cursor:pointer;">▶️</button>
            <button class="add-song-btn" data-id="${song.id}" style="background:#3b82f6; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:12px;">+ Add</button>
          </div>
        </div>
      `;
    });
  }
  
  renderActiveLane() {
    const view = this.container.querySelector('#active-lane-view');
    const songs = this.playlists[this.activeLane];
    
    if (songs.length === 0) {
      view.innerHTML = `<div style="text-align:center; color:#94a3b8; margin-top:50px;">No songs in ${this.activeLane} yet.<br/>Add songs from the library.</div>`;
      return;
    }
    
    // Calculate total duration roughly
    let totalSecs = songs.reduce((acc, songId) => {
      const s = this.songLibrary.find(x => x.id === songId);
      if(!s) return acc;
      const [m, sec] = s.duration.split(':').map(Number);
      return acc + (m * 60 + sec);
    }, 0);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    
    let html = `<div style="margin-bottom:15px; font-weight:bold; color:#3b82f6;">Total Duration: ${m}m ${s}s</div>`;
    
    songs.forEach((songId, index) => {
      const song = this.songLibrary.find(x => x.id === songId);
      if(!song) return;
      html += `
        <div style="padding:10px; border:1px solid #e2e8f0; border-radius:4px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; background:#f8fafc;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-weight:bold; color:#94a3b8; width:20px;">${index + 1}.</span>
            <div>
              <div style="font-weight:bold; font-size:14px;">${song.title}</div>
              <div style="font-size:12px; color:#64748b;">${song.artist} • ${song.duration}</div>
            </div>
          </div>
          <div>
            <button class="move-up-btn" data-idx="${index}" style="background:none; border:none; cursor:pointer;">⬆️</button>
            <button class="move-down-btn" data-idx="${index}" style="background:none; border:none; cursor:pointer;">⬇️</button>
            <button class="remove-song-btn" data-idx="${index}" style="background:none; border:none; color:#ef4444; cursor:pointer;">&times;</button>
          </div>
        </div>
      `;
    });
    
    view.innerHTML = html;
  }
  
  playTone(bpm) {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    
    osc.type = 'sine';
    // Map bpm roughly to a frequency
    osc.frequency.setValueAtTime(200 + bpm * 2, this.audioCtx.currentTime); 
    
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    
    gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1);
    
    osc.start();
    osc.stop(this.audioCtx.currentTime + 1);
  }
  
  bindEvents() {
    this.container.addEventListener('input', e => {
      if (e.target.id === 'song-search') {
        this.renderLibrary(e.target.value);
      }
    });
    
    this.container.addEventListener('click', e => {
      // Tab switching
      if (e.target.classList.contains('lane-tab')) {
        this.activeLane = e.target.dataset.lane;
        // Re-render UI fully to update active tab colors simply
        this.render();
      }
      
      // Play preview
      else if (e.target.classList.contains('play-preview-btn')) {
        const bpm = parseInt(e.target.dataset.bpm) || 120;
        this.playTone(bpm);
      }
      
      // Add song
      else if (e.target.classList.contains('add-song-btn')) {
        const id = e.target.dataset.id;
        this.playlists[this.activeLane].push(id);
        this.saveData();
        this.renderActiveLane();
      }
      
      // Remove song
      else if (e.target.classList.contains('remove-song-btn')) {
        const idx = parseInt(e.target.dataset.idx);
        this.playlists[this.activeLane].splice(idx, 1);
        this.saveData();
        this.renderActiveLane();
      }
      
      // Move up
      else if (e.target.classList.contains('move-up-btn')) {
        const idx = parseInt(e.target.dataset.idx);
        if (idx > 0) {
          const temp = this.playlists[this.activeLane][idx];
          this.playlists[this.activeLane][idx] = this.playlists[this.activeLane][idx - 1];
          this.playlists[this.activeLane][idx - 1] = temp;
          this.saveData();
          this.renderActiveLane();
        }
      }
      
      // Move down
      else if (e.target.classList.contains('move-down-btn')) {
        const idx = parseInt(e.target.dataset.idx);
        if (idx < this.playlists[this.activeLane].length - 1) {
          const temp = this.playlists[this.activeLane][idx];
          this.playlists[this.activeLane][idx] = this.playlists[this.activeLane][idx + 1];
          this.playlists[this.activeLane][idx + 1] = temp;
          this.saveData();
          this.renderActiveLane();
        }
      }
      
      // Export JSON
      else if (e.target.id === 'export-playlist-btn') {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.playlists, null, 2));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "event_playlists.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      }
    });
  }
  
  saveData() {
    localStorage.setItem('helme_events_playlists', JSON.stringify(this.playlists));
  }
}
