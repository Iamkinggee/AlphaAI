/**
 * Builds a compact text block of current signals for the AI (Groq) system context.
 */
import type { Signal } from '@/src/types';

export function buildSignalsAppContext(signals: Signal[]): string {
  if (!signals.length) {
    return 'Signals feed: empty or not loaded yet. Suggest the user open the Signals tab to refresh if they expect live setups.';
  }
  const lines = signals.slice(0, 15).map((s) => {
    const ez = `${s.entryZone.lowFormatted}–${s.entryZone.highFormatted}`;
    return (
      `${s.pair} ${s.direction} | ${s.status} | ${s.timeframe} | score ${s.score}\n` +
      `  entry ${ez} | SL ${s.stopLossFormatted} | TP1 ${s.takeProfit1.priceFormatted} (${s.takeProfit1.rr}) | TP2 ${s.takeProfit2.priceFormatted} | TP3 ${s.takeProfit3.priceFormatted}\n` +
      `  setup: ${s.setupType}`
    );
  });
  return `Current signals from the user's AlphaAI app (verify prices on the chart):\n${lines.join('\n\n')}`;
}
