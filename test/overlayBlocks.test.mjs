/**
 * Contract tests for quantity-aware composited blocks and palette comparison.
 *
 * The bug these exist to stop coming back: `slot-stage-seating` is twenty VIP
 * chairs and the compositor drew ONE cut-out for it, so a concert lawn showed a
 * single chair (or, with a throne pair selected, two thrones in a field).
 *
 *   npm test
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { VENUE_ZONES } from '../src/data/zones.js';
import {
  arrangementFor, slotQuantity, cutoutCount, overlaySpec, CAMERA_HEIGHT_M
} from '../src/data/propOverlays.js';
import { getItemById } from '../src/data/catalog.js';
import {
  billboardFrame, frameBBox, arrangementPlacements, unionBBox,
  rasteriseBillboard, rasteriseBlockShadow, blitOver, cutoutOccupancy
} from '../src/engine/equirectBillboard.js';
import {
  extractPaletteFromPixels, comparePalettes, rgbToHsl, hueDelta
} from '../src/engine/paletteCompare.js';

const slotById = id => {
  for (const z of VENUE_ZONES) for (const s of z.slots) if (s.id === id) return s;
  return null;
};

test('a multi-quantity seating slot plans a block, not one object', () => {
  const slot = slotById('slot-stage-seating');
  assert.equal(slotQuantity(slot, 'chair-chiavari-gold'), 20);
  const plan = arrangementFor(slot, 'chair-chiavari-gold');
  assert.ok(plan, 'twenty chairs must plan a block');
  assert.ok(plan.count > 1 && plan.count <= 16, 'drawn count is capped, not literal');
  assert.ok(plan.rows >= 1 && plan.cols >= 2);
});

test('single objects stay single', () => {
  for (const id of ['slot-stage-main', 'slot-fountain-center', 'slot-function-mandap',
    'slot-meeting-podium', 'slot-election-podium']) {
    const slot = slotById(id);
    assert.equal(arrangementFor(slot, slot.defaultItemId), null, `${id} must stay one object`);
  }
});

test('hanging slots are never laid out as a floor block', () => {
  for (const id of ['slot-stage-backdrop', 'slot-banquet-lighting', 'slot-entrance-arch']) {
    assert.equal(arrangementFor(slotById(id), 'backdrop-hedge-wall'), null);
  }
});

test('a cut-out that already depicts a pair is not doubled', () => {
  const slot = slotById('slot-function-throne');
  assert.equal(slotQuantity(slot, 'chair-maharaja-throne'), 2);
  assert.equal(cutoutCount(slot, 'chair-maharaja-throne'), 1);
  assert.equal(arrangementFor(slot, 'chair-maharaja-throne'), null);
  // A single-object cut-out at the same slot still gets its pair.
  assert.equal(cutoutCount(slot, 'chair-throne'), 2);
  assert.ok(arrangementFor(slot, 'chair-throne'));
});

test('block instances recede: further back is further away and higher in frame', () => {
  const slot = slotById('slot-stage-seating');
  const spec = overlaySpec(slot, getItemById('chair-ghost'));
  const plan = arrangementFor(slot, 'chair-ghost');
  const base = {
    yawDeg: spec.anchorYaw, pitchDeg: spec.anchorPitch, distanceM: spec.distanceM,
    heightM: spec.heightM, aspect: 0.6, contact: 0.9,
    cameraHeightM: CAMERA_HEIGHT_M, ground: true
  };
  const ref = billboardFrame(base);
  const places = arrangementPlacements({
    yawDeg: base.yawDeg, distanceM: base.distanceM, wM: ref.wM, occupancy: 0.4, plan
  });
  assert.equal(places.length, plan.count);

  // Sorted back to front, so the painter's algorithm is correct by construction.
  for (let i = 1; i < places.length; i++) {
    assert.ok(places[i].distanceM <= places[i - 1].distanceM + 1e-9, 'not sorted far -> near');
  }
  // A back-row instance really is further and really does sit higher (smaller
  // |pitch| at its base) — that is perspective, not a scale fudge.
  const back = places[0], front = places[places.length - 1];
  assert.ok(back.distanceM > front.distanceM);
  const W = 3072, H = 1536;
  const bb = f => frameBBox(billboardFrame({ ...base, yawDeg: f.yawDeg, distanceM: f.distanceM }), W, H);
  const bBack = bb(back), bFront = bb(front);
  assert.ok(bBack.h < bFront.h, 'the further instance must be drawn smaller');
  assert.ok(bBack.y < bFront.y, 'the further instance must sit higher in the frame');
});

test('the layout is deterministic — the bake and the runtime cannot disagree', () => {
  const slot = slotById('slot-banquet-chairs');
  const plan = arrangementFor(slot, 'chair-ghost');
  const args = { yawDeg: 12, distanceM: 3, wM: 0.9, occupancy: 0.42, plan };
  assert.deepEqual(arrangementPlacements(args), arrangementPlacements(args));
});

test('a block rasterises to one patch with one merged shadow', () => {
  const cw = 60, ch = 90;
  const data = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    for (let x = 18; x < 42; x++) {
      const o = (y * cw + x) * 4;
      data[o] = 180; data[o + 1] = 180; data[o + 2] = 200; data[o + 3] = 255;
    }
  }
  const cut = { data, width: cw, height: ch };
  assert.ok(Math.abs(cutoutOccupancy(cut) - 24 / 60) < 0.02, 'occupancy must measure the object, not the frame');

  const slot = slotById('slot-stage-seating');
  const plan = arrangementFor(slot, 'chair-ghost');
  const base = {
    yawDeg: -15, pitchDeg: -25, distanceM: 2.6, heightM: 0.95,
    aspect: cw / ch, contact: 0.9, cameraHeightM: CAMERA_HEIGHT_M, ground: true
  };
  const W = 3072, H = 1536;
  const ref = billboardFrame(base);
  const places = arrangementPlacements({
    yawDeg: base.yawDeg, distanceM: base.distanceM, wM: ref.wM,
    occupancy: cutoutOccupancy(cut), plan
  });
  const frames = places.map(p => billboardFrame({ ...base, yawDeg: p.yawDeg, distanceM: p.distanceM }));
  const boxes = frames.map(f => frameBBox(f, W, H));
  const bbox = unionBBox(boxes, W, H);
  const colour = { data: new Uint8ClampedArray(bbox.w * bbox.h * 4), width: bbox.w, height: bbox.h };
  frames.forEach((f, i) => blitOver(colour, bbox, rasteriseBillboard(cut, f, boxes[i], W, H), boxes[i]));

  let opaque = 0;
  for (let i = 3; i < colour.data.length; i += 4) if (colour.data[i] > 200) opaque++;
  assert.ok(opaque > 1000, 'the block must actually draw pixels');
  // Wider than one instance: the row spreads across the ground plane.
  assert.ok(bbox.w > boxes[0].w * 3, 'a row must be wider than a single chair');

  const shadow = rasteriseBlockShadow(frames, bbox, W, H);
  let dark = 0;
  for (let i = 3; i < shadow.data.length; i += 4) if (shadow.data[i] > 8) dark++;
  assert.ok(dark > 0, 'the block must carry a contact shadow');
  // A union, never a sum: no pixel may exceed the configured strength.
  let peak = 0;
  for (let i = 3; i < shadow.data.length; i += 4) peak = Math.max(peak, shadow.data[i]);
  assert.ok(peak <= Math.round(255 * 0.6) + 1, 'overlapping shadows must not compound');
});

// ---------------------------------------------------------------- palettes

test('palette extraction reports dominant colours and their share', () => {
  const cols = [[200, 40, 60], [30, 90, 180], [220, 200, 120]];
  const data = new Uint8ClampedArray(cols.length * 400 * 4);
  let i = 0;
  for (const c of cols) for (let k = 0; k < 400; k++) { data[i++] = c[0]; data[i++] = c[1]; data[i++] = c[2]; data[i++] = 255; }
  const pal = extractPaletteFromPixels(data);
  assert.equal(pal.length, 3);
  assert.ok(pal.every(p => Math.abs(p.share - 1 / 3) < 0.02));
});

test('an unreadable palette returns null coverage, never a fabricated score', () => {
  const r = comparePalettes([], [{ hex: '#fff', rgb: { r: 255, g: 255, b: 255 }, share: 1 }]);
  assert.equal(r.coverage, null);
  assert.equal(r.pairs.length, 0);
});

test('identical palettes score 1, a missed dominant colour costs real weight', () => {
  const mk = cols => {
    const d = new Uint8ClampedArray(cols.length * 400 * 4);
    let i = 0;
    for (const c of cols) for (let k = 0; k < 400; k++) { d[i++] = c[0]; d[i++] = c[1]; d[i++] = c[2]; d[i++] = 255; }
    return extractPaletteFromPixels(d);
  };
  const a = mk([[200, 40, 60], [30, 90, 180], [220, 200, 120]]);
  assert.equal(comparePalettes(a, a).coverage, 1);
  const b = mk([[190, 50, 70], [40, 140, 60], [210, 190, 110]]);
  const r = comparePalettes(a, b);
  assert.equal(r.matched, 2);
  assert.ok(r.coverage > 0.6 && r.coverage < 0.85, `coverage ${r.coverage} should be visibly short of 1`);
});

test('hue arithmetic wraps the short way', () => {
  assert.equal(hueDelta(350, 10), 20);
  assert.equal(hueDelta(10, 350), -20);
  assert.ok(Math.abs(rgbToHsl({ r: 255, g: 0, b: 0 }).h) < 1e-9);
  assert.equal(rgbToHsl({ r: 128, g: 128, b: 128 }).s, 0);
});
