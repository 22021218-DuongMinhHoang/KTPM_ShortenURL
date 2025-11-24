import { Client } from "cassandra-driver";
import { withRetry } from "./utils/retry";

const contactPoints = (process.env.SCYLLA_CONTACT_POINTS || "localhost").split(
	",",
);
const localDataCenter = process.env.SCYLLA_DATACENTER || "datacenter1";
const keyspace = process.env.SCYLLA_KEYSPACE || "urlshortener";

const client = new Client({
	contactPoints,
	localDataCenter,
});

let initialized = false;

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

	initialized = true;
}

export async function findOrigin(id: string): Promise<string | null> {
	const query = `SELECT url FROM ${keyspace}.urls WHERE id = ?`;
	const result = await withRetry(() =>
		client.execute(query, [id], { prepare: true }),
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

function makeID(length: number = 5): string {
	const characters =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let result = "";
	for (let i = 0; i < length; i++) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}

export async function shortUrl(url: string): Promise<string> {
	while (true) {
		const newID = makeID(5);
		const existingUrl = await findOrigin(newID);

		if (existingUrl === null) {
			await createShortUrl(newID, url);
			return newID;
		}
	}
}

export async function closeDatabase(): Promise<void> {
	await client.shutdown();
	console.log("ScyllaDB connection closed");
}
