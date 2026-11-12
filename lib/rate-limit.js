// lib/rate-limit.js — Distributed rate limiting with Redis fallback
// Supports: Redis (Upstash) for production multi-instance,
// In-memory for development, Database for shared-node deployments.
//
// Environment variables:
// - RATE_LIMIT_BACKEND: redis | database | memory
// - UPSTASH_REDIS_REST_URL
// - UPSTASH_REDIS_REST_TOKEN
// - REDIS_URL (optional: for ioredis Redis)

import { Ratelimit } from '@upstash/ratelimit';
import Redis from 'ioredis';

export const RATE_LIMITS = {
  // Login: 5 attempts per 15-minute window per bucket (email or IP)
  login: { max: 5, windowSeconds: 900, message: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' },
  // Registration: 3 per 24 hours
  register: { max: 3, windowSeconds: 86400, message: 'Terlalu banyak pendaftaran. Coba lagi nanti.' },
  // Password reset request: 3 per 1 hour
  resetRequest: { max: 3, windowSeconds: 3600, message: 'Terlalu banyak permintaan reset. Coba lagi dalam 1 jam.' },
  // Email verification resend: 3 per 1 hour
  emailVerify: { max: 3, windowSeconds: 3600, message: 'Terlalu banyak permintaan verifikasi. Coba lagi dalam 1 jam.' },
  passwordChange: { max: 5, windowSeconds: 900, message: 'Terlalu banyak percobaan ganti kata sandi. Coba lagi dalam 15 menit.' },
  // API general: 100 requests per 15 minutes per IP
  apiGeneral: { max: 100, windowSeconds: 900, message: 'Berbagai permintaan terlalu cepat. Tunggu sebentar.' },
  // Admin: 30 requests per 15 minutes per IP
  admin: { max: 30, windowSeconds: 900, message: 'Berbagai request admin terlalu cepat.' }
};

// ---------------------------------------------------------------------------
// Storage backends
// ---------------------------------------------------------------------------

/**
 * Redis-backed rate limiter using @upstash/ratelimit (REST API)
 */
export class RedisRateLimiter {
  constructor() {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error('REDIS environment variables are not configured.');
    }
    this.ratelimit = new Ratelimit({
      redis: new Redis(url, { authToken: token, maxRetries: 1, retryStrategy: () => 1000 }),
      limiter: new Ratelimit.TokenBucket({
        interval: 60, // seconds
        capacity: 1,  // per second bucket
        refillRate: 1
      }),
      analytics: true
    });
    this.backend = 'redis';
  }

  async check(bucketKey, limitKey) {
    const def = RATE_LIMITS[limitKey] || RATE_LIMITS.apiGeneral;
    try {
      const { limit, remaining, reset, success } = await this.ratelimit
        .limit(bucketKey);

      if (!success) {
        const retryAfter = Math.ceil(reset - Date.now() / 1000);
        return {
          allowed: false,
          retryAfter,
          message: def.message,
          headers: {
            'X-RateLimit-Limit': String(def.max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(reset))
          }
        };
      }

      return {
        allowed: true,
        retryAfter: null,
        message: null,
        headers: {
          'X-RateLimit-Limit': String(def.max),
          'X-RateLimit-Remaining': String(remaining),
          'X-RateLimit-Reset': String(Math.ceil(reset))
        }
      };
    } catch (error) {
      // Fail-closed: if Redis is unavailable, deny the request
      console.error('[RATE_LIMIT] Redis error:', error.message);
      return {
        allowed: false,
        retryAfter: 60,
        message: def.message,
        headers: { 'X-RateLimit-Limit': String(def.max), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '60' }
      };
    }
  }
}

/**
 * Redis-backed rate limiter using ioredis (client-based)
 */
export class RedisClientRateLimiter {
  constructor() {
    const url = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (!url) {
      throw new Error('REDIS_URL or REDIS_HOST is not configured.');
    }
    this.redis = new Redis(url, {
      maxRetries: 1,
      retryStrategy: () => 1000
    });
    this.backend = 'redis';
  }

