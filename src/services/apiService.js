/**
 * Helm Events 360° — persistence client.
 *
 * Persistence model, in priority order:
 *   1. localStorage  — always written, always read first. This is the real store.
 *   2. `/api/*`      — an OPTIONAL upgrade. Present under `npm run dev` (Vite
 *                      middleware) or `npm run api`. Absent on a static deploy.
 *
 * localStorage-first is deliberate: on Vercel there is no API, and `fetch('/api/state')`
 * returns the SPA's own index.html with a 200. Treating that as authoritative
 * would blank the user's work, so the API is only ever allowed to *upgrade* a
 * local restore, never to replace it with nothing.
 *
 * Every read goes through `readJSON` and every write through the storage helper,
 * so a corrupt localStorage value can never blank the app.
 */

import { readJSON } from '../utils/format.js';
import { K, SCHEMA_VERSION, load, save, loadRaw, saveRaw, migrateLegacyStorage } from './storage.js';

const API_BASE = '/api';
/** Give up on the API quickly — it is optional and must never delay first paint. */
const API_TIMEOUT_MS = 2500;

/** `activeSelections` is a FLAT map of slotId -> itemId string. Nothing else. */
function sanitizeSelections(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const out = {};
  for (const [slotId, value] of Object.entries(input)) {
    if (slotId === '__proto__' || slotId === 'constructor') continue;
    if (typeof value === 'string') {
      out[slotId] = value;
    } else if (value && typeof value === 'object' && typeof value.itemId === 'string') {
      // Tolerate the legacy {itemId, quantity} shape on read; write back flat.
      out[slotId] = value.itemId;
    }
  }
  return Object.keys(out).length ? out : null;
}

