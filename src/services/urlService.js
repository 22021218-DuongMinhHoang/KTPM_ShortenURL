// services/urlService.js
const db = require('../infrastructure/db');
const cache = require('./cache');
const withRetry = require('./retry');

module.exports = function makeUrlService() {
  return {
    // findOrigin: try cache then DB
    async findOrigin(id) {
      if (!id) return null;
      // Try memory cache first
      // try {
      //   const maybe = await cache.get(id);

      //   if (maybe) return maybe;
      // } catch (e) { /* ignore */ }

      // fetch from DB (with retry as DB operations might transiently fail)
      const val = await db.findOrigin(id)
      // if (val != null) {
      //   try { cache.set(id, val); } catch (e) {}
      // }
      return val;
    },

    // shortUrl: use DB logic; also populate cache
    async shortUrl(url) {
      if (!url) throw new Error('url_required');
      // check cache by original URL -> existing id?
      // try {
      //   const cachedId = await cache.get(url);
      //   if (cachedId) return cachedId;
      // } catch (e) { /* ignore */ }
      
      // Use DB.shortUrl which encapsulates findByUrl and insert collision retry.
      // Wrap DB call with retry to be resilient to transient sqlite issues.
      const id = await withRetry(() => db.shortUrl(url), { retries: 3, baseDelayMs: 50 });
      // update caches
      try {
        cache.set(url, id);
        cache.set(id, url);
      } catch (e) { /* ignore */ }

      return id;
    }
  };
};
