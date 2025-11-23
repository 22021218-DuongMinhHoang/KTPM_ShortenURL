// src/plugins/rateLimit/index.js
// Rate limiting plugin for Express apps.
// - Redis-backed via rate-limiter-flexible + ioredis when REDIS_URL set
// - Fallback to express-rate-limit (in-memory) otherwise
//
// Supports per-route config via RATE_LIMIT_CONFIG (JSON) or simple CSV via RATE_LIMIT_ROUTES
// Supports key by ip / header:<name> / cookie:<name>
// Ensures safe IPv6 handling by deferring to express-rate-limit's ip helper when appropriate.

const meta = { priority: 0, phase: 'both' };
const DEFAULT_BLOCK_MSG = 'Too many requests, please try later.';

function parseConfig() {
  const cfg = {};
  try {
    cfg.perRoute = [];
    if (process.env.RATE_LIMIT_CONFIG) {
      cfg.perRoute = JSON.parse(process.env.RATE_LIMIT_CONFIG);
    } else {
      const routes = (process.env.RATE_LIMIT_ROUTES || '/create').split(',').map(s => s.trim()).filter(Boolean);
      const max = Number(process.env.RATE_LIMIT_MAX || 20);
      const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000);
      cfg.perRoute = routes.map(r => ({ route: r, max, windowMs }));
    }
  } catch (e) {
    console.error('[rateLimit] invalid RATE_LIMIT_CONFIG JSON', e);
    cfg.perRoute = [{ route: '/create', max: Number(process.env.RATE_LIMIT_MAX || 20), windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000) }];
  }
  cfg.keyBy = process.env.RATE_LIMIT_KEY_BY || 'ip'; // 'ip' or 'header:x-api-key' or 'cookie:session'
  cfg.whitelist = (process.env.RATE_LIMIT_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
  cfg.skipPaths = (process.env.RATE_LIMIT_SKIP_PATHS || '').split(',').map(s => s.trim()).filter(Boolean);
  cfg.blockMsg = process.env.RATE_LIMIT_BLOCK_MESSAGE || DEFAULT_BLOCK_MSG;
  cfg.blockJson = (process.env.RATE_LIMIT_BLOCK_JSON || 'false') === 'true';
  cfg.redisUrl = process.env.REDIS_URL || '';
  return cfg;
}

function keyExtractorFromReq(req, keyBy) {
  if (!keyBy || keyBy === 'ip') {
    // Do NOT return req.ip directly when using express-rate-limit in-memory;
    // for in-memory mode we will not set keyGenerator and let express-rate-limit use its safe default.
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  }
  if (keyBy.startsWith('header:')) {
    const header = keyBy.split(':', 2)[1];
    return req.headers[header.toLowerCase()] || null;
  }
  if (keyBy.startsWith('cookie:')) {
    const cookieName = keyBy.split(':', 2)[1];
    const cookieHeader = req.headers.cookie || '';
    const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='));
    if (match) return match.split('=')[1];
    return null;
  }
  return null;
}

function inWhitelist(req, whitelist, keyBy) {
  if (!whitelist || whitelist.length === 0) return false;
  const keyVal = keyExtractorFromReq(req, keyBy) || req.ip || '';
  return whitelist.includes(keyVal);
}

