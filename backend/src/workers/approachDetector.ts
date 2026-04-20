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
import { getProModeEnabled } from '../services/proModeState';
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
  confidenceScore: number;
  regimeTag:       'trend_following' | 'reversal' | 'ranging_risk' | 'high_volatility';
  qualityBand:     'A' | 'B' | 'C';
  staleAfter:      string;
  detectedAt:      number;
}

// ── Configuration ──────────────────────────────────────────────────────
const MIN_SCORE           = 65;      // Spec minimum for approaching alert quality
const MIN_ACTIVATION_RR   = 2.0;     // TP1 must be ≥ 1:2 RR (spec hard rule)
const APPROACH_PCT_MIN    = 0.005;   // 0.5% — already touching zone edge
const APPROACH_PCT_MAX    = 0.015;   // 1.5% — spec early warning ceiling
const EXTENSION_LIMIT_PCT = 0.02;    // >2% past zone = entry too late (spec rule)
const STRUCTURAL_MAX_AGE  = 4 * 60 * 60 * 1000; // Structural data freshness cap (4H)

// Pro mode hard filters (env-tunable).
const PRO_MIN_CONFIDENCE = toNumberEnv(process.env.PRO_MIN_CONFIDENCE, 78);
const PRO_MIN_RR = toNumberEnv(process.env.PRO_MIN_RR, 2.5);
const PRO_MAX_DISTANCE_PCT = toNumberEnv(process.env.PRO_MAX_DISTANCE_PCT, 0.012);
const PRO_ALLOW_RANGING_RISK = (process.env.PRO_ALLOW_RANGING_RISK ?? 'false').toLowerCase() === 'true';
const PRO_ALLOW_HIGH_VOLATILITY = (process.env.PRO_ALLOW_HIGH_VOLATILITY ?? 'false').toLowerCase() === 'true';
const PRO_ALLOW_QUALITY_C = (process.env.PRO_ALLOW_QUALITY_C ?? 'false').toLowerCase() === 'true';

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

    const candidates: Array<ApproachingSignal & { _distance: number; _zonePriority: number }> = [];
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

      const regime = classifyMarketRegime(h4Data, d1Data, distance);
      const adjustedScore = Math.max(0, Math.min(100, scoreResult.score + regime.scoreBias));
      if (adjustedScore < MIN_SCORE) continue;

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
      const confidenceScore = Math.max(
        1,
        Math.min(
          100,
          Math.round(
            adjustedScore * 0.75 +
            (rrTp1 >= 3 ? 10 : rrTp1 >= 2.5 ? 6 : 3) +
            (distance <= 0.008 ? 6 : distance <= 0.012 ? 3 : 1) +
            (choch ? 5 : 0)
          )
        )
      );
      const qualityBand: ApproachingSignal['qualityBand'] =
        confidenceScore >= 82 ? 'A' : confidenceScore >= 72 ? 'B' : 'C';
      const staleAfterHours = regime.tag === 'ranging_risk' ? 12 : regime.tag === 'high_volatility' ? 8 : 24;
      const staleAfter = new Date(Date.now() + staleAfterHours * 60 * 60 * 1000).toISOString();

      // Pro mode: tighten quality gate for better win consistency.
      if (getProModeEnabled()) {
        if (confidenceScore < PRO_MIN_CONFIDENCE) continue;
        if (rrTp1 < PRO_MIN_RR) continue;
        if (distance > PRO_MAX_DISTANCE_PCT) continue;
        if (!PRO_ALLOW_QUALITY_C && qualityBand === 'C') continue;
        if (!PRO_ALLOW_RANGING_RISK && regime.tag === 'ranging_risk') continue;
        if (!PRO_ALLOW_HIGH_VOLATILITY && regime.tag === 'high_volatility') continue;
      }

      candidates.push({
        pair,
        direction,
        timeframe: '4H',
        zoneType:  zone.type,
        zoneHigh:  zone.high,
        zoneLow:   zone.low,
        currentPrice,
        distancePercent: Math.round(distance * 10000) / 100,
        confluenceScore: adjustedScore,
        setupType,
        entryZone:   { low: zone.low, high: zone.high },
        stopLoss:    plan.stopLoss,
        takeProfit1: plan.takeProfit1.price,
        takeProfit2: plan.takeProfit2.price,
        takeProfit3: plan.takeProfit3.price,
        rrTp1:       Math.round(rrTp1 * 10) / 10,
        rrTp2:       Math.round(rrTp2 * 10) / 10,
        rrTp3:       Math.round(rrTp3 * 10) / 10,
        confidenceScore,
        regimeTag: regime.tag,
        qualityBand,
        staleAfter,
        detectedAt:  Date.now(),
        _distance: distance,
        _zonePriority: zone.type === 'OB' ? 3 : zone.type === 'SD' ? 2 : zone.type === 'FVG' ? 1 : 0,
      });
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) =>
        b.confluenceScore - a.confluenceScore ||
        b._zonePriority - a._zonePriority ||
        a._distance - b._distance
      );
      const best = candidates[0];
      const { _distance, _zonePriority, ...signal } = best;
      approaching.push(signal);
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

function classifyMarketRegime(
  h4Data: StructuralData,
  d1Data: StructuralData | null,
  distanceToZone: number
): { tag: ApproachingSignal['regimeTag']; scoreBias: number } {
  const h4Trend = h4Data.trend;
  const d1Trend = d1Data?.trend ?? 'ranging';
  const trendAligned = h4Trend !== 'ranging' && h4Trend === d1Trend;
  const hasRecentChoch = h4Data.choch;
  const highLiquiditySweepDensity = (h4Data.liquidityPools?.filter(l => l.swept).length ?? 0) >= 3;

  if (hasRecentChoch) {
    return { tag: 'reversal', scoreBias: 4 };
  }
  if (!trendAligned && h4Trend === 'ranging') {
    return { tag: 'ranging_risk', scoreBias: -8 };
  }
  if (highLiquiditySweepDensity && distanceToZone > 0.012) {
    return { tag: 'high_volatility', scoreBias: -5 };
  }
  return { tag: 'trend_following', scoreBias: 3 };
}

function toNumberEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
