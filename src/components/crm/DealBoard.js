/**
 * DealBoard.js — the pipeline, as TWO chained pipelines on one board.
 *
 * An event business does not have one funnel. It has a sales funnel owned by
 * the salesperson (enquiry → negotiation → won) and a production pipeline
 * owned by the event manager (booked → planning → in production → live →
 * delivered → settled). Cramming both into one dropdown — which is what most
 * tools do — means "won" and "delivered" compete for the same column and
 * nobody can answer either "what will we sell" or "what must we deliver".
 *
 * So: `phase` splits the board into two swimlanes, and the two lanes show
 * different numbers. Sales shows WEIGHTED value, because a deal at 40% is not
 * revenue. Production shows COLLECTED against contract, because a won deal's
 * only remaining question is whether the money arrives.
 *
 * Moving a deal: drag it, or focus a card and use the move control — every
 * stage change is reachable from the keyboard, because drag-and-drop alone is
 * an accessibility dead end.
 */

import { crmStore } from '../../crm/store.js';
import { dealFinancials } from '../../crm/finance.js';
import { SALES_STAGES, PRODUCTION_STAGES, CLOSED_STAGES, stageLabel } from '../../crm/schema.js';
import { injectCrmStyles } from './crmStyles.js';
import {
  formatMoney, formatMoneyShort, escapeHtml, chip, kpi, emptyState, dateRangeLabel, relativeDays
} from './shared.js';

export class DealBoard {
  /** @param {HTMLElement} container @param {(clientId:string)=>void} onOpenClient */
  constructor(container, onOpenClient = null) {
    injectCrmStyles();
    this.container = container;
    this.onOpenClient = onOpenClient;
    this.categoryFilter = 'all';
    this.dragDealId = null;
    this.unsubscribe = crmStore.subscribe(() => this.render());
    this.render();
  }

  destroy() {
    if (this.unsubscribe) this.unsubscribe();
  }

  data() {
    const snapshot = crmStore.get();
    const clientById = new Map(snapshot.clients.map(c => [c.id, c]));
    return snapshot.deals
      .filter(d => this.categoryFilter === 'all' || d.category === this.categoryFilter)
      .map(deal => ({
        deal,
        client: clientById.get(deal.clientId) || null,
        fin: dealFinancials(deal, clientById.get(deal.clientId) || null, snapshot.milestones, snapshot.receipts, snapshot.invoices)
      }));
  }

