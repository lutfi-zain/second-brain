/**
 * Rate limiting utilities using Cloudflare Workers KV
 */

export interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  resetTimeFormatted?: string;
}

/**
 * Simple rate limiter using Workers KV
 * Tracks requests by client identifier in a time window
 */
export class RateLimiter {
  private readonly keyPrefix: string;

  constructor(
    private readonly kv: KVNamespace,
    private readonly config: RateLimitConfig,
    keyPrefix: string = 'rate_limit'
  ) {
    this.keyPrefix = keyPrefix;
  }

  /**
   * Check if a request should be rate limited
   * @param identifier Client identifier (IP, user ID, etc.)
   * @returns Promise resolving to rate limit status
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = `${this.keyPrefix}:${identifier}`;

    try {
      // Get current request data for this identifier
      const existingData = await this.kv.getWithMetadata(key);

      let requestData: number[] = [];

      if (existingData.value) {
        try {
          // Parse stored request timestamps
          const parsed = JSON.parse(existingData.value);
          if (Array.isArray(parsed)) {
            // Filter out requests outside the current window
            requestData = parsed.filter((timestamp: number) => timestamp > windowStart);
          }
        } catch (error) {
          // If parsing fails, start fresh
          requestData = [];
        }
      }

      // Add current request timestamp
      requestData.push(now);

      // Remove expired entries and count recent requests
      const currentWindowRequests = requestData.filter((timestamp: number) => timestamp > windowStart);
      const requestCount = currentWindowRequests.length;

      // Calculate reset time (when the oldest request in window expires)
      let resetTime = now + this.config.windowMs;
      if (currentWindowRequests.length > 0) {
        const oldestRequest = Math.min(...currentWindowRequests);
        resetTime = oldestRequest + this.config.windowMs;
      }

      const remaining = Math.max(0, this.config.maxRequests - requestCount);
      const allowed = requestCount < this.config.maxRequests;

      // Store updated request data with expiration
      const expiration = Math.ceil(this.config.windowMs / 1000); // Convert to seconds for KV
      await this.kv.put(key, JSON.stringify(currentWindowRequests), {
        expirationTtl: expiration,
      });

      return {
        allowed,
        remaining,
        resetTime,
        resetTimeFormatted: new Date(resetTime).toISOString(),
      };
    } catch (error) {
      // If KV operation fails, allow the request but log the error
      console.error('Rate limit check failed:', error);
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
        resetTimeFormatted: new Date(now + this.config.windowMs).toISOString(),
      };
    }
  }

  /**
   * Reset the rate limit for a specific identifier
   * @param identifier Client identifier to reset
   */
  async resetLimit(identifier: string): Promise<void> {
    const key = `${this.keyPrefix}:${identifier}`;
    try {
      await this.kv.delete(key);
    } catch (error) {
      console.error('Failed to reset rate limit:', error);
    }
  }

  /**
   * Get current rate limit status without incrementing
   * @param identifier Client identifier
   */
  async getStatus(identifier: string): Promise<RateLimitResult | null> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    const key = `${this.keyPrefix}:${identifier}`;

    try {
      const existingData = await this.kv.get(key);

      if (!existingData) {
        return null;
      }

      const requestData: number[] = JSON.parse(existingData);
      const currentWindowRequests = requestData.filter((timestamp: number) => timestamp > windowStart);
      const requestCount = currentWindowRequests.length;

      let resetTime = now + this.config.windowMs;
      if (currentWindowRequests.length > 0) {
        const oldestRequest = Math.min(...currentWindowRequests);
        resetTime = oldestRequest + this.config.windowMs;
      }

      const remaining = Math.max(0, this.config.maxRequests - requestCount);
      const allowed = requestCount < this.config.maxRequests;

      return {
        allowed,
        remaining,
        resetTime,
        resetTimeFormatted: new Date(resetTime).toISOString(),
      };
    } catch (error) {
      console.error('Failed to get rate limit status:', error);
      return null;
    }
  }
}

// Predefined rate limit configurations
export const RATE_LIMIT_CONFIGS = {
  // 10 requests per minute (generous for development)
  DEVELOPMENT: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 10,
  },
  // 60 requests per minute (production-ready)
  PRODUCTION: {
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 60,
  },
  // 100 requests per hour (for rate limiting expensive operations)
  EXPENSIVE_OPERATIONS: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 100,
  },
  // 1000 requests per hour (high volume)
  HIGH_VOLUME: {
    windowMs: 60 * 60 * 1000,  // 1 hour
    maxRequests: 1000,
  },
} as const;

/**
 * Rate limiting middleware for Hono applications
 */
export function createRateLimitMiddleware(
  kv: KVNamespace,
  config: RateLimitConfig,
  getIdentifier: (request: Request) => string
) {
  const limiter = new RateLimiter(kv, config, 'mcp_rate_limit');

  return async (c: any, next: () => Promise<void>) => {
    const identifier = getIdentifier(c.req.raw);
    const rateLimitResult = await limiter.checkLimit(identifier);

    // Add rate limit headers to response
    c.res.headers.set('X-RateLimit-Limit', config.maxRequests.toString());
    c.res.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    c.res.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString());

    if (!rateLimitResult.allowed) {
      c.res.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

      return c.json({
        error: 'Rate limit exceeded',
        message: `Too many requests. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`,
        retryAfter: rateLimitResult.resetTime,
        retryAfterFormatted: rateLimitResult.resetTimeFormatted,
      }, 429);
    }

    await next();
  };
}