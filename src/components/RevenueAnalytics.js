import { VENUE_ZONES } from '../data/zones.js';
import { getItemById } from '../data/catalog.js';
import { readJSON, formatMoney, formatMoneyShort, formatNumber, escapeHtml } from '../utils/format.js';
import { eventState, todayISO, parseISODate } from '../data/eventState.js';

const BOOKINGS_KEY = 'helm_events_bookings_v2';
const LEGACY_BOOKINGS_KEY = 'helme_events_bookings';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * A documented, clearly-labelled sample book — shown ONLY behind the
 * "Show illustrative sample" control, and every figure is marked SAMPLE.
 * It is never mixed with real bookings.
 */
const SAMPLE_BOOKINGS = [
  { date: '2026-01-18', name: 'Sharma Sangeet', venue: 'Royal Banquet Ballroom' },
  { date: '2026-02-09', name: 'Verma Reception', venue: 'Royal Banquet Ballroom' },
  { date: '2026-03-22', name: 'TechNova Annual Meet', venue: 'Corporate Meeting Hall' },
  { date: '2026-04-11', name: 'Iyer Wedding', venue: 'Main Stage Lawn' },
  { date: '2026-05-30', name: 'Constituency Rally', venue: 'Rally Ground' },
  { date: '2026-08-15', name: 'Kapoor Mehendi', venue: 'Garden Fountain Plaza' },
  { date: '2026-11-20', name: 'Nair Reception', venue: 'Royal Banquet Ballroom' }
];

