// services/rateLimit.js
// Simple sliding-window counter per key (IP). Config via env or params.
const buckets = new Map();

function makeRateLimiter({ windowMs = 60 * 1000, max = 20, keyFn } = {}) {
  keyFn = keyFn || ((req) => {
    // normalize X-Forwarded-For -> first address else req.ip
    const xff = req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For'];
    if (xff) return String(xff).split(',')[0].trim();
    return req.ip || req.socket?.remoteAddress || 'unknown';
  });

  return (req, res, next) => {
    try {
      const key = keyFn(req);
      const now = Date.now();
      let entry = buckets.get(key);
      if (!entry) {
        entry = { count: 1, start: now };
        buckets.set(key, entry);
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
        return next();
      }

      // window expired -> reset
      if (now - entry.start > windowMs) {
        entry.start = now;
        entry.count = 1;
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(Math.max(0, max - 1)));
        return next();
      }

      entry.count += 1;
      const remaining = Math.max(0, max - entry.count);
      res.set('X-RateLimit-Limit', String(max));
      res.set('X-RateLimit-Remaining', String(remaining));

      if (entry.count > max) {
        const retrySecs = Math.ceil((windowMs - (now - entry.start)) / 1000);
        res.set('Retry-After', String(retrySecs));
        return res.status(429).json({ error: 'rate_limited', retryAfter: retrySecs, message: 'Too many requests' });
      }

      return next();
    } catch (e) {
      // on error, don't block requests
      return next();
    }
  };
}

module.exports = makeRateLimiter;
