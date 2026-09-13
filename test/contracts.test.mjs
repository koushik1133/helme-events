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

// ------------------------------------------------------------------ CRM money
// Appended by the CRM work. These cover the India-specific arithmetic that,
// if wrong, makes every corporate deal in the book look permanently unpaid.

test('TDS is deducted on the EX-GST base, not the gross', async () => {
  const { computeTds, expectedRemittance } = await import('../src/crm/finance.js');
  // ₹10,00,000 ex-GST, 194C, company payee => 2%.
  assert.equal(computeTds(1000000, '194C', 'company'), 20000);
  // Individual/HUF payees are deducted at 1%, not 2%.
  assert.equal(computeTds(1000000, '194C', 'individual_huf'), 10000);
  // 194J professional fee is 10%.
  assert.equal(computeTds(1000000, '194J'), 100000);
  // Deducting on the GROSS would give 2% of 11,80,000 = 23,600. It must not.
  const r = expectedRemittance(1000000, { placeOfSupplyCode: '36', tdsSection: '194C' });
  assert.equal(r.tds, 20000);
  assert.notEqual(r.tds, 23600);
});

test('a corporate deal settled net of TDS shows ZERO outstanding', async () => {
  const { dealFinancials } = await import('../src/crm/finance.js');
  // ₹10,00,000 + 18% = ₹11,80,000. Client withholds ₹20,000 (194C @2% of the
  // ex-GST base) and transfers ₹11,60,000. The deal is FULLY SETTLED.
  const deal = { id: 'd1', quotedValue: 1000000, discount: 0, stage: 'delivered',
    venue: { stateCode: '36' }, eventDates: [{ date: '2026-08-01' }] };
  const client = { id: 'c1', billing: { tdsApplicable: true, tdsSection: '194C', tdsDeducteeType: 'company', placeOfSupply: '36' } };
  const milestones = [{ id: 'm1', dealId: 'd1', sequence: 1, label: 'Full', percent: 100, amountDue: 1000000, dueRule: 'on_booking', dueDate: '2026-07-01' }];
  const receipts = [{ id: 'r1', dealId: 'd1', clientId: 'c1', amount: 1160000, tdsDeducted: 20000,
    tdsSection: '194C', receivedOn: '2026-08-10', allocations: [{ milestoneId: 'm1', amount: 1160000, tds: 20000 }] }];

  const fin = dealFinancials(deal, client, milestones, receipts, [], '2026-09-13');
  assert.equal(fin.contractGross, 1180000);
  assert.equal(fin.received, 1160000);
  assert.equal(fin.tdsWithheld, 20000);
  assert.equal(fin.outstanding, 0, 'outstanding must be invoiced − received − tdsWithheld');
  assert.equal(fin.fullySettled, true);
  assert.equal(fin.collectionPct, 100);
  assert.equal(fin.milestones[0].balance, 0);
  assert.equal(fin.milestones[0].status, 'paid');
  assert.equal(fin.overdue, 0, 'a TDS-settled milestone must never age into the overdue bucket');
});

test('place of supply is the VENUE state, so an out-of-state client can still be intra-state', async () => {
  const { dealFinancials, placeOfSupplyFor } = await import('../src/crm/finance.js');
  // Client registered in Karnataka (29); event at HICC Hyderabad (36). Supplier
  // is Telangana, so this is INTRA-state: CGST + SGST, never IGST.
  const client = { id: 'c', billing: { placeOfSupply: '29', address: { stateCode: '29' } } };
  const deal = { id: 'd', quotedValue: 1000000, discount: 0, venue: { stateCode: '36' }, eventDates: [] };
  assert.equal(placeOfSupplyFor(deal, client), '36');
  const fin = dealFinancials(deal, client, [], [], []);
  assert.equal(fin.gstMode, 'intra');
  assert.equal(fin.gst.cgst + fin.gst.sgst, 180000);
  assert.equal(fin.gst.igst, 0);

  // Same client, venue in Rajasthan => inter-state => IGST only.
  const away = dealFinancials({ ...deal, venue: { stateCode: '08' } }, client, [], [], []);
  assert.equal(away.gstMode, 'inter');
  assert.equal(away.gst.igst, 180000);
  assert.equal(away.gst.cgst + away.gst.sgst, 0);
});

