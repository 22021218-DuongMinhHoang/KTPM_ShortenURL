// services/urlService.js
const db = require('../infrastructure/db');
const cache = require('./cache');
const withRetry = require('./retry');
const crypto = require('crypto');

function makeID(length = 5) {
  // alphanumeric
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function cacheKeyForUrl(url) {
  return `url:${url}`;
}

function cacheKeyForId(id) {
  return `id:${id}`;
}

module.exports = function makeUrlService() {
  return {
    // findOrigin: try cache then DB
    async findOrigin(id) {
      if (!id) return null;
      // Try memory cache first
      try {
        const maybe = cache.get(cacheKeyForId(id));
        if (maybe) return maybe;
      } catch (e) { /* ignore */ }

      // fetch from DB (with retry as DB operations might transiently fail)
      const val = await withRetry(() => db.findOrigin(id), { retries: 3, baseDelayMs: 50 });
      if (val != null) {
        try { cache.set(cacheKeyForId(id), val); } catch (e) {}
      }
      return val;
    },

    // shortUrl: use DB logic; also populate cache
    async shortUrl(url) {
      if (!url) throw new Error('url_required');

      // check cache by original URL -> existing id?
      try {
        const cachedId = cache.get(cacheKeyForUrl(url));
        if (cachedId) return cachedId;
      } catch (e) { /* ignore */ }

      // Use DB.shortUrl which encapsulates findByUrl and insert collision retry.
      // Wrap DB call with retry to be resilient to transient sqlite issues.
      const id = await withRetry(() => db.shortUrl(url), { retries: 3, baseDelayMs: 50 });

      // update caches
      try {
        cache.set(cacheKeyForUrl(url), id);
        cache.set(cacheKeyForId(id), url);
      } catch (e) { /* ignore */ }

      return id;
    }
  };
};
