/**
 * Backend REST API Client Service for Helme Events 360°
 * Syncs real-time state, item swaps, proposals, and bookings with backend environment.
 */

const API_BASE = '/api';

export class ApiService {
  /**
   * Sync full active selections and current zone with backend environment
   */
  static async syncState(activeSelections, currentZoneId) {
    try {
      const res = await fetch(`${API_BASE}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeSelections, currentZoneId })
      });
      const json = await res.json();
      console.log('[API Service] Backend state synced:', json);
      return json;
    } catch (err) {
      console.warn('[API Service] Backend API offline, saving to localStorage fallback:', err.message);
      localStorage.setItem('helme_events_activeSelections', JSON.stringify(activeSelections));
      if (currentZoneId) localStorage.setItem('helme_events_currentZone', currentZoneId);
      return { success: true, fallback: true, data: { activeSelections, currentZoneId } };
    }
  }

  /**
   * Fetch current backend environment state
   */
  static async fetchState() {
    try {
      const res = await fetch(`${API_BASE}/state`);
      const json = await res.json();
      if (json.success && json.data) {
        console.log('[API Service] Fetched state from backend:', json.data);
        return json.data;
      }
    } catch (err) {
      console.warn('[API Service] Fetch state failed, loading local storage:', err.message);
    }
    const localSel = localStorage.getItem('helme_events_activeSelections');
    const localZone = localStorage.getItem('helme_events_currentZone');
    return {
      activeSelections: localSel ? JSON.parse(localSel) : null,
      currentZoneId: localZone || 'zone-stage'
    };
  }

  /**
   * Record individual item swap to backend environment endpoint
   */
  static async recordSwap({ slotId, itemId, itemTitle, zoneId, category }) {
    try {
      const res = await fetch(`${API_BASE}/swap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, itemId, itemTitle, zoneId, category })
      });
      const json = await res.json();
      console.log('[API Service] Backend item swap recorded:', json);
      this.notifyBackendUpdate(`Backend Synced: ${itemTitle || itemId} (${category || 'item'}) updated`);
      return json;
    } catch (err) {
      console.warn('[API Service] Swap record offline, fallback:', err.message);
      return { success: true, fallback: true };
    }
  }

  /**
   * Save proposal to backend
   */
  static async saveProposal(proposalData) {
    try {
      const res = await fetch(`${API_BASE}/proposals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(proposalData)
      });
      const json = await res.json();
      console.log('[API Service] Proposal saved to backend:', json);
      return json;
    } catch (err) {
      console.warn('[API Service] Proposal save fallback:', err.message);
      return { success: true, fallback: true };
    }
  }

  /**
   * Fetch swap activity log from backend
   */
  static async fetchActivity() {
    try {
      const res = await fetch(`${API_BASE}/activity`);
      const json = await res.json();
      return json.swaps || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Toast notification helper for live backend updates
   */
  static notifyBackendUpdate(msg) {
    let toast = document.getElementById('backend-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'backend-toast-notification';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        background: rgba(15, 23, 42, 0.95);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.4);
        padding: 10px 18px;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
        transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0;
        transform: translateY(10px);
        pointer-events: none;
        display: flex;
        align-items: center;
        gap: 8px;
      `;
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>⚡</span> ${msg}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
  }
}