test('a milestone schedule always re-sums to the contract value exactly', async () => {
  const { buildMilestones } = await import('../src/crm/finance.js');
  const { MILESTONE_TEMPLATES } = await import('../src/crm/schema.js');
  const deal = { createdAt: '2026-01-01', eventDates: [{ date: '2026-06-10' }, { date: '2026-06-12' }] };
  for (const template of MILESTONE_TEMPLATES) {
    for (const net of [1000000, 333333, 2750001, 87]) {
      const rows = buildMilestones(template, deal, net);
      const sum = rows.reduce((a, r) => a + r.amountDue, 0);
      assert.equal(sum, net, `${template.id} @ ${net} lost or invented rupees in rounding`);
      assert.equal(rows.reduce((a, r) => a + r.percent, 0), 100, `${template.id} percentages must total 100`);
    }
  }
});

test('a vendor payout is four numbers: gross, GST, TDS, net', async () => {
  const { vendorPayout } = await import('../src/crm/finance.js');
  const p = vendorPayout({ gross: 1000000, gstRate: 18, tdsSection: '194C', deducteeType: 'company' });
  assert.equal(p.gross, 1000000);
  assert.equal(p.gst, 180000);
  assert.equal(p.inputCredit, 180000, 'vendor GST is reclaimable input credit, not a sunk cost');
  assert.equal(p.tds, 20000);
  assert.equal(p.net, 1160000);
  // An individual/HUF tent house is deducted at 1%.
  const huf = vendorPayout({ gross: 1000000, gstRate: 18, tdsSection: '194C', deducteeType: 'individual_huf' });
  assert.equal(huf.tds, 10000);
});

test('receivables split upcoming from overdue and never merge them', async () => {
  const { receivables } = await import('../src/crm/finance.js');
  const today = '2026-09-13';
  const client = { id: 'c', billing: {} };
  const deal = { id: 'd', clientId: 'c', stage: 'delivered', quotedValue: 200000, discount: 0,
    venue: { stateCode: '36' }, eventDates: [{ date: '2026-05-01' }] };
  const milestones = [
    { id: 'm1', dealId: 'd', sequence: 1, label: 'Advance', percent: 50, amountDue: 100000, dueDate: '2026-03-01', dueRule: 'on_booking' },
    { id: 'm2', dealId: 'd', sequence: 2, label: 'Balance', percent: 50, amountDue: 100000, dueDate: '2026-12-01', dueRule: 'days_after_event' }
  ];
  const r = receivables([deal], [client], milestones, [], [], today);
  assert.equal(r.overdue.length, 1);
  assert.equal(r.upcoming.length, 1);
  assert.equal(r.overdue[0].bucket, '90+', '2026-03-01 is more than 90 days before 2026-09-13');
  assert.equal(r.totalOverdue, 118000);
  assert.equal(r.totalUpcoming, 118000);
  const bucketSum = Object.values(r.buckets).reduce((a, b) => a + b, 0);
  assert.equal(bucketSum, r.totalOverdue, 'the ageing buckets must account for every overdue rupee');
});

