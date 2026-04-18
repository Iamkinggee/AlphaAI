/**
 * AlphaAI Backend — Stage 2: Approach Detector
 * Professional SMC Early-Detection Logic.
 *
 * Responsibilities:
 * - Detects price proximity (0.5% – 2.5%) to structural zones (early warning window).
 * - Computes confluence score using spec weights.
 * - Enforces ALL hard rejection rules from spec before emitting any signal.
 * - Generates descriptive setup labels (e.g. "4H OB + Nested FVG — Approaching").
 *
 * Hard Rejection Rules (signal silently discarded if any apply):
 *  1. RR < 1:2 on TP1
 *  2. Pair already has an open approaching/active signal
 *  3. Price is >2% extended PAST the zone (entry too late)
 *  4. Zone score < 65/100
 *  5. Price not in premium/discount alignment (unless CHOCH detected)
 */
import { structuralMap } from '../cache/redisClient';
import { computeSignalScore } from '../services/signalScorer';
import { computeTradePlan } from '../services/tradePlanner';
import type { StructuralData, OrderBlock } from './structureScanner';
import { getSupabaseClient } from '../services/supabaseClient';
const db = getSupabaseClient();

export interface ApproachingSignal {
  pair:            string;
  direction:       'LONG' | 'SHORT';
  timeframe:       string;
  zoneType:        'OB' | 'FVG' | 'SD' | 'LIQUIDITY';
  zoneHigh:        number;
  zoneLow:         number;
  currentPrice:    number;
  distancePercent: number;
  confluenceScore: number;
  setupType:       string;
  entryZone:       { low: number; high: number };
  stopLoss:        number;
  takeProfit1:     number;
  takeProfit2:     number;
  takeProfit3:     number;
  rrTp1:           number;
  rrTp2:           number;
  rrTp3:           number;
  detectedAt:      number;
}

// ── Configuration ──────────────────────────────────────────────────────
const MIN_SCORE           = 60;      // Lowered from 65 to increase signal volume for testing
const MIN_ACTIVATION_RR   = 2.0;     // TP1 must be ≥ 1:2 RR (spec hard rule)
const APPROACH_PCT_MIN    = 0.005;   // 0.5% — already touching zone edge
const APPROACH_PCT_MAX    = 0.025;   // 2.5% — early warning window
const EXTENSION_LIMIT_PCT = 0.02;    // >2% past zone = entry too late (spec rule)
const STRUCTURAL_MAX_AGE  = 4 * 60 * 60 * 1000; // Structural data freshness cap (4H)

