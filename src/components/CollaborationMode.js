import { VENUE_ZONES } from '../data/zones.js';

export class CollaborationMode {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;
    
    const saved = localStorage.getItem('helme_events_collab');
    this.comments = saved ? JSON.parse(saved) : [];
    
    this.currentUser = 'Planner';
    this.collaborators = [
      { name: 'Planner', initials: 'PL', color: '#1976d2' },
      { name: 'Client', initials: 'CL', color: '#388e3c' },
      { name: 'Decorator', initials: 'DE', color: '#f57c00' }
    ];
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.container.style.display = 'none';
  }

  save() {
    localStorage.setItem('helme_events_collab', JSON.stringify(this.comments));
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="collab-backdrop"></div>
      <div class="modal-content collab-modal" style="width: 400px; height: 90vh; max-height: 800px; padding: 20px; background: white; border-radius: 8px; position: fixed; right: 20px; top: 5vh; z-index: 1000; box-shadow: -4px 0 20px rgba(0,0,0,0.1); display: flex; flex-direction: column;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2>🤝 Collaboration</h2>
          <button id="collab-close-btn" class="btn-icon" style="font-size: 1.5em; border:none; background:none; cursor:pointer;">&times;</button>
        </div>

        <div class="collab-users" style="display: flex; gap: 10px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #eee;">
          ${this.collaborators.map(c => `
            <div class="collab-avatar ${c.name === this.currentUser ? 'active' : ''}" data-name="${c.name}" title="Login as ${c.name}" style="width: 40px; height: 40px; border-radius: 50%; background: ${c.color}; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; border: ${c.name === this.currentUser ? '3px solid #333' : '3px solid transparent'};">
              ${c.initials}
            </div>
          `).join('')}
          <button id="collab-share-btn" class="btn-secondary" style="margin-left: auto; font-size: 12px; padding: 5px 10px;">🔗 Share Link</button>
        </div>

        <div class="collab-thread" id="collab-thread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; padding-right: 5px;">
          ${this.renderComments()}
        </div>

        <div class="collab-input" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 15px;">
          <select id="collab-zone-select" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #ccc;">
            <option value="general">General Venue</option>
            ${VENUE_ZONES.map(z => `<option value="${z.id}">${z.name}</option>`).join('')}
          </select>
          <textarea id="collab-text" placeholder="Type a comment or requested revision..." style="width: 100%; height: 60px; padding: 8px; border-radius: 4px; border: 1px solid #ccc; resize: none; margin-bottom: 10px; box-sizing: border-box;"></textarea>
          <div style="display: flex; gap: 10px;">
            <button id="collab-add-comment" class="btn-primary" style="flex: 1;">💬 Comment</button>
            <button id="collab-approve" class="btn-secondary" style="background: #e8f5e9; color: #2e7d32; border: 1px solid #c8e6c9;">✅ Approve</button>
            <button id="collab-revise" class="btn-secondary" style="background: #ffebee; color: #c62828; border: 1px solid #ffcdd2;">❌ Revise</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderComments() {
    if (this.comments.length === 0) {
      return '<div style="text-align: center; color: #888; margin-top: 50px;">No comments yet. Start the conversation!</div>';
    }

    return this.comments.map(c => {
      const user = this.collaborators.find(u => u.name === c.author) || this.collaborators[0];
      const zoneName = c.zone === 'general' ? 'General' : VENUE_ZONES.find(z => z.id === c.zone)?.name || c.zone;
      
      let statusHtml = '';
      if (c.status === 'approved') statusHtml = '<span style="color: #2e7d32; font-weight: bold; font-size: 12px; margin-left: 10px;">✅ Approved</span>';
      if (c.status === 'revision') statusHtml = '<span style="color: #c62828; font-weight: bold; font-size: 12px; margin-left: 10px;">❌ Needs Revision</span>';

      return `
        <div class="collab-message" style="display: flex; gap: 10px;">
          <div style="width: 30px; height: 30px; border-radius: 50%; background: ${user.color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">
            ${user.initials}
          </div>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <strong>${c.author}</strong>
              <span style="font-size: 10px; color: #888;">${new Date(c.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Zone: ${zoneName}</div>
            <div style="font-size: 14px;">${c.text}</div>
            ${statusHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  addComment(status = 'comment') {
    const text = this.container.querySelector('#collab-text').value.trim();
    if (!text && status === 'comment') return;

    const zone = this.container.querySelector('#collab-zone-select').value;
    
    this.comments.push({
      id: 'c' + Date.now(),
      author: this.currentUser,
      text: text || (status === 'approved' ? 'Design Approved' : 'Revision Requested'),
      timestamp: Date.now(),
      zone: zone,
      status: status
    });
    
    this.save();
    this.render();
  }

  bindEvents() {
    this.container.querySelector('#collab-close-btn').addEventListener('click', () => this.close());
    
    // Allow clicking backdrop to close ONLY IF it's rendered as a full modal
    const backdrop = this.container.querySelector('#collab-backdrop');
    if(backdrop) backdrop.addEventListener('click', () => this.close());

    this.container.querySelectorAll('.collab-avatar').forEach(avatar => {
      avatar.addEventListener('click', (e) => {
        this.currentUser = e.target.dataset.name;
        this.render();
      });
    });

    this.container.querySelector('#collab-add-comment').addEventListener('click', () => this.addComment('comment'));
    this.container.querySelector('#collab-approve').addEventListener('click', () => this.addComment('approved'));
    this.container.querySelector('#collab-revise').addEventListener('click', () => this.addComment('revision'));

    this.container.querySelector('#collab-share-btn').addEventListener('click', () => {
      // Simulate creating a shareable state URL
      const state = btoa(JSON.stringify(this.activeSelections));
      const url = `${window.location.origin}${window.location.pathname}?state=${state.substring(0, 20)}...`;
      
      navigator.clipboard.writeText(url).then(() => {
        alert('Shareable link copied to clipboard!');
      }).catch(() => {
        prompt('Copy this link:', url);
      });
    });
  }
}