test('the seeded book is believable and internally consistent', async () => {
  const { seedCrm } = await import('../src/crm/seed.js');
  const { dealFinancials, receivables } = await import('../src/crm/finance.js');
  const s = seedCrm();
  assert.ok(s.clients.length >= 10, 'the demo book needs enough clients to look real');
  assert.ok(s.deals.length >= 10);

  // Every client carries a source — the field the research calls the most
  // forgotten and the least recoverable.
  for (const c of s.clients) assert.ok(c.source, `${c.name} has no acquisition source`);

  // Multi-day is represented, not just single-date events.
  assert.ok(s.deals.some(d => (d.eventDates || []).length >= 3), 'no multi-day event in the seed');
  assert.ok(s.deals.some(d => (d.functions || []).length >= 5), 'no five-function wedding in the seed');

  // All three segments and both terminal money states are present.
  for (const cat of ['wedding', 'corporate', 'political']) {
    assert.ok(s.deals.some(d => d.category === cat), `no ${cat} deal in the seed`);
  }
  assert.ok(s.deals.some(d => d.stage === 'cancelled'), 'cancelled is a distinct state and must be demonstrated');
  assert.ok(s.deals.some(d => d.stage === 'lost'));

  // Exactly the TDS case: a corporate deal fully settled by a SHORT bank credit.
  const clientById = new Map(s.clients.map(c => [c.id, c]));
  const tdsSettled = s.deals
    .map(d => ({ d, fin: dealFinancials(d, clientById.get(d.clientId), s.milestones, s.receipts, s.invoices) }))
    .filter(x => x.fin.tdsWithheld > 0 && x.fin.fullySettled && x.fin.received < x.fin.contractGross);
  assert.ok(tdsSettled.length >= 1, 'the seed must contain a corporate deal settled net of TDS');

  // And at least one genuinely aged receivable, or the ageing table is theatre.
  const r = receivables(s.deals, s.clients, s.milestones, s.receipts, s.invoices);
  assert.ok(r.totalOverdue > 0, 'the seed must contain a real overdue receivable');
  assert.ok(r.buckets['90+'] > 0, 'the seed must exercise the 90+ ageing bucket');
});

test('no stored financial totals — every rupee is derived', async () => {
  const { makeMilestone, makeDeal } = await import('../src/crm/schema.js');
  const milestone = makeMilestone({ dealId: 'd', amountDue: 100000 });
  for (const forbidden of ['status', 'amountReceived', 'balance', 'gstAmount', 'amountDueGross']) {
    assert.ok(!(forbidden in milestone),
      `PaymentMilestone must not store "${forbidden}" — a stored balance is a stale balance`);
  }
  const deal = makeDeal({ quotedValue: 100000 });
  for (const forbidden of ['netValue', 'grossValue', 'outstanding', 'received', 'margin']) {
    assert.ok(!(forbidden in deal), `Deal must not store "${forbidden}" — it is derived in finance.js`);
  }
});

// ------------------------------------------------- catalogue image integrity

/**
 * Catalogue items that currently share a photograph despite different prices.
 *
 * This is an ASSET debt list, not a code bug. A client comparing two options sees
 * the picture, not the id — so illustrating a Rs 25,000 floral wall and a
 * Rs 4,20,000 LED screen with the same photo means the 360 cannot show a
 * difference, the swap looks broken, and the higher quote is indefensible in the
 * room. Each line needs new artwork.
 *
 * The test below allows exactly these and fails on any NEW one, so the list can
 * only shrink. Delete a line when its artwork lands.
 */
const KNOWN_SHARED_ARTWORK = new Set([
  '/images/chair_velvet_armchair.jpg',
  '/images/chair_maharaja_throne.jpg',
  '/images/fountain_royal_marble.jpg',
  '/images/fountain_glass_waterfall.jpg',
  '/images/lighting_rally_highmast.jpg',
  '/images/backdrop_floral_wall.jpg',
  '/images/backdrop_shimmer_sequin.jpg',
  '/images/backdrop_election_flags.jpg',
  '/images/lighting_temple_lanterns.jpg'
]);

test('no NEW catalogue item shares artwork with a differently priced one', () => {
  const byImage = new Map();
  for (const item of allItems()) {
    if (!item.imageUrl) continue;
    if (!byImage.has(item.imageUrl)) byImage.set(item.imageUrl, []);
    byImage.get(item.imageUrl).push(item);
  }

  const offenders = [];
  for (const [url, items] of byImage) {
    if (items.length < 2) continue;
    if (new Set(items.map(i => i.price)).size < 2) continue;
    if (KNOWN_SHARED_ARTWORK.has(url)) continue;
    offenders.push(`${url} shared by ${items.map(i => `${i.id} (${i.price})`).join(', ')}`);
  }

  assert.deepEqual(offenders, [],
    'new items priced differently must not share artwork:\n  ' + offenders.join('\n  '));
});

