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
import { sendPushToAllDevices } from './pushNotificationService';

export type SignalStatus =
  | 'approaching'
  | 'active'
  | 'TP1_hit'
  | 'TP2_hit'
  | 'TP3_hit'
  | 'stopped'
  | 'expired';

interface LiveSignalRow {
  id:              string;
  pair:            string;
  timeframe?:      string;
  direction:       'LONG' | 'SHORT';
  status:          SignalStatus;
  // Support BOTH column name conventions used across migrations
  entry_zone_low?:  number; entry_low?:  number;
  entry_zone_high?: number; entry_high?: number;
  stop_loss:        number;
  // Supabase may return either take_profit1 or take_profit_1 depending on migration
  take_profit1?:  number; take_profit_1?:  number;
  take_profit2?:  number; take_profit_2?:  number;
  take_profit3?:  number; take_profit_3?:  number;
  expires_at:      string;
  stale_after?:    string | null;
  activated_at:    string | null;
  detected_at?:    string | null;
  regime_tag?:     string | null;
  quality_band?:   string | null;
}

// Normalise the raw DB row into a clean LiveSignal shape.
interface LiveSignal {
  id:             string;
  pair:           string;
  timeframe:      string;
  direction:      'LONG' | 'SHORT';
  status:         SignalStatus;
  entryLow:       number;
  entryHigh:      number;
  stopLoss:       number;
  takeProfit1:    number;
  takeProfit2:    number;
  takeProfit3:    number;
  expiresAt:      string;
  staleAfter:     string | null;
  activatedAt:    string | null;
  detectedAt:     string | null;
  regimeTag:      string | null;
  qualityBand:    string | null;
}

function normaliseRow(r: LiveSignalRow): LiveSignal {
  return {
    id:          r.id,
    pair:        r.pair,
    timeframe:   r.timeframe ?? '4H',
    direction:   r.direction,
    status:      r.status,
    entryLow:    r.entry_zone_low  ?? r.entry_low  ?? 0,
    entryHigh:   r.entry_zone_high ?? r.entry_high ?? 0,
    stopLoss:    r.stop_loss,
    takeProfit1: r.take_profit1 ?? r.take_profit_1 ?? 0,
    takeProfit2: r.take_profit2 ?? r.take_profit_2 ?? 0,
    takeProfit3: r.take_profit3 ?? r.take_profit_3 ?? 0,
    expiresAt:   r.expires_at,
    staleAfter:  r.stale_after ?? null,
    activatedAt: r.activated_at ?? null,
    detectedAt:  r.detected_at ?? null,
    regimeTag:   r.regime_tag ?? null,
    qualityBand: r.quality_band ?? null,
  };
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
  const { data: rawSignals } = await db
    .from('signals')
    .select('*')
    .in('status', ['approaching', 'active', 'TP1_hit', 'TP2_hit'])
    .returns<LiveSignalRow[]>();

  if (!rawSignals?.length) return;
  const signals = rawSignals.map(normaliseRow);

  for (const signal of signals) {
    const currentPrice = prices[signal.pair];
    if (!currentPrice) continue;

    const newStatus = evaluateSignal(signal, currentPrice, now);
    if (newStatus && newStatus !== signal.status) {
      await db.from('signals').update({
        status: newStatus,
        updated_at: now,
        // Mark closed_at for ALL terminal states
        ...((['stopped', 'expired', 'TP3_hit'] as SignalStatus[]).includes(newStatus)
          ? { closed_at: now }
          : {}),
      }).eq('id', signal.id);

      if ((['TP1_hit', 'TP2_hit', 'TP3_hit', 'stopped', 'expired'] as SignalStatus[]).includes(newStatus)) {
        await upsertSignalOutcome(signal, newStatus, currentPrice, now);
      }

      console.log(`📊 [Lifecycle] ${signal.pair} ${signal.status} → ${newStatus} @ $${currentPrice}`);

      // Broadcast to all connected clients
      const wsType = newStatus === 'stopped' ? 'signal_stopped' : 'signal_tp_hit';
      broadcastAll({
        type: wsType,
        timestamp: Date.now(),
        data: {
          signalId: signal.id,
          pair: signal.pair,
          status: newStatus,
          price: currentPrice,
          created_at: now,   // ISO string — used by client freshness gate
        },
      });

      await sendPushToAllDevices({
        title: buildNotifTitle(signal.pair, newStatus, currentPrice),
        body: buildNotifBody(signal, newStatus, currentPrice),
        data: {
          type: newStatus === 'stopped' ? 'stopped' : 'tp_hit',
          signalId: signal.id,
          pair: signal.pair,
          status: newStatus,
        },
        priority: newStatus === 'stopped' ? 'high' : 'default',
      });

      // ── Only insert a notification if we haven't already done so for this signal+status ──
      const notifType = mapStatusToNotifType(newStatus);
      const { count } = await db
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('signal_id', signal.id)
        .eq('type', notifType);

      if ((count ?? 0) === 0) {
        const { error: notifInsertErr } = await db.from('notifications').insert({
          type:      notifType,
          priority:  newStatus === 'stopped' ? 'high' : 'critical',
          title:     buildNotifTitle(signal.pair, newStatus, currentPrice),
          body:      buildNotifBody(signal, newStatus, currentPrice),
          pair:      signal.pair,
          signal_id: signal.id,
        });
        if (notifInsertErr) {
          // Signals are currently global; notifications table requires user_id.
          // Keep lifecycle flowing even when in-app DB notification row cannot be written.
          console.debug('[Lifecycle] Notification row skipped:', notifInsertErr.message);
        }
      }

    }
  }
}

