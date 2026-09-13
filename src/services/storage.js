/**
 * Helm Events 360° — the ONE localStorage namespace.
 *
 * The app previously wrote under three unrelated prefixes (`event360_`,
 * `helme_events_`, and a couple of bare keys) with a misspelt brand name.
 * Everything now lives under a single versioned prefix:
 *
 *     helm.v1.<name>
 *
 * Rules for every other module:
 *   - NEVER type a raw localStorage key. Import `K` from here.
 *   - NEVER call JSON.parse(localStorage.getItem(...)). Use `load`/`save`,
 *     which delegate to readJSON/writeJSON from src/utils/format.js and are
 *     corrupt-data safe.
 *   - Call `migrateLegacyStorage()` once at boot, before anything reads state.
 */

import { readJSON, writeJSON } from '../utils/format.js';

/** Bump when a stored shape changes incompatibly; add a step to MIGRATIONS. */
export const SCHEMA_VERSION = 1;
export const NS = `helm.v${SCHEMA_VERSION}.`;

const key = (name) => `${NS}${name}`;

/**
 * The complete key registry. Every persisted value in the app must appear here.
 * Adding a key elsewhere is a bug.
 */
export const K = {
  // App shell
  schemaVersion: key('schemaVersion'),
  theme: key('theme'),

  // Core design state
  selections: key('selections'),
  currentZone: key('currentZone'),

  // Feature panels
  proposals: key('proposals'),
  bookings: key('bookings'),
  contracts: key('contracts'),
  guests: key('guests'),
  inventory: key('inventory'),
  moodboard: key('moodboard'),
  notes: key('notes'),
  notifications: key('notifications'),
  palettes: key('palettes'),
  activePalette: key('activePalette'),
  playlists: key('playlists'),
  testimonials: key('testimonials'),
  timeline: key('timeline'),
  vendorAssignments: key('vendorAssignments'),
  collab: key('collab')
};

/**
 * Legacy key -> new key. `raw: true` means the value is a bare string, not JSON,
 * and must be copied verbatim rather than re-serialised.
 */
const LEGACY_KEYS = [
  ['event360_theme', K.theme, { raw: true }],
  ['event360_proposals', K.proposals],
  ['helme_events_activeSelections', K.selections],
  ['helme_events_currentZone', K.currentZone, { raw: true }],
  ['helme_events_active_palette', K.activePalette, { raw: true }],
  ['helme_events_bookings', K.bookings],
  ['helme_events_collab', K.collab],
  ['helme_events_contracts', K.contracts],
  ['helme_events_guests', K.guests],
  ['helme_events_inventory', K.inventory],
  ['helme_events_moodboard', K.moodboard],
  ['helme_events_notes', K.notes],
  ['helme_events_notifications', K.notifications],
  ['helme_events_palettes', K.palettes],
  ['helme_events_playlists', K.playlists],
  ['helme_events_testimonials', K.testimonials],
  ['helme_events_timeline', K.timeline],
  ['helme_events_vendor_assignments', K.vendorAssignments]
];

/** JSON read that survives corrupt values (delegates to readJSON). */
export function load(storageKey, fallback = null) {
  return readJSON(storageKey, fallback);
}

/** JSON write that survives quota errors. Returns false rather than throwing. */
export function save(storageKey, value) {
  return writeJSON(storageKey, value);
}

/** Bare-string read (theme, zone id, palette id). Never throws. */
export function loadRaw(storageKey, fallback = null) {
  try {
    const v = localStorage.getItem(storageKey);
    return v === null ? fallback : v;
  } catch {
    return fallback;
  }
}

/** Bare-string write. Never throws. */
export function saveRaw(storageKey, value) {
  try {
    localStorage.setItem(storageKey, String(value));
    return true;
  } catch {
    return false;
  }
}

export function remove(storageKey) {
  try { localStorage.removeItem(storageKey); return true; } catch { return false; }
}

/**
 * Copy any pre-namespace values into `helm.v1.*` and delete the originals.
 * Idempotent and safe to call on every boot: a legacy key that no longer exists
 * is skipped, and an existing new-namespace value is never overwritten.
 *
 * @returns {{migrated: string[], version: number}}
 */
export function migrateLegacyStorage() {
  const migrated = [];
  let available = true;
  try { localStorage.getItem(K.schemaVersion); } catch { available = false; }
  if (!available) return { migrated, version: SCHEMA_VERSION };

  for (const [oldKey, newKey, opts] of LEGACY_KEYS) {
    let raw = null;
    try { raw = localStorage.getItem(oldKey); } catch { break; }
    if (raw === null) continue;

    // Do not clobber a value the user already has in the new namespace.
    if (loadRaw(newKey) === null) {
      if (opts && opts.raw) {
        saveRaw(newKey, raw);
      } else {
        // Re-serialise through readJSON so a corrupt legacy blob is dropped
        // rather than carried forward.
        const parsed = readJSON(oldKey, undefined);
        if (parsed !== undefined) save(newKey, parsed);
      }
      migrated.push(oldKey);
    }
    remove(oldKey);
  }

  saveRaw(K.schemaVersion, String(SCHEMA_VERSION));
  if (migrated.length) {
    console.info(`[storage] Migrated ${migrated.length} legacy key(s) into ${NS}*`);
  }
  return { migrated, version: SCHEMA_VERSION };
}

/** Wipe every Helm-namespaced key. Used by "reset demo" affordances. */
export function clearAll() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
    return doomed.length;
  } catch {
    return 0;
  }
}