test('the shared-artwork debt list does not contain entries that are already fixed', () => {
  // Keeps the list honest in the other direction: once artwork lands, the line
  // must be deleted rather than quietly granting a future duplicate a free pass.
  const shared = new Set();
  const byImage = new Map();
  for (const item of allItems()) {
    if (!item.imageUrl) continue;
    if (!byImage.has(item.imageUrl)) byImage.set(item.imageUrl, []);
    byImage.get(item.imageUrl).push(item);
  }
  for (const [url, items] of byImage) {
    if (items.length > 1 && new Set(items.map(i => i.price)).size > 1) shared.add(url);
  }
  const stale = [...KNOWN_SHARED_ARTWORK].filter(url => !shared.has(url));
  assert.deepEqual(stale, [], 'these no longer share artwork — remove them from KNOWN_SHARED_ARTWORK');
});

// ------------------------------------------------- brief → CRM intake (w5)

/**
 * The event brief is the one form at the start of a job. Everything typed into
 * it has to land somewhere real, or the owner is back to re-keying the same
 * client into three screens. These tests pin the four things that make that
 * true, and the one thing that must NOT happen.
 */

/** A complete, valid brief. Tests mutate a copy of it to break one thing at a time. */
function completeBrief(overrides = {}) {
  const base = {
    client: {
      name: 'Sharma Family Trust', type: 'individual', source: 'referral',
      sourceDetail: 'referred by the Kapoor wedding',
      contactName: 'Anil Sharma', contactRole: 'Father of the bride',
      phone: '98490 44551', whatsapp: '', email: 'anil@example.com',
      altContacts: [{ name: 'Ritu Sharma', role: 'Sister', phone: '9849044552', email: '' }],
      city: 'Bengaluru', state: 'Karnataka',
      billing: { legalName: '', gstin: '', pan: '', isRegistered: false, tdsApplicable: false, tdsSection: '' }
    },
    event: {
      name: 'Sharma–Mehta Wedding', category: 'social', subType: 'wedding',
      venueName: 'Taj Falaknuma Palace', venueCity: 'Hyderabad', venueState: 'Telangana',
      venueType: 'heritage', guestCount: 600, budgetIndicated: 4500000,
      startDate: '2026-11-20', endDate: '2026-11-22', startTime: '18:00', endTime: '23:00',
      ownerId: 'u-priya', eventManagerId: 'u-arjun', notes: 'Load-in only after 6am'
    },
    functions: [
      { type: 'mehendi', label: 'Mehendi', date: '2026-11-20', headcount: 200, requirements: 'Satvik menu only' },
      { type: 'wedding', label: 'Wedding ceremony', date: '2026-11-22', headcount: 600, requirements: '' }
    ],
    requirements: {
      cateringStyle: 'Grand multi-cuisine buffet', dietary: ['veg', 'jain'],
      av: 'Standard social AV', security: 'Marshals and access control',
      power: '2 x 250 kVA silent DG', accommodation: '40 rooms, 2 nights', transport: '6 coaches'
    },
    design: {
      conceptId: 'concept-1', conceptTitle: 'Royal Gold Carved Mandap',
      panoramaUrl: '/images/zone_stage_360.jpg',
      selections: { 'slot-stage-main': 'stage-royal-pavilion' }, styleKeywords: 'marigold, gold'
    }
  };
  return { ...base, ...overrides, client: { ...base.client, ...(overrides.client || {}) }, event: { ...base.event, ...(overrides.event || {}) } };
}

