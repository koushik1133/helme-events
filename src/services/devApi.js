/**
 * Helm Events 360° — local development API.
 *
 * NODE-ONLY MODULE. This file is never imported by browser code and therefore
 * never reaches the production bundle. It is the SINGLE source of truth for the
 * local `/api/*` surface and is consumed by exactly two callers:
 *
 *   1. `vite.config.js`  — mounts it as dev-server middleware (`npm run dev`)
 *   2. `server.js`       — mounts it as a standalone http server (`npm run api`)
 *
 * There is deliberately no third implementation. Previously the Vite plugin and
 * server.js each had their own divergent copy of these routes.
 *
 * Persistence is a single JSON file (`src/data/backend_db.json`). That file is
 * gitignored; `backend_db.seed.json` next to it is the tracked seed. This is a
 * local demo store, not a production database — Vercel's filesystem is
 * read-only/ephemeral, so none of this ships.
 */

import fs from 'node:fs';
import path from 'node:path';

/** Hard cap on request bodies. Anything larger is rejected with 413. */
export const MAX_BODY_BYTES = 256 * 1024;

/** Bumped when the persisted shape changes incompatibly. */
export const DB_SCHEMA_VERSION = 1;

const MAX_SELECTIONS = 500;
const MAX_HISTORY = 200;
const MAX_PROPOSALS = 200;
const MAX_BOOKINGS = 200;
const MAX_STRING = 300;

/** Slot ids and item ids are machine-generated kebab/snake ids — nothing else is accepted. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
/** `custom_text_<slotId>` free-text keys are the one exception to the id rule. */
const CUSTOM_TEXT_RE = /^custom_text_[A-Za-z0-9_-]{1,64}$/;

function defaultDb() {
  return {
    schemaVersion: DB_SCHEMA_VERSION,
    state: {
      activeSelections: {
        'slot-stage-main': 'stage-led-arch',
        'slot-table-banquet': 'table-round-standard',
        'slot-chair-banquet': 'chair-chiavari-gold',
        'slot-backdrop-photo': 'backdrop-marigold-garland',
        'slot-lighting-main': 'lighting-chandeliers',
        'slot-fountain-main': 'fountain-royal-marble',
        'slot-sofa-lounge': 'sofa-royal-maharani',
        'slot-podium-main': 'stage-digital-podium'
      },
      currentZoneId: 'zone-stage',
      lastUpdated: new Date().toISOString()
    },
    swapHistory: [],
    proposals: [],
    vendors: [],
    bookings: []
  };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Trim + cap an untrusted string. Never throws. */
function str(value, max = MAX_STRING) {
  if (typeof value !== 'string') return '';
  return value.slice(0, max).trim();
}

/** Prices are INTEGER RUPEES. No floats, no negatives, no NaN. */
function rupees(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1e12);
}

/**
 * `activeSelections` is a FLAT map of slotId -> itemId string, plus optional
 * `custom_text_<slotId>` string keys. Anything else is rejected outright rather
 * than merged, so a malformed client can never poison the store.
 */
function validateSelections(input) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new ApiError(400, 'activeSelections must be a flat object of slotId -> itemId');
  }
  const entries = Object.entries(input);
  if (entries.length > MAX_SELECTIONS) {
    throw new ApiError(400, `activeSelections may contain at most ${MAX_SELECTIONS} keys`);
  }
  const out = Object.create(null);
  for (const [key, value] of entries) {
    // Block prototype-pollution vectors explicitly, even though we build a
    // null-prototype object and JSON.parse does not set __proto__ as a setter.
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      throw new ApiError(400, `Illegal selection key: ${key}`);
    }
    if (CUSTOM_TEXT_RE.test(key)) {
      if (typeof value !== 'string') throw new ApiError(400, `${key} must be a string`);
      out[key] = str(value);
      continue;
    }
    if (!ID_RE.test(key)) throw new ApiError(400, `Illegal selection key: ${String(key).slice(0, 64)}`);
    if (typeof value !== 'string' || !ID_RE.test(value)) {
      throw new ApiError(400, `Selection ${key} must be an item id string`);
    }
    out[key] = value;
  }
  return { ...out };
}

function validateZoneId(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !ID_RE.test(value)) throw new ApiError(400, 'Invalid currentZoneId');
  return value;
}

/** Short, collision-resistant id. `substr` is deprecated; `slice` is not. */
function newId(prefix) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Repair a store written before the state contract was enforced.
 *
 * Real stores in the wild contain numeric-keyed entries like
 * `"0": {id, name, category}` and the legacy `{itemId, quantity}` object shape.
 * The contract is a FLAT map of slotId -> itemId string, so coerce what can be
 * coerced and drop the rest rather than serving garbage to the client.
 */
