// dùng redis trong docker : docker run -d -p 6379:6379 --name redis-cache redis
// hảo khởi tạo redis trong package.json: "start": "set REDIS_URL=redis://
const { createClient } = require('redis');

const DEFAULT_TTL = Number(process.env.CACHE_TTL || 60);

function parseConfig() {
  return {
    perRoute: process.env.CACHE_PER_ROUTE
      ? JSON.parse(process.env.CACHE_PER_ROUTE)
      : (process.env.CACHE_ROUTES || '/o').split(',').map(r => ({ route: r.trim(), ttl: DEFAULT_TTL })),
    keyBy: process.env.CACHE_KEY_BY || 'ip',
    whitelist: (process.env.CACHE_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean),
    skipPaths: (process.env.CACHE_SKIP_PATHS || '').split(',').map(s => s.trim()).filter(Boolean),
    redisUrl: process.env.REDIS_URL || '',
    cacheJson: (process.env.CACHE_JSON || 'true') === 'true'
  };
}

function getCacheKey(req, route, keyBy) {
  const keyVal = keyBy === 'ip' ? req.ip || 'unknown' : req.path;
  return `cache:${encodeURIComponent(route)}:${encodeURIComponent(keyVal)}:${encodeURIComponent(req.originalUrl || req.url)}`;
}

function inWhitelist(req, whitelist) {
  const keyVal = req.ip || 'unknown';
  return whitelist.includes(keyVal);
}

async function createRedisMiddleware(redisClient, route, ttl, cfg) {
  return async (req, res, next) => {
    if (req.method !== 'GET' || inWhitelist(req, cfg.whitelist)) return next();
    const key = getCacheKey(req, route, cfg.keyBy);

    const cached = await redisClient.get(key).catch(() => null);
    if (cached != null) {
      res.set('X-Cache-Status', 'HIT').set('X-Cache-TTL', String(ttl));
      return cfg.cacheJson ? res.json(JSON.parse(cached)) : res.send(cached);
    }

    const originalSend = res.send.bind(res);
    res.send = async (body) => {
      const storeVal = cfg.cacheJson && typeof body !== 'string' ? JSON.stringify(body) : String(body);
      await redisClient.setEx(key, ttl, storeVal).catch(() => {});
      res.set('X-Cache-Status', 'MISS').set('X-Cache-TTL', String(ttl));
      return originalSend(body);
    };
    next();
  };
}

module.exports = {
  meta: { priority: 30, phase: 'read' },

  register: async ({ app } = {}) => {
    if (!app) return;

    const cfg = parseConfig();
    if (!cfg.redisUrl) {
      console.warn('[cache] REDIS_URL not set, skipping cache middleware');
      return;
    }

    const redisClient = createClient({ url: cfg.redisUrl });
    await redisClient.connect().catch((e) => console.error('[cache] redis connect failed', e.message));

    for (const { route, ttl } of cfg.perRoute) {
      app.use(route, await createRedisMiddleware(redisClient, route, ttl, cfg));
      console.log(`Redis cache applied for route ${route}`);
    }

    const cleanup = async () => { try { await redisClient.quit(); } catch {} };
    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  },

  decorate: (service) => {
    const redisClient = createClient({ url: process.env.REDIS_URL || '' });
    redisClient.connect().catch(() => {});

    const makeKey = (prefix, id) => `svc:${prefix}:${id}`;

    return {
      async findOrigin(id) {
        if (!id) return null;
        const key = makeKey('findOrigin', id);

        try {
          const cached = await redisClient.get(key);
          if (cached != null) return cached;
        } catch {}

        const val = await service.findOrigin(id);
        if (val != null) {
          const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL);
          redisClient.setEx(key, ttl, val).catch(() => {});
        }
        return val;
      },

      async shortUrl(url) {
        const id = await service.shortUrl(url);
        if (!id) return id;
        const key = makeKey('findOrigin', id);
        redisClient.del(key).catch(() => {});
        return id;
      },

      ...service
    };
  }
};