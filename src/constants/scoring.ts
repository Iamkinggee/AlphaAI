/**
 * AlphaAI Confluence Scoring System
 * Weights and thresholds for the signal scoring engine
 */

export const ScoringWeights = {
  /** 4H Order Block present in zone */
  ORDER_BLOCK: 20,
  /** Unfilled FVG nested inside zone */
  NESTED_FVG: 15,
  /** Liquidity sweep before entry */
  LIQUIDITY_SWEEP: 20,
  /** Price in premium/discount alignment */
  PREMIUM_DISCOUNT: 10,
  /** 1D trend aligned with trade direction */
  DAILY_TREND: 10,
  /** 5M BOS confirmation (Stage 3 upgrade) */
  FIVE_MIN_BOS: 15,
  /** Supply/Demand zone coincides with OB */
  SD_OB_CONFLUENCE: 10,
} as const;

export const ScoringThresholds = {
  /** Minimum score to generate an approaching alert */
  APPROACHING_MIN: 65,
  /** Minimum score to confirm an active signal */
  ACTIVE_MIN: 70,
  /** Maximum possible score */
  MAX_SCORE: 100,
} as const;

export const HardRejectionRules = {
  /** Minimum Risk:Reward ratio on any TP level */
  MIN_RR: 2.0,
  /** Maximum price extension beyond zone at approach (%) */
  MAX_ZONE_EXTENSION: 2.0,
  /** Hours before scheduled high-impact macro event */
  MACRO_EVENT_BUFFER_MINUTES: 45,
  /** Volume threshold: confirmation candle vs 20-period average */
  VOLUME_MIN_RATIO: 1.0,
  /** Signal expiry if price doesn't enter zone (hours) */
  SIGNAL_EXPIRY_HOURS: 48,
  /** Approach detection: min distance from zone (%) */
  APPROACH_MIN_DISTANCE: 0.5,
  /** Approach detection: max distance from zone (%) */
  APPROACH_MAX_DISTANCE: 1.5,
} as const;

export const StructureConfig = {
  /** ZigZag algorithm minimum swing sensitivity on 4H (%) */
  SWING_SENSITIVITY: 1.5,
  /** Maximum candle cluster size for OB detection */
  OB_MAX_CLUSTER: 3,
  /** S&D zone tightness: max range for consolidation (%) */
  SD_MAX_RANGE: 1.5,
  /** S&D departure: minimum move size (%) */
  SD_MIN_DEPARTURE: 3.0,
  /** S&D departure: minimum consecutive candles */
  SD_MIN_CONSECUTIVE: 2,
  /** Equal highs/lows: tolerance for liquidity pool detection (%) */
  LIQUIDITY_TOLERANCE: 0.1,
  /** Minimum liquidity pool occurrences */
  LIQUIDITY_MIN_OCCURRENCES: 2,
  /** OB mitigation threshold: price traded through zone (%) */
  OB_MITIGATION_THRESHOLD: 50,
  /** S&D zone touch count before retirement */
  SD_RETIREMENT_TOUCHES: 4,
  /** SL placement beyond zone edge (%) */
  SL_BUFFER: 0.3,
  /** Number of confirmed swings for trend determination */
  TREND_SWING_COUNT: 5,
} as const;