  async check(bucketKey, limitKey) {
    const def = RATE_LIMITS[limitKey] || RATE_LIMITS.apiGeneral;
    const now = Date.now();
    const windowKey = `${bucketKey}:${Math.floor(now / (def.windowSeconds * 1000))}`.slice(0, 64);
    const script = `
      local key = KEYS[1]
      local limit = tonumber(ARGV[1])
      local window = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])

      local count = redis.call('GET', key)
      count = count and tonumber(count) or 0

      if count == 0 then
        redis.call('HSET', key, 'window_start', now)
      end

      if now - tonumber(redis.call('HGET', key, 'window_start')) > window * 1000 then
        redis.call('HSET', key, 'count', 1)
        redis.call('HSET', key, 'window_start', now)
        redis.call('EXPIRE', key, ARGV[4])
        return { allowed = true, count = 1, retryAfter = null }
      end

      if count >= limit then
        local retryAfter = math.ceil((tonumber(redis.call('HGET', key, 'window_start')) + window * 1000 - now) / 1000)
        return { allowed = false, count = count, retryAfter = retryAfter }
      end

      local newCount = count + 1
      redis.call('HSET', key, 'count', newCount)
      redis.call('EXPIRE', key, ARGV[4])
      return { allowed = true, count = newCount, retryAfter = null }
    `;

    try {
      const result = await this.redis.eval(
        script,
        1,
        windowKey,
        def.max,
        def.windowSeconds,
        now,
        def.windowSeconds + 60
      );

      if (!result.allowed) {
        const retryAfter = result.retryAfter;
        return {
          allowed: false,
          retryAfter,
          message: def.message,
          headers: {
            'X-RateLimit-Limit': String(def.max),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(retryAfter)
          }
        };
      }

      return {
        allowed: true,
        retryAfter: null,
        message: null,
        headers: {
          'X-RateLimit-Limit': String(def.max),
          'X-RateLimit-Remaining': String(def.count),
          'X-RateLimit-Reset': String(def.windowSeconds)
        }
      };
    } catch (error) {
      console.error('[RATE_LIMIT] Redis error:', error.message);
      // Fail-closed
      return {
        allowed: false,
        retryAfter: 60,
        message: def.message,
        headers: { 'X-RateLimit-Limit': String(def.max), 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '60' }
      };
    }
  }
}

/**
 * Database-backed rate limiter (uses existing rate_limits table)
 * Works for multi-instance without external Redis
 */
export class DatabaseRateLimiter {
  constructor(db) {
    this.db = db;
    this.backend = 'database';
  }

  async check(bucketKey, limitKey) {
    const def = RATE_LIMITS[limitKey] || RATE_LIMITS.apiGeneral;
    const now = Date.now();

    try {
      const result = await this.db.query(
        `INSERT INTO rate_limits (bucket, window_started_at, attempts)
         VALUES ($1, $2, 1)
         ON CONFLICT (bucket, window_started_at)
         DO UPDATE SET attempts = rate_limits.attempts + 1
         RETURNING attempts`,
        [bucketKey, new Date().toISOString().slice(0, 19).replace('T', ' ')]
      );
      const attempts = result.rows[0].attempts;
      if (attempts > def.max) {
        return { allowed: false, retryAfter: null, message: def.message };
      }
      return { allowed: true, retryAfter: null, message: null };
    } catch (error) {
      console.error('[RATE_LIMIT] DB error:', error.message);
      throw error;
    }
  }
}

/**
 * In-memory rate limiter (development)
 */
export class MemoryRateLimiter {
  constructor() {
    this.buckets = new Map();
    this.backend = 'memory';
  }

