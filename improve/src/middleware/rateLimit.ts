import type { Context } from 'elysia';
import * as cache from '../cache';

const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const windowSec = Math.ceil(windowMs / 1000);

export async function rateLimitMiddleware(ctx: Context): Promise<void | Response> {
  const ip = ctx.request.headers.get('x-real-ip') || 
             ctx.request.headers.get('x-forwarded-for')?.split(',')[0] ||
             'unknown';

  const key = `ratelimit:${ip}`;

  try {
    const currentTTL = await cache.ttl(key);
    let count: number;

    if (currentTTL === -2 || currentTTL === -1) {
      count = await cache.incr(key);
      await cache.expire(key, windowSec);
    } else {
      count = await cache.incr(key);
    }

    const remaining = Math.max(0, maxRequests - count);
    const resetTime = Math.floor(Date.now() / 1000) + (currentTTL > 0 ? currentTTL : windowSec);

    ctx.set.headers['X-RateLimit-Limit'] = maxRequests.toString();
    ctx.set.headers['X-RateLimit-Remaining'] = remaining.toString();
    ctx.set.headers['X-RateLimit-Reset'] = resetTime.toString();

    if (count > maxRequests) {
      const retryAfter = currentTTL > 0 ? currentTTL : windowSec;
      
      return new Response(
        JSON.stringify({ 
          error: 'rate_limited', 
          message: 'Too many requests, please try later.',
          retryAfter 
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': resetTime.toString(),
          }
        }
      );
    }
  } catch (err) {
    console.error('Rate limit error:', err);
  }
}
