export class ZoneNotes {
  constructor(containerElement) {
    this.container = containerElement;
    this.notes = JSON.parse(localStorage.getItem('helme_events_notes')) || [];
    this.mediaRecorder = null;
    this.audioChunks = [];
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
      <div class="modal-overlay notes-modal-overlay">
        <div class="notes-modal" style="position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:90%; max-width:520px; background:var(--bg-surface); color:var(--text-main); border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.5); z-index:2000; display:flex; flex-direction:column; max-height:85vh; border:1px solid var(--border-subtle);">
          <div style="padding:15px 20px; background:var(--bg-elevated); color:var(--text-main); border-radius:12px 12px 0 0; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--border-subtle);">
            <h2 style="margin:0; font-size:18px;">💬 Zone Notes & Comments</h2>
            <button id="close-notes-btn" style="background:none; border:none; color:var(--text-muted); font-size:24px; cursor:pointer;">&times;</button>
          </div>
        
        <div style="padding:20px; overflow-y:auto; flex:1;" id="notes-list-container">
          <!-- Notes List -->
        </div>
        
        <div style="padding:20px; border-top:1px solid #e2e8f0; background:#f8fafc; border-radius:0 0 8px 8px;">
          <textarea id="note-text" placeholder="Add a new note..." style="width:100%; height:60px; padding:8px; box-sizing:border-box; margin-bottom:10px; border-radius:4px; border:1px solid #cbd5e1;"></textarea>
          
          <div style="display:flex; gap:10px; margin-bottom:10px;">
            <select id="note-zone" style="flex:1; padding:5px;">
              <option value="General">General</option>
              <option value="Stage">Stage</option>
              <option value="Banquet">Banquet</option>
              <option value="Entrance">Entrance</option>
            </select>
            <select id="note-priority" style="flex:1; padding:5px;">
              <option value="Low">Low Priority</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <button id="record-voice-btn" style="background:#ef4444; color:white; border:none; border-radius:4px; padding:8px 12px; cursor:pointer;">🎤 Record Voice</button>
            <span id="recording-status" style="color:#ef4444; font-size:12px; font-weight:bold; display:none;">Recording...</span>
            <button id="add-note-btn" style="background:#3b82f6; color:white; border:none; border-radius:4px; padding:8px 20px; cursor:pointer;">Add Note</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
    this.renderNotes();
  }
  
  renderNotes() {
    const listContainer = this.container.querySelector('#notes-list-container');
    listContainer.innerHTML = '';
    
    if (this.notes.length === 0) {
      listContainer.innerHTML = '<p style="text-align:center; color:#94a3b8;">No notes yet.</p>';
      return;
    }
    
    this.notes.forEach(note => {
      const pColor = note.priority === 'Urgent' ? '#ef4444' : note.priority === 'High' ? '#f97316' : note.priority === 'Medium' ? '#eab308' : '#22c55e';
      
      let audioHtml = '';
      if (note.audioBase64) {
        audioHtml = `<audio controls src="${note.audioBase64}" style="width:100%; height:30px; margin-top:10px;"></audio>`;
      }
      
      listContainer.innerHTML += `
        <div style="border:1px solid #e2e8f0; border-radius:6px; padding:12px; margin-bottom:12px; background:white;">
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div>
              <span style="font-size:12px; font-weight:bold; color:white; background:#475569; padding:2px 6px; border-radius:4px; margin-right:5px;">${note.zone}</span>
              <span style="font-size:12px; font-weight:bold; color:white; background:${pColor}; padding:2px 6px; border-radius:4px;">${note.priority}</span>
            </div>
            <span style="font-size:11px; color:#94a3b8;">${new Date(note.timestamp).toLocaleString()}</span>
          </div>
          <p style="margin:0; font-size:14px; color:#334155; line-height:1.4;">${note.text}</p>
          ${audioHtml}
          <div style="text-align:right; margin-top:5px;">
            <button class="delete-note-btn" data-id="${note.id}" style="background:none; border:none; color:#ef4444; font-size:12px; cursor:pointer; text-decoration:underline;">Delete</button>
          </div>
        </div>
      `;
    });
  }
  
  bindEvents() {
    this.container.addEventListener('click', async e => {
      if (e.target.id === 'close-notes-btn' || e.target.classList.contains('notes-modal-overlay')) {
        this.close();
      } else if (e.target.classList.contains('delete-note-btn')) {
        const id = e.target.dataset.id;
        this.notes = this.notes.filter(n => n.id !== id);
        localStorage.setItem('helme_events_notes', JSON.stringify(this.notes));
        this.renderNotes();
      } else if (e.target.id === 'add-note-btn') {
        const text = this.container.querySelector('#note-text').value.trim();
        if (!text && !this.tempAudioBase64) return;
        
        const zone = this.container.querySelector('#note-zone').value;
        const priority = this.container.querySelector('#note-priority').value;
        
        this.notes.push({
          id: 'note_' + Date.now(),
          text,
          zone,
          priority,
          timestamp: Date.now(),
          audioBase64: this.tempAudioBase64 || null
        });
        
        this.tempAudioBase64 = null;
        localStorage.setItem('helme_events_notes', JSON.stringify(this.notes));
        this.container.querySelector('#note-text').value = '';
        this.renderNotes();
      } else if (e.target.id === 'record-voice-btn') {
        const btn = e.target;
        const status = this.container.querySelector('#recording-status');
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
          btn.textContent = '🎤 Record Voice';
          status.style.display = 'none';
        } else {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = event => {
              this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
              const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = () => {
                this.tempAudioBase64 = reader.result;
                this.container.querySelector('#note-text').value = '[Voice Memo Attached] ' + this.container.querySelector('#note-text').value;
              };
              // Stop tracks
              stream.getTracks().forEach(track => track.stop());
            };
            
            this.mediaRecorder.start();
            btn.textContent = '⏹ Stop Recording';
            status.style.display = 'inline';
          } catch (err) {
            alert('Microphone access denied or not available.');
          }
        }
      }
    });
  }
}
