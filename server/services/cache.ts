/**
 * Lightweight in-memory TTL cache.
 *
 * MLB data (schedule, odds, weather, model picks) only changes meaningfully on
 * the order of an hour, but the dashboard re-fetches several external APIs on
 * every page load (~10s cold). Caching the aggregate result makes repeat loads
 * near-instant and protects the UI from a single slow/flaky upstream (e.g. The
 * Odds API ECONNRESET) — a stale-but-recent result is far better than an empty
 * dashboard.
 *
 * This is process-local memory. On Cloud Run with min-instances=0 a cold start
 * starts empty, which is fine — the first request warms it.
 */

type Entry<T> = { value: T; expires: number };

const store = new Map<string, Entry<unknown>>();

/**
 * Get a cached value or compute it via `producer`. If `producer` throws but a
 * stale value exists, the stale value is returned (fail-soft). If no stale
 * value exists, the error propagates.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  producer: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit && hit.expires > now) {
    return hit.value;
  }

  try {
    const value = await producer();
    store.set(key, { value, expires: now + ttlMs });
    return value;
  } catch (err) {
    if (hit) {
      // Serve stale rather than fail — keeps the UI populated when an upstream
      // API is temporarily unreachable.
      console.warn(
        `[cache] producer for "${key}" failed, serving stale value:`,
        (err as Error).message
      );
      return hit.value;
    }
    throw err;
  }
}

/** Manually invalidate a cache key (e.g. on a forced refresh). */
export function invalidate(key: string): void {
  store.delete(key);
}

/** Clear the entire cache. */
export function clearCache(): void {
  store.clear();
}

/** Common TTLs. */
export const TTL = {
  schedule: 10 * 60 * 1000, // 10 min — schedule/probables rarely change intraday
  odds: 5 * 60 * 1000, // 5 min — odds move, but not second-to-second
  weather: 30 * 60 * 1000, // 30 min — ballpark weather
  picks: 5 * 60 * 1000, // 5 min — aggregate model output
  teams: 60 * 60 * 1000, // 1 hour — team/season stats
};
