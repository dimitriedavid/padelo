export type RateLimitPolicy = {
  max: number;
  windowMs: number;
};

export type ActiveLimitPolicy = {
  max: number;
};

export type RateLimitPolicies = {
  createTournament: RateLimitPolicy;
  lookupTournament: RateLimitPolicy;
  writeTournament: RateLimitPolicy;
  openTournamentStream: RateLimitPolicy;
  activeTournamentStreams: ActiveLimitPolicy;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  windowMs: number;
};

export type RateLimitLease = {
  limit: number;
  active: number;
  release: () => void;
};

export interface RateLimiter {
  check(scope: string, key: string, policy: RateLimitPolicy): RateLimitResult;
  acquire(scope: string, key: string, policy: ActiveLimitPolicy): RateLimitLease | null;
}

export const DEFAULT_RATE_LIMIT_POLICIES: RateLimitPolicies = {
  createTournament: { max: 20, windowMs: 60_000 },
  lookupTournament: { max: 60, windowMs: 60_000 },
  writeTournament: { max: 120, windowMs: 60_000 },
  openTournamentStream: { max: 30, windowMs: 60_000 },
  activeTournamentStreams: { max: 50 },
};

type Bucket = {
  count: number;
  resetAt: number;
};

export class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly active = new Map<string, number>();
  private checksSincePrune = 0;

  constructor(private readonly now = () => Date.now()) {}

  check(scope: string, key: string, policy: RateLimitPolicy): RateLimitResult {
    const bucketKey = this.bucketKey(scope, key);
    const now = this.now();
    let bucket = this.buckets.get(bucketKey);

    if (!bucket || bucket.resetAt <= now) {
      bucket = {
        count: 0,
        resetAt: now + policy.windowMs,
      };
      this.buckets.set(bucketKey, bucket);
    }

    if (bucket.count >= policy.max) {
      return {
        allowed: false,
        limit: policy.max,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterSeconds: retryAfterSeconds(now, bucket.resetAt),
        windowMs: policy.windowMs,
      };
    }

    bucket.count += 1;
    this.pruneExpiredBuckets(now);

    return {
      allowed: true,
      limit: policy.max,
      remaining: Math.max(0, policy.max - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterSeconds: retryAfterSeconds(now, bucket.resetAt),
      windowMs: policy.windowMs,
    };
  }

  acquire(scope: string, key: string, policy: ActiveLimitPolicy): RateLimitLease | null {
    const bucketKey = this.bucketKey(scope, key);
    const current = this.active.get(bucketKey) ?? 0;

    if (current >= policy.max) {
      return null;
    }

    let released = false;
    const next = current + 1;
    this.active.set(bucketKey, next);

    return {
      limit: policy.max,
      active: next,
      release: () => {
        if (released) {
          return;
        }

        released = true;
        const active = this.active.get(bucketKey) ?? 0;

        if (active <= 1) {
          this.active.delete(bucketKey);
          return;
        }

        this.active.set(bucketKey, active - 1);
      },
    };
  }

  private bucketKey(scope: string, key: string): string {
    return `${scope}:${key}`;
  }

  private pruneExpiredBuckets(now: number): void {
    this.checksSincePrune += 1;

    if (this.checksSincePrune < 500) {
      return;
    }

    this.checksSincePrune = 0;

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

function retryAfterSeconds(now: number, resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - now) / 1000));
}
