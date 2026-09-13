/**
 * Contract tests — the invariants that must never break.
 *
 * These cover the classes of bug that actually shipped in this codebase:
 * quotes that didn't add up, selections in the wrong shape zeroing the whole
 * price, UTC dates stamping yesterday in IST, and panorama plates that were
 * silently wrong. They run on plain Node with no test framework.
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { VENUE_ZONES } from '../src/data/zones.js';
import { getItemById, allItems } from '../src/data/catalog.js';
import {
  formatMoney, formatMoneyShort, sumLines, computeGst, readJSON, escapeHtml
} from '../src/utils/format.js';
import { buildQuote } from '../src/utils/quote.js';
import { PANORAMA_DIMENSIONS } from '../src/data/panoramaMeta.js';

/** The venue's default configuration — the state the app boots into. */
function defaultSelections() {
  const sel = {};
  VENUE_ZONES.forEach(z => z.slots.forEach(s => { sel[s.id] = s.defaultItemId; }));
  return sel;
}

// ---------------------------------------------------------------- money

test('Indian digit grouping, not Western', () => {
  assert.equal(formatMoney(2301590), '₹23,01,590');
  assert.equal(formatMoney(85000), '₹85,000');
  assert.equal(formatMoney(0), '₹0');
});

test('formatMoney never renders NaN or undefined to the user', () => {
  for (const bad of [undefined, null, NaN, 'abc', {}]) {
    assert.equal(formatMoney(bad), '₹0', `formatMoney(${String(bad)})`);
  }
});

test('compact money uses lakh and crore', () => {
  assert.equal(formatMoneyShort(2301590), '₹23.0L');
  assert.equal(formatMoneyShort(45000000), '₹4.5Cr');
  assert.equal(formatMoneyShort(85000), '₹85,000');
});

test('sumLines rounds each line once so lines always equal the subtotal', () => {
  const lines = [
    { price: 1250.4, qty: 3 },
    { price: 99.6, qty: 7 },
    { unitPrice: 33.33, quantity: 3 }
  ];
  const total = sumLines(lines);
  const perLine = lines.reduce(
    (a, l) => a + Math.round((l.unitPrice ?? l.price) * (l.quantity ?? l.qty)), 0
  );
  assert.equal(total, perLine);
  assert.ok(Number.isInteger(total), 'subtotal must be an integer number of rupees');
});

test('GST splits CGST/SGST intra-state and IGST inter-state, and the parts re-sum', () => {
  const intra = computeGst(100001, 'Telangana');
  assert.equal(intra.intraState, true);
  assert.equal(intra.igst, 0);
  assert.equal(intra.cgst + intra.sgst, intra.total);

  const inter = computeGst(100001, 'Karnataka');
  assert.equal(inter.intraState, false);
  assert.equal(inter.cgst + inter.sgst, 0);
  assert.equal(inter.igst, inter.total);

  // Same taxable base means the same tax either way — only the split differs.
  assert.equal(intra.total, inter.total);
});

test('an odd rupee cannot vanish in the CGST/SGST halves', () => {
  for (const base of [1, 7, 99, 12345, 999999]) {
    const g = computeGst(base, 'Telangana');
    assert.equal(g.cgst + g.sgst, g.total, `base ${base}`);
  }
});

// ---------------------------------------------------------------- quote

test('the quote adds up, in both GST regimes', () => {
  for (const state of ['Telangana', 'Karnataka']) {
    const q = buildQuote(defaultSelections(), { buyerState: state });
    assert.equal(sumLines(q.lines), q.subtotal, `${state}: lines vs subtotal`);
    assert.equal(q.gst.cgst + q.gst.sgst + q.gst.igst, q.gst.total, `${state}: gst parts`);
    assert.equal(q.subtotal + q.gst.total, q.grandTotal, `${state}: grand total`);
    assert.equal(
      q.schedule.reduce((a, p) => a + p.amount, 0), q.grandTotal,
      `${state}: payment schedule must sum to the grand total`
    );
    assert.equal(q.deposit + q.balanceDue, q.grandTotal, `${state}: deposit + balance`);
    for (const n of [q.subtotal, q.gst.total, q.grandTotal]) {
      assert.ok(Number.isInteger(n), `${state}: ${n} must be integer rupees`);
    }
  }
});

test('a quote is never negative or NaN, even with junk selections', () => {
  const junk = { 'slot-stage-main': 'no-such-item', 'not-a-slot': 'nonsense' };
  const q = buildQuote(junk, { buyerState: 'Telangana' });
  assert.ok(Number.isFinite(q.grandTotal), 'grand total must be finite');
  assert.ok(q.grandTotal >= 0, 'grand total must not go negative');
});

// ------------------------------------------------------ catalog & zones

test('catalog item ids are unique across every category', () => {
  const seen = new Map();
  for (const item of allItems()) {
    assert.ok(!seen.has(item.id), `duplicate catalog id: ${item.id}`);
    seen.set(item.id, item);
  }
});