function sanitizeStoredSelections(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  let dropped = 0;
  for (const [key, value] of Object.entries(input)) {
    if (!ID_RE.test(key) && !CUSTOM_TEXT_RE.test(key)) { dropped += 1; continue; }
    if (typeof value === 'string') { out[key] = value; continue; }
    // Legacy {itemId, quantity} — quantities live on the zone slot, not here.
    if (value && typeof value === 'object' && typeof value.itemId === 'string') {
      out[key] = value.itemId;
      continue;
    }
    dropped += 1;
  }
  if (dropped) console.warn(`[helm-api] Dropped ${dropped} malformed selection entr(y|ies) on load`);
  return out;
}

function createStore(dbPath) {
  let cache = null;
  /** Serialises writes so two in-flight requests cannot interleave. */
  let writeChain = Promise.resolve();

  const load = () => {
    if (cache) return cache;
    for (const candidate of [dbPath, dbPath.replace(/\.json$/, '.seed.json')]) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf-8'));
        if (parsed && typeof parsed === 'object') {
          const base = defaultDb();
          cache = { ...base, ...parsed, schemaVersion: DB_SCHEMA_VERSION };
          cache.state = { ...base.state, ...(parsed.state || {}) };
          cache.state.activeSelections = sanitizeStoredSelections(cache.state.activeSelections);
          for (const list of ['swapHistory', 'proposals', 'vendors', 'bookings']) {
            if (!Array.isArray(cache[list])) cache[list] = [];
          }
          return cache;
        }
      } catch (err) {
        console.warn(`[helm-api] Could not read ${candidate}: ${err.message}`);
      }
    }
    cache = defaultDb();
    return cache;
  };

  /**
   * Atomic write: temp file + rename, so a crash mid-write cannot truncate the
   * store. Rejects on failure — callers must NOT report success on a failed write.
   */
  const save = (data) => {
    cache = data;
    writeChain = writeChain.then(() => new Promise((resolve, reject) => {
      const tmp = `${dbPath}.${process.pid}.tmp`;
      try {
        fs.mkdirSync(path.dirname(dbPath), { recursive: true });
        fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
        fs.renameSync(tmp, dbPath);
        resolve();
      } catch (err) {
        try { fs.rmSync(tmp, { force: true }); } catch { /* best effort */ }
        reject(new ApiError(500, `Failed to persist store: ${err.message}`));
      }
    }));
    return writeChain;
  };

  return { load, save };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      reject(new ApiError(413, 'Request body too large'));
      return;
    }
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (err) => { if (!done) { done = true; req.destroy(); reject(err); } };

    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { fail(new ApiError(413, 'Request body too large')); return; }
      chunks.push(chunk);
    });
    req.on('error', (err) => fail(new ApiError(400, err.message)));
    req.on('end', () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) { resolve({}); return; }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          reject(new ApiError(400, 'Body must be a JSON object'));
          return;
        }
        resolve(parsed);
      } catch {
        reject(new ApiError(400, 'Invalid JSON body'));
      }
    });
  });
}

/**
 * @param {object} options
 * @param {string} options.dbPath     absolute path to the JSON store
 * @param {string[]} [options.allowedOrigins]  exact origins allowed to call the API.
 *        Empty (the default) means same-origin only — no CORS headers are emitted.
 *        There is NO wildcard mode.
 */
