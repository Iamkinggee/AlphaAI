/**
 * AlphaAI Backend — Signal Lifecycle Manager
 * Monitors active signals for:
 *  - TP1 / TP2 / TP3 hits (partial close opportunities)
 *  - Stop loss invalidation
 *  - Expiry (48h default TTL)
 *  - Trailing stop calculation
 *
 * Runs every 30 seconds, triggered by live price feed.
 */
import { getSupabaseClient } from './supabaseClient';
import { broadcastActivated, broadcastAll } from './wsServerManager';

export type SignalStatus =
  | 'approaching'
  | 'active'
  | 'TP1_hit'
  | 'TP2_hit'
  | 'TP3_hit'
  | 'stopped'
  | 'expired';

interface LiveSignal {
  id: string;
  pair: string;
  direction: 'LONG' | 'SHORT';
  status: SignalStatus;
  entry_zone_low: number;
  entry_zone_high: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  take_profit_3: number;
  expires_at: string;
  activated_at: string | null;
}

let monitorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the lifecycle monitor.
 * @param getPrices - callback returning current live prices from the price feed
 */
export function startLifecycleMonitor(getPrices: () => Record<string, number>): void {
  if (monitorInterval) return;
  monitorInterval = setInterval(() => {
    checkSignalLifecycle(getPrices()).catch((err) =>
      console.error('[Lifecycle] Error:', err)
    );
  }, 30_000);
  console.log('⏱️  [Lifecycle] Monitor started (30s interval)');
}

export function stopLifecycleMonitor(): void {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  console.log('⏱️  [Lifecycle] Monitor stopped');
}

async function checkSignalLifecycle(prices: Record<string, number>): Promise<void> {
  const db = getSupabaseClient();
  const now = new Date().toISOString();

  // Load all active / approaching signals
  const { data: signals } = await db
    .from('signals')
    .select('*')
    .in('status', ['approaching', 'active', 'TP1_hit', 'TP2_hit'])
    .returns<LiveSignal[]>();

  if (!signals?.length) return;

  for (const signal of signals) {
    const currentPrice = prices[signal.pair];
    if (!currentPrice) continue;

    const newStatus = evaluateSignal(signal, currentPrice, now);
    if (newStatus && newStatus !== signal.status) {
      await db.from('signals').update({
        status: newStatus,
        updated_at: now,
        ...(newStatus === 'stopped' || newStatus === 'expired' ? { resolved_at: now } : {}),
      }).eq('id', signal.id);

      console.log(`📊 [Lifecycle] ${signal.pair} ${signal.status} → ${newStatus} @ $${currentPrice}`);

      // Broadcast to all connected clients
      broadcastAll({
        type: newStatus === 'stopped' ? 'signal_stopped' : 'signal_tp_hit',
        timestamp: Date.now(),
        data: { signalId: signal.id, pair: signal.pair, status: newStatus, price: currentPrice },
      });

      // Insert notification
      await db.from('notifications').insert({
        type: mapStatusToNotifType(newStatus),
        priority: newStatus === 'stopped' ? 'high' : 'critical',
        title: buildNotifTitle(signal.pair, newStatus, currentPrice),
        body: buildNotifBody(signal, newStatus, currentPrice),
        pair: signal.pair,
        signal_id: signal.id,
      });
    }
  }
}

function evaluateSignal(signal: LiveSignal, price: number, now: string): SignalStatus | null {
  const { direction, stop_loss, take_profit_1, take_profit_2, take_profit_3, expires_at, status } = signal;
  const isLong = direction === 'LONG';

  // 1. Expiry check
  if (new Date(expires_at) < new Date(now)) return 'expired';

  // 2. Stop loss hit
  const slHit = isLong ? price <= stop_loss : price >= stop_loss;
  if (slHit) return 'stopped';

  // 3. TP progression
  if (status === 'active' || status === 'approaching') {
    const tp1Hit = isLong ? price >= take_profit_1 : price <= take_profit_1;
    if (tp1Hit) return 'TP1_hit';
  }
  if (status === 'TP1_hit') {
    const tp2Hit = isLong ? price >= take_profit_2 : price <= take_profit_2;
    if (tp2Hit) return 'TP2_hit';
  }
  if (status === 'TP2_hit') {
    const tp3Hit = isLong ? price >= take_profit_3 : price <= take_profit_3;
    if (tp3Hit) return 'TP3_hit';
  }

  return null; // No change
}

function mapStatusToNotifType(status: SignalStatus): string {
  if (status === 'stopped') return 'stopped';
  if (status === 'expired') return 'expired';
  return 'tp_hit';
}

function buildNotifTitle(pair: string, status: SignalStatus, price: number): string {
  const priceStr = `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  switch (status) {
    case 'TP1_hit': return `${pair} — TP1 Hit ✅`;
    case 'TP2_hit': return `${pair} — TP2 Hit 🎯`;
    case 'TP3_hit': return `${pair} — TP3 Hit 🏆`;
    case 'stopped': return `${pair} — Stopped Out ❌`;
    case 'expired': return `${pair} — Signal Expired`;
    default:        return `${pair} — Status: ${status}`;
  }
}

function buildNotifBody(signal: LiveSignal, status: SignalStatus, price: number): string {
  const priceStr = `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  switch (status) {
    case 'TP1_hit': return `TP1 reached at ${priceStr}. Consider securing partial profits. Trail stop to break-even.`;
    case 'TP2_hit': return `TP2 reached at ${priceStr}. Excellent R:R achieved. Trail stop to TP1.`;
    case 'TP3_hit': return `Full target hit at ${priceStr}. Outstanding trade — review entry in journal.`;
    case 'stopped': return `Price hit stop loss at ${priceStr}. ${signal.direction} bias invalidated. Review structure.`;
    case 'expired': return `Signal expired without activation after 48h. Zone may still be valid — re-scan recommended.`;
    default:        return `Signal status updated to ${status}.`;
  }
}
