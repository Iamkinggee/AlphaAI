/**
 * AlphaAI Backend — Pipeline Orchestrator
 * Central scheduler that drives all 3 detection stages:
 *
 *  1. Structure Scanner  — runs on 1H/4H/1D candle close
 *  2. Approach Detector  — polls every 60 seconds
 *  3. Entry Trigger      — runs on every 5M candle close
 *
 * Coordinates Binance Futures WS + REST feeds → Redis → Supabase pipeline.
 * Monitors Top 80 USDT Perpetual pairs by volume.
 */
import { fetchCandles, subscribePriceStream, subscribe5MCandles } from './marketData/binanceService';
import { getTopPairs, PairSpec } from './marketData/pairUniverse';
import { runStructureScanner }  from '../workers/structureScanner';
import { runApproachDetector }  from '../workers/approachDetector';
import { runEntryTrigger }      from '../workers/entryTrigger';
import { getSupabaseClient }    from './supabaseClient';
import { startLifecycleMonitor, stopLifecycleMonitor } from './signalLifecycle';
import { computeTradePlan } from './tradePlanner';
import { computeSignalScore } from './signalScorer';
import { broadcastSetupDetected, broadcastPriceTick } from './wsServerManager';
import { StructuralData } from '../workers/structureScanner';

// Price tick throttle — only broadcast if price changed > 0.01% to reduce noise
const lastBroadcastPrices: Record<string, number> = {};
const PRICE_BROADCAST_THRESHOLD = 0.0001; // 0.01%

// Live universe and state
let MONITOR_LIST: PairSpec[] = [];
const livePrices: Record<string, number> = {};
const unsubscribers: Array<() => void> = [];
let approachInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Boot the detection pipeline.
 */
export async function startPipeline(): Promise<void> {
  console.log('🚀 [Pipeline] Starting professional SMC detection engine (80 Pairs)...');

  // ── Step 0: Fetch monitored universe (Top 80 Perpetuals) ──────────
  MONITOR_LIST = await getTopPairs();
  console.log(`📡 [Pipeline] Monitoring ${MONITOR_LIST.length} pairs on Binance Futures`);

  // ── Stage 1: Initial structure scan ──────────────────────────────
  // We stagger these to avoid massive CPU spikes and rate limits
  await runInitialStructureScan();

  // ── Signal Lifecycle Monitor ─────────────────────────────────────
  startLifecycleMonitor(() => ({ ...livePrices }));

  // ── Real-time price stream for Approach Detector ──────────────────
  // Use Futures Mark Price streams
  const unsubPrices = subscribePriceStream(
    MONITOR_LIST.map(m => m.pair),
    (pair, price) => {
      livePrices[pair] = price;
      // Broadcast to WS clients — throttled to avoid flooding
      const last = lastBroadcastPrices[pair];
      if (!last || Math.abs((price - last) / last) >= PRICE_BROADCAST_THRESHOLD) {
        lastBroadcastPrices[pair] = price;
        broadcastPriceTick(pair, price, 0); // change24h filled by REST route, 0 here is fine
      }
    },
    'FUTURES'
  );
  unsubscribers.push(unsubPrices);

    try {
      // Small delay to ensure price feed has populated first tick
      await new Promise(r => setTimeout(r, 2000));
      
      const approaching = await runApproachDetector(livePrices);
      if (approaching.length > 0) {
        console.log(`⚡ [Pipeline] ${approaching.length} HIGH-QUALITY signal(s) detected during boot scan`);
        await persistApproachingSignals(approaching);
      }
    } catch (err) {
      console.error('[Pipeline] Initial detection error:', err);
    }

  // ── Stage 2: Approach Detector — every 60 seconds ─────────────────
  approachInterval = setInterval(async () => {
    try {
      const approaching = await runApproachDetector(livePrices);
      if (approaching.length > 0) {
        console.log(`⚡ [Pipeline] ${approaching.length} HIGH-QUALITY signal(s) detected`);
        await persistApproachingSignals(approaching);
      }
      
      // Periodic Refresh of Universe (every 24h)
      if (new Date().getHours() === 0 && new Date().getMinutes() === 0) {
        console.log('🔄 [Pipeline] Scheduled universe refresh...');
        refreshUniverse();
      }
    } catch (err) {
      console.error('[Pipeline] Approach detector error:', err);
    }
  }, 60_000);

  // ── Periodic Structure Restamping (Top of the hour) ──────────────
  let lastScanHour = -1;
  setInterval(() => {
    const now = new Date();
    // Run at exactly 5+ seconds past the hour to ensure Binance 1H/4H candles have completely closed
    if (now.getMinutes() === 0 && now.getSeconds() >= 5 && now.getHours() !== lastScanHour) {
      lastScanHour = now.getHours();
      console.log('🔄 [Pipeline] Top of the hour — refreshing structural maps...');
      runInitialStructureScan().catch(err => console.error('[Pipeline] Structure refresh error:', err));
    }
  }, 1000);


  // ── Stage 3: 5M candle streams for Entry Trigger ──────────────────
  // We subscribe to all 80 pairs for 5m klines
  for (const { pair, symbol } of MONITOR_LIST) {
    const recent5mCandles: any[] = [];

    const unsub = subscribe5MCandles(symbol, async (candle, isClosed) => {
      recent5mCandles.push(candle);
      if (recent5mCandles.length > 30) recent5mCandles.shift();

      if (!isClosed) return;

      const db = getSupabaseClient();
      const { data: approachingSignals } = await db
        .from('signals')
        .select('*')
        .eq('pair', pair)
        .eq('status', 'approaching');

      for (const signal of approachingSignals ?? []) {
        const trigger = await runEntryTrigger(signal, recent5mCandles);
        if (trigger) {
          await activateSignal(signal.id, trigger);
        }
      }
    }, 'FUTURES');
    unsubscribers.push(unsub);
  }

  console.log('✅ [Pipeline] Engine fully active');
}

