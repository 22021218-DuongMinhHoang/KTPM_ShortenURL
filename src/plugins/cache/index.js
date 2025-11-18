// module.exports = {
//   //meta: { priority: NUMBER, phase: 'read'|'write'|'both' },
//   register: async ({app}) => { /* optional middleware setup */ },
//   decorate: (service) => { /* optional: return wrapped service */ }
// }
// cachePattern.js
// Usage: module exported with { meta, register, decorate }
// Supports Redis (preferred) and in-memory fallback.
// Env examples:
//   CACHE_PER_ROUTE='[{"route":"/o/","ttl":60}]'
//   CACHE_ROUTES='/o'  (comma separated, fallback)
//   CACHE_TTL=60
//   CACHE_KEY_BY='ip' | 'header:x-api-key' | 'cookie:session' (default ip)
//   CACHE_WHITELIST='127.0.0.1,my-api-key'
//   CACHE_SKIP_PATHS='/health,/metrics'
//   REDIS_URL='redis://127.0.0.1:6379'

const meta = { priority: 30, phase: 'read' };
const DEFAULT_TTL_SEC = Number(process.env.CACHE_TTL || 60);

function parseConfig() {
  const cfg = {};
  try {
    cfg.perRoute = [];
    if (process.env.CACHE_PER_ROUTE) {
      cfg.perRoute = JSON.parse(process.env.CACHE_PER_ROUTE);
    } else {
      const routes = (process.env.CACHE_ROUTES || '/o').split(',').map(s => s.trim()).filter(Boolean);
      const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL_SEC);
      cfg.perRoute = routes.map(r => ({ route: r, ttl }));
    }
  } catch (e) {
    console.error('[cache] invalid CACHE_PER_ROUTE JSON', e);
    cfg.perRoute = [{ route: '/o', ttl: DEFAULT_TTL_SEC }];
  }
  cfg.keyBy = process.env.CACHE_KEY_BY || 'ip'; // 'ip' | 'header:name' | 'cookie:name' | 'path'
  cfg.whitelist = (process.env.CACHE_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
  cfg.skipPaths = (process.env.CACHE_SKIP_PATHS || '').split(',').map(s => s.trim()).filter(Boolean);
  cfg.redisUrl = process.env.REDIS_URL || '';
  cfg.cacheJson = (process.env.CACHE_JSON || 'true') === 'true'; 
  return  cfg;
}

