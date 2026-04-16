/**
 * AlphaAI — Utility Formatters
 * Centralised formatting functions so every screen uses the same conventions.
 */

// ─── Price Formatters ─────────────────────────────────────────────────────────

/**
 * Format a raw price to a human‑readable string.
 * - BTC / high-value: 2 decimal places  (≥ 1000)
 * - Mid-tier assets: 4 decimal places   (≥ 1)
 * - Low-value / alts: 6 decimal places  (< 1)
 */
export function formatPrice(price: number): string {
  if (price >= 1_000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (price >= 1)     return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;
  return `$${price.toFixed(6)}`;
}

/**
 * Format a percentage value (+ sign for positives).
 * e.g.  3.14 → "+3.14%"  |  -1.2 → "-1.20%"
 */
export function formatPercent(value: number, decimals = 2): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a PnL value in percentage terms with colour hint.
 * Returns { text, isPositive }
 */
export function formatPnl(pnlPercent: number): { text: string; isPositive: boolean } {
  return {
    text: formatPercent(pnlPercent),
    isPositive: pnlPercent >= 0,
  };
}

/**
 * Compact market-cap / volume display.
 * e.g.  1_230_000_000 → "$1.23B"
 */
export function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9)  return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6)  return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString('en-US')}`;
}

/**
 * Format a distance to a zone.
 * e.g.  1.23 → "1.23% away"
 */
export function formatDistance(distancePct: number): string {
  return `${distancePct.toFixed(2)}% away`;
}

// ─── Risk/Reward Formatters ───────────────────────────────────────────────────

/**
 * Format a risk:reward ratio.
 * e.g.  2.5 → "1:2.5R"
 */
export function formatRR(rr: number): string {
  return `1:${rr.toFixed(1)}R`;
}

/**
 * Calculate and format R:R given entry, stop-loss and take-profit.
 */
export function calcRR(entry: number, sl: number, tp: number): string {
  const risk   = Math.abs(entry - sl);
  const reward = Math.abs(tp - entry);
  if (risk === 0) return '—';
  return formatRR(reward / risk);
}

// ─── Date / Time Formatters ──────────────────────────────────────────────────

/**
 * Relative time string from a Date or ISO string.
 * e.g.  "just now" | "5m ago" | "2h ago" | "3d ago"
 */
export function formatRelativeTime(date: Date | string): string {
  const ms = Date.now() - new Date(date).getTime();
  const s  = Math.floor(ms / 1000);
  if (s < 60)   return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/**
 * Countdown in seconds to a human-readable label.
 * e.g.  90 → "1m 30s"  |  3665 → "1h 1m"
 */
export function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'now';
  if (seconds < 60)   return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Short date for journal entries.
 * e.g.  "Apr 15"  |  "Dec 31"
 */
export function formatShortDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Long date for signal detail.
 * e.g.  "Tuesday, Apr 15 · 10:32 AM"
 */
export function formatLongDate(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Score Formatters ─────────────────────────────────────────────────────────

/**
 * Map a confluence score 0–100 to a quality label.
 */
export function scoreLabel(score: number): string {
  if (score >= 85) return 'Elite';
  if (score >= 75) return 'Strong';
  if (score >= 65) return 'Valid';
  return 'Weak';
}

/**
 * Map a confluence score to a hex colour string.
 * Consumers must pass the Colors object to avoid circular imports.
 */
export function scoreColor(score: number, colors: { bullish: string; approaching: string; textTertiary: string }): string {
  if (score >= 80) return colors.bullish;
  if (score >= 65) return colors.approaching;
  return colors.textTertiary;
}

// ─── String Helpers ───────────────────────────────────────────────────────────

/**
 * Truncate a long string with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  return str.length > maxLength ? `${str.slice(0, maxLength - 1)}…` : str;
}