/** A throwaway in-memory CRM store, so these tests never touch the seeded one. */
async function freshStore() {
  // store.js exports a seeded singleton and not its class, so these tests use a
  // minimal stand-in with the same write surface. It deliberately copies the one
  // behaviour under test: `addDeal` writes a schedule ONLY when asked to.
  const { makeClient, makeDeal, phaseForStage, probabilityForStage, templateById, defaultTemplateFor } =
    await import('../src/crm/schema.js');
  const state = { clients: [], deals: [], milestones: [], n: 0 };
  return {
    clients: () => [...state.clients],
    dealsForClient: (id) => state.deals.filter(d => d.clientId === id),
    milestonesForDeal: (id) => state.milestones.filter(m => m.dealId === id),
    addClient(patch) {
      state.n += 1;
      const c = makeClient(patch);
      c.code = `CL-${String(state.n).padStart(4, '0')}`;
      state.clients.push(c);
      return c;
    },
    updateClient(id, patch) {
      const i = state.clients.findIndex(c => c.id === id);
      if (i < 0) return null;
      state.clients[i] = makeClient({ ...state.clients[i], ...patch, id, code: state.clients[i].code });
      return state.clients[i];
    },
    addDeal(patch, { withSchedule = true } = {}) {
      state.n += 1;
      const d = makeDeal(patch);
      d.code = `EV-2026-${String(state.n).padStart(4, '0')}`;
      d.phase = phaseForStage(d.stage);
      d.probability = probabilityForStage(d.stage);
      // Mirrors the real store: a schedule is ONLY written when asked for.
      if (withSchedule) {
        const t = templateById(d.milestoneTemplateId) || defaultTemplateFor(d.category);
        (t ? t.milestones : []).forEach((m, i) => state.milestones.push({ id: `ms${state.n}_${i}`, dealId: d.id, ...m }));
      }
      state.deals.push(d);
      return d;
    },
    updateDeal(id, patch) {
      const i = state.deals.findIndex(d => d.id === id);
      if (i < 0) return null;
      state.deals[i] = makeDeal({ ...state.deals[i], ...patch, id, code: state.deals[i].code });
      return state.deals[i];
    },
    _state: state
  };
}

const fakeEventState = () => ({ patches: [], set(patch) { this.patches.push(patch); return patch; } });

test('a completed brief creates exactly one client and one deal', async () => {
  const { submitIntake } = await import('../src/crm/intake.js');
  const store = await freshStore();
  const state = fakeEventState();

  const res = submitIntake(completeBrief(), { store, state });
  assert.equal(res.ok, true, JSON.stringify(res.errors));
  assert.equal(store._state.clients.length, 1);
  assert.equal(store._state.deals.length, 1);
  assert.equal(res.created.deal.stage, 'enquiry', 'a brief is an enquiry, never a booking');
  assert.equal(res.created.deal.phase, 'sales');
  assert.equal(res.created.deal.functions.length, 2, 'the function is the costing unit — all of them must land');
  assert.equal(res.created.deal.clientId, res.created.client.id);
  // And the shared event state follows the brief rather than keeping its own copy.
  assert.equal(state.patches.length, 1);
  assert.equal(state.patches[0].guestCount, 600);
  assert.equal(state.patches[0].clientState, 'Telangana');
});

test('submitting the same brief twice does not create a second client or deal', async () => {
  const { submitIntake } = await import('../src/crm/intake.js');
  const store = await freshStore();
  const state = fakeEventState();

  const first = submitIntake(completeBrief(), { store, state });
  const second = submitIntake(completeBrief(), { store, state });
  assert.equal(first.ok && second.ok, true);
  assert.equal(store._state.clients.length, 1, 'the same family enquiring twice is ONE client');
  assert.equal(store._state.deals.length, 1, 'the same event submitted twice is ONE deal');
  assert.equal(second.created.clientCreated, false);
  assert.equal(second.created.dealCreated, false);
  assert.equal(second.created.client.code, first.created.client.code);
});