export function createApiHandler({ dbPath, allowedOrigins = [] } = {}) {
  const store = createStore(dbPath);
  const allowList = new Set(allowedOrigins.filter(Boolean));

  const applyCors = (req, res) => {
    const origin = req.headers.origin;
    if (!origin || !allowList.has(origin)) return;
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Max-Age', '600');
  };

  const send = (res, status, payload) => {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(body);
  };

  const fail = (res, status, message) => send(res, status, { success: false, error: message });

  /**
   * @returns {Promise<boolean>} true if the request was handled (always true for
   * `/api/*` — unknown routes get a real 404, they never fall through).
   */
  return async function handleApi(req, res) {
    if (!req.url || !req.url.startsWith('/api/')) return false;

    applyCors(req, res);

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return true;
    }

    let pathname;
    try {
      pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
    } catch {
      fail(res, 400, 'Malformed request URL');
      return true;
    }

    const method = req.method || 'GET';

    try {
      const db = store.load();

      // --- health ---------------------------------------------------------
      if (pathname === '/api/health') {
        if (method !== 'GET') return fail(res, 405, 'Method Not Allowed'), true;
        send(res, 200, {
          success: true,
          status: 'ok',
          service: 'Helm Events 360° local API',
          schemaVersion: DB_SCHEMA_VERSION,
          timestamp: new Date().toISOString(),
          activeZone: db.state.currentZoneId,
          totalSwaps: db.swapHistory.length
        });
        return true;
      }

      // --- state ----------------------------------------------------------
      if (pathname === '/api/state') {
        if (method === 'GET') {
          send(res, 200, { success: true, schemaVersion: DB_SCHEMA_VERSION, data: db.state });
          return true;
        }
        if (method === 'POST') {
          const body = await readBody(req);
          const selections = validateSelections(body.activeSelections);
          const zoneId = validateZoneId(body.currentZoneId);
          if (selections) db.state.activeSelections = { ...db.state.activeSelections, ...selections };
          if (zoneId) db.state.currentZoneId = zoneId;
          db.state.lastUpdated = new Date().toISOString();
          await store.save(db);
          send(res, 200, { success: true, schemaVersion: DB_SCHEMA_VERSION, data: db.state });
          return true;
        }
        return fail(res, 405, 'Method Not Allowed'), true;
      }

      // --- swap -----------------------------------------------------------
      if (pathname === '/api/swap') {
        if (method !== 'POST') return fail(res, 405, 'Method Not Allowed'), true;
        const body = await readBody(req);
        const slotId = str(body.slotId, 64);
        const itemId = str(body.itemId, 64);
        if (!ID_RE.test(slotId) || !ID_RE.test(itemId)) {
          return fail(res, 400, 'slotId and itemId are required and must be valid ids'), true;
        }
        const zoneId = validateZoneId(body.zoneId);
        db.state.activeSelections[slotId] = itemId;
        if (zoneId) db.state.currentZoneId = zoneId;
        db.state.lastUpdated = new Date().toISOString();

        const swap = {
          id: newId('swap'),
          slotId,
          itemId,
          itemTitle: str(body.itemTitle, 120) || itemId,
          category: str(body.category, 60) || 'furniture',
          zoneId: zoneId || db.state.currentZoneId,
          timestamp: new Date().toISOString()
        };
        db.swapHistory.unshift(swap);
        if (db.swapHistory.length > MAX_HISTORY) db.swapHistory.length = MAX_HISTORY;
        await store.save(db);
        send(res, 201, { success: true, swap, activeSelections: db.state.activeSelections });
        return true;
      }

      // --- activity -------------------------------------------------------
      if (pathname === '/api/activity') {
        if (method !== 'GET') return fail(res, 405, 'Method Not Allowed'), true;
        send(res, 200, { success: true, swaps: db.swapHistory, lastUpdated: db.state.lastUpdated });
        return true;
      }

      // --- proposals ------------------------------------------------------
      if (pathname === '/api/proposals') {
        if (method === 'GET') {
          send(res, 200, { success: true, proposals: db.proposals });
          return true;
        }
        if (method === 'POST') {
          const body = await readBody(req);
          const selections = validateSelections(body.selections);
          const proposal = {
            id: newId('prop'),
            clientName: str(body.clientName, 120) || 'Valued Client',
            title: str(body.title, 160) || 'Event Design Quote',
            eventDate: str(body.eventDate, 40),
            buyerState: str(body.buyerState, 60),
            // INTEGER RUPEES.
            totalPrice: rupees(body.totalPrice),
            selections: selections || { ...db.state.activeSelections },
            createdAt: new Date().toISOString()
          };
          db.proposals.unshift(proposal);
          if (db.proposals.length > MAX_PROPOSALS) db.proposals.length = MAX_PROPOSALS;
          await store.save(db);
          send(res, 201, { success: true, proposal });
          return true;
        }
        return fail(res, 405, 'Method Not Allowed'), true;
      }

      // --- vendors (read-only catalogue) ----------------------------------
      if (pathname === '/api/vendors') {
        if (method !== 'GET') return fail(res, 405, 'Method Not Allowed'), true;
        send(res, 200, { success: true, vendors: Array.isArray(db.vendors) ? db.vendors : [] });
        return true;
      }

      // --- bookings -------------------------------------------------------
      if (pathname === '/api/bookings') {
        if (method === 'GET') {
          send(res, 200, { success: true, bookings: db.bookings });
          return true;
        }
        if (method === 'POST') {
          const body = await readBody(req);
          const dates = Array.isArray(body.dates)
            ? body.dates.slice(0, 30).map((d) => str(d, 40)).filter(Boolean)
            : [];
          const booking = {
            id: newId('book'),
            eventName: str(body.eventName, 160) || '360° Event Booking',
            clientName: str(body.clientName, 120),
            venue: str(body.venue, 160),
            dates,
            // INTEGER RUPEES.
            totalBudget: rupees(body.totalBudget),
            status: 'confirmed',
            createdAt: new Date().toISOString()
          };
          db.bookings.push(booking);
          if (db.bookings.length > MAX_BOOKINGS) db.bookings.splice(0, db.bookings.length - MAX_BOOKINGS);
          await store.save(db);
          send(res, 201, { success: true, booking });
          return true;
        }
        return fail(res, 405, 'Method Not Allowed'), true;
      }

      // --- terminal 404: /api/* NEVER falls through ------------------------
      fail(res, 404, `No such API endpoint: ${method} ${pathname}`);
      return true;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 500;
      if (status >= 500) console.error('[helm-api]', err);
      fail(res, status, status >= 500 ? 'Internal server error' : err.message);
      return true;
    }
  };
}

export { ApiError };