  render() {
    if (!this.container) return;
    const rows = this.data();
    const sales = rows.filter(r => r.deal.phase === 'sales');
    const production = rows.filter(r => r.deal.phase === 'production');
    const closed = rows.filter(r => r.deal.phase === 'closed');

    const weighted = sales.reduce((a, r) => a + r.fin.weightedValue, 0);
    const openValue = sales.reduce((a, r) => a + r.fin.net, 0);
    const bookValue = production.reduce((a, r) => a + r.fin.contractGross, 0);
    const collected = production.reduce((a, r) => a + r.fin.settledValue, 0);
    const cancelled = closed.filter(r => r.deal.stage === 'cancelled');

    this.container.innerHTML = `
      <section class="crm" aria-labelledby="crm-board-title">
        <header class="crm-head">
          <div>
            <h2 class="crm-title" id="crm-board-title">Pipeline</h2>
            <p class="crm-sub">Two pipelines, chained. Sales runs enquiry → won and is weighted by stage. Production runs booked → settled and is measured in money collected.</p>
          </div>
          <div class="crm-toolbar">
            <label for="crm-board-cat" class="crm-kpi-label">Category</label>
            <select id="crm-board-cat" class="crm-select" aria-label="Filter pipeline by event category">
              ${['all', 'wedding', 'corporate', 'political', 'exhibition', 'concert', 'private'].map(c =>
                `<option value="${c}"${this.categoryFilter === c ? ' selected' : ''}>${c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
            </select>
          </div>
        </header>

        <div class="crm-kpis">
          ${kpi({ label: 'Open pipeline', value: formatMoneyShort(openValue), note: `${sales.length} deal${sales.length === 1 ? '' : 's'} in sales` })}
          ${kpi({ label: 'Weighted', value: formatMoneyShort(weighted), note: 'by stage probability' })}
          ${kpi({ label: 'Order book', value: formatMoneyShort(bookValue), note: `${production.length} in production, incl. GST` })}
          ${kpi({ label: 'Collected', value: formatMoneyShort(collected), note: 'bank + TDS withheld', tone: 'good' })}
          ${kpi({ label: 'Cancelled', value: String(cancelled.length), note: cancelled.length ? 'booked then cancelled — money already in' : 'none', tone: cancelled.length ? 'warn' : '' })}
        </div>

        ${rows.length === 0 ? emptyState({
          title: 'Nothing in the pipeline',
          body: 'Every event starts as an enquiry against a client. Add one and it appears in the sales lane, where it stays until the advance lands.'
        }) : `
          ${this.lane('sales', 'Sales — owned by the salesperson', SALES_STAGES, sales, 'weighted')}
          ${this.lane('production', 'Production — owned by the event manager', PRODUCTION_STAGES, production, 'collected')}
          ${this.lane('closed', 'Closed', CLOSED_STAGES.filter(s => s.id !== 'won'), closed, 'plain')}
        `}

        <p class="crm-note">Cancelled is deliberately not the same column as Lost. A lost deal never had money; a cancelled one was booked, took an advance and committed vendors, so somebody still has to decide what is retained and what is refunded.</p>
      </section>`;

    this.bind();
  }

  lane(phase, title, stages, rows, mode) {
    const total = rows.reduce((a, r) => a + (mode === 'weighted' ? r.fin.weightedValue : r.fin.contractGross), 0);
    return `
      <div class="crm-lane">
        <div class="crm-lane-head">
          <h3>${escapeHtml(title)}</h3>
          <span class="crm-col-meta">${rows.length} deal${rows.length === 1 ? '' : 's'} · ${formatMoneyShort(total)}${mode === 'weighted' ? ' weighted' : ''}</span>
        </div>
        <div class="crm-board" role="list" aria-label="${escapeHtml(title)}">
          ${stages.map(stage => {
            const inStage = rows.filter(r => r.deal.stage === stage.id);
            const value = inStage.reduce((a, r) => a + r.fin.net, 0);
            return `
              <div class="crm-col" role="listitem" data-stage="${escapeHtml(stage.id)}" data-phase="${escapeHtml(phase)}">
                <div class="crm-col-head">
                  <span class="crm-col-name">${escapeHtml(stage.label)}</span>
                  <span class="crm-col-meta">${inStage.length} · ${formatMoneyShort(value)}${phase === 'sales' ? ` · ${stage.probability}%` : ''}</span>
                </div>
                ${inStage.length === 0
                  ? '<p class="crm-deal-client">Empty</p>'
                  : inStage.map(r => this.card(r, phase)).join('')}
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  card({ deal, client, fin }, phase) {
    const late = fin.overdue > 0;
    const soon = fin.nextDue && fin.nextDue.daysUntil >= 0 && fin.nextDue.daysUntil <= 14;
    return `
      <div class="crm-deal" draggable="true" data-deal="${escapeHtml(deal.id)}">
        <div class="crm-deal-title">${escapeHtml(deal.title)}</div>
        <button class="crm-link crm-deal-client" type="button" data-client="${escapeHtml(deal.clientId)}">${escapeHtml(client?.name || 'Unknown client')}</button>
        <div class="crm-deal-client">${escapeHtml(dateRangeLabel(deal))}</div>
        <div class="crm-deal-row">
          <span class="crm-deal-value">${fin.net > 0 ? formatMoney(fin.net) : 'Not quoted'}</span>
          ${phase === 'sales'
            ? chip(`${deal.probability}% · ${formatMoneyShort(fin.weightedValue)}`, 'info')
            : chip(`${fin.collectionPct}% collected`, fin.collectionPct >= 100 ? 'good' : 'warn')}
        </div>
        ${late ? `<div class="crm-deal-row">${chip(`${formatMoneyShort(fin.overdue)} overdue`, 'danger')}</div>`
              : soon ? `<div class="crm-deal-row">${chip(`${escapeHtml(fin.nextDue.label)} ${relativeDays(fin.nextDue.daysUntil)}`, 'warn')}</div>` : ''}
        <div class="crm-deal-row">
          <label class="crm-kpi-label" for="mv-${escapeHtml(deal.id)}">Move to</label>
          <select class="crm-select" id="mv-${escapeHtml(deal.id)}" data-move="${escapeHtml(deal.id)}" aria-label="Move ${escapeHtml(deal.title)} to another stage">
            ${[...SALES_STAGES, ...PRODUCTION_STAGES, ...CLOSED_STAGES].map(s =>
              `<option value="${s.id}"${s.id === deal.stage ? ' selected' : ''}>${escapeHtml(s.label)}</option>`).join('')}
          </select>
        </div>
      </div>`;
  }

  bind() {
    const cat = this.container.querySelector('#crm-board-cat');
    if (cat) cat.addEventListener('change', (e) => { this.categoryFilter = e.target.value; this.render(); });

    this.container.querySelectorAll('[data-client]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof this.onOpenClient === 'function') this.onOpenClient(btn.dataset.client);
      });
    });

    // Keyboard and assistive-tech path. This is the PRIMARY path, not a fallback.
    this.container.querySelectorAll('[data-move]').forEach(select => {
      select.addEventListener('change', (e) => {
        crmStore.moveStage(select.dataset.move, e.target.value, { note: 'Moved on the board' });
      });
    });

    this.container.querySelectorAll('.crm-deal[draggable="true"]').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        this.dragDealId = card.dataset.deal;
        card.dataset.dragging = 'true';
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', card.dataset.deal);
        }
      });
      card.addEventListener('dragend', () => {
        delete card.dataset.dragging;
        this.dragDealId = null;
      });
    });

    this.container.querySelectorAll('.crm-col').forEach(col => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        col.dataset.dropping = 'true';
      });
      col.addEventListener('dragleave', () => { delete col.dataset.dropping; });
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        delete col.dataset.dropping;
        const dealId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this.dragDealId;
        if (!dealId) return;
        crmStore.moveStage(dealId, col.dataset.stage, { note: `Dragged to ${stageLabel(col.dataset.stage)}` });
      });
    });
  }
}

export default DealBoard;
