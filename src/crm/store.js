/**
 * store.js — the CRM's observable store.
 *
 * Conventions deliberately copied from src/data/eventState.js, which is the
 * house pattern: ONE versioned localStorage key, readJSON/writeJSON so a
 * corrupt value or a full quota can never take the app down, a read-only
 * `get()` snapshot, and `subscribe(fn)` returning an unsubscribe function that
 * callers MUST invoke on teardown.
 *
 * What is stored: clients, deals, functions, milestones, receipts, invoices,
 * vendor payouts, activity. What is NOT stored: a single derived rupee. Every
 * total on every screen comes from finance.js at read time. There is no cached
 * balance in here to go stale.
 *
 * There is also no parallel cash ledger and there never will be. Cash receipts
 * are legal and are recorded like any other receipt via the `mode` field; a
 * second set of books is not a feature, it is a liability.
 */

import { readJSON, writeJSON } from '../utils/format.js';
import { todayISO } from '../data/eventState.js';
import {
  makeClient, makeDeal, makeMilestone, makeReceipt, makeInvoice, makeVendorPayout,
  phaseForStage, probabilityForStage, templateById, defaultTemplateFor, makeId
} from './schema.js';
import { buildMilestones } from './finance.js';
import { seedCrm } from './seed.js';

export const CRM_STORE_KEY = 'helm_crm_v1';

const EMPTY = Object.freeze({
  version: 1,
  clients: [], deals: [], milestones: [], receipts: [], invoices: [],
  vendorPayouts: [], activity: [],
  counters: { client: 0, deal: 0, receipt: 0, invoice: 0 }
});

const COLLECTIONS = ['clients', 'deals', 'milestones', 'receipts', 'invoices', 'vendorPayouts', 'activity'];

function sanitize(raw) {
  const base = {
    version: 1,
    clients: [], deals: [], milestones: [], receipts: [], invoices: [],
    vendorPayouts: [], activity: [],
    counters: { ...EMPTY.counters }
  };
  if (!raw || typeof raw !== 'object') return base;
  COLLECTIONS.forEach(key => {
    if (Array.isArray(raw[key])) base[key] = raw[key].filter(r => r && typeof r === 'object');
  });
  if (raw.counters && typeof raw.counters === 'object') {
    Object.keys(base.counters).forEach(k => {
      const n = Math.max(0, Math.round(Number(raw.counters[k])));
      if (Number.isFinite(n)) base.counters[k] = n;
    });
  }
  // Normalise every record through its factory, so a record written by an
  // older build can never reach a screen missing a field it reads.
  base.clients = base.clients.map(c => makeClient(c));
  base.deals = base.deals.map(d => {
    const deal = makeDeal(d);
    deal.phase = phaseForStage(deal.stage);
    deal.probability = probabilityForStage(deal.stage);
    return deal;
  });
  base.milestones = base.milestones.map(m => makeMilestone(m));
  base.receipts = base.receipts.map(r => makeReceipt(r));
  base.invoices = base.invoices.map(i => makeInvoice(i));
  base.vendorPayouts = base.vendorPayouts.map(v => makeVendorPayout(v));
  return base;
}