/** fetch with a timeout, returning null instead of throwing. */
async function apiFetch(pathSuffix, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${pathSuffix}`, { ...options, signal: controller.signal });
    const contentType = res.headers.get('content-type') || '';
    // A static host answers /api/* with the SPA shell. That is not an API.
    if (!contentType.includes('application/json')) return null;
    const json = await res.json();
    if (!res.ok) {
      console.warn(`[api] ${pathSuffix} -> ${res.status}`, json && json.error);
      return null;
    }
    return json;
  } catch (err) {
    if (err.name !== 'AbortError') console.debug(`[api] ${pathSuffix} unavailable:`, err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export class ApiService {
  /** Cached result of the availability probe: null = unknown, true/false = known. */
  static _apiAvailable = null;

  /**
   * Run once, before the app reads any state.
   * Performs the legacy-key migration and stamps the schema version.
   */
  static initStorage() {
    const result = migrateLegacyStorage();
    const stored = Number(loadRaw(K.schemaVersion, SCHEMA_VERSION));
    if (Number.isFinite(stored) && stored > SCHEMA_VERSION) {
      // Storage written by a NEWER build. Do not try to interpret it.
      console.warn(`[storage] Found schema v${stored}, this build speaks v${SCHEMA_VERSION}. Ignoring stored state.`);
      return { ...result, incompatible: true };
    }
    saveRaw(K.schemaVersion, String(SCHEMA_VERSION));
    return { ...result, incompatible: false };
  }

  /**
   * Restore-on-load. Call this at boot and merge the result over the defaults.
   *
   * @param {object} defaults  the built-from-zones default selection map
   * @returns {Promise<{activeSelections: object, currentZoneId: string|null, source: 'default'|'local'|'api'}>}
   */
  static async restoreState(defaults = {}) {
    const { incompatible } = this.initStorage();
    const base = { ...defaults };

    if (incompatible) {
      return { activeSelections: base, currentZoneId: null, source: 'default' };
    }

    // --- 1. localStorage (authoritative) ---------------------------------
    let source = 'default';
    const localSelections = sanitizeSelections(load(K.selections, null));
    if (localSelections) {
      Object.assign(base, localSelections);
      source = 'local';
    }
    let zoneId = loadRaw(K.currentZone, null);

    // --- 2. API (optional upgrade) ---------------------------------------
    const json = await apiFetch('/state');
    const remote = json && json.success && json.data ? json.data : null;
    if (remote) {
      const remoteSelections = sanitizeSelections(remote.activeSelections);
      if (remoteSelections) {
        Object.assign(base, remoteSelections);
        source = 'api';
      }
      if (typeof remote.currentZoneId === 'string' && remote.currentZoneId) {
        zoneId = remote.currentZoneId;
      }
      this._apiAvailable = true;
    } else if (this._apiAvailable === null) {
      this._apiAvailable = false;
    }

    // Write the merged result straight back so local is always current.
    save(K.selections, base);
    if (zoneId) saveRaw(K.currentZone, zoneId);

    console.info(`[api] State restored from: ${source}`);
    return { activeSelections: base, currentZoneId: zoneId, source };
  }

  /**
   * Persist full selections + zone. localStorage write is synchronous and
   * unconditional; the API call is fire-and-forget best effort.
   */
  static async syncState(activeSelections, currentZoneId) {
    const clean = sanitizeSelections(activeSelections) || {};
    const storedOk = save(K.selections, clean);
    if (currentZoneId) saveRaw(K.currentZone, currentZoneId);

    const json = await apiFetch('/state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activeSelections: clean, currentZoneId })
    });

    this._apiAvailable = json !== null;
    return {
      success: storedOk,
      persistedLocally: storedOk,
      persistedRemotely: json !== null,
      data: { activeSelections: clean, currentZoneId }
    };
  }

  /** Record one item swap. Local state is updated by syncState; this is the audit log. */
  static async recordSwap({ slotId, itemId, itemTitle, zoneId, category }) {
    const json = await apiFetch('/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId, itemId, itemTitle, zoneId, category })
    });
    this._apiAvailable = json !== null;
    if (json) this.notifyBackendUpdate(`Synced: ${itemTitle || itemId} updated`);
    return { success: true, persistedRemotely: json !== null, swap: json && json.swap };
  }

  /** Save a proposal. Always stored locally; mirrored to the API when present. */
  static async saveProposal(proposalData) {
    const list = load(K.proposals, []);
    const record = {
      id: `prop_${Date.now().toString(36)}`,
      ...proposalData,
      createdAt: new Date().toISOString()
    };
    save(K.proposals, [record, ...(Array.isArray(list) ? list : [])].slice(0, 200));

    const json = await apiFetch('/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proposalData)
    });
    return { success: true, proposal: (json && json.proposal) || record, persistedRemotely: json !== null };
  }

  /** Proposals, API-first with the local list as the fallback. */
  static async fetchProposals() {
    const json = await apiFetch('/proposals');
    if (json && Array.isArray(json.proposals) && json.proposals.length) return json.proposals;
    const local = load(K.proposals, []);
    return Array.isArray(local) ? local : [];
  }

  /** Swap activity log. Empty array is a legitimate result — render an empty state. */
  static async fetchActivity() {
    const json = await apiFetch('/activity');
    return json && Array.isArray(json.swaps) ? json.swaps : [];
  }

  /** Back-compat alias for the old name. Prefer `restoreState`. */
  static async fetchState() {
    const { activeSelections, currentZoneId } = await this.restoreState({});
    return { activeSelections, currentZoneId };
  }

  /** True once a real JSON API has answered. Use to label UI honestly. */
  static isApiAvailable() {
    return this._apiAvailable === true;
  }

  /**
   * Toast for live sync updates. `role="status"` + `aria-live="polite"` so
   * screen readers announce it.
   */
  static notifyBackendUpdate(msg) {
    if (typeof document === 'undefined') return;
    let toast = document.getElementById('backend-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'backend-toast-notification';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
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
    // textContent, not innerHTML — `msg` can contain a user-entered item title.
    toast.textContent = `⚡ ${msg}`;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
    }, 3000);
  }
}

// Re-export the storage surface so callers have one import site.
export { K as STORAGE_KEYS, SCHEMA_VERSION, load as loadStored, save as saveStored, readJSON };
