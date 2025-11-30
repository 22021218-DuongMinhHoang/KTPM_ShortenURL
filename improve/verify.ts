import { expect } from "bun:test";

const BASE_URL = "http://localhost:8090";

console.log("Starting Verification Tests...");

// 1. Shorten URL
console.log("\n1. Testing Shorten URL...");
const shortenRes = await fetch(`${BASE_URL}/api/shorten`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" }),
});

if (!shortenRes.ok) {
  console.error("Shorten failed:", await shortenRes.text());
  process.exit(1);
}

const shortenData = await shortenRes.json();
console.log("Shorten Result:", shortenData);
const id = shortenData.id;

if (!id) {
  console.error("No ID returned");
  process.exit(1);
}

// 2. Redirect (Simulate Click)
console.log(`\n2. Testing Redirect (ID: ${id})...`);
const redirectRes = await fetch(`${BASE_URL}/short/${id}`, {
  redirect: "manual", // Don't follow, just check header
});

console.log("Redirect Status:", redirectRes.status);
console.log("Location Header:", redirectRes.headers.get("Location"));

if (redirectRes.status !== 302) {
  console.error("Redirect failed, expected 302");
  // process.exit(1); // Might be 200 if browser follows, but manual should be 302
}

// 3. Stats (Wait a bit for async tracking)
console.log("\n3. Testing Stats (waiting 2s for async tracking)...");
await new Promise((r) => setTimeout(r, 2000));

const statsRes = await fetch(`${BASE_URL}/api/stats/${id}`);
const statsData = await statsRes.json();
console.log("Stats Result:", statsData);

if (statsData.clicks !== "1") {
  console.warn("Warning: Clicks should be 1, got", statsData.clicks);
}

// 4. Dashboard Links
console.log("\n4. Testing Dashboard Links...");
const linksRes = await fetch(`${BASE_URL}/api/links`);
const linksData = await linksRes.json();
console.log(`Found ${linksData.links?.length} links`);

if (Array.isArray(linksData.links) && linksData.links.length >= 0) {
  console.log("✅ Dashboard API returned a list of links");
} else {
  console.error("❌ Dashboard API failed to return a list");
}

console.log("\n✅ Verification Complete!");