/** Financial-year label for document numbering: 2026-09 → "26-27". */
export function fyLabel(iso = todayISO()) {
  const [y, m] = String(iso).split('-').map(Number);
  const startYear = m >= 4 ? y : y - 1;
  return `${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;
}

class CrmStore {
  constructor() {
    const stored = readJSON(CRM_STORE_KEY, null);
    this.state = sanitize(stored);
    if (!stored || this.state.clients.length === 0) {
      // First run: a store with no clients is an unusable demo and an
      // unreadable screenshot. Seed it, then persist so it is stable.
      this.state = sanitize(seedCrm());
      this.persist();
    }
    this.listeners = new Set();
  }

  // ------------------------------------------------------------- reads

  /** Shallow read-only snapshot. Mutating it does nothing to the store. */
  get() {
    return {
      ...this.state,
      clients: [...this.state.clients],
      deals: [...this.state.deals],
      milestones: [...this.state.milestones],
      receipts: [...this.state.receipts],
      invoices: [...this.state.invoices],
      vendorPayouts: [...this.state.vendorPayouts],
      activity: [...this.state.activity]
    };
  }

  clients() { return [...this.state.clients]; }
  deals() { return [...this.state.deals]; }
  milestones() { return [...this.state.milestones]; }
  receipts() { return [...this.state.receipts]; }
  invoices() { return [...this.state.invoices]; }
  vendorPayouts() { return [...this.state.vendorPayouts]; }

  client(id) { return this.state.clients.find(c => c.id === id) || null; }
  deal(id) { return this.state.deals.find(d => d.id === id) || null; }
  dealsForClient(clientId) { return this.state.deals.filter(d => d.clientId === clientId); }
  milestonesForDeal(dealId) {
    return this.state.milestones.filter(m => m.dealId === dealId)
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  }
  receiptsForDeal(dealId) { return this.state.receipts.filter(r => r.dealId === dealId); }
  receiptsForClient(clientId) { return this.state.receipts.filter(r => r.clientId === clientId); }
  activityForClient(clientId) {
    const dealIds = new Set(this.dealsForClient(clientId).map(d => d.id));
    return this.state.activity
      .filter(a => a.clientId === clientId || dealIds.has(a.dealId))
      .sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }

  // ------------------------------------------------------------ writes

  nextCode(kind) {
    const n = (this.state.counters[kind] || 0) + 1;
    this.state.counters[kind] = n;
    const pad = String(n).padStart(4, '0');
    if (kind === 'client') return `CL-${pad}`;
    if (kind === 'deal') return `EV-${new Date().getFullYear()}-${pad}`;
    if (kind === 'receipt') return `RCP-${fyLabel()}-${pad}`;
    return `HLM/${fyLabel()}/${pad}`;
  }

  addClient(patch) {
    const client = makeClient(patch);
    client.code = client.code || this.nextCode('client');
    client.createdAt = client.createdAt || todayISO();
    client.updatedAt = client.createdAt;
    this.state.clients = [...this.state.clients, client];
    this.log({ clientId: client.id, type: 'client_created', text: `Client ${client.name} added — source: ${client.source || 'unrecorded'}` });
    this.commit(['clients']);
    return client;
  }

  updateClient(id, patch) {
    let updated = null;
    this.state.clients = this.state.clients.map(c => {
      if (c.id !== id) return c;
      updated = makeClient({ ...c, ...patch, id: c.id, code: c.code, createdAt: c.createdAt });
      updated.updatedAt = todayISO();
      return updated;
    });
    if (updated) this.commit(['clients']);
    return updated;
  }

  /**
   * Create a deal and, unless told otherwise, lay its payment schedule down
   * from the segment template straight away. A booked event with no schedule
   * is how a balance goes uncollected.
   */
  addDeal(patch, { templateId = null, withSchedule = true } = {}) {
    const deal = makeDeal(patch);
    deal.code = deal.code || this.nextCode('deal');
    deal.createdAt = deal.createdAt || todayISO();
    deal.updatedAt = deal.createdAt;
    deal.phase = phaseForStage(deal.stage);
    deal.probability = probabilityForStage(deal.stage);
    if (!deal.stageHistory.length) {
      deal.stageHistory = [{ stage: deal.stage, at: deal.createdAt, note: 'Created' }];
    }
    const template = templateById(templateId) || templateById(deal.milestoneTemplateId) || defaultTemplateFor(deal.category);
    deal.milestoneTemplateId = template ? template.id : '';
    this.state.deals = [...this.state.deals, deal];
    if (withSchedule && template) this.applyTemplate(deal.id, template.id, { silent: true });
    this.log({ clientId: deal.clientId, dealId: deal.id, type: 'deal_created', text: `${deal.title} created at ${deal.stage}` });
    this.commit(['deals', 'milestones']);
    return deal;
  }

  updateDeal(id, patch) {
    let updated = null;
    this.state.deals = this.state.deals.map(d => {
      if (d.id !== id) return d;
      updated = makeDeal({ ...d, ...patch, id: d.id, code: d.code, createdAt: d.createdAt });
      updated.phase = phaseForStage(updated.stage);
      updated.probability = probabilityForStage(updated.stage);
      updated.updatedAt = todayISO();
      return updated;
    });
    if (updated) this.commit(['deals']);
    return updated;
  }

  /**
   * Move a deal between stages. `cancelled` is kept distinct from `lost`
   * precisely because a cancellation has money attached — the advance is
   * already in, vendors are already committed, and somebody has to decide
   * what is retained. Collapsing the two loses that decision.
   */
  moveStage(dealId, stage, { note = '', lostReason = null } = {}) {
    const deal = this.deal(dealId);
    if (!deal || deal.stage === stage) return deal;
    const at = todayISO();
    const patch = {
      stage,
      stageChangedAt: at,
      stageHistory: [...deal.stageHistory, { stage, at, note }],
      lostReason: (stage === 'lost' || stage === 'dropped' || stage === 'cancelled') ? (lostReason || deal.lostReason) : null
    };
    // Winning a deal starts the clock on the production pipeline.
    if (stage === 'won') { patch.stage = 'booked'; patch.bookedAt = at; }
    const updated = this.updateDeal(dealId, patch);
    this.log({
      clientId: deal.clientId, dealId, type: 'stage_changed',
      text: `Stage → ${patch.stage}${note ? ` · ${note}` : ''}`
    });
    this.commit(['deals', 'activity']);
    return updated;
  }

  /** Replace a deal's payment schedule from a segment template. */
  applyTemplate(dealId, templateId, { silent = false } = {}) {
    const deal = this.deal(dealId);
    const template = templateById(templateId);
    if (!deal || !template) return [];
    const net = Math.max(0, (Number(deal.quotedValue) || 0) - (Number(deal.discount) || 0));
    const rows = buildMilestones(template, deal, net);
    // Drop only the untouched milestones — one with a receipt against it is
    // history, and history is not regenerated.
    const allocated = new Set(this.state.receipts.flatMap(r => (r.allocations || []).map(a => a.milestoneId)));
    const kept = this.state.milestones.filter(m => m.dealId !== dealId || allocated.has(m.id));
    const fresh = rows.map(r => makeMilestone({ ...r, dealId }));
    this.state.milestones = [...kept, ...fresh];
    this.state.deals = this.state.deals.map(d => (d.id === dealId ? { ...d, milestoneTemplateId: template.id } : d));
    if (!silent) {
      this.log({ clientId: deal.clientId, dealId, type: 'schedule_set', text: `Payment schedule: ${template.label}` });
      this.commit(['milestones', 'deals']);
    }
    return fresh;
  }

  addMilestone(patch) {
    const milestone = makeMilestone(patch);
    this.state.milestones = [...this.state.milestones, milestone];
    this.commit(['milestones']);
    return milestone;
  }

  updateMilestone(id, patch) {
    this.state.milestones = this.state.milestones.map(m => (m.id === id ? makeMilestone({ ...m, ...patch, id: m.id }) : m));
    this.commit(['milestones']);
    return this.state.milestones.find(m => m.id === id) || null;
  }

  /**
   * Record money actually received. `tdsDeducted` is the amount the client
   * withheld and paid to the government on our behalf — it settles the
   * milestone exactly as the bank credit does, and finance.js treats it that
   * way. Recording it as a shortfall is the bug this whole module exists to
   * avoid.
   */
  addReceipt(patch) {
    const receipt = makeReceipt(patch);
    receipt.receiptNo = receipt.receiptNo || this.nextCode('receipt');
    receipt.receivedOn = receipt.receivedOn || todayISO();
    // An unallocated receipt lands on the oldest unpaid milestone rather than
    // floating free, because an unallocated receipt is invisible on every screen.
    if (!receipt.allocations.length && receipt.dealId) {
      const open = this.milestonesForDeal(receipt.dealId);
      if (open.length) {
        receipt.allocations = [{ milestoneId: open[0].id, amount: receipt.amount, tds: receipt.tdsDeducted }];
      }
    }
    this.state.receipts = [...this.state.receipts, receipt];
    this.log({
      clientId: receipt.clientId, dealId: receipt.dealId, type: 'receipt',
      text: `Receipt ${receipt.receiptNo} — ${receipt.mode.toUpperCase()}${receipt.tdsDeducted ? ` (TDS ${receipt.tdsSection || ''} withheld)` : ''}`,
      amount: receipt.amount
    });
    this.commit(['receipts', 'activity']);
    return receipt;
  }

  addInvoice(patch) {
    const invoice = makeInvoice(patch);
    invoice.invoiceNo = invoice.invoiceNo || this.nextCode('invoice');
    invoice.issueDate = invoice.issueDate || todayISO();
    this.state.invoices = [...this.state.invoices, invoice];
    this.log({ clientId: invoice.clientId, dealId: invoice.dealId, type: 'invoice', text: `${invoice.type === 'proforma' ? 'Proforma' : 'Tax invoice'} ${invoice.invoiceNo} issued` });
    this.commit(['invoices', 'activity']);
    return invoice;
  }

  addVendorPayout(patch) {
    const payout = makeVendorPayout(patch);
    this.state.vendorPayouts = [...this.state.vendorPayouts, payout];
    this.commit(['vendorPayouts']);
    return payout;
  }

  addNote(target, text) {
    const note = { id: makeId('nt'), text: String(text || '').trim(), at: todayISO() };
    if (!note.text) return null;
    this.log({ ...target, type: 'note', text: note.text });
    this.commit(['activity']);
    return note;
  }

  /** Append to the activity trail. Not tamper-proof; it is a working log. */
  log(entry) {
    this.state.activity = [
      ...this.state.activity,
      { id: makeId('ac'), at: todayISO(), clientId: '', dealId: '', type: 'note', text: '', ...entry }
    ];
  }

  /** Wipe and re-seed. Used by "Reset demo data". */
  resetToSeed() {
    this.state = sanitize(seedCrm());
    this.commit(COLLECTIONS);
    return this.get();
  }

  persist() {
    writeJSON(CRM_STORE_KEY, this.state);
  }

  commit(changedKeys = []) {
    this.persist();
    this.notify(changedKeys);
  }

  /** `fn(snapshot, changedKeys)`. Returns an unsubscribe — call it on teardown. */
  subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(changedKeys) {
    const snapshot = this.get();
    this.listeners.forEach(fn => {
      // One bad subscriber must never stop the others.
      try { fn(snapshot, changedKeys); } catch { /* ignore */ }
    });
  }
}

/** The app-wide singleton. Import this, not the class. */
export const crmStore = new CrmStore();

export default crmStore;