test('every price is a positive integer number of rupees', () => {
  for (const item of allItems()) {
    assert.ok(Number.isInteger(item.price), `${item.id} price ${item.price} is not an integer`);
    assert.ok(item.price > 0, `${item.id} price must be positive`);
  }
});

test('every slot default and allowed item resolves in the catalog', () => {
  for (const zone of VENUE_ZONES) {
    for (const slot of zone.slots) {
      assert.ok(getItemById(slot.defaultItemId),
        `${zone.id}/${slot.id}: default "${slot.defaultItemId}" is not in the catalog`);
      for (const id of slot.allowedItemIds || []) {
        assert.ok(getItemById(id),
          `${zone.id}/${slot.id}: allowed item "${id}" is not in the catalog`);
      }
    }
  }
});

test('slot ids are unique across the whole venue', () => {
  const seen = new Set();
  for (const zone of VENUE_ZONES) {
    for (const slot of zone.slots) {
      assert.ok(!seen.has(slot.id), `duplicate slot id: ${slot.id}`);
      seen.add(slot.id);
    }
  }
});

// ------------------------------------------------------------ panoramas

test('every panorama has measured dimensions recorded', () => {
  for (const zone of VENUE_ZONES) {
    assert.ok(PANORAMA_DIMENSIONS[zone.panoramaUrl],
      `${zone.id}: ${zone.panoramaUrl} is missing from panoramaMeta.js — ` +
      'regenerate it so the viewer can pick the right projection');
  }
});

test('every plate is a true 2:1 full sphere', async () => {
  const { isTrue360, nonSphericalPlates } = await import('../src/data/panoramaMeta.js');
  const bad = nonSphericalPlates();
  assert.deepEqual(bad, [],
    'these plates are not 2:1 and will seam/smear on a sphere — run tools/pano360.py on them: ' + bad.join(', '));
  for (const [url, d] of Object.entries(PANORAMA_DIMENSIONS)) {
    assert.ok(d.w > 0 && d.h > 0, `${url}: bad dimensions`);
    assert.ok(isTrue360(url), `${url}: not a full sphere`);
    assert.ok(d.w >= 2048, `${url}: ${d.w}px is too low-res for a 360 backdrop`);
    assert.ok(d.w <= 4096, `${url}: ${d.w}px exceeds the 4096 texture limit a long tail of mobile GPUs enforces`);
  }
});

test('the viewer never applies a partial-panorama projection', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/engine/Viewer360.js', import.meta.url), 'utf8');
  for (const token of ['haov', 'vaov', 'vOffset']) {
    assert.ok(!src.includes(token),
      `Viewer360 references ${token}: every plate is a full sphere, so limiting the field of view would crop the venue`);
  }
});

// ------------------------------------------------------------- safety

test('escapeHtml neutralises script injection', () => {
  const out = escapeHtml('<img src=x onerror="alert(1)">');
  assert.ok(!out.includes('<'), 'angle brackets must be escaped');
  assert.ok(!out.includes('"'), 'quotes must be escaped');
});

test('readJSON survives corrupt storage instead of throwing', () => {
  const store = new Map([['good', '{"a":1}'], ['bad', '{not json']]);
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: k => store.delete(k)
  };
  assert.deepEqual(readJSON('good', null), { a: 1 });
  assert.equal(readJSON('bad', 'fallback'), 'fallback', 'corrupt JSON must fall back, not throw');
  assert.equal(readJSON('missing', 'fallback'), 'fallback');
  delete globalThis.localStorage;
});

// -------------------------------------------------------- event scoping

test('a quote only includes the zones the event actually uses', async () => {
  const { eventState, zonesInScope, ZONES_BY_EVENT_TYPE } = await import('../src/data/eventState.js');
  const allZoneIds = VENUE_ZONES.map(z => z.id);

  for (const type of Object.keys(ZONES_BY_EVENT_TYPE)) {
    eventState.set({ eventType: type, scopeZoneIds: null });
    const scope = zonesInScope(allZoneIds);
    assert.ok(scope.length > 0, `${type}: scope must never be empty`);
    assert.ok(scope.length < allZoneIds.length, `${type}: scope should be narrower than the whole venue`);

    const q = buildQuote(defaultSelections(), { buyerState: 'Telangana' });
    for (const line of q.lines) {
      assert.ok(scope.includes(line.zoneId),
        `${type}: quote contains ${line.zoneId}, which is not in scope`);
    }
  }
});

test('a wedding is never quoted for the election rally stage', async () => {
  const { eventState } = await import('../src/data/eventState.js');
  eventState.set({ eventType: 'wedding', scopeZoneIds: null });
  const q = buildQuote(defaultSelections(), { buyerState: 'Telangana' });
  assert.ok(!q.lines.some(l => l.zoneId === 'zone-india-election'),
    'a wedding quote must not include the political rally zone');
  assert.ok(q.lines.some(l => l.zoneId === 'zone-india-function'),
    'a wedding quote should include the mandap zone');
});