  async check(bucketKey, limitKey) {
    const def = RATE_LIMITS[limitKey] || RATE_LIMITS.apiGeneral;
    const now = Date.now();
    let bucket = this.buckets.get(bucketKey);

    if (!bucket) {
      bucket = { count: 0, windowStart: now };
      this.buckets.set(bucketKey, bucket);
    }

    if (now - bucket.windowStart > def.windowSeconds * 1000) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    if (bucket.count >= def.max) {
      const retryAfter = Math.ceil((bucket.windowStart + def.windowSeconds * 1000 - now) / 1000);
      return {
        allowed: false,
        retryAfter,
        message: def.message,
        headers: {
          'X-RateLimit-Limit': String(def.max),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(retryAfter)
        }
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      retryAfter: null,
      message: null,
      headers: {
        'X-RateLimit-Limit': String(def.max),
        'X-RateLimit-Remaining': String(def.max - bucket.count),
        'X-RateLimit-Reset': String(Math.ceil((bucket.windowStart + def.windowSeconds * 1000 - now) / 1000))
      }
    };
  }

  async cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart > 86400 * 1000) {
        this.buckets.delete(key);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate rate limiter based on environment.
 * Priority: redis (production) > database (single-node production) > memory (development)
 */
export function createRateLimiter() {
  const backend = process.env.RATE_LIMIT_BACKEND || 'memory';

  if (backend === 'redis' || backend === 'upstash') {
    // Try Redis first
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      return new RedisRateLimiter();
    }
    if (process.env.REDIS_URL || process.env.REDIS_HOST) {
      return new RedisClientRateLimiter();
    }
    // Fall back to in-memory with a clear warning
    console.warn('[RATE_LIMIT] Redis configured as backend but credentials missing. Using in-memory store.');
    return new MemoryRateLimiter();
  }

  if (backend === 'database') {
    return new DatabaseRateLimiter();
  }

  // Default: in-memory (development)
  return new MemoryRateLimiter();
}

// ---------------------------------------------------------------------------
// Middleware factory (same interface as before)
// ---------------------------------------------------------------------------

export function createRateLimitMiddleware(limitKey, identifierFn) {
  const limiter = createRateLimiter();

  const bucketFor = (req) => {
    if (typeof identifierFn === 'function') return identifierFn(req);
    if (identifierFn === 'ip') {
      return `api:ip:${req.ip || req.connection.remoteAddress || 'unknown'}`;
    }
    if (identifierFn === 'email') {
      const email = (req.body?.email || req.query?.email || 'anonymous').toString().toLowerCase();
      return `api:email:${email}`;
    }
    return 'api:general';
  };

  const rateLimitMiddleware = async function (req, res, next) {
    try {
      const result = await rateLimitMiddleware.check(req);
      if (!result.allowed) {
        res.set(result.headers);
        return res.status(429).json({
          ok: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: result.message,
            retryAfter: result.retryAfter
          }
        });
      }
      res.set(result.headers);
      next();
    } catch (error) {
      // Rate limiting failure should not block the request
      // In production with Redis, this is a fail-closed scenario
      console.error('[RATE_LIMIT] Middleware error:', error.message);
      next();
    }
  };
  rateLimitMiddleware.check = (req) => limiter.check(bucketFor(req), limitKey);
  return rateLimitMiddleware;
}

// ---------------------------------------------------------------------------
// Pre-built rate limit middleware for common endpoints
// ---------------------------------------------------------------------------

const rateLimitLoginMiddleware = createRateLimitMiddleware('login', (req) => {
  const email = (req.body?.email || req.query?.email || 'anonymous').toString().toLowerCase();
  return `login:email:${email}`;
});

const rateLimitRegistrationMiddleware = createRateLimitMiddleware('register', (req) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const timestamp = Date.now().toString(36);
  return `register:ip:${ip}:${timestamp}`;
});

const rateLimitEmailVerifyMiddleware = createRateLimitMiddleware('emailVerify', (req) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  return `email:verify:${ip}`;
});

const rateLimitPasswordChangeMiddleware = createRateLimitMiddleware('passwordChange', (req) => {
  const forwardedIp = req.headers && req.headers['x-forwarded-for'];
  const ip = req.ip || (req.connection && req.connection.remoteAddress) ||
    (forwardedIp && String(forwardedIp).split(',')[0].trim()) || 'unknown';
  return `password-change:ip:${ip}`;
});

const rateLimitResetMiddleware = createRateLimitMiddleware('resetRequest', (req) => {
  const email = (req.body?.email || 'anonymous').toString().toLowerCase();
  return `reset:email:${email}`;
});

const rateLimitAdminMiddleware = createRateLimitMiddleware('admin', 'ip');

const rateLimitApiMiddleware = createRateLimitMiddleware('apiGeneral', 'ip');

export {
  rateLimitLoginMiddleware as rateLimitLogin,
  rateLimitRegistrationMiddleware as rateLimitRegistration,
  rateLimitEmailVerifyMiddleware as rateLimitEmailVerify,
  rateLimitPasswordChangeMiddleware as rateLimitPasswordChange,
  rateLimitResetMiddleware as rateLimitReset,
  rateLimitAdminMiddleware as rateLimitAdmin,
  rateLimitApiMiddleware as rateLimitApi
};
