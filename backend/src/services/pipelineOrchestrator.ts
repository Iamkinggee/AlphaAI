/**
 * AlphaAI Backend — Pipeline Orchestrator
 * Central scheduler that drives all 3 detection stages:
 *
 *  1. Structure Scanner  — runs on 1H/4H/1D candle close
 *  2. Approach Detector  — polls every 60 seconds
 *  3. Entry Trigger      — runs on every 5M candle close
 *
 * Coordinates Binance WebSocket + REST feeds → Redis → Supabase pipeline.
 */
import { fetchCandles, subscribePriceStream, subscribe5MCandles } from './marketData/binanceService';
import { runStructureScanner }  from '../workers/structureScanner';
import { runApproachDetector }  from '../workers/approachDetector';
import { runEntryTrigger }      from '../workers/entryTrigger';
import { computeSignalScore }   from './signalScorer';
import { computeTradePlan }     from './tradePlanner';
import { getSupabaseClient }    from './supabaseClient';
import { startLifecycleMonitor, stopLifecycleMonitor } from './signalLifecycle';

// ── Tracked universe ─────────────────────────────────────────────────
const UNIVERSE: { pair: string; symbol: string }[] = [
  { pair: 'BTC/USDT',  symbol: 'BTCUSDT'  },
  { pair: 'ETH/USDT',  symbol: 'ETHUSDT'  },
  { pair: 'SOL/USDT',  symbol: 'SOLUSDT'  },
  { pair: 'DOGE/USDT', symbol: 'DOGEUSDT' },
  { pair: 'LINK/USDT', symbol: 'LINKUSDT' },
  { pair: 'AVAX/USDT', symbol: 'AVAXUSDT' },
  { pair: 'ADA/USDT',  symbol: 'ADAUSDT'  },
  { pair: 'DOT/USDT',  symbol: 'DOTUSDT'  },
];

// Live price state — updated by WS mini-ticker
const livePrices: Record<string, number> = {};

// Active unsubscribe handles
const unsubscribers: Array<() => void> = [];

// Approach polling interval
let approachInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Boot the detection pipeline.
 * Call once on server start. Automatically manages all subscriptions.
 */
export async function startPipeline(): Promise<void> {
  console.log('🚀 [Pipeline] Starting detection engine...');

  // ── Stage 1: Initial structure scan for all pairs ─────────────────
  await runInitialStructureScan();

  // ── Signal Lifecycle Monitor ───────────────────────────────────────
  startLifecycleMonitor(() => ({ ...livePrices }));

  // ── Real-time price stream for Approach Detector ──────────────────
  const unsubPrices = subscribePriceStream(
    UNIVERSE.map((u) => u.pair),
    (pair, price) => { livePrices[pair] = price; },
    (err) => console.error('[Pipeline] Price stream error:', err)
  );
  unsubscribers.push(unsubPrices);

  // ── Stage 2: Approach Detector — every 60 seconds ─────────────────
  approachInterval = setInterval(async () => {
    try {
      const approaching = await runApproachDetector(livePrices);
      if (approaching.length > 0) {
        console.log(`⚡ [Pipeline] ${approaching.length} approaching signal(s) detected`);
        await persistApproachingSignals(approaching);
      }
    } catch (err) {
      console.error('[Pipeline] Approach detector error:', err);
    }
  }, 60_000);

  // ── Stage 3: 5M candle streams for Entry Trigger ──────────────────
  for (const { pair, symbol } of UNIVERSE) {
    const recent5mCandles: import('./marketData/binanceService.js').BinanceCandle[] = [];

    const unsub = subscribe5MCandles(symbol, async (candle, isClosed) => {
      recent5mCandles.push({
        timestamp: candle.openTime,
        ...candle,
      } as typeof candle);
      if (recent5mCandles.length > 20) recent5mCandles.shift(); // keep rolling 20 candles

      if (!isClosed) return; // Only process on candle close

      // Re-scan structure on 1H equivalent (every 12 × 5M = 60 candles)
      // For now check every 5M close
      const db = getSupabaseClient();
      const { data: approachingSignals } = await db
        .from('signals')
        .select('*')
        .eq('pair', pair)
        .eq('status', 'approaching')
        .limit(5);

      for (const signal of approachingSignals ?? []) {
        const trigger = await runEntryTrigger(signal, recent5mCandles.map(c => ({
          timestamp: c.openTime,
          open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
        })));
        if (trigger) {
          console.log(`🔥 [Pipeline] Entry triggered: ${pair} — Score: ${trigger.finalScore}`);
          await activateSignal(signal.id, trigger);
        }
      }
    });
    unsubscribers.push(unsub);
  }

  console.log(`✅ [Pipeline] Running — watching ${UNIVERSE.length} pairs`);
}

/**
 * Stop the pipeline and clean up all subscriptions.
 */
export function stopPipeline(): void {
  unsubscribers.forEach((fn) => fn());
  unsubscribers.length = 0;
  if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
  stopLifecycleMonitor();
  console.log('🛑 [Pipeline] Stopped');
}

// ── Internal helpers ──────────────────────────────────────────────────

async function runInitialStructureScan(): Promise<void> {
  for (const { pair, symbol } of UNIVERSE) {
    try {
      const candles1H = await fetchCandles(symbol, '1h', 200);
      const candles4H = await fetchCandles(symbol, '4h', 200);
      await runStructureScanner(pair, '1H', candles1H.map(toOHLCV));
      await runStructureScanner(pair, '4H', candles4H.map(toOHLCV));
      console.log(`  ✅ [Pipeline] Initial scan complete: ${pair}`);
    } catch (err) {
      console.warn(`  ⚠️  [Pipeline] Scan failed for ${pair}:`, (err as Error).message);
    }
  }
}

function toOHLCV(c: { openTime: number; open: number; high: number; low: number; close: number; volume: number }): number[] {
  return [c.openTime, c.open, c.high, c.low, c.close, c.volume];
}

async function persistApproachingSignals(signals: Awaited<ReturnType<typeof runApproachDetector>>): Promise<void> {
  const db = getSupabaseClient();
  for (const signal of signals) {
    const plan = computeTradePlan(signal.pair, signal.direction, signal.zoneHigh, signal.zoneLow);
    await db.from('signals').upsert({
      pair: signal.pair,
      direction: signal.direction,
      timeframe: signal.timeframe,
      status: 'approaching',
      score: signal.confluenceScore,
      setup_type: `${signal.zoneType} Zone`,
      entry_zone_low: plan.entryZone.low,
      entry_zone_high: plan.entryZone.high,
      stop_loss: plan.stopLoss,
      take_profit_1: plan.takeProfit1.price,
      take_profit_2: plan.takeProfit2.price,
      take_profit_3: plan.takeProfit3.price,
      distance_pct: signal.distancePercent,
      detected_at: new Date(signal.detectedAt).toISOString(),
      expires_at: new Date(signal.detectedAt + 48 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'pair,direction,timeframe' });
  }
}

async function activateSignal(id: string, trigger: NonNullable<Awaited<ReturnType<typeof runEntryTrigger>>>): Promise<void> {
  const db = getSupabaseClient();
  await db.from('signals').update({
    status: 'active',
    score: trigger.finalScore,
    activated_at: new Date().toISOString(),
  }).eq('id', id);
}