export function stopPipeline(): void {
  unsubscribers.forEach((fn) => fn());
  unsubscribers.length = 0;
  if (approachInterval) { clearInterval(approachInterval); approachInterval = null; }
  stopLifecycleMonitor();
  console.log('🛑 [Pipeline] Stopped');
}

/**
 * Perform initial structure scans (1H, 4H, 1D) for all 80 pairs.
 * Staggered to ensure stability.
 */
async function runInitialStructureScan(): Promise<void> {
  console.log('🔬 [Pipeline] Running initial structural mapping for 80 pairs...');
  
  // Scans are heavy, so we process in batches of 5
  const batchSize = 5;
  for (let i = 0; i < MONITOR_LIST.length; i += batchSize) {
    const batch = MONITOR_LIST.slice(i, i + batchSize);
    await Promise.all(batch.map(async ({ pair, symbol }) => {
      try {
        const [c1H, c4H, c1D] = await Promise.all([
          fetchCandles(symbol, '1h', 200, 'FUTURES'),
          fetchCandles(symbol, '4h', 200, 'FUTURES'),
          fetchCandles(symbol, '1d', 200, 'FUTURES')
        ]);
        
        await Promise.all([
          runStructureScanner(pair, '1H', c1H.map(toOHLCV)),
          runAndNotifyStructure(pair, '4H', c4H.map(toOHLCV)),
          runStructureScanner(pair, '1D', c1D.map(toOHLCV))
        ]);
      } catch (err) {
        console.warn(`  ⚠️  Scan failed for ${pair}:`, (err as Error).message);
      }
    }));
    // Small delay between batches to respect rate limits
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('✅ [Pipeline] Structural mapping complete');
}

/**
 * Runs structural scanner and notifies if a NEW high-probability setup is found.
 */
async function runAndNotifyStructure(pair: string, timeframe: string, candles: any[]): Promise<void> {
  const data = await runStructureScanner(pair, timeframe, candles);
  
  // Only alert on 4H/1D for high-prob setups
  if (timeframe === '1H') return;

  const now = Date.now();
  const recentThreshold = 30 * 60 * 1000; // Created in last 30 mins

  // Check unmitigated OBs
  for (const ob of data.orderBlocks || []) {
    if (ob.mitigated || (now - ob.timestamp > recentThreshold)) continue;

    const scoreResult = computeSignalScore({
      zoneHigh: ob.high,
      zoneLow: ob.low,
      direction: ob.direction === 'BULLISH' ? 'LONG' : 'SHORT',
      zoneType: 'OB',
      structData: data,
      orderBlock: ob
    });

    if (scoreResult.score >= 80) {
      console.log(`📡 [Pipeline] NEW HIGH-PROB SETUP: ${pair} ${timeframe} OB — Score: ${scoreResult.score}`);
      broadcastSetupDetected({
        pair,
        timeframe,
        type: 'OB',
        direction: ob.direction === 'BULLISH' ? 'LONG' : 'SHORT',
        score: scoreResult.score,
        zone: { high: ob.high, low: ob.low }
      });
    }
  }

  // Check unfilled FVGs
  for (const fvg of data.fairValueGaps || []) {
    if (fvg.filled || (now - fvg.timestamp > recentThreshold)) continue;

    const scoreResult = computeSignalScore({
      zoneHigh: fvg.high,
      zoneLow: fvg.low,
      direction: fvg.direction === 'BULLISH' ? 'LONG' : 'SHORT',
      zoneType: 'FVG',
      structData: data
    });

    if (scoreResult.score >= 80) {
      console.log(`📡 [Pipeline] NEW HIGH-PROB SETUP: ${pair} ${timeframe} FVG — Score: ${scoreResult.score}`);
      broadcastSetupDetected({
        pair,
        timeframe,
        type: 'FVG',
        direction: fvg.direction === 'BULLISH' ? 'LONG' : 'SHORT',
        score: scoreResult.score,
        zone: { high: fvg.high, low: fvg.low }
      });
    }
  }
}

function toOHLCV(c: any): number[] {
  return [c.openTime, c.open, c.high, c.low, c.close, c.volume];
}

async function refreshUniverse(): Promise<void> {
  // Logic to stop and restart pipeline with new list
  // For now we just refresh the list in memory; subscriptions would need re-init
  // To keep it simple, we reboot the pipeline every 24h or just stick to the 80
  MONITOR_LIST = await getTopPairs(true);
}

async function persistApproachingSignals(signals: any[]): Promise<void> {
  const db = getSupabaseClient();

  for (const signal of signals) {
    // DISABLED Cooldown guard for testing/visibility
    /*
    const cooldownSince = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const { count: recentlyClosed } = await db
      .from('signals')
      .select('id', { count: 'exact', head: true })
      .eq('pair', signal.pair)
      .eq('direction', signal.direction)
      .in('status', ['TP3_hit', 'stopped', 'expired'])
      .or(`closed_at.gte.${cooldownSince},and(closed_at.is.null,updated_at.gte.${cooldownSince})`);

    if ((recentlyClosed ?? 0) > 0) {
      console.log(`⏳ [Pipeline] Cooldown active for ${signal.pair} ${signal.direction} — skipping`);
      continue;
    }
    */


    // Insert new approaching signal with full trade plan
    const { data: inserted, error } = await db.from('signals').insert({
      pair:          signal.pair,
      direction:     signal.direction,
      timeframe:     signal.timeframe,
      status:        'approaching',
      score:         signal.confluenceScore,
      setup_type:    signal.setupType,
      // Support both column name conventions used in DB
      entry_low:     signal.entryZone.low,
      entry_high:    signal.entryZone.high,
      entry_zone_low:  signal.entryZone.low,
      entry_zone_high: signal.entryZone.high,
      stop_loss:     signal.stopLoss,
      take_profit1:  signal.takeProfit1,
      take_profit2:  signal.takeProfit2,
      take_profit3:  signal.takeProfit3,
      distance_pct:  signal.distancePercent,
      detected_at:   new Date(signal.detectedAt).toISOString(),
      expires_at:    new Date(signal.detectedAt + 48 * 60 * 60 * 1000).toISOString(),
    }).select('id').single();

    if (error) {
      // Retry without the duplicate column names if DB schema is strict
      const { data: inserted2, error: err2 } = await db.from('signals').insert({
        pair:         signal.pair,
        direction:    signal.direction,
        timeframe:    signal.timeframe,
        status:       'approaching',
        score:        signal.confluenceScore,
        setup_type:   signal.setupType,
        entry_low:    signal.entryZone.low,
        entry_high:   signal.entryZone.high,
        stop_loss:    signal.stopLoss,
        take_profit1: signal.takeProfit1,
        take_profit2: signal.takeProfit2,
        take_profit3: signal.takeProfit3,
        distance_pct: signal.distancePercent,
        detected_at:  new Date(signal.detectedAt).toISOString(),
        expires_at:   new Date(signal.detectedAt + 48 * 60 * 60 * 1000).toISOString(),
      }).select('id').single();

      if (err2) {
        console.error(`❌ [Pipeline] Failed to insert signal for ${signal.pair}:`, err2.message);
        continue;
      }

      if (inserted2) {
        console.log(`💾 [Pipeline] ✅ Signal persisted: ${signal.pair} — ${signal.setupType} — Score: ${signal.confluenceScore} — RR: 1:${signal.rrTp1}`);
        const { broadcastApproaching } = await import('./wsServerManager');
        broadcastApproaching({
          signalId:    inserted2.id,
          pair:        signal.pair,
          direction:   signal.direction,
          timeframe:   signal.timeframe,
          score:       signal.confluenceScore,
          setupType:   signal.setupType,
          rrTp1:       signal.rrTp1,
          distancePct: signal.distancePercent,
          entryZone:   signal.entryZone,
          stopLoss:    signal.stopLoss,
          takeProfit1: signal.takeProfit1,
          takeProfit2: signal.takeProfit2,
          takeProfit3: signal.takeProfit3,
        });
      }
      continue;
    }

    if (inserted) {
      console.log(`💾 [Pipeline] ✅ Signal persisted: ${signal.pair} — ${signal.setupType} — Score: ${signal.confluenceScore} — RR: 1:${signal.rrTp1}`);
      const { broadcastApproaching } = await import('./wsServerManager');
      broadcastApproaching({
        signalId:    inserted.id,
        pair:        signal.pair,
        direction:   signal.direction,
        timeframe:   signal.timeframe,
        score:       signal.confluenceScore,
        setupType:   signal.setupType,
        rrTp1:       signal.rrTp1,
        distancePct: signal.distancePercent,
        entryZone:   signal.entryZone,
        stopLoss:    signal.stopLoss,
        takeProfit1: signal.takeProfit1,
        takeProfit2: signal.takeProfit2,
        takeProfit3: signal.takeProfit3,
      });
    }
  }
}

async function activateSignal(id: string, trigger: any): Promise<void> {
  const db = getSupabaseClient();
  await db.from('signals').update({
    status:       'active',
    score:        trigger.finalScore,
    activated_at: new Date().toISOString(),
    setup_type:   `${trigger.setupType} (Confirmed: ${trigger.confirmationType})`
  }).eq('id', id);
  console.log(`🔥 [Pipeline] Signal Activated: ${trigger.pair} @ ${trigger.currentPrice}`);
}
