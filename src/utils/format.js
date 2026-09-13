/**
 * Shared formatting helpers — single source of truth for money and numbers.
 *
 * Helm Events prices are stored as INTEGER RUPEES everywhere. Never store
 * paise, never store floats. Format only at the point of display.
 */

export const CURRENCY = { code: 'INR', symbol: '₹', locale: 'en-IN' };

/**
 * Format an amount in rupees using Indian digit grouping (lakh/crore).
 * 2301590 -> "₹23,01,590"
 */
export function formatMoney(amount, { symbol = true, decimals = 0 } = {}) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return symbol ? `${CURRENCY.symbol}0` : '0';
  const body = n.toLocaleString(CURRENCY.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return symbol ? `${CURRENCY.symbol}${body}` : body;
}

/**
 * Compact Indian-style short form for dashboards and badges.
 * 2301590 -> "₹23.0L"   45000000 -> "₹4.5Cr"   85000 -> "₹85,000"
 */
export function formatMoneyShort(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return `${CURRENCY.symbol}0`;
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${CURRENCY.symbol}${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${CURRENCY.symbol}${(n / 1e5).toFixed(1)}L`;
  return formatMoney(n);
}

/** Indian grouping for plain counts: 120000 -> "1,20,000" */
export function formatNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString(CURRENCY.locale);
}

/**
 * Sum line items the same way every screen must sum them: round each line
 * once, then add. Prevents the "lines don't match the subtotal" class of bug.
 */
export function sumLines(lines) {
  return lines.reduce((total, line) => {
    const unit = Number(line.unitPrice ?? line.price ?? 0);
    const qty = Number(line.quantity ?? line.qty ?? 1);
    if (!Number.isFinite(unit) || !Number.isFinite(qty)) return total;
    return total + Math.round(unit * qty);
  }, 0);
}

/** GST split. Intra-state (same state as the seller) splits CGST/SGST; otherwise IGST. */
export const SELLER_STATE = 'Telangana';
export const GST_RATE = 0.18;

export function computeGst(taxableAmount, buyerState = SELLER_STATE) {
  const base = Math.max(0, Math.round(Number(taxableAmount) || 0));
  const total = Math.round(base * GST_RATE);
  const intraState = String(buyerState).trim().toLowerCase() === SELLER_STATE.toLowerCase();
  if (intraState) {
    const half = Math.round(total / 2);
    // Give any odd rupee to CGST so the halves always re-sum to `total`.
    return { intraState, cgst: total - half, sgst: half, igst: 0, total };
  }
  return { intraState, cgst: 0, sgst: 0, igst: total, total };
}

/** Safe localStorage read — a corrupt value must never take the app down. */
export function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* storage unavailable */ }
    return fallback;
  }
}

/** Safe localStorage write — quota errors must never take the app down. */
export function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Escape untrusted text before putting it into an innerHTML template. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
