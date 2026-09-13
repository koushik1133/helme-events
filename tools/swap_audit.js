/**
 * 360 swap audit — the acceptance test for "every swap visibly changes the view".
 *
 * Walks every zone x slot x catalogue option, drives the real Viewer360, waits
 * for the composited panorama to settle and hashes the texture canvas. A swap
 * that leaves the hash unchanged is a swap the user cannot see, and is reported
 * as a FAIL rather than quietly tolerated.
 *
 * Run it in dev at http://localhost:3002/tools/swap_audit.html — it is served
 * by vite from /tools and is not part of the production bundle.
 */
import { VENUE_ZONES } from '/src/data/zones.js';
import { ITEM_CATALOG, getItemById } from '/src/data/catalog.js';
import { Viewer360 } from '/src/engine/Viewer360.js';

const stage = document.getElementById('stage');
const logEl = document.getElementById('log');
const statusEl = document.getElementById('status');

const viewer = new Viewer360(stage, () => {}, () => {});
window.__auditViewer = viewer;

function optionsFor(slot) {
  if (slot.allowedItemIds?.length) return [...new Set(slot.allowedItemIds)];
  const cats = slot.swapCategories || [slot.category];
  return [...new Set(cats.flatMap(c => (ITEM_CATALOG[c] || []).map(i => i.id)))];
}

const settled = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));

async function runAudit() {
  const rows = [];
  for (const zone of VENUE_ZONES) {
    for (const slot of zone.slots) {
      const opts = optionsFor(slot);
      // Always start each slot from a clean default configuration so one slot's
      // result can never depend on what the previous slot left behind.
      const base = {};
      zone.slots.forEach(s => { base[s.id] = s.defaultItemId; });
      viewer.loadZone(zone, base);
      // loadZone is async internally; poll until the first paint lands.
      for (let i = 0; i < 200 && !viewer._compositor?.revision; i++) await settled();
      let prev = viewer._compositor.hash();
      let prevId = base[slot.id];

      for (const itemId of opts) {
        if (itemId === prevId) continue;
        await viewer.updateSlotDisplay(slot.id, itemId);
        const h = viewer._compositor.hash();
        rows.push({
          zone: zone.id, slot: slot.id,
          from: prevId, to: itemId,
          changed: h !== prev,
          plate: viewer._currentPanorama.split('/').pop(),
          layers: (viewer._compositor._layers || []).length
        });
        prev = h; prevId = itemId;
        statusEl.textContent = `${rows.length} swaps checked…`;
      }
    }
  }
  return rows;
}

document.getElementById('run').addEventListener('click', async () => {
  statusEl.textContent = 'running…';
  const rows = await runAudit();
  window.__auditRows = rows;
  const fails = rows.filter(r => !r.changed);
  statusEl.textContent = `${rows.length} swaps · ${rows.length - fails.length} changed the view · ${fails.length} did not`;
  logEl.innerHTML = `<table><tr><th>zone</th><th>slot</th><th>from → to</th><th>plate</th><th>layers</th><th>view changed</th></tr>`
    + rows.map(r => `<tr><td>${r.zone}</td><td>${r.slot}</td><td>${r.from} → ${r.to}</td>`
      + `<td>${r.plate}</td><td>${r.layers}</td>`
      + `<td class="${r.changed ? 'ok' : 'bad'}">${r.changed ? 'YES' : 'NO'}</td></tr>`).join('')
    + '</table>';
});

// Convenience for a scripted (non-clicking) run.
window.__runAudit = runAudit;

// Auto-run: the dev server reloads whenever any source file is saved, so the
// audit must be able to complete without anyone being there to click.
window.__auditDone = false;
window.__auditError = null;
import('three').then(
  () => { document.getElementById('run').click(); },
  e => { window.__auditError = 'three failed to load: ' + (e?.message || e); statusEl.textContent = window.__auditError; }
);
const origRun = runAudit;
window.__runAudit = async () => { const r = await origRun(); window.__auditDone = true; return r; };
document.getElementById('run').addEventListener('click', () => {
  const t = setInterval(() => { if (window.__auditRows) { window.__auditDone = true; clearInterval(t); } }, 200);
});