function evaluateSignal(signal: LiveSignal, price: number, now: string): SignalStatus | null {
  const { direction, stopLoss, takeProfit1, takeProfit2, takeProfit3, expiresAt, status } = signal;
  const isLong = direction === 'LONG';

  // 1. Expiry check
  if (new Date(expiresAt) < new Date(now)) return 'expired';
  if (signal.staleAfter && new Date(signal.staleAfter) < new Date(now) && status === 'approaching') return 'expired';

  // 2. Stop loss hit (ONLY if already active)
  if (status !== 'approaching') {
    const slHit = isLong ? price <= stopLoss : price >= stopLoss;
    if (slHit) return 'stopped';
  }


  // 3. TP progression
  if (status === 'active') {
    const tp1Hit = isLong ? price >= takeProfit1 : price <= takeProfit1;
    if (tp1Hit) return 'TP1_hit';
  }
  if (status === 'TP1_hit') {
    const tp2Hit = isLong ? price >= takeProfit2 : price <= takeProfit2;
    if (tp2Hit) return 'TP2_hit';
  }
  if (status === 'TP2_hit') {
    const tp3Hit = isLong ? price >= takeProfit3 : price <= takeProfit3;
    if (tp3Hit) return 'TP3_hit';
  }

  return null; // No change
}

async function upsertSignalOutcome(
  signal: LiveSignal,
  status: SignalStatus,
  exitPrice: number,
  nowIso: string
): Promise<void> {
  const db = getSupabaseClient();
  const entryMid = (signal.entryLow + signal.entryHigh) / 2;
  const risk = Math.abs(entryMid - signal.stopLoss);
  if (risk <= 0) return;

  const signedMove = signal.direction === 'LONG' ? (exitPrice - entryMid) : (entryMid - exitPrice);
  const rMultiple = Number((signedMove / risk).toFixed(4));
  const detectedMs = signal.detectedAt ? new Date(signal.detectedAt).getTime() : null;
  const nowMs = new Date(nowIso).getTime();
  const holdingMinutes = detectedMs ? Math.max(0, Math.round((nowMs - detectedMs) / 60_000)) : null;

  await db.from('signal_outcomes').upsert({
    signal_id: signal.id,
    pair: signal.pair,
    timeframe: signal.timeframe,
    direction: signal.direction,
    regime_tag: signal.regimeTag,
    quality_band: signal.qualityBand,
    outcome_status: status,
    entry_price: entryMid,
    exit_price: exitPrice,
    r_multiple: rMultiple,
    holding_minutes: holdingMinutes,
    detected_at: signal.detectedAt,
    activated_at: signal.activatedAt,
    closed_at: nowIso,
  }, { onConflict: 'signal_id,outcome_status' });
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
