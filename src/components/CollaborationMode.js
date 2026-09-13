import { VENUE_ZONES } from '../data/zones.js';
import { readJSON, writeJSON, escapeHtml } from '../utils/format.js';

const COLLAB_KEY = 'helme_events_collab';

/** Every slot's factory default — anything matching one is not worth sending. */
function slotDefaults() {
  const defaults = {};
  VENUE_ZONES.forEach(z => z.slots.forEach(s => { defaults[s.id] = s.defaultItemId; }));
  return defaults;
}

/**
 * Encode the flat `slotId -> itemId` selection map into a URL-safe string.
 * Compact by design: only entries that DIFFER from the venue defaults travel
 * in the fragment, so a lightly customised design makes a short link.
 */
export function encodeDesignState(selections) {
  const defaults = slotDefaults();
  const flat = {};
  Object.entries(selections || {}).forEach(([key, value]) => {
    if (typeof value !== 'string' || !value) return;
    if (defaults[key] === value) return;
    flat[key] = value;
  });
  const json = JSON.stringify(flat);
  // btoa handles Latin-1 only; encode to UTF-8 bytes first so any future
  // non-ASCII key still round-trips.
  const bytes = new TextEncoder().encode(json);
  const b64 = btoa(String.fromCharCode(...bytes));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Inverse of encodeDesignState. Returns `null` on anything malformed. */
export function decodeDesignState(encoded) {
  try {
    const b64 = String(encoded).replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out = {};
    Object.entries(parsed).forEach(([k, v]) => {
      if (typeof v === 'string' && v) out[k] = v;
    });
    return out;
  } catch {
    return null;
  }
}

export class CollaborationMode {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections;

    const saved = readJSON(COLLAB_KEY, []);
    this.comments = Array.isArray(saved) ? saved : [];

    this.attributedTo = 'Client';
    this.draft = '';
    this.draftZone = 'general';
    this.shareMessage = '';
    // Who a note is ATTRIBUTED to. This is not a login and never claimed to
    // be: one salesperson is sitting with the file, writing down who said
    // what. The previous version dressed these up as avatars you "log in as",
    // which read as a multi-user collaboration feature the product does not
    // have.
    this.voices = [
      { name: 'Client', color: '#388e3c' },
      { name: 'Planner', color: '#1976d2' },
      { name: 'Decorator', color: '#f57c00' }
    ];
    this._bound = false;
  }

  open() {
    this.container.style.display = 'block';
    this.render();
  }

  close() {
    this.captureDraft();
    this.container.style.display = 'none';
  }

  save() {
    if (!writeJSON(COLLAB_KEY, this.comments)) {
      this.shareMessage = 'Browser storage is full — this comment was not saved.';
    }
  }

  /** Keep whatever is half-typed so a re-render does not destroy it. */
  captureDraft() {
    const textEl = this.container.querySelector('#collab-text');
    const zoneEl = this.container.querySelector('#collab-zone-select');
    if (textEl) this.draft = textEl.value;
    if (zoneEl) this.draftZone = zoneEl.value;
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-backdrop" id="collab-backdrop"></div>
      <div class="modal-content collab-modal" role="dialog" aria-modal="true" aria-labelledby="collab-title" style="width: 400px; max-width: 92vw; height: 90vh; max-height: 800px; padding: 20px; background: var(--bg-surface); color: var(--text-main); border: 1px solid var(--border-subtle); border-radius: 8px; position: fixed; right: 20px; top: 5vh; z-index: 1000; box-shadow: -4px 0 20px rgba(0,0,0,0.35); display: flex; flex-direction: column;">

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h2 id="collab-title" style="margin:0;">🤝 Client Review</h2>
          <button type="button" id="collab-close-btn" class="btn-icon" aria-label="Close client review panel" style="font-size: 1.5em; border:none; background:none; color: var(--text-muted); cursor:pointer;">&times;</button>
        </div>

        <p style="margin:0 0 12px; font-size:11px; color:var(--text-muted);">
          Log what the client asks for as you walk the venue, and mark each zone approved or
          needing revision. Notes are kept on this device. The review link carries the design
          itself, so anyone who opens it sees exactly this build.
        </p>

        <div class="collab-users" style="display: flex; gap: 8px; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border-subtle); align-items:center; flex-wrap:wrap;">
          <label for="collab-voice" style="font-size:11px; color:var(--text-muted);">Note from</label>
          <select id="collab-voice" aria-label="Who this note is from"
            style="padding:6px 8px; border-radius:6px; border:1px solid var(--border-subtle); background:var(--bg-elevated); color:var(--text-main); font-size:12px;">
            ${this.voices.map(v => `<option value="${escapeHtml(v.name)}" ${v.name === this.attributedTo ? 'selected' : ''}>${escapeHtml(v.name)}</option>`).join('')}
          </select>
          <button type="button" id="collab-share-btn" class="btn-secondary" style="margin-left: auto; font-size: 12px; padding: 5px 10px;">🔗 Copy Review Link</button>
        </div>

        <div id="collab-share-msg" role="status" style="font-size:11px; color:var(--text-muted); min-height:15px; margin-bottom:8px;">${escapeHtml(this.shareMessage)}</div>

        <div class="collab-thread" id="collab-thread" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 15px; padding-right: 5px;">
          ${this.renderComments()}
        </div>

        <div class="collab-input" style="margin-top: 15px; border-top: 1px solid var(--border-subtle); padding-top: 15px;">
          <select id="collab-zone-select" aria-label="Zone this comment is about" style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); color: var(--text-main);">
            <option value="general" ${this.draftZone === 'general' ? 'selected' : ''}>General Venue</option>
            ${VENUE_ZONES.map(z => `<option value="${escapeHtml(z.id)}" ${this.draftZone === z.id ? 'selected' : ''}>${escapeHtml(z.name)}</option>`).join('')}
          </select>
          <textarea id="collab-text" aria-label="Comment text" placeholder="Type a comment or requested revision..." style="width: 100%; height: 60px; padding: 8px; border-radius: 4px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); color: var(--text-main); resize: none; margin-bottom: 10px; box-sizing: border-box;">${escapeHtml(this.draft)}</textarea>
          <div style="display: flex; gap: 10px;">
            <button type="button" id="collab-add-comment" class="btn-primary" style="flex: 1;">💬 Comment</button>
            <button type="button" id="collab-approve" class="btn-secondary">✅ Approve</button>
            <button type="button" id="collab-revise" class="btn-secondary">❌ Revise</button>
          </div>
        </div>
      </div>
    `;
    this.bindEvents();
  }

  renderComments() {
    if (this.comments.length === 0) {
      return `<div style="text-align: center; color: var(--text-muted); margin-top: 50px; padding: 0 16px;">
        <div style="font-size:28px; margin-bottom:8px;" aria-hidden="true">🗒️</div>
        <strong style="display:block; margin-bottom:4px;">No review notes yet</strong>
        Record the client's asks against a zone, or mark a zone approved.
      </div>`;
    }

    return this.comments.map(c => {
      const voice = this.voices.find(u => u.name === c.author) || this.voices[0];
      const initials = String(c.author || '?').slice(0, 2).toUpperCase();
      const zoneName = c.zone === 'general' ? 'General' : VENUE_ZONES.find(z => z.id === c.zone)?.name || c.zone;

      let statusHtml = '';
      if (c.status === 'approved') statusHtml = '<span style="color: #4ade80; font-weight: bold; font-size: 12px;">✅ Approved</span>';
      if (c.status === 'revision') statusHtml = '<span style="color: #f87171; font-weight: bold; font-size: 12px;">❌ Needs Revision</span>';

      const stamp = new Date(c.timestamp).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
      });

      return `
        <div class="collab-message" style="display: flex; gap: 10px;">
          <div style="width: 30px; height: 30px; border-radius: 50%; background: ${voice.color}; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">
            ${escapeHtml(initials)}
          </div>
          <div style="background: var(--bg-elevated); border: 1px solid var(--border-subtle); padding: 10px; border-radius: 8px; flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; gap: 8px;">
              <strong>${escapeHtml(c.author)}</strong>
              <span style="font-size: 10px; color: var(--text-muted); white-space: nowrap;">${escapeHtml(stamp)}</span>
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 5px;">Zone: ${escapeHtml(zoneName)}</div>
            <div style="font-size: 14px; white-space: pre-wrap;">${escapeHtml(c.text)}</div>
            ${statusHtml}
            <div style="text-align:right; margin-top:6px;">
              <button type="button" class="collab-delete-btn" data-id="${escapeHtml(c.id)}"
                aria-label="Delete this review note"
                style="background:none; border:none; color:#f87171; font-size:11px; cursor:pointer; text-decoration:underline;">Delete</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  addComment(status = 'comment') {
    this.captureDraft();
    const text = this.draft.trim();
    if (!text && status === 'comment') return;

    this.comments.push({
      id: 'c' + Date.now(),
      author: this.attributedTo,
      text: text || (status === 'approved' ? 'Design Approved' : 'Revision Requested'),
      timestamp: Date.now(),
      zone: this.draftZone,
      status
    });

    this.save();
    this.draft = '';
    this.render();
  }

  /** A genuine, complete review link — the full selection map, no truncation. */
  buildShareUrl() {
    const encoded = encodeDesignState(this.activeSelections);
    const { origin, pathname } = window.location;
    return `${origin}${pathname}#design=${encoded}`;
  }

  setShareMessage(message) {
    this.shareMessage = message;
    const el = this.container.querySelector('#collab-share-msg');
    if (el) el.textContent = message;
  }

  bindEvents() {
    if (this._bound) return;
    this._bound = true;

    this.container.addEventListener('change', e => {
      if (e.target.id === 'collab-voice') this.attributedTo = e.target.value;
    });

    this.container.addEventListener('click', e => {
      const target = e.target;

      if (target.id === 'collab-close-btn' || target.id === 'collab-backdrop') {
        this.close();
        return;
      }

      const del = target.closest?.('.collab-delete-btn');
      if (del) {
        if (!window.confirm('Delete this review note?')) return;
        this.comments = this.comments.filter(c => c.id !== del.dataset.id);
        this.save();
        this.render();
        return;
      }

      if (target.id === 'collab-add-comment') return this.addComment('comment');
      if (target.id === 'collab-approve') return this.addComment('approved');
      if (target.id === 'collab-revise') return this.addComment('revision');

      if (target.id === 'collab-share-btn') {
        const url = this.buildShareUrl();
        navigator.clipboard?.writeText(url)
          .then(() => this.setShareMessage('Review link copied — it carries the full current design.'))
          .catch(() => {
            window.prompt('Copy this review link:', url);
            this.setShareMessage('Review link ready to copy.');
          });
      }
    });
  }
}
