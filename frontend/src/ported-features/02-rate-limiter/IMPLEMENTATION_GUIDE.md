# 02 — Rate Limiter

## Source
**From:** JobTrackr (ported to SalesBlock) `src/lib/auth/rate-limiter.ts`

## What You Get

An in-memory sliding window rate limiter with:
- Per-key tracking with configurable window and max requests
- LRU eviction (MAX_STORE_SIZE=10,000, EVICT_RATIO=0.1) to prevent memory growth in serverless
- Client IP extraction from X-Forwarded-For / X-Real-IP / socket
- Test helper for resetting state
- **Zero external dependencies** — pure TypeScript

## Files Copied

| Source File | Purpose |
|---|---|
| `source/rate-limiter.ts` | Complete rate limiter with `isRateLimited()`, `getClientIP()`, `_resetRateLimitForTesting()` |

## Implementation Steps

### Step 1: Review the API

The rate limiter exposes 3 functions:

```typescript
isRateLimited(key: string, config?: { windowMs?: number, maxRequests?: number }): boolean
getClientIP(request: Request): string
_resetRateLimitForTesting(): void
```

Defaults: 10 requests per 60 seconds per key.

### Step 2: Decide Where to Apply

SalesBlock has several unprotected endpoints that need rate limiting:

| Endpoint | Suggested Config |
|---|---|
| OAuth token exchange (`/api/oauth/callback/*`) | 5 req / 60s per IP |
| Stripe webhooks (`/api/webhooks/stripe`) | 100 req / 60s per IP |
| Email reply tracking (`/api/track/reply`) | 50 req / 60s per IP |
| Contact creation API | 20 req / 60s per user |
| Sequence enrollment API | 10 req / 60s per user |
| Login/Auth endpoints | 5 req / 60s per IP |

### Step 3: Integration Pattern

**For Supabase Edge Functions:**

```typescript
import { isRateLimited, getClientIP } from "@/lib/rate-limiter"

// At top of Edge Function handler:
const ip = getClientIP(req)
if (isRateLimited(`oauth:${ip}`, { windowMs: 60_000, maxRequests: 5 })) {
  return new Response("Too many requests", { status: 429 })
}
```

**For Vite dev server / API routes:**

Same pattern — the rate limiter works with any `Request` object.

### Step 4: Rework for SalesBlock

Minimal changes needed:

1. **Move file** from `source/` to `frontend/src/lib/rate-limiter.ts`
2. **Remove @crumb comment** or update to SalesBlock format
3. **Adjust defaults** if needed — SalesBlock may want different limits than the original 10/60s default (ported from JobTrackr)
4. **Consider user-based keys** instead of IP-only. SalesBlock has authenticated users — use `user_id` as key for authenticated routes, IP for public routes:
   ```typescript
   const key = user?.id ? `api:${user.id}` : `api:${getClientIP(req)}`
   ```

### Step 5: Add Response Headers (Optional Enhancement)

```typescript
// After rate limit check, add standard headers:
headers.set("X-RateLimit-Limit", String(config.maxRequests))
headers.set("X-RateLimit-Remaining", String(remaining))
headers.set("X-RateLimit-Reset", String(resetTime))
```

## Dependencies to Install

**None.** Pure TypeScript, zero dependencies.

## Hazards (from @crumb metadata)

- In-memory store — resets on server restart / new serverless instance. Acceptable for Edge Functions (short-lived) but won't work for distributed rate limiting across multiple instances. For production scale, consider Redis-backed alternative.
- LRU eviction drops oldest 10% when store hits 10,000 entries — legitimate users could lose their window tracking during high traffic
- `getClientIP()` trusts X-Forwarded-For header — ensure reverse proxy (Vercel/Cloudflare) sets this correctly

## Estimated Effort
**Low** — 30 minutes. Copy file, update imports, add rate limit checks to 3-5 Edge Functions.
