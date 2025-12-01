import { createClient } from "redis";

const defaultTTL = parseInt(process.env.CACHE_TTL || "300", 10);
const dragonflyUrl = process.env.DRAGONFLY_URL || "redis://127.0.0.1:6379";

const redis = createClient({
  url: dragonflyUrl,
  socket: {
    connectTimeout: 10000,
    keepAlive: true,
  }
});

redis.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Dragonfly cache (node-redis)");
});

try {
    await redis.connect();
} catch (e) {
    console.error("Fatal: Could not connect to Redis at startup", e);
}

export async function get(key: string): Promise<string | null> {
  try {
    return await redis.get(key);
  } catch (err) {
    console.error("Cache get error:", err);
    return null;
  }
}

export async function set(
  key: string,
  value: string,
  ttl: number = defaultTTL
): Promise<void> {
  try {
    await redis.set(key, value, { EX: ttl });
  } catch (err) {
    console.error("Cache set error:", err);
  }
}

export async function del(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    console.error("Cache delete error:", err);
  }
}

export async function incr(key: string): Promise<number> {
  try {
    return await redis.incr(key);
  } catch (err) {
    console.error("Cache incr error:", err);
    return 0;
  }
}

export async function expire(key: string, seconds: number): Promise<void> {
  try {
    await redis.expire(key, seconds);
  } catch (err) {
    console.error("Cache expire error:", err);
  }
}

export async function ttl(key: string): Promise<number> {
  try {
    return await redis.ttl(key);
  } catch (err) {
    console.error("Cache ttl error:", err);
    return -1;
  }
}

export async function closeCache(): Promise<void> {
  if (redis.isOpen) {
      await redis.quit();
  }
  console.log("Dragonfly cache connection closed");
}

export { redis };