import { Client } from "cassandra-driver";
import { withRetry } from "./utils/retry";

const contactPoints = (process.env.SCYLLA_CONTACT_POINTS || "localhost").split(
  ","
);
const localDataCenter = process.env.SCYLLA_DATACENTER || "datacenter1";
const keyspace = process.env.SCYLLA_KEYSPACE || "urlshortener";

const client = new Client({
  contactPoints,
  localDataCenter,
  pooling: {
    coreConnectionsPerHost: {
      0: 4,
      1: 1,
    },
  },
  socketOptions: {
    connectTimeout: 10000,
    readTimeout: 12000,
  },
});

let initialized = false;

import { nanoid } from "nanoid";

export async function initDatabase(): Promise<void> {
  if (initialized) return;

  await client.connect();
  console.log("Connected to ScyllaDB");

  await client.execute(`
    CREATE KEYSPACE IF NOT EXISTS ${keyspace}
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1}
  `);
  console.log(`Keyspace '${keyspace}' ready`);

  await client.execute(`USE ${keyspace}`);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS urls (
      id text PRIMARY KEY,
      url text,
      created_at timestamp
    )
  `);
  console.log("Table urls ready");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS url_counters (
      id text PRIMARY KEY,
      clicks counter
    )
  `);
  console.log("Table url_counters ready");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS url_stats (
      id text,
      created_at timestamp,
      ip text,
      ua text,
      referrer text,
      PRIMARY KEY (id, created_at)
    ) WITH CLUSTERING ORDER BY (created_at DESC)
  `);
  console.log("Table url_stats ready");

  initialized = true;
}

export async function findOrigin(id: string): Promise<string | null> {
  const query = `SELECT url FROM ${keyspace}.urls WHERE id = ?`;
  const result = await withRetry(() =>
    client.execute(query, [id], { prepare: true })
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].url;
}

export async function createShortUrl(id: string, url: string): Promise<string> {
  const query = `INSERT INTO ${keyspace}.urls (id, url, created_at) VALUES (?, ?, toTimestamp(now()))`;
  await withRetry(() => client.execute(query, [id, url], { prepare: true }));
  return id;
}

export async function shortUrl(url: string): Promise<string> {
  const newID = nanoid(7); // 7 chars is enough for millions of links
  await createShortUrl(newID, url);
  return newID;
}

export async function incrementClick(id: string): Promise<void> {
  const query = `UPDATE ${keyspace}.url_counters SET clicks = clicks + 1 WHERE id = ?`;
  await client.execute(query, [id], { prepare: true });
}

export async function logClick(
  id: string,
  ip: string,
  ua: string,
  referrer: string
): Promise<void> {
  const query = `INSERT INTO ${keyspace}.url_stats (id, created_at, ip, ua, referrer) VALUES (?, toTimestamp(now()), ?, ?, ?)`;
  await client.execute(query, [id, ip, ua, referrer], { prepare: true });
}

export async function getAllLinks(
  page: number = 1,
  limit: number = 20
): Promise<{ links: any[]; hasMore: boolean }> {
  // ScyllaDB does not support OFFSET. For simple pagination, we fetch up to the current page end.
  // This is O(N) and not suitable for millions of rows, but works for "page, pageSize" request.
  const fetchLimit = page * limit + 1; // Fetch one extra to check if there are more
  const query = `SELECT id, url, created_at FROM ${keyspace}.urls LIMIT ${fetchLimit}`;

  const result = await client.execute(query, [], { prepare: true });
  const allRows = result.rows;

  // Slice the rows for the current page
  const startIndex = (page - 1) * limit;
  const slicedRows = allRows.slice(startIndex, startIndex + limit);
  const hasMore = allRows.length > page * limit;

  if (slicedRows.length === 0) {
    return { links: [], hasMore: false };
  }

  // Optimization: Use IN clause to fetch all counters in one query
  const ids = slicedRows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const counterQuery = `SELECT id, clicks FROM ${keyspace}.url_counters WHERE id IN (${placeholders})`;

  const counterResult = await client.execute(counterQuery, ids, {
    prepare: true,
  });

  // Create a map for fast lookup
  const clicksMap = new Map<string, string>();
  counterResult.rows.forEach((row) => {
    clicksMap.set(row.id, row.clicks?.toString() || "0");
  });

  const links = slicedRows.map((row) => ({
    ...row,
    clicks: clicksMap.get(row.id) || "0",
  }));

  return {
    links,
    hasMore,
  };
}

export async function truncateDatabase(): Promise<void> {
  await client.execute(`TRUNCATE ${keyspace}.urls`);
  await client.execute(`TRUNCATE ${keyspace}.url_counters`);
  await client.execute(`TRUNCATE ${keyspace}.url_stats`);
  console.log("Database truncated");
}

export async function getUrlStats(id: string): Promise<any> {
  const counterQuery = `SELECT clicks FROM ${keyspace}.url_counters WHERE id = ?`;
  const statsQuery = `SELECT * FROM ${keyspace}.url_stats WHERE id = ? LIMIT 100`;

  const [counterResult, statsResult] = await Promise.all([
    client.execute(counterQuery, [id], { prepare: true }),
    client.execute(statsQuery, [id], { prepare: true }),
  ]);

  return {
    clicks: counterResult.rows[0]?.clicks?.toString() || "0",
    recent_clicks: statsResult.rows,
  };
}

export async function closeDatabase(): Promise<void> {
  await client.shutdown();
  console.log("ScyllaDB connection closed");
}
