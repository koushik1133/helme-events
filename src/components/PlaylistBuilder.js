import { MOMENTS, SONG_LIBRARY, durationToSeconds } from '../data/songs.js';
import { escapeHtml, readJSON, writeJSON } from '../utils/format.js';

const STORAGE_KEY = 'helm_events_playlists_v2';

/** Lanes are the real moments of an Indian event day, not generic time slots. */
const DEFAULT_LANES = MOMENTS.map(m => m.id);

function emptyPlaylists() {
  const out = {};
  for (const id of DEFAULT_LANES) out[id] = [];
  return out;
}

export class PlaylistBuilder {
  constructor(containerElement) {
    this.container = containerElement;
    this.songLibrary = SONG_LIBRARY;

    const stored = readJSON(STORAGE_KEY, null);
    this.playlists = emptyPlaylists();
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      for (const lane of DEFAULT_LANES) {
        if (Array.isArray(stored[lane])) {
          // Drop ids that no longer exist in the library.
          this.playlists[lane] = stored[lane].filter(id => this.songLibrary.some(s => s.id === id));
        }
      }
    }

    this.activeLane = DEFAULT_LANES[0];
    this.searchQuery = '';
    this.momentFilter = 'lane'; // 'lane' | 'all'
    this._bound = false;
  }

  momentLabel(id) {
    const m = MOMENTS.find(x => x.id === id);
    return m ? m.label : id;
  }

  momentNote(id) {
    const m = MOMENTS.find(x => x.id === id);
    return m ? m.note : '';
  }

  render() {
    this.container.innerHTML = `
      <div class="playlist-wrapper" style="display:flex; flex-wrap:wrap; gap:var(--space-5); align-items:stretch;">
        <!-- Song library -->
        <div class="playlist-library-panel" style="flex:1 1 280px; min-width:260px; display:flex; flex-direction:column; gap:var(--space-3); max-height:640px;">
          <div class="playlist-library-head">
            <h3>🎵 Cue Library</h3>
            <p class="meta">${this.songLibrary.length} cues across ${MOMENTS.length} moments. Helm plans the run-sheet; it does not stream audio.</p>
            <label for="song-search" class="meta">Search title, artist, film or language</label>
            <input type="text" id="song-search" placeholder="e.g. Arijit, Punjabi, baraat"
                   value="${escapeHtml(this.searchQuery)}" />
            <div class="playlist-scope-toggle" style="display:flex; gap:var(--space-2); margin-top:var(--space-2);" role="group" aria-label="Library scope">
              <button type="button" class="btn-filter ${this.momentFilter === 'lane' ? 'active' : ''}"
                      data-scope="lane" aria-pressed="${this.momentFilter === 'lane'}">This moment</button>
              <button type="button" class="btn-filter ${this.momentFilter === 'all' ? 'active' : ''}"
                      data-scope="all" aria-pressed="${this.momentFilter === 'all'}">Whole library</button>
            </div>
          </div>
          <div id="library-list" class="playlist-library-list" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:var(--space-2);"></div>
        </div>

        <!-- Lanes -->
        <div class="playlist-lanes-panel" style="flex:2 1 380px; min-width:300px; display:flex; flex-direction:column; gap:var(--space-3); max-height:640px;">
          <div class="playlist-lanes-head" style="display:flex; flex-wrap:wrap; gap:var(--space-3); justify-content:space-between; align-items:flex-start;">
            <div>
              <h2>Event Run-Sheet</h2>
              <p class="meta" id="lane-note"></p>
            </div>
            <div class="playlist-export-group" style="display:flex; gap:var(--space-2); flex-wrap:wrap;">
              <button type="button" id="export-runsheet-btn" class="btn-secondary">📄 Export run-sheet (CSV)</button>
            </div>
          </div>

          <div class="playlist-lane-tabs" style="display:flex; gap:var(--space-1); flex-wrap:wrap;" role="tablist" aria-label="Run-sheet moments">
            ${DEFAULT_LANES.map(l => `
              <button type="button" role="tab" class="lane-tab ${l === this.activeLane ? 'active' : ''}"
                      data-lane="${escapeHtml(l)}" aria-selected="${l === this.activeLane}">
                ${escapeHtml(this.momentLabel(l))}<span class="lane-count">${this.playlists[l].length}</span>
              </button>
            `).join('')}
          </div>

          <div id="active-lane-view" class="playlist-lane-view" role="tabpanel" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:var(--space-2);"></div>
        </div>
      </div>
    `;

    this.renderLibrary();
    this.renderActiveLane();
    this.bindEvents();
  }

  filteredLibrary() {
    const q = this.searchQuery.trim().toLowerCase();
    return this.songLibrary.filter(s => {
      if (this.momentFilter === 'lane' && !q && s.moment !== this.activeLane) return false;
      if (!q) return true;
      return [s.title, s.artist, s.composer, s.film, s.language, s.genre]
        .filter(Boolean)
        .some(v => String(v).toLowerCase().includes(q));
    });
  }

  renderLibrary() {
    const list = this.container.querySelector('#library-list');
    if (!list) return;
    const filtered = this.filteredLibrary();

    if (filtered.length === 0) {
      list.innerHTML = `<p class="meta">No cues match “${escapeHtml(this.searchQuery)}”. Try a film, artist or language.</p>`;
      return;
    }

    list.innerHTML = filtered.map(song => `
      <div class="song-card" style="display:flex; justify-content:space-between; align-items:center; gap:var(--space-3);">
        <div class="song-card-text" style="display:flex; flex-direction:column; gap:2px; min-width:0;">
          <div class="song-title">${escapeHtml(song.title)}</div>
          <div class="meta">
            ${escapeHtml(song.artist)}${song.film ? ` · ${escapeHtml(song.film)}` : ''}
          </div>
          <div class="meta">
            ${escapeHtml(song.language)} · ${escapeHtml(song.genre)} · ${escapeHtml(song.duration)} · ${song.bpm} BPM
            · ${escapeHtml(this.momentLabel(song.moment))}
          </div>
        </div>
        <button type="button" class="add-song-btn btn-secondary" data-id="${escapeHtml(song.id)}"
                aria-label="Add ${escapeHtml(song.title)} to ${escapeHtml(this.momentLabel(this.activeLane))}">+ Add</button>
      </div>
    `).join('');
  }

  renderActiveLane() {
    const view = this.container.querySelector('#active-lane-view');
    const note = this.container.querySelector('#lane-note');
    if (note) note.textContent = this.momentNote(this.activeLane);
    if (!view) return;

    const songs = this.playlists[this.activeLane];

    if (songs.length === 0) {
      view.innerHTML = `
        <div class="playlist-empty">
          <p><strong>${escapeHtml(this.momentLabel(this.activeLane))}</strong> has no cues yet.</p>
          <p class="meta">${escapeHtml(this.momentNote(this.activeLane))}</p>
          <p class="meta">Add cues from the library on the left.</p>
        </div>`;
      return;
    }

    const totalSecs = songs.reduce((acc, id) => {
      const s = this.songLibrary.find(x => x.id === id);
      return acc + (s ? durationToSeconds(s.duration) : 0);
    }, 0);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;

    const rows = songs.map((songId, index) => {
      const song = this.songLibrary.find(x => x.id === songId);
      if (!song) return '';
      return `
        <div class="song-card" style="display:flex; justify-content:space-between; align-items:center; gap:var(--space-3);">
          <div class="song-card-text" style="display:flex; align-items:center; gap:var(--space-2); min-width:0;">
            <span class="song-index">${index + 1}.</span>
            <div>
              <div class="song-title">${escapeHtml(song.title)}</div>
              <div class="meta">${escapeHtml(song.artist)} · ${escapeHtml(song.duration)} · ${song.bpm} BPM</div>
            </div>
          </div>
          <div class="song-card-actions" style="display:flex; gap:var(--space-1); flex-shrink:0;">
            <button type="button" class="move-up-btn" data-idx="${index}" aria-label="Move ${escapeHtml(song.title)} up">⬆️</button>
            <button type="button" class="move-down-btn" data-idx="${index}" aria-label="Move ${escapeHtml(song.title)} down">⬇️</button>
            <button type="button" class="remove-song-btn" data-idx="${index}" aria-label="Remove ${escapeHtml(song.title)}">&times;</button>
          </div>
        </div>`;
    }).join('');

    view.innerHTML = `
      <div class="playlist-lane-summary">
        ${songs.length} cue${songs.length === 1 ? '' : 's'} · ${mins}m ${secs}s
      </div>
      ${rows}`;
  }

  updateLaneCounts() {
    this.container.querySelectorAll('.lane-tab').forEach(tab => {
      const count = tab.querySelector('.lane-count');
      const lane = tab.dataset.lane;
      if (count && this.playlists[lane]) count.textContent = this.playlists[lane].length;
    });
  }

  setActiveLane(lane) {
    if (!this.playlists[lane]) return;
    this.activeLane = lane;
    this.container.querySelectorAll('.lane-tab').forEach(tab => {
      const isActive = tab.dataset.lane === lane;
      tab.classList.toggle('active', isActive);
      tab.setAttribute('aria-selected', String(isActive));
    });
    this.renderLibrary();
    this.renderActiveLane();
  }

  save() {
    writeJSON(STORAGE_KEY, this.playlists);
  }

  downloadFile(filename, mime, contents) {
    const blob = new Blob([contents], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  exportRunSheet() {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [['Moment', 'Order', 'Title', 'Artist', 'Film', 'Language', 'Duration', 'BPM'].join(',')];
    for (const lane of DEFAULT_LANES) {
      this.playlists[lane].forEach((id, i) => {
        const s = this.songLibrary.find(x => x.id === id);
        if (!s) return;
        lines.push([
          esc(this.momentLabel(lane)), i + 1, esc(s.title), esc(s.artist),
          esc(s.film || ''), esc(s.language), esc(s.duration), s.bpm
        ].join(','));
      });
    }
    if (lines.length === 1) return false;
    this.downloadFile(`helm_run_sheet_${Date.now()}.csv`, 'text/csv;charset=utf-8', lines.join('\n'));
    return true;
  }

  bindEvents() {
    // Delegated handlers bound ONCE to the persistent container. Binding these
    // inside render() is what previously made one "+ Add" click insert 32 songs.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('input', e => {
      if (e.target.id === 'song-search') {
        this.searchQuery = e.target.value;
        this.renderLibrary();
      }
    });

    this.container.addEventListener('click', e => {
      const laneTab = e.target.closest('.lane-tab');
      if (laneTab) {
        this.setActiveLane(laneTab.dataset.lane);
        return;
      }

      const scopeBtn = e.target.closest('[data-scope]');
      if (scopeBtn) {
        this.momentFilter = scopeBtn.dataset.scope;
        this.container.querySelectorAll('[data-scope]').forEach(b => {
          const on = b.dataset.scope === this.momentFilter;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        this.renderLibrary();
        return;
      }

      const addBtn = e.target.closest('.add-song-btn');
      if (addBtn) {
        this.playlists[this.activeLane].push(addBtn.dataset.id);
        this.save();
        this.renderActiveLane();
        this.updateLaneCounts();
        return;
      }

      const removeBtn = e.target.closest('.remove-song-btn');
      if (removeBtn) {
        this.playlists[this.activeLane].splice(Number(removeBtn.dataset.idx), 1);
        this.save();
        this.renderActiveLane();
        this.updateLaneCounts();
        return;
      }

      const upBtn = e.target.closest('.move-up-btn');
      if (upBtn) {
        const idx = Number(upBtn.dataset.idx);
        const lane = this.playlists[this.activeLane];
        if (idx > 0) {
          [lane[idx - 1], lane[idx]] = [lane[idx], lane[idx - 1]];
          this.save();
          this.renderActiveLane();
        }
        return;
      }

      const downBtn = e.target.closest('.move-down-btn');
      if (downBtn) {
        const idx = Number(downBtn.dataset.idx);
        const lane = this.playlists[this.activeLane];
        if (idx < lane.length - 1) {
          [lane[idx + 1], lane[idx]] = [lane[idx], lane[idx + 1]];
          this.save();
          this.renderActiveLane();
        }
        return;
      }

      if (e.target.closest('#export-runsheet-btn')) {
        if (!this.exportRunSheet()) {
          const note = this.container.querySelector('#lane-note');
          if (note) note.textContent = 'Add at least one cue before exporting a run-sheet.';
        }
        return;
      }

    });
  }
}
