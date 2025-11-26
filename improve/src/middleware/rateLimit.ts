import { Elysia } from 'elysia';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { redis } from '../cache'; // Import instance redis có sẵn

// 1. Cấu hình giới hạn
const maxRequests = parseInt(process.env.RATE_LIMIT_MAX || '20', 10);
const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const windowSec = Math.ceil(windowMs / 1000);

// 2. Khởi tạo RateLimiterRedis
// Thư viện này tự động quản lý Lua script và Atomic operation
const rateLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'ratelimit',
  points: maxRequests, // Số request tối đa
  duration: windowSec, // Trong khoảng thời gian này (giây)
  // blockDuration: 60, // Tùy chọn: Nếu muốn phạt user bị block thêm thời gian thì uncomment dòng này
});

// 3. Main Middleware Plugin
export const rateLimitMiddleware = new Elysia()
  .onBeforeHandle(async ({ request, set }) => {
    const ip = request.headers.get('x-real-ip') || 
               request.headers.get('x-forwarded-for')?.split(',')[0] || 
               'unknown';

    try {
      // Consume 1 point cho mỗi request
      const rateLimiterRes = await rateLimiter.consume(ip);

      // --- TRƯỜNG HỢP THÀNH CÔNG (Chưa vượt quá limit) ---
      
      // Tính toán headers
      const headers = {
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimiterRes.remainingPoints.toString(),
        'X-RateLimit-Reset': new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString(),
      };

      // Gán headers vào response
      Object.assign(set.headers, headers);

    } catch (rateLimiterRes) {
      // --- TRƯỜNG HỢP LỖI HOẶC VƯỢT QUÁ LIMIT ---

      // Kiểm tra xem lỗi do vượt quá limit hay lỗi Redis/Internal
      // Nếu là object RateLimiterRes thì là do vượt quá limit
      if (rateLimiterRes instanceof Error) {
        console.error('Rate limit internal error:', rateLimiterRes);
        // Fail open: Nếu Redis lỗi, cho phép request đi qua
        return; 
      }

      // Ép kiểu để lấy thông tin (do thư viện trả về object trong catch khi block)
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