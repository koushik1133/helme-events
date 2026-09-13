import { VENUE_ZONES } from '../data/zones.js';
import { readJSON, writeJSON, escapeHtml } from '../utils/format.js';

const NOTES_KEY = 'helme_events_notes';

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const PRIORITY_COLORS = { Urgent: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#22c55e' };

export class ZoneNotes {
  constructor(containerElement, getCurrentZoneId) {
    this.container = containerElement;
    this.getCurrentZoneId = typeof getCurrentZoneId === 'function'
      ? getCurrentZoneId
      // The app publishes itself as window.app; fall back to that so the note
      // defaults to the zone the user is actually standing in.
      : () => (typeof window !== 'undefined' ? window.app?.currentZoneId : null);

    const saved = readJSON(NOTES_KEY, []);
    this.notes = Array.isArray(saved) ? saved : [];
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.tempAudioBase64 = null;
    this.statusMessage = '';
    this._bound = false;
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try { this.mediaRecorder.stop(); } catch { /* already stopped */ }
    }
    this.container.style.display = 'none';
    this.container.innerHTML = '';
  }

  currentZoneId() {
    const id = this.getCurrentZoneId();
    return VENUE_ZONES.some(z => z.id === id) ? id : (VENUE_ZONES[0]?.id || 'general');
  }

  zoneName(zoneId) {
    if (zoneId === 'general') return 'General Venue';
    return VENUE_ZONES.find(z => z.id === zoneId)?.name || zoneId;
  }

  persist() {
    if (writeJSON(NOTES_KEY, this.notes)) {
      this.statusMessage = '';
      return true;
    }
    this.statusMessage = 'Browser storage is full — this note could not be saved. Delete an older voice memo and try again.';
    return false;
  }

  render() {
    const activeZone = this.currentZoneId();
    const zoneOptions = [`<option value="general">General Venue</option>`]
      .concat(VENUE_ZONES.map(z =>
        `<option value="${escapeHtml(z.id)}" ${z.id === activeZone ? 'selected' : ''}>${escapeHtml(z.name)}</option>`
      ))
      .join('');

    this.container.innerHTML = `
      <div class="modal-overlay notes-modal-overlay">
        <div class="notes-modal" role="dialog" aria-modal="true" aria-labelledby="notes-title" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:520px; background:var(--bg-surface); color:var(--text-main); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:2000; display:flex; flex-direction:column; max-height:85vh; border:1px solid var(--border-subtle);">
          <div style="padding:15px 20px; background:var(--bg-elevated); color:var(--text-main); border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle);">
            <h2 id="notes-title" style="margin:0; font-size:18px;">💬 Zone Notes &amp; Punch List</h2>
            <button type="button" id="close-notes-btn" aria-label="Close zone notes" style="background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">&times;</button>
          </div>

          <div style="padding:20px; overflow-y:auto; flex:1;" id="notes-list-container"></div>

          <div style="padding:20px; border-top:1px solid var(--border-subtle); background:var(--bg-elevated); border-radius:0 0 12px 12px;">
            <div id="notes-status" role="status" style="min-height:16px; font-size:12px; color:#fbbf24; margin-bottom:6px;">${escapeHtml(this.statusMessage)}</div>
            <textarea id="note-text" aria-label="Note text" placeholder="Add a note for this zone…" style="width:100%; height:60px; padding:8px; box-sizing:border-box; margin-bottom:10px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-main);"></textarea>

            <div style="display:flex; gap:10px; margin-bottom:10px;">
              <select id="note-zone" aria-label="Zone this note applies to" style="flex:1; padding:6px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-main);">
                ${zoneOptions}
              </select>
              <select id="note-priority" aria-label="Note priority" style="flex:1; padding:6px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-surface); color:var(--text-main);">
                ${PRIORITIES.map(p => `<option value="${p}">${p === 'Low' ? 'Low Priority' : p}</option>`).join('')}
              </select>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
              <button type="button" id="record-voice-btn" style="background:#ef4444; color:#fff; border:none; border-radius:6px; padding:8px 12px; cursor:pointer;">🎤 Record Voice</button>
              <span id="recording-status" role="status" style="color:#ef4444; font-size:12px; font-weight:bold; display:none;">Recording…</span>
              <button type="button" id="add-note-btn" class="btn-primary" style="padding:8px 20px; cursor:pointer;">Add Note</button>
            </div>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderNotes();
  }

  renderNotes() {
    const listContainer = this.container.querySelector('#notes-list-container');
    if (!listContainer) return;

    if (this.notes.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align:center; color:var(--text-muted); padding:32px 12px;">
          <div style="font-size:28px; margin-bottom:8px;">🗒️</div>
          <strong style="display:block; margin-bottom:4px;">No notes yet</strong>
          Add a snag, a client request or a voice memo — it is pinned to the zone you pick below.
        </div>
      `;
      return;
    }

    // Urgent first, then newest first.
    const ordered = this.notes.slice().sort((a, b) => {
      const rank = p => PRIORITIES.indexOf(p);
      return rank(b.priority) - rank(a.priority) || (b.timestamp - a.timestamp);
    });

    listContainer.innerHTML = ordered.map(note => {
      const pColor = PRIORITY_COLORS[note.priority] || PRIORITY_COLORS.Low;
      const audioHtml = note.audioBase64
        ? `<audio controls src="${escapeHtml(note.audioBase64)}" style="width:100%; height:30px; margin-top:10px;"></audio>`
        : '';
      return `
        <div style="border:1px solid var(--border-subtle); border-radius:8px; padding:12px; margin-bottom:12px; background:var(--bg-elevated);">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px; gap:8px;">
            <div>
              <span style="font-size:12px; font-weight:bold; color:#fff; background:#475569; padding:2px 6px; border-radius:4px; margin-right:5px;">${escapeHtml(this.zoneName(note.zone))}</span>
              <span style="font-size:12px; font-weight:bold; color:#fff; background:${pColor}; padding:2px 6px; border-radius:4px;">${escapeHtml(note.priority)}</span>
            </div>
            <span style="font-size:11px; color:var(--text-muted); white-space:nowrap;">${escapeHtml(new Date(note.timestamp).toLocaleString('en-IN'))}</span>
          </div>
          <p style="margin:0; font-size:14px; color:var(--text-main); line-height:1.4; white-space:pre-wrap;">${escapeHtml(note.text)}</p>
          ${audioHtml}
          <div style="text-align:right; margin-top:5px;">
            <button type="button" class="delete-note-btn" data-id="${escapeHtml(note.id)}" aria-label="Delete this note" style="background:none; border:none; color:#ef4444; font-size:12px; cursor:pointer; text-decoration:underline;">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  setStatus(message) {
    this.statusMessage = message;
    const el = this.container.querySelector('#notes-status');
    if (el) el.textContent = message;
  }

  bindEvents() {
    // The modal container persists between open() calls, so bind once.
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('click', async e => {
      if (e.target.id === 'close-notes-btn' || e.target.classList.contains('notes-modal-overlay')) {
        this.close();
        return;
      }

      if (e.target.classList.contains('delete-note-btn')) {
        const id = e.target.dataset.id;
        const note = this.notes.find(n => n.id === id);
        if (!note) return;
        if (!window.confirm('Delete this note permanently?')) return;
        this.notes = this.notes.filter(n => n.id !== id);
        this.persist();
        this.renderNotes();
        return;
      }

      if (e.target.id === 'add-note-btn') {
        const textEl = this.container.querySelector('#note-text');
        const text = textEl.value.trim();
        if (!text && !this.tempAudioBase64) {
          this.setStatus('Type a note or record a voice memo first.');
          return;
        }

        const note = {
          id: 'note_' + Date.now(),
          text,
          zone: this.container.querySelector('#note-zone').value,
          priority: this.container.querySelector('#note-priority').value,
          timestamp: Date.now(),
          audioBase64: this.tempAudioBase64 || null
        };

        this.notes.push(note);
        if (!this.persist()) {
          // Roll back so the UI never shows a note the browser refused to keep.
          this.notes = this.notes.filter(n => n.id !== note.id);
          this.setStatus('Browser storage is full — the note was not saved. Delete an older voice memo and try again.');
          return;
        }

        this.tempAudioBase64 = null;
        textEl.value = '';
        this.setStatus('');
        this.renderNotes();
        return;
      }

      if (e.target.id === 'record-voice-btn') {
        const btn = e.target;
        const status = this.container.querySelector('#recording-status');

        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          btn.textContent = '🎤 Record Voice';
          status.style.display = 'none';
          return;
        }

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.mediaRecorder = new MediaRecorder(stream);
          this.audioChunks = [];

          this.mediaRecorder.ondataavailable = event => this.audioChunks.push(event.data);

          this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              this.tempAudioBase64 = reader.result;
              this.setStatus('Voice memo attached — press “Add Note” to save it.');
            };
            reader.onerror = () => this.setStatus('That recording could not be read.');
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };

          this.mediaRecorder.start();
          btn.textContent = '⏹ Stop Recording';
          status.style.display = 'inline';
        } catch {
          this.setStatus('Microphone access was denied or is unavailable in this browser.');
        }
      }
    });
  }
}
