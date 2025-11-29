import { Elysia } from 'elysia';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../cache';

const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const windowSec = Math.ceil(windowMs / 1000);

const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: maxRequests,
  duration: windowSec,
});

export const rateLimitMiddleware = new Elysia()
  .onBeforeHandle(async ({ request, set }) => {
    const ip = request.headers.get('x-real-ip') || 
               request.headers.get('x-forwarded-for')?.split(',')[0] || 
               'unknown';

    try {
      const rateLimiterRes = await rateLimiter.consume(ip);

      const headers = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimiterRes.remainingPoints.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
      };

      Object.assign(set.headers, headers);

    } catch (rateLimiterRes) {
      if (rateLimiterRes instanceof Error) {
        console.error('Rate limit internal error:', rateLimiterRes);
        return; 
      }

      const res = rateLimiterRes as { msBeforeNext: number; remainingPoints: number };
      const retryAfterSec = Math.ceil(res.msBeforeNext / 1000) || 1;

      set.status = 429;
      set.headers['Content-Type'] = 'application/json';
      set.headers['Retry-After'] = retryAfterSec.toString();
      set.headers['X-RateLimit-Limit'] = maxRequests.toString();
      set.headers['X-RateLimit-Remaining'] = '0';
      set.headers['X-RateLimit-Reset'] = new Date(Date.now() + res.msBeforeNext).toISOString();

      return {
        error: 'rate_limited',
        message: 'Too many requests, please try later.',
        retryAfter: retryAfterSec
      };
    }
  });