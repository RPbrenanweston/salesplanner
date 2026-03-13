/**
 * In-memory rate limiter for API endpoints.
 *
 * Uses a sliding window algorithm: tracks timestamps of requests
 * per key (typically IP address or user ID) and rejects requests
 * that exceed the configured threshold within the window period.
 *
 * Note: In-memory rate limiting resets on server restart and is
 * per-instance (not shared across multiple serverless functions).
 * For production at scale, consider Redis-based rate limiting.
 */

interface RateLimitEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_CONFIG: RateLimiterConfig = {
  windowMs: 60_000, // 1 minute
  maxRequests: 10,
};

/** Maximum entries before LRU eviction kicks in (prevents unbounded memory growth) */
const MAX_STORE_SIZE = 10_000;

/** Percentage of store to evict when cap is reached */
const EVICT_RATIO = 0.1;

const store = new Map<string, RateLimitEntry>();

/**
 * Check if a key (typically IP address or user ID) has exceeded the rate limit.
 * If not rate limited, the request is recorded.
 *
 * Uses Map insertion-order as an LRU proxy: accessed keys are
 * deleted and re-inserted (moved to end). Eviction removes the
 * oldest 10% when store hits MAX_STORE_SIZE.
 *
 * @param key - The rate limit key (e.g., client IP or `api:${userId}`)
 * @param config - Optional configuration override
 * @returns true if the key is rate limited, false otherwise
 */
export function isRateLimited(
  key: string,
  config: RateLimiterConfig = DEFAULT_CONFIG
): boolean {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    // Evict oldest entries when store reaches capacity
    if (store.size >= MAX_STORE_SIZE) {
      const evictCount = Math.ceil(MAX_STORE_SIZE * EVICT_RATIO);
      const keys = store.keys();
      for (let i = 0; i < evictCount; i++) {
        const next = keys.next();
        if (next.done) break;
        store.delete(next.value);
      }
    }
    store.set(key, { timestamps: [now] });
    return false;
  }

  // Move to end of Map for LRU ordering (delete + re-insert)
  store.delete(key);

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter(
    (ts) => now - ts < config.windowMs
  );

  if (entry.timestamps.length >= config.maxRequests) {
    store.set(key, entry);
    return true;
  }

  entry.timestamps.push(now);
  store.set(key, entry);
  return false;
}

/**
 * Extract the client IP address from a Request's headers.
 * Checks x-forwarded-for (common in reverse proxy setups) and x-real-ip.
 * Falls back to "unknown" if no IP header is present.
 */
export function getClientIP(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Reset rate limiter state. Exported for testing only.
 * @internal
 */
export function _resetRateLimitForTesting(): void {
  store.clear();
}