function keyExtractorFromReq(req, keyBy) {
  if (!keyBy || keyBy === 'ip') {
    return req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress || 'unknown';
  }
  if (keyBy === 'path') {
    return req.originalUrl || req.url || req.path || 'unknown';
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
  return whitelist.includes(String(keyVal));
}

module.exports = {
  meta,
  register: async function register({ app, metrics } = {}) {
    if (!app || typeof app.use !== 'function') {
      console.warn('[cache] register called without valid app');
      return;
    }

    const cfg = parseConfig();
    const isSkipped = (path) => cfg.skipPaths.some(p => p && path.startsWith(p));

  
    if (cfg.redisUrl) {
      try {
        const { createClient } = require('redis');
        const redisClient = createClient({ url: cfg.redisUrl });
     
        await redisClient.connect().catch((e) => {
          console.error('[cache] redis connect failed', e && e.message || e);
        });

      
        for (const rcfg of cfg.perRoute) {
          const ttl = Number(rcfg.ttl || DEFAULT_TTL_SEC);
          const route = rcfg.route;

          const mw = async (req, res, next) => {
            try {
            
              if (req.method !== 'GET') return next();
              if (isSkipped(req.path)) return next();
              if (inWhitelist(req, cfg.whitelist, cfg.keyBy)) return next();

              
              const keyBase = `cache:${encodeURIComponent(route)}`;
              const keyByVal = keyExtractorFromReq(req, cfg.keyBy) || (req.ip || 'unknown');
              const resource = (req.originalUrl || req.url || req.path);
              const cacheKey = `${keyBase}:${encodeURIComponent(String(keyByVal))}:${encodeURIComponent(resource)}`;

              const cached = await redisClient.get(cacheKey).catch(()=>null);
              if (cached != null) {
                // HIT
                res.set('X-Cache-Status', 'HIT');
                res.set('X-Cache-TTL', String(ttl));
              
                if (cfg.cacheJson) {
                  try {
                    const parsed = JSON.parse(cached);
                    return res.status(200).json(parsed);
                  } catch (e) {
                    
                    return res.status(200).send(cached);
                  }
                } else {
                  return res.status(200).send(cached);
                }
              }

            
              const originalSend = res.send.bind(res);
              const originalJson = res.json ? res.json.bind(res) : null;

              const cacheAndSend = async (body) => {
                try {
                  let storeVal = body;
                  if (cfg.cacheJson && typeof body !== 'string') {
                  
                    storeVal = JSON.stringify(body);
                  } else if (typeof body !== 'string') {
                    storeVal = String(body);
                  }
               
                  await redisClient.setEx(cacheKey, ttl, storeVal).catch(()=>{});
                } catch (e) {
                 
                }
               
                res.set('X-Cache-Status', 'MISS');
                res.set('X-Cache-TTL', String(ttl));
                return originalSend(body);
              };

            
              if (originalJson) {
                res.json = (obj) => {
      
                  cacheAndSend(obj).catch(()=>{});
                  return originalJson(obj);
                };
              }
              res.send = (body) => {
                cacheAndSend(body).catch(()=>{});
                return originalSend(body);
              };

              return next();
            } catch (e) {
      
              console.error('[cache] middleware error', e && e.message || e);
              return next();
            }
          };

          app.use(route, mw);
          console.log(`[cache] Redis cache middleware applied ${route} ttl=${ttl}s keyBy=${cfg.keyBy}`);
        }

        const cleanup = async () => {
          try { await redisClient.quit(); } catch (e) { /* ignore */ }
        };
        process.on('exit', cleanup);
        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

        if (metrics && typeof metrics.inc === 'function') metrics.inc('cache.loaded', 1);
        return;
      } catch (e) {
        console.error('[cache] failed to init redis cache, falling back to in-memory', e && e.message || e);
       
      }
    } 

    // in-memory cache
    try {
      const memStore = new Map(); // { value, expiresAt }
      const timers = new Map(); // timerId

      for (const rcfg of cfg.perRoute) {
        const ttl = Number(rcfg.ttl || DEFAULT_TTL_SEC);
        const route = rcfg.route;

        const mw = (req, res, next) => {
          try {
            if (req.method !== 'GET') return next();
            if (isSkipped(req.path)) return next();
            if (inWhitelist(req, cfg.whitelist, cfg.keyBy)) return next();

            const keyBase = `cache:${encodeURIComponent(route)}`;
            const keyByVal = keyExtractorFromReq(req, cfg.keyBy) || (req.ip || 'unknown');
            const resource = (req.originalUrl || req.url || req.path);
            const cacheKey = `${keyBase}:${encodeURIComponent(String(keyByVal))}:${encodeURIComponent(resource)}`;

            const entry = memStore.get(cacheKey);
            const now = Date.now();
            if (entry && entry.expiresAt > now) {
              res.set('X-Cache-Status', 'HIT');
              res.set('X-Cache-TTL', String(Math.ceil((entry.expiresAt - now) / 1000)));
          
              try {
                if (cfg.cacheJson) {
                  const parsed = JSON.parse(entry.value);
                  return res.status(200).json(parsed);
                }
                return res.status(200).send(entry.value);
              } catch (e) {
                return res.status(200).send(entry.value);
              }
            }

            // MISS: override 
            const originalSend = res.send.bind(res);
            const originalJson = res.json ? res.json.bind(res) : null;

            const cacheAndSend = (body) => {
              try {
                let storeVal = body;
                if (cfg.cacheJson && typeof body !== 'string') storeVal = JSON.stringify(body);
                else if (typeof body !== 'string') storeVal = String(body);

                const expiresAt = Date.now() + ttl * 1000;
                memStore.set(cacheKey, { value: storeVal, expiresAt });

             
                if (timers.has(cacheKey)) {
                  clearTimeout(timers.get(cacheKey));
                }
                const tid = setTimeout(() => {
                  memStore.delete(cacheKey);
                  timers.delete(cacheKey);
                }, ttl * 1000);
                timers.set(cacheKey, tid);
              } catch (e) {
              
              }
              res.set('X-Cache-Status', 'MISS');
              res.set('X-Cache-TTL', String(ttl));
              return originalSend(body);
            };

            if (originalJson) {
              res.json = (obj) => {
                cacheAndSend(obj);
                return originalJson(obj);
              };
            }
            res.send = (body) => {
              cacheAndSend(body);
              return originalSend(body);
            };

            return next();
          } catch (e) {
            console.error('[cache] in-memory middleware error', e && e.message || e);
            return next();
          }
        };

        app.use(route, mw);
        console.log(`[cache] In-memory cache middleware applied ${route} ttl=${ttl}s keyBy=${cfg.keyBy}`);
      }

      if (metrics && typeof metrics.inc === 'function') metrics.inc('cache.loaded', 1);
    } catch (err) {
      console.error('[cache] failed to initialize in-memory cache', err && err.message || err);
    }
  },

 
  decorate: (service) => {
    let redisClient = null;
    try {
      const { createClient } = require('redis');
      redisClient = createClient({ url: process.env.REDIS_URL || '' });
      redisClient.connect().catch(()=>{ /* ignore init errors */ });
    } catch (e) {
      redisClient = null;
    }

    const memCache = new Map(); //  { val, expiresAt, timer }

    
    const makeKey = (...parts) => parts.map(p => encodeURIComponent(String(p))).join(':');

    return {
      async findOrigin(id) {
        if (!id) return null;
        const key = makeKey('svc', 'findOrigin', id);
        if (redisClient && redisClient.isOpen) {
          try {
            const v = await redisClient.get(key);
            if (v != null) return v;
          } catch (e) { /* fallthrough to service */ }
        } else {
          const entry = memCache.get(key);
          if (entry && entry.expiresAt > Date.now()) return entry.val;
          if (entry) memCache.delete(key);
        }

        const val = await service.findOrigin(id);
        if (val != null) {
          const ttl = Number(process.env.CACHE_TTL || DEFAULT_TTL_SEC);
          if (redisClient && redisClient.isOpen) {
            redisClient.setEx(key, ttl, val).catch(()=>{});
          } else {
            const expiresAt = Date.now() + ttl * 1000;
            memCache.set(key, { val, expiresAt });
            setTimeout(() => memCache.delete(key), ttl * 1000);
          }
        }
        return val;
      },

      async shortUrl(url) {
        const id = await service.shortUrl(url);
        if (!id) return id;
        const key = makeKey('svc', 'findOrigin', id);
        if (redisClient && redisClient.isOpen) {
          redisClient.del(key).catch(()=>{});
        } else {
          memCache.delete(key);
        }
        return id;
      },

      ...Object.fromEntries(
        Object.keys(service)
          .filter(k => !['findOrigin','shortUrl'].includes(k))
          .map(k => [k, service[k]])
      )
    };
  }
};
