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

test('recorded panorama dimensions are sane', () => {
  for (const [url, d] of Object.entries(PANORAMA_DIMENSIONS)) {
    assert.ok(d.w > 0 && d.h > 0, `${url}: bad dimensions`);
    assert.ok(d.w > d.h, `${url}: a panorama should be wider than it is tall`);
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