module.exports = {
  meta,

  register: async function register({ app, metrics } = {}) {
    if (!app || typeof app.use !== 'function') {
      console.warn('[rateLimit] register called without valid app');
      return;
    }

    const cfg = parseConfig();

    // simple skipPaths check
    const isSkipped = (path) => cfg.skipPaths.some(p => p && path.startsWith(p));

    // ---- Redis-backed limiter (preferred for prod) ----
    if (cfg.redisUrl) {
      try {
        const { RateLimiterRedis } = require('rate-limiter-flexible');
        const IORedis = require('ioredis');

        const redisClient = new IORedis(cfg.redisUrl, { maxRetriesPerRequest: null });
        redisClient.on('error', (e) => console.error('[rateLimit] redis error', e && e.message || e));

        for (const rcfg of cfg.perRoute) {
          const opts = {
            storeClient: redisClient,
            keyPrefix: `rl:${encodeURIComponent(rcfg.route)}`,
            points: Number(rcfg.max),
            duration: Math.ceil(Number(rcfg.windowMs) / 1000)
          };
          const limiter = new RateLimiterRedis(opts);

          const mw = async (req, res, next) => {
            try {
              if (isSkipped(req.path)) return next();
              if (inWhitelist(req, cfg.whitelist, cfg.keyBy)) return next();

              // key extraction: use header/cookie if configured; else use IP
              let key;
              if (cfg.keyBy && cfg.keyBy !== 'ip') {
                const extracted = keyExtractorFromReq(req, cfg.keyBy);
                key = extracted || (req.ip || 'unknown');
              } else {
                key = req.ip || (req.headers['x-forwarded-for'] || req.connection?.remoteAddress) || 'unknown';
              }

              const rlRes = await limiter.consume(key, 1);

              // set standard headers
              res.set('X-RateLimit-Limit', String(opts.points));
              // consumedPoints is number consumed so far — compute remaining
              const remaining = Math.max(0, opts.points - (rlRes.consumedPoints || 0));
              res.set('X-RateLimit-Remaining', String(remaining));
              const resetSec = Math.ceil((rlRes.msBeforeNext || 0) / 1000);
              const resetTs = Math.floor(Date.now() / 1000) + resetSec;
              res.set('X-RateLimit-Reset', String(resetTs));

              return next();
            } catch (rej) {
              // when limited, rate-limiter-flexible throws an object
              const retryMs = (rej && rej.msBeforeNext) || 0;
              const retrySecs = Math.ceil(retryMs / 1000);
              res.set('Retry-After', String(retrySecs));
              res.set('X-RateLimit-Limit', String(rcfg.max));
              res.set('X-RateLimit-Remaining', '0');
              res.set('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + retrySecs));
              if (cfg.blockJson) {
                return res.status(429).json({ error: 'rate_limited', retryAfter: retrySecs, message: cfg.blockMsg });
              } else {
                return res.status(429).send(cfg.blockMsg);
              }
            }
          };

          app.use(rcfg.route, mw);
          console.log(`[rateLimit] Redis limiter applied ${rcfg.route} max=${rcfg.max} windowMs=${rcfg.windowMs}`);
        }

        const cleanup = async () => {
          try { await redisClient.quit(); } catch (e) { /* ignore */ }
        };
        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        if (metrics && typeof metrics.inc === 'function') metrics.inc('rate_limit.loaded', 1);
        return;
      } catch (e) {
        console.error('[rateLimit] failed to init redis limiter, falling back to in-memory', e && e.message || e);
        // fall through to in-memory
      }
    }

    // ---- Fallback: express-rate-limit (in-memory) ----
    try {
      const rateLimit = require('express-rate-limit');
      const { keyGeneratorIpFallback } = require('express-rate-limit');

      for (const rcfg of cfg.perRoute) {
        // Build limiter options. IMPORTANT: do NOT set keyGenerator when keyBy === 'ip'
        // so that express-rate-limit uses the safe default (which handles IPv6 properly).
        const limiterOptions = {
          windowMs: Number(rcfg.windowMs),
          max: Number(rcfg.max),
          standardHeaders: true,
          legacyHeaders: false,
          skip: (req) => isSkipped(req.path) || inWhitelist(req, cfg.whitelist, cfg.keyBy),
          handler: (req, res) => {
            const retrySecs = Math.ceil(Number(rcfg.windowMs) / 1000);
            res.set('Retry-After', String(retrySecs));
            res.set('X-RateLimit-Limit', String(rcfg.max));
            res.set('X-RateLimit-Remaining', '0');
            res.set('X-RateLimit-Reset', String(Math.floor(Date.now() / 1000) + retrySecs));
            if (cfg.blockJson) return res.status(429).json({ error: 'rate_limited', retryAfter: retrySecs, message: cfg.blockMsg });
            return res.status(429).send(cfg.blockMsg);
          }
        };

        // only set a custom keyGenerator if keyBy is header: or cookie:
        if (cfg.keyBy && cfg.keyBy !== 'ip') {
          if (cfg.keyBy.startsWith('header:')) {
            const headerName = cfg.keyBy.split(':', 2)[1].toLowerCase();
            limiterOptions.keyGenerator = (req) => {
              const val = req.headers[headerName];
              if (val && String(val).length > 0) return String(val);
              // fallback to the safe IP key generator helper provided by express-rate-limit
              return keyGeneratorIpFallback(req);
            };
          } else if (cfg.keyBy.startsWith('cookie:')) {
            const cookieName = cfg.keyBy.split(':', 2)[1];
            limiterOptions.keyGenerator = (req) => {
              const cookieHeader = req.headers.cookie || '';
              const match = cookieHeader.split(';').map(c => c.trim()).find(c => c.startsWith(cookieName + '='));
              if (match) return match.split('=')[1];
              return keyGeneratorIpFallback(req);
            };
          } else {
            // unknown keyBy - use safe IP fallback
            limiterOptions.keyGenerator = (req) => keyGeneratorIpFallback(req);
          }
        }
        // if keyBy === 'ip', we intentionally do NOT set keyGenerator so library uses safe default

        const limiter = rateLimit(limiterOptions);
        app.use(rcfg.route, limiter);
        console.log(`[rateLimit] In-memory limiter applied ${rcfg.route} max=${rcfg.max} windowMs=${rcfg.windowMs} keyBy=${cfg.keyBy}`);
      }

      if (metrics && typeof metrics.inc === 'function') metrics.inc('rate_limit.loaded', 1);
    } catch (err) {
      console.error('[rateLimit] failed to initialize in-memory limiter. Please install express-rate-limit or configure REDIS_URL.', err && err.message || err);
    }
  }
};
