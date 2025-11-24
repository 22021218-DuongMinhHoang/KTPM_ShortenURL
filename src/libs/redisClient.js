// libs/redisClient.js
const { createClient } = require('redis');

let client = null;

/**
 * Trả về singleton Redis client.
 * Nếu chưa tạo, sẽ tạo mới và connect.
 */
function getRedisClient() {
  if (!client) {
    const url = process.env.REDIS_URL || undefined;
    client = createClient({ url });

    client.on('error', (err) => {
      console.error('[redis] error', err && err.message ? err.message : err);
    });

    client.on('connect', () => {
      console.log('[redis] connecting...');
    });

    client.on('ready', () => {
      console.log('[redis] ready');
    });

    // Kết nối async nhưng không block
    client.connect().catch((err) => {
      console.error('[redis] connect failed', err && err.message ? err.message : err);
    });
  }
  return client;
}

module.exports = getRedisClient;