function token(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

const PIE_TOKENS = ['--accent-indigo', '--accent-emerald', '--accent-gold', '--accent-rose'];
const PIE_FALLBACKS = ['#0a84ff', '#30d158', '#ffd60a', '#ff453a'];

export class RevenueAnalytics {
  constructor(containerElement, activeSelections) {
    this.container = containerElement;
    this.activeSelections = activeSelections || {};
    this.showSample = false;
  }

  updateSelections(activeSelections) {
    this.activeSelections = activeSelections || {};
    if (this.container && this.container.innerHTML) this.render();
  }

  /** Real bookings, migrating the legacy flat map if that is all there is. */
  loadBookings() {
    const stored = readJSON(BOOKINGS_KEY, null);
    if (Array.isArray(stored)) {
      return stored.filter(b => b && parseISODate(b.date));
    }
    const legacy = readJSON(LEGACY_BOOKINGS_KEY, null);
    if (legacy && typeof legacy === 'object' && !Array.isArray(legacy)) {
      return Object.entries(legacy)
        .filter(([date]) => parseISODate(date))
        .map(([date, name]) => ({ date, name: String(name), venue: '' }));
    }
    return [];
  }

  /**
   * Per-event value at the CURRENT configuration. This is a quote figure the
   * app genuinely computes — it is not booked revenue, and it is labelled
   * "estimated" everywhere it appears.
   */
  configuredOrderValue() {
    let total = 0;
    VENUE_ZONES.forEach(zone => {
      zone.slots.forEach(slot => {
        const itemId = this.activeSelections[slot.id] || slot.defaultItemId;
        const item = getItemById(itemId);
        if (!item) return;
        const qty = Number(slot.quantityByItem?.[itemId] ?? slot.quantity ?? 1) || 1;
        total += Math.round(Number(item.price || 0) * qty);
      });
    });
    return total;
  }

  /** Trailing 12 months of booking counts, ending with the current month. */
  monthlySeries(bookings) {
    const now = new Date();
    const series = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      series.push({ key, label: MONTH_SHORT[d.getMonth()], count: 0 });
    }
    const index = new Map(series.map((s, i) => [s.key, i]));
    bookings.forEach(b => {
      const key = String(b.date).slice(0, 7);
      if (index.has(key)) series[index.get(key)].count++;
    });
    return series;
  }

  venueMix(bookings) {
    const map = new Map();
    bookings.forEach(b => {
      const key = (b.venue || '').trim() || 'Unspecified venue';
      map.set(key, (map.get(key) || 0) + 1);
    });
    const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3).reduce((n, [, v]) => n + v, 0);
    if (rest) top.push(['Other venues', rest]);
    return top.map(([label, value], i) => ({
      label,
      value,
      color: token(PIE_TOKENS[i % PIE_TOKENS.length], PIE_FALLBACKS[i % PIE_FALLBACKS.length])
    }));
  }

  render() {
    const real = this.loadBookings();
    const usingSample = this.showSample && real.length === 0;
    const bookings = usingSample ? SAMPLE_BOOKINGS : real;

    if (!bookings.length) {
      this.container.innerHTML = this.emptyStateHtml();
      this.bindSampleToggle();
      return;
    }

    const today = todayISO();
    const upcoming = bookings.filter(b => b.date >= today).length;
    const perEvent = this.configuredOrderValue();
    const pipeline = perEvent * bookings.length;
    const series = this.monthlySeries(bookings);
    const busiest = series.reduce((best, s) => (s.count > best.count ? s : best), series[0]);
    const mix = this.venueMix(bookings);

    const sampleBadge = usingSample
      ? `<div role="status" style="margin-bottom:1rem; padding:.6rem .9rem; border:1px solid var(--accent-gold);
           color:var(--accent-gold); border-radius:var(--radius-sm); font-size:.82rem;">
           ⚠️ SAMPLE DATA — illustrative only. These seven bookings are not real. Book a date in the
           Calendar tab and this page switches to your actual bookings.
           <button class="btn-secondary" id="rev-hide-sample" type="button"
                   style="margin-left:.5rem; font-size:.72rem; padding:.2rem .5rem;">Hide sample</button>
         </div>`
      : '';

    const tag = usingSample ? 'SAMPLE · ' : '';

    this.container.innerHTML = `
      <div class="analytics-wrapper" style="padding:20px; color:var(--text-main);">
        <h2 style="margin-top:0; color:var(--text-main);">📈 Booking &amp; Revenue Analytics</h2>
        <p style="color:var(--text-muted); font-size:.82rem; margin:.25rem 0 1rem;">
          Booking counts are real, read from your calendar. Values are <strong>estimates</strong> priced at the
          current studio configuration (${escapeHtml(formatMoney(perEvent))} per event) — they are quotes, not invoiced revenue.
        </p>
        ${sampleBadge}

        <div style="display:flex; gap:20px; margin-bottom:30px; flex-wrap:wrap;">
          ${this.kpiCard(`${tag}Bookings on record`, formatNumber(bookings.length))}
          ${this.kpiCard(`${tag}Upcoming`, formatNumber(upcoming))}
          ${this.kpiCard(`${tag}Estimated pipeline`, formatMoneyShort(pipeline), formatMoney(pipeline))}
          ${this.kpiCard(`${tag}Busiest month`, busiest && busiest.count ? `${busiest.label} · ${busiest.count}` : '—')}
        </div>

        <div style="display:flex; gap:30px; flex-wrap:wrap;">
          <div style="flex:2; min-width:320px; background:var(--bg-surface); padding:20px;
                      border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
            <h3 style="color:var(--text-main);">${tag}Bookings per month (last 12 months)</h3>
            <canvas id="bar-chart" style="width:100%; display:block;"
                    aria-label="Bar chart of bookings per month"></canvas>
          </div>
          <div style="flex:1; min-width:260px; background:var(--bg-surface); padding:20px;
                      border-radius:var(--radius-md); border:1px solid var(--border-subtle);">
            <h3 style="color:var(--text-main);">${tag}Bookings by venue</h3>
            <canvas id="pie-chart" style="width:100%; display:block;"
                    aria-label="Pie chart of bookings by venue"></canvas>
          </div>
        </div>
      </div>
    `;

    // The canvases exist synchronously here — no setTimeout race.
    this.drawBarChart(series);
    this.drawPieChart(mix);
    this.bindSampleToggle();
  }

  kpiCard(label, value, title = '') {
    return `
      <div style="flex:1; min-width:150px; background:var(--bg-surface); padding:20px; border-radius:var(--radius-md);
                  border:1px solid var(--border-subtle); text-align:center;" ${title ? `title="${escapeHtml(title)}"` : ''}>
        <div style="color:var(--text-muted); font-size:.8rem;">${escapeHtml(label)}</div>
        <div style="font-size:1.4rem; font-weight:700; color:var(--text-main); margin-top:.25rem;">${escapeHtml(value)}</div>
      </div>`;
  }

  emptyStateHtml() {
    const ev = eventState.get();
    return `
      <div class="analytics-wrapper" style="padding:20px; color:var(--text-main);">
        <h2 style="margin-top:0; color:var(--text-main);">📈 Booking &amp; Revenue Analytics</h2>
        <div style="margin-top:1.5rem; padding:2.5rem 1.5rem; text-align:center; border:1px dashed var(--border-strong);
                    border-radius:var(--radius-md); background:var(--bg-surface);">
          <div style="font-size:2rem;">📊</div>
          <h3 style="color:var(--text-main); margin:.5rem 0;">No bookings yet</h3>
          <p style="color:var(--text-muted); max-width:46ch; margin:0 auto 1rem;">
            This page reports on real bookings only. Book a date in the <strong>Calendar</strong> tab for
            ${escapeHtml(ev.eventName)} and the monthly chart, venue mix and pipeline estimate appear here.
          </p>
          <button class="btn-secondary" id="rev-show-sample" type="button">Show illustrative sample</button>
          <p style="color:var(--text-dim); font-size:.75rem; margin-top:.75rem;">
            The sample is clearly marked and is never mixed with your data.
          </p>
        </div>
      </div>`;
  }

  bindSampleToggle() {
    const show = this.container.querySelector('#rev-show-sample');
    if (show) show.addEventListener('click', () => { this.showSample = true; this.render(); });
    const hide = this.container.querySelector('#rev-hide-sample');
    if (hide) hide.addEventListener('click', () => { this.showSample = false; this.render(); });
  }

  /** Size the backing store to CSS pixels × devicePixelRatio so nothing is blurry. */
  prepareCanvas(canvas, cssHeight) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(240, Math.round(canvas.clientWidth || canvas.parentElement.clientWidth || 600));
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { ctx, width: cssWidth, height: cssHeight };
  }

  drawBarChart(series) {
    const canvas = this.container.querySelector('#bar-chart');
    if (!canvas) return;
    const { ctx, width, height } = this.prepareCanvas(canvas, 300);

    const axis = token('--border-strong', 'rgba(255,255,255,0.2)');
    const grid = token('--border-subtle', 'rgba(255,255,255,0.1)');
    const label = token('--text-muted', '#a1a1a6');
    const bar = token('--accent-indigo', '#0a84ff');

    const padLeft = 46;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 34;
    const plotW = Math.max(10, width - padLeft - padRight);
    const plotH = Math.max(10, height - padTop - padBottom);

    // Guard the empty-data path: Math.max(...[]) is -Infinity.
    const counts = series.map(s => s.count);
    const rawMax = counts.length ? Math.max(...counts) : 0;
    const maxVal = Math.max(1, rawMax);
    const ticks = Math.min(5, maxVal);
    const step = Math.max(1, Math.ceil(maxVal / ticks));
    const axisMax = step * Math.ceil(maxVal / step);

    // Y axis ticks + gridlines
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let v = 0; v <= axisMax; v += step) {
      const y = padTop + plotH - (v / axisMax) * plotH;
      ctx.strokeStyle = grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(width - padRight, y);
      ctx.stroke();
      ctx.fillStyle = label;
      ctx.fillText(String(v), padLeft - 8, y);
    }

    ctx.strokeStyle = axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop);
    ctx.lineTo(padLeft, padTop + plotH);
    ctx.lineTo(width - padRight, padTop + plotH);
    ctx.stroke();

    const slot = plotW / series.length;
    const barW = Math.max(4, slot * 0.62);
    ctx.textAlign = 'center';
    series.forEach((s, i) => {
      const h = (s.count / axisMax) * plotH;
      const x = padLeft + i * slot + (slot - barW) / 2;
      const y = padTop + plotH - h;
      if (h > 0) {
        ctx.fillStyle = bar;
        ctx.fillRect(x, y, barW, h);
      }
      ctx.fillStyle = label;
      ctx.textBaseline = 'top';
      ctx.fillText(s.label, x + barW / 2, padTop + plotH + 8);
    });

    ctx.fillStyle = label;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('bookings', padLeft - 40, 2);
  }

  drawPieChart(slices) {
    const canvas = this.container.querySelector('#pie-chart');
    if (!canvas) return;
    const legendRows = slices.length;
    const legendH = 18 * legendRows + 12;
    const { ctx, width, height } = this.prepareCanvas(canvas, 240 + legendH);

    const label = token('--text-muted', '#a1a1a6');
    const total = slices.reduce((n, s) => n + s.value, 0);

    if (!total) {
      ctx.fillStyle = label;
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No bookings to break down yet', width / 2, height / 2);
      return;
    }

    const cx = width / 2;
    const cy = 120;
    const radius = Math.max(20, Math.min(cx, 110) - 10);

    let angle = -Math.PI / 2;
    slices.forEach(s => {
      const sweep = (s.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      angle += sweep;
    });

    // Legend BELOW the pie, never on top of it.
    let ly = cy + radius + 18;
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    slices.forEach(s => {
      ctx.fillStyle = s.color;
      ctx.fillRect(10, ly - 6, 12, 12);
      ctx.fillStyle = label;
      const pct = Math.round((s.value / total) * 100);
      ctx.fillText(`${s.label} — ${s.value} (${pct}%)`, 28, ly);
      ly += 18;
    });
  }
}