test('intake blocks on the fields the CRM requires, and says what to do', async () => {
  const { validateIntake } = await import('../src/crm/intake.js');

  // Source is the field this whole model refuses to lose.
  const noSource = completeBrief({ client: { source: '' } });
  const a = validateIntake(noSource);
  assert.equal(a.ok, false);
  assert.match(a.errors.clientSource, /where this enquiry came from/i);

  const noVenueState = completeBrief({ event: { venueState: '' } });
  const b = validateIntake(noVenueState);
  assert.equal(b.ok, false);
  assert.match(b.errors.venueState, /GST split/i);

  const badPhone = completeBrief({ client: { phone: '12345' } });
  assert.match(validateIntake(badPhone).errors.contactPhone, /10-digit/);

  const noOwner = completeBrief({ event: { ownerId: '' } });
  assert.match(validateIntake(noOwner).errors.ownerId, /owner/i);

  // Every message must be an instruction, not a label.
  const empty = validateIntake({});
  assert.ok(Object.keys(empty.errors).length >= 8);
  for (const [key, msg] of Object.entries(empty.errors)) {
    assert.ok(msg.length > 20, `${key} message is too terse to act on: "${msg}"`);
  }
});

test('no payment record is created at intake — only a suggestion', async () => {
  const { submitIntake } = await import('../src/crm/intake.js');
  const store = await freshStore();
  const res = submitIntake(completeBrief(), { store, state: fakeEventState() });

  assert.equal(res.created.milestonesCreated, 0);
  assert.equal(store._state.milestones.length, 0,
    'payment milestones belong to a BOOKED deal, not to an enquiry');
  // The template is recorded so nobody has to remember the segment convention…
  assert.ok(res.created.deal.milestoneTemplateId, 'the suggested template should be recorded');
  assert.ok(res.created.suggestedTemplate.milestones.length > 0);
  // …but nothing about money-in exists yet.
  assert.equal(res.created.deal.quotedValue, 0);
  assert.equal(res.created.deal.budgetIndicated, 4500000, 'what the client SAID is not what we quoted');
});

test('GST place of supply follows the VENUE state, not the client address', async () => {
  const { submitIntake } = await import('../src/crm/intake.js');
  const { placeOfSupplyFor } = await import('../src/crm/finance.js');
  const { stateCodeForName } = await import('../src/crm/schema.js');
  const store = await freshStore();

  // Client registered in Karnataka (29); event at a Telangana (36) venue.
  const res = submitIntake(completeBrief(), { store, state: fakeEventState() });
  const { client, deal } = res.created;

  assert.equal(client.billing.address.stateCode, '29', 'the client keeps their own registered state');
  assert.equal(deal.venue.stateCode, '36');
  assert.equal(placeOfSupplyFor(deal, client), '36',
    'for an event the place of supply is the venue state — a Bengaluru client at a Hyderabad venue is INTRA-state');
  assert.equal(res.created.placeOfSupply.from, 'venue');

  // Flip only the venue and the answer must flip with it.
  const other = submitIntake(
    completeBrief({ event: { venueState: 'Maharashtra', name: 'Sharma Mumbai Reception' } }),
    { store, state: fakeEventState() }
  );
  assert.equal(other.created.deal.venue.stateCode, stateCodeForName('Maharashtra'));
  assert.equal(placeOfSupplyFor(other.created.deal, client), '27');
});

test('the brief field map covers client, deal, functions, requirements and eventState', async () => {
  const { FIELD_MAP, readRequirements, readDesign, submitIntake } = await import('../src/crm/intake.js');
  // The map is the owner-facing deliverable: it must not quietly shrink.
  const keys = Object.keys(FIELD_MAP);
  for (const needle of ['client.source', 'event.venueState', 'functions[].headcount', 'requirements.*', 'design.*']) {
    assert.ok(keys.includes(needle), `FIELD_MAP lost "${needle}"`);
  }
  assert.match(FIELD_MAP['(none) payment details'], /NOTHING/);

  const store = await freshStore();
  const res = submitIntake(completeBrief(), { store, state: fakeEventState() });
  const reqs = readRequirements(res.created.deal);
  assert.deepEqual(reqs.dietary, ['veg', 'jain'], 'veg/Jain/satvik must survive into the deal');
  assert.equal(reqs.accommodation, '40 rooms, 2 nights');
  assert.equal(readDesign(res.created.deal).conceptId, 'concept-1');
  assert.ok(!('amount' in reqs) && !('milestone' in reqs), 'requirements carry no money');
});
