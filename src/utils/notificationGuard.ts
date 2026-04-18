/**
 * AlphaAI — Notification Guard
 *
 * Prevents duplicate local notifications for the same signal event.
 * Uses AsyncStorage to persist fired event keys across app restarts.
 *
 * Key format: "<type>:<signalId>"  (e.g. "active:sig_abc123")
 * System events without a signalId use a time-bucket key so the same
 * scan_complete doesn't re-fire within a 60-second window.
 *
 * Old keys (> 24 hours) are pruned automatically on load.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY     = '@alphaai/fired_notif_keys';
const PAIR_LOCK_KEY   = '@alphaai/resolved_pairs';    // pairs silenced until new setup
const TTL_MS          = 7 * 24 * 60 * 60 * 1000;  // 7 days — never forget a fired event within this window
const MAX_EVENT_AGE   = 15 * 60 * 1000;            // 15 minutes — ignore events older than this

interface GuardEntry {
  firedAt: number; // epoch ms
}

/** In-memory cache so we don't hit AsyncStorage on every event */
let cache: Map<string, GuardEntry> = new Map();
let loaded = false;

// ── Load ────────────────────────────────────────────────────────────────────

async function load(): Promise<void> {
  if (loaded) return;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, GuardEntry>;
      const now = Date.now();
      cache = new Map(
        Object.entries(parsed).filter(([, v]) => now - v.firedAt < TTL_MS)
      );
    }
  } catch {
    cache = new Map();
  }
  loaded = true;
}

async function persist(): Promise<void> {
  try {
    const obj: Record<string, GuardEntry> = {};
    cache.forEach((v, k) => { obj[k] = v; });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch { /* best effort */ }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a stable deduplication key for a notification event.
 *
 * - Signal events:  "<type>:<signalId>"
 * - Scan complete:  "scan:<minute-bucket>" (fires at most once per minute)
 */
export function buildNotifKey(
  type: string,
  signalId?: string | null
): string {
  if (signalId) return `${type}:${signalId}`;
  // Use 60-second time bucket for events without a signalId
  const bucket = Math.floor(Date.now() / 60_000);
  return `${type}:bucket_${bucket}`;
}

/**
 * Returns true if this notification has NOT been fired before —
 * i.e. it is safe to fire now.
 *
 * Call this BEFORE scheduling a local notification.
 * On first call it loads the persisted store from AsyncStorage.
 */
export async function shouldFireNotification(key: string): Promise<boolean> {
  await load();
  const existing = cache.get(key);
  if (existing) {
    // Already fired within TTL — suppress
    return false;
  }
  return true;
}

/**
 * Mark a notification key as fired. Call this immediately after scheduling.
 */
export async function markNotificationFired(key: string): Promise<void> {
  await load();
  cache.set(key, { firedAt: Date.now() });
  // Prune stale entries while we're at it
  const now = Date.now();
  cache.forEach((v, k) => {
    if (now - v.firedAt >= TTL_MS) cache.delete(k);
  });
  persist(); // fire-and-forget
}

/**
 * Check and mark in one atomic step.
 * Returns true if the notification was new (and is now marked as fired).
 * Returns false if it was already seen (do NOT fire).
 */
export async function checkAndMark(key: string): Promise<boolean> {
  const isNew = await shouldFireNotification(key);
  if (isNew) await markNotificationFired(key);
  return isNew;
}

/**
 * Returns true if an event timestamp is recent enough to act on.
 * Any event older than 15 minutes is treated as historical and suppressed.
 * Pass the signal's `created_at` or WS event `timestamp` (epoch ms or ISO string).
 */
export function isEventFresh(eventTimestamp?: number | string | null): boolean {
  if (!eventTimestamp) return true; // no timestamp → assume new
  const ts = typeof eventTimestamp === 'string' ? new Date(eventTimestamp).getTime() : eventTimestamp;
  if (isNaN(ts)) return true;
  return Date.now() - ts <= MAX_EVENT_AGE;
}

// ── Per-pair resolution cooldown ────────────────────────────────────────────
// Once a signal resolves (TP3/stopped/expired), the pair is "locked" until
// a new approaching/active signal is detected, which resets the lock.

let resolvedPairs: Set<string> = new Set();
let resolvedLoaded = false;

async function loadResolvedPairs(): Promise<void> {
  if (resolvedLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(PAIR_LOCK_KEY);
    if (raw) resolvedPairs = new Set(JSON.parse(raw) as string[]);
  } catch {
    resolvedPairs = new Set();
  }
  resolvedLoaded = true;
}

async function persistResolvedPairs(): Promise<void> {
  try {
    await AsyncStorage.setItem(PAIR_LOCK_KEY, JSON.stringify([...resolvedPairs]));
  } catch { /* best effort */ }
}

/**
 * Returns true if this pair has a resolved signal and should NOT receive
 * more notifications until a new setup (approaching/active) resets it.
 */
export async function isPairResolved(pair?: string | null): Promise<boolean> {
  if (!pair) return false;
  await loadResolvedPairs();
  return resolvedPairs.has(pair);
}

/**
 * Call when a signal FULLY resolves (TP3_hit, stopped, expired).
 * Silences all further notifications for this pair.
 */
export async function markPairResolved(pair?: string | null): Promise<void> {
  if (!pair) return;
  await loadResolvedPairs();
  resolvedPairs.add(pair);
  persistResolvedPairs();
}

/**
 * Call when a NEW setup is detected for a pair (signal_approaching / signal_active).
 * Lifts the silence so the user receives notifications for this new setup.
 */
export async function clearPairResolved(pair?: string | null): Promise<void> {
  if (!pair) return;
  await loadResolvedPairs();
  if (resolvedPairs.has(pair)) {
    resolvedPairs.delete(pair);
    persistResolvedPairs();
  }
}

/**
 * Clear all fired notification keys (e.g. on sign-out / fresh install).
 */
export async function clearNotificationGuard(): Promise<void> {
  cache = new Map();
  loaded = true;
  resolvedPairs = new Set();
  resolvedLoaded = true;
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {}),
    AsyncStorage.removeItem(PAIR_LOCK_KEY).catch(() => {}),
  ]);
}
