// src/services/cache.js
const { createClient } = require('redis');
const { getRedisClient } = require('../libs/redisClient')
//const { LRUCache } = require('lru-cache');

const DEFAULT_TTL_SEC = 30 * 100; // mặc định 30s
const DEFAULT_MAX_ITEMS = 5000;

let redisClient = null;
let usingRedis = false;

// init Redis nếu có REDIS_URL
if (process.env.REDIS_URL) {
  redisClient = createClient();
  redisClient.on('error', (err) => console.error('[cache][redis] error', err));
  redisClient.connect()
    .then(() => {
      usingRedis = true;
      console.log('[cache] Redis client connected');
    })
    .catch((err) => {
      console.warn('[cache] Redis connection failed, fallback to in-memory LRU', err);
      usingRedis = false;
    });
}

// fallback LRU
// const fallback = new LRUCache({
//   max: Number(process.env.CACHE_MAX_ITEMS || DEFAULT_MAX_ITEMS),
//   ttl: Number(process.env.CACHE_TTL_MS || DEFAULT_TTL_SEC * 1000)
// });

// helper functions
async function get(key) {
  if (usingRedis && redisClient) {
    try {
      const val = await redisClient.get(key);
      return val != null ? val : null;
    } catch (e) {
      //console.warn('[cache][get] redis failed, fallback to LRU', e);
      //return fallback.get(key) || null;
    }
  } else {
    //return fallback.get(key) || null;
  }
}

async function set(key, value, ttlSec = DEFAULT_TTL_SEC) {
  if (usingRedis && redisClient) {
    try {
      await redisClient.setEx(key, ttlSec, value);
      return true;
    } catch (e) {
      // console.warn('[cache][set] redis failed, fallback to LRU', e);
      // fallback.set(key, value, { ttl: ttlSec * 1000 });
      return false;
    }
  } else {
    //fallback.set(key, value, { ttl: ttlSec * 1000 });
    return false;
  }
}

async function del(key) {
  if (usingRedis && redisClient) {
    try {
      await redisClient.del(key);
      return true;
    } catch (e) {
      // console.warn('[cache][del] redis failed, fallback to LRU', e);
      // fallback.delete(key);
      return false;
    }
  } else {
    //fallback.delete(key);
    return false;
  }
}

async function quit() {
  if (usingRedis && redisClient) {
    try {
      await redisClient.quit();
    } catch (e) {
      console.warn('[cache][quit] redis quit failed', e);
    }
  }
}

module.exports = {
  get,
  set,
  del,
  quit
};
