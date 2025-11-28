const { createClient } = require('redis'); // npm i redis
const DEFAULT_TTL = 60; // seconds

module.exports = {
  meta: { priority: 30, phase: 'read' }, // outermost for reads
  // optional async init if using Redis
  register: async ({ app, config }) => {
    // nothing to register on app level; keep for symmetry
  },
  decorate(service) {
    // try to use redis if available, else in-memory map
    let redisClient;
    try {
      redisClient = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
      redisClient.connect().catch(()=>{/* ignore init errors, fallback to memory */});
    } catch(e) {
      redisClient = null;
    }

    const memCache = new Map();

    return {
      async findOrigin(id) {
        // check redis first
        if (redisClient && redisClient.isOpen) {
          try {
            const val = await redisClient.get(`short:${id}`);
            if (val != null) return val;
          } catch (e) { /* fallthrough to service */ }
        } else {
          if (memCache.has(id)) return memCache.get(id);
        }

        // cache miss -> call inner service
        const val = await service.findOrigin(id);
        if (val != null) {
          if (redisClient && redisClient.isOpen) {
            await redisClient.setEx(`short:${id}`, DEFAULT_TTL, val).catch(()=>{});
          } else {
            memCache.set(id, val);
            // optional: setTimeout to expire
            setTimeout(() => memCache.delete(id), DEFAULT_TTL * 1000);
          }
        }
        return val;
      },

      async shortUrl(url) {
        // writes: call inner and invalidate cache if necessary
        const id = await service.shortUrl(url);
        // no guarantee about what ID created, but attempt to invalidate
        if (redisClient && redisClient.isOpen) {
          redisClient.del(`short:${id}`).catch(()=>{});
        } else {
          memCache.delete(id);
        }
        return id;
      }
    };
  }
};