test('an explicit zone scope overrides the event type', async () => {
  const { eventState, zonesInScope } = await import('../src/data/eventState.js');
  const allZoneIds = VENUE_ZONES.map(z => z.id);
  eventState.set({ eventType: 'wedding', scopeZoneIds: ['zone-stage'] });
  assert.deepEqual(zonesInScope(allZoneIds), ['zone-stage']);

  // An all-invalid override must fall back rather than quote nothing.
  eventState.set({ scopeZoneIds: ['zone-does-not-exist'] });
  assert.ok(zonesInScope(allZoneIds).length > 0, 'scope must never collapse to empty');
  eventState.set({ scopeZoneIds: null });
});

// --------------------------------------------------------- seeded store

test('the seeded store only references slots and items that still exist', async () => {
  const { readFileSync } = await import('node:fs');
  const db = JSON.parse(readFileSync(new URL('../src/data/backend_db.seed.json', import.meta.url), 'utf8'));
  const selections = db.state?.activeSelections || db.activeSelections || {};
  const validSlots = new Set(VENUE_ZONES.flatMap(z => z.slots.map(s => s.id)));

  for (const [key, value] of Object.entries(selections)) {
    if (key.startsWith('custom_text_')) {
      assert.ok(validSlots.has(key.slice('custom_text_'.length)),
        `seed has custom text for a slot that no longer exists: ${key}`);
      assert.equal(typeof value, 'string', `${key} must be a string`);
      continue;
    }
    assert.ok(validSlots.has(key), `seed references a slot that no longer exists: ${key}`);
    assert.equal(typeof value, 'string',
      `seed value for ${key} must be a plain item id string, not ${typeof value}`);
    assert.ok(getItemById(value), `seed references a catalog item that no longer exists: ${value}`);
  }
});

test('the seeded store covers every slot, so a restore is never partial', async () => {
  const { readFileSync } = await import('node:fs');
  const db = JSON.parse(readFileSync(new URL('../src/data/backend_db.seed.json', import.meta.url), 'utf8'));
  const selections = db.state?.activeSelections || db.activeSelections || {};
  for (const zone of VENUE_ZONES) {
    for (const slot of zone.slots) {
      assert.ok(slot.id in selections, `seed is missing ${zone.id}/${slot.id}`);
    }
  }
});

// ------------------------------------------- 360 swap / quote agreement

test('every changed slot is either baked into the plate or reported for compositing', async () => {
  const { resolveSceneComposite, isBakedIntoPlate, unbakedChanges } =
    await import('../src/data/sceneVariants.js');

  // This is the bug that shipped: swapping a second slot reloaded a plate showing
  // only the FIRST change, silently reverting the other on screen while the quote
  // still charged for it. Every non-default selection must now be accounted for.
  for (const zone of VENUE_ZONES) {
    const selections = defaultSelections();

    // Change every slot in this zone to something other than its default.
    const changed = [];
    for (const slot of zone.slots) {
      const alt = (slot.allowedItemIds || []).find((id) => id !== slot.defaultItemId);
      if (!alt) continue;
      selections[slot.id] = alt;
      changed.push(slot.id);
    }
    if (changed.length < 2) continue;   // need at least two to exercise the bug

    const composite = resolveSceneComposite(zone.id, zone, selections);
    assert.ok(composite, `${zone.id}: resolveSceneComposite returned nothing`);

    const layered = new Set(unbakedChanges(composite).map((c) => c.slotId ?? c));
    for (const slotId of changed) {
      const accounted = isBakedIntoPlate(composite, slotId) || layered.has(slotId);
      assert.ok(accounted,
        `${zone.id}/${slotId}: changed but neither baked into the plate nor composited — ` +
        'the 360 view would contradict the quote');
    }
  }
});

test('at most one slot is ever baked into the plate', async () => {
  const { resolveSceneComposite, isBakedIntoPlate } = await import('../src/data/sceneVariants.js');
  for (const zone of VENUE_ZONES) {
    const selections = defaultSelections();
    for (const slot of zone.slots) {
      const alt = (slot.allowedItemIds || []).find((id) => id !== slot.defaultItemId);
      if (alt) selections[slot.id] = alt;
    }
    const composite = resolveSceneComposite(zone.id, zone, selections);
    const baked = zone.slots.filter((s) => isBakedIntoPlate(composite, s.id));
    assert.ok(baked.length <= 1,
      `${zone.id}: ${baked.length} slots claim to be baked into one plate — a plate depicts one element`);
  }
});

test('a resolved plate always belongs to its own zone', async () => {
  const { resolveScenePanorama } = await import('../src/data/sceneVariants.js');
  const { PANORAMA_DIMENSIONS } = await import('../src/data/panoramaMeta.js');
  for (const zone of VENUE_ZONES) {
    const selections = defaultSelections();
    for (const slot of zone.slots) {
      for (const itemId of slot.allowedItemIds || []) {
        selections[slot.id] = itemId;
        const url = resolveScenePanorama(zone.id, zone, selections);
        if (!url) continue;
        assert.ok(PANORAMA_DIMENSIONS[url],
          `${zone.id}/${slot.id}/${itemId}: resolved a plate that is not in the manifest: ${url}`);
      }
      selections[slot.id] = slot.defaultItemId;
    }
  }
});
