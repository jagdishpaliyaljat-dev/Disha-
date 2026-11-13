export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface BucketEntry {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private buckets = new Map<string, BucketEntry>();
  private readonly maxBuckets: number;

  constructor(maxBuckets = 5000) {
    this.maxBuckets = maxBuckets;
  }

  check(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const now = Date.now();
    const cutoff = now - config.windowMs;

    if (this.buckets.size > this.maxBuckets) {
      for (const [k, entry] of this.buckets.entries()) {
        if (entry.timestamps.length === 0 || entry.timestamps[entry.timestamps.length - 1] < cutoff) {
          this.buckets.delete(k);
        }
      }
    }

    const existing = this.buckets.get(key) || { timestamps: [] };
    existing.timestamps = existing.timestamps.filter((ts) => ts > cutoff);

    if (existing.timestamps.length >= config.maxRequests) {
      const oldest = existing.timestamps[0] || now;
      const retryAfterMs = Math.max(1000, config.windowMs - (now - oldest));
      this.buckets.set(key, existing);
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }

    existing.timestamps.push(now);
    this.buckets.set(key, existing);
    return {
      allowed: true,
      remaining: Math.max(0, config.maxRequests - existing.timestamps.length),
      retryAfterSeconds: 0,
    };
  }

  reset(): void {
    this.buckets.clear();
  }
}