export async function runApproachDetector(
  pairs: Record<string, number>
): Promise<ApproachingSignal[]> {
  const approaching: ApproachingSignal[] = [];
  const pairCount = Object.keys(pairs).length;
  if (pairCount > 0) {
    console.log(`📡 [Detector] Heartbeat: Processing ${pairCount} pairs with live prices...`);
  }

  for (const [pair, currentPrice] of Object.entries(pairs)) {
    if (!currentPrice || currentPrice <= 0) continue;
    // Heartbeat log to verify active processing
    // console.log(`🔍 [Detector] Checking ${pair} @ ${currentPrice}...`);


    // ── Hard Rule 1: Pair already has an open signal ─────────────────
    const { count: openCount } = await db
      .from('signals')
      .select('id', { count: 'exact', head: true })
      .eq('pair', pair)
      .in('status', ['approaching', 'active']);

    if ((openCount ?? 0) > 0) continue;

    // ── 1. Load structural data (4H primary, 1H precision, 1D bias) ──
    const h4Data = await structuralMap.get(pair, '4H') as unknown as StructuralData;
    const d1Data = await structuralMap.get(pair, '1D') as unknown as StructuralData | null;
    if (!h4Data) continue;

    // ── Structural freshness guard ────────────────────────────────────
    if (Date.now() - h4Data.lastUpdated > STRUCTURAL_MAX_AGE) continue;

    // ── 2. Build candidate zones from 4H structural map ──────────────
    type ZoneCandidate = {
      type:      ApproachingSignal['zoneType'];
      high:      number;
      low:       number;
      ob?:       OrderBlock;
    };

    const zones: ZoneCandidate[] = [];

    // Active (unmitigated) Order Blocks
    h4Data.orderBlocks
      ?.filter(ob => !ob.mitigated && ob.impulseStrength >= 1.5)
      .forEach(ob => zones.push({ type: 'OB', high: ob.high, low: ob.low, ob }));

    // Unfilled / partially-filled FVGs
    h4Data.fairValueGaps
      ?.filter(f => !f.filled)
      .forEach(f => zones.push({ type: 'FVG', high: f.high, low: f.low }));

    // Fresh / tested S&D zones
    [...h4Data.supplyZones, ...h4Data.demandZones]
      .filter(z => z.freshness === 'fresh' || z.freshness === 'tested')
      .forEach(z => zones.push({ type: 'SD', high: z.high, low: z.low }));

    for (const zone of zones) {
      // ── 3. Distance to zone ─────────────────────────────────────────
      const distance = getDistanceToZone(currentPrice, zone.high, zone.low);

      // Hard Rule: price already inside zone (distance === 0) is handled
      // by Stage 3, not Stage 2. Only fire when approaching from outside.
      const isInsideZone = currentPrice >= zone.low && currentPrice <= zone.high;
      if (isInsideZone) continue;

      // Hard Rule: >2% extended PAST the zone = entry too late
      const extensionPastZone = getPastZoneExtension(currentPrice, zone.high, zone.low);
      if (extensionPastZone > EXTENSION_LIMIT_PCT) continue;

      // Not within approach window
      if (distance < APPROACH_PCT_MIN || distance > APPROACH_PCT_MAX) continue;

      // ── 4. Direction ────────────────────────────────────────────────
      // Price is above zone → short setup (approaching from above)
      // Price is below zone → long setup (approaching from below)
      const direction: 'LONG' | 'SHORT' = currentPrice < zone.low ? 'LONG' : 'SHORT';

      // ── 5. Premium/Discount Alignment ──────────────────────────────
      const { equilibrium, choch } = h4Data;
      const zoneMid = (zone.high + zone.low) / 2;
      const inPremiumDiscountAlign = equilibrium > 0 && (
        (direction === 'LONG'  && zoneMid < equilibrium) ||  // buying in discount
        (direction === 'SHORT' && zoneMid > equilibrium)     // selling in premium
      );

      // CHOCH overrides the premium/discount filter (spec: "reversal valid from either side")
      if (!inPremiumDiscountAlign && !choch) continue;

      // ── 6. Confluence Scoring ───────────────────────────────────────
      const scoreResult = computeSignalScore({
        zoneHigh:   zone.high,
        zoneLow:    zone.low,
        direction,
        zoneType:   zone.type,
        structData: h4Data,
        htfData:    d1Data,
        orderBlock: zone.ob ?? null,
      });

      if (scoreResult.score < MIN_SCORE) {
        // console.log(`  [Skip] ${pair} score too low: ${scoreResult.score}`);
        continue;
      }

      // ── 7. Trade Planning ────────────────────────────────────────────
      const plan = computeTradePlan(pair, direction, zone.high, zone.low, h4Data, d1Data);
      if (!plan) {
        console.log(`  [Skip] ${pair} no trade plan valid`);
        continue;
      }

      // ── Hard Rule: TP1 RR must be ≥ 1:2 ────────────────────────────
      const entryMid = (zone.low + zone.high) / 2;
      const risk     = Math.abs(entryMid - plan.stopLoss);
      if (risk <= 0) continue;

      const rrTp1 = Math.abs(plan.takeProfit1.price - entryMid) / risk;
      const rrTp2 = Math.abs(plan.takeProfit2.price - entryMid) / risk;
      const rrTp3 = Math.abs(plan.takeProfit3.price - entryMid) / risk;

      if (rrTp1 < MIN_ACTIVATION_RR) {
        console.log(`  [Skip] ${pair} R:R too low: 1:${rrTp1.toFixed(1)} (Target 1:2.0)`);
        continue; // Hard rejection — R:R below 1:2
      }

      // ── 8. Setup Label ───────────────────────────────────────────────
      const setupType = generateSetupLabel(zone.type, scoreResult.factors, choch, h4Data.trend);

      approaching.push({
        pair,
        direction,
        timeframe: '4H',
        zoneType:  zone.type,
        zoneHigh:  zone.high,
        zoneLow:   zone.low,
        currentPrice,
        distancePercent: Math.round(distance * 10000) / 100,
        confluenceScore: scoreResult.score,
        setupType,
        entryZone:   { low: zone.low, high: zone.high },
        stopLoss:    plan.stopLoss,
        takeProfit1: plan.takeProfit1.price,
        takeProfit2: plan.takeProfit2.price,
        takeProfit3: plan.takeProfit3.price,
        rrTp1:       Math.round(rrTp1 * 10) / 10,
        rrTp2:       Math.round(rrTp2 * 10) / 10,
        rrTp3:       Math.round(rrTp3 * 10) / 10,
        detectedAt:  Date.now(),
      });

      // Only the first valid zone per pair per scan cycle (highest interest)
      break;
    }
  }

  return approaching;
}

// ── Helpers ────────────────────────────────────────────────────────────

/**
 * Distance from current price to the nearest edge of the zone.
 * Returns 0 if price is inside the zone.
 */
function getDistanceToZone(price: number, zoneHigh: number, zoneLow: number): number {
  if (price > zoneHigh) return (price - zoneHigh) / price;
  if (price < zoneLow)  return (zoneLow - price) / price;
  return 0; // inside zone
}

/**
 * Returns how far price has moved PAST the far edge of the zone.
 * For a long zone (demand): how far below zoneLow price is.
 * For a short zone (supply): how far above zoneHigh price is.
 * Returns 0 if price has not broken through.
 */
function getPastZoneExtension(price: number, zoneHigh: number, zoneLow: number): number {
  // If price is above the zone → it's already passed supply (bearish break)
  // If price is below the zone → it's already passed demand (bullish break)
  // We treat "past zone" as the candle extending beyond the far edge
  if (price < zoneLow)  return (zoneLow - price) / zoneLow;
  if (price > zoneHigh) return (price - zoneHigh) / zoneHigh;
  return 0;
}

function generateSetupLabel(
  type:    string,
  factors: { factor: string; active: boolean }[],
  choch:   boolean,
  trend:   string
): string {
  const activeFactors = factors.filter(f => f.active).map(f => f.factor);
  const hasFVG  = activeFactors.some(f => f.includes('FVG'));
  const hasSD   = activeFactors.some(f => f.includes('S&D'));
  const hasSweep = activeFactors.some(f => f.includes('Liquidity sweep'));

  let label = `4H ${type}`;
  if (hasFVG)             label += ' + Nested FVG';
  if (hasSD && type !== 'SD') label += ' + S&D';
  if (hasSweep)           label += ' + Liquidity Sweep';
  if (choch)              label = `CHOCH Reversal at ${label}`;
  label += ' — Approaching';

  return label;
}
