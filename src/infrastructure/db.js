const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbDir = path.join(__dirname, '..', 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const dbPath = path.join(dbDir, 'app.db');
const db = new sqlite3.Database(dbPath);

// Schema: id là PRIMARY KEY, url là UNIQUE để dễ lookup và tránh duplicate mappings
db.run(`
  CREATE TABLE IF NOT EXISTS data(
    id TEXT PRIMARY KEY,
    url TEXT UNIQUE
  ) STRICT
`);

function makeID(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

function findOrigin(id) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM data WHERE id = ?`, [id], function (err, res) {
      if (err) return reject(err);
      if (res) return resolve(res.url);
      return resolve(null);
    });
  });
}

function findByUrl(url) {
  return new Promise((resolve, reject) => {
    db.get(`SELECT id FROM data WHERE url = ?`, [url], function (err, res) {
      if (err) return reject(err);
      if (res) return resolve(res.id);
      return resolve(null);
    });
  });
}

function createEntry(id, url) {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO data(id, url) VALUES (?, ?)`, [id, url], function (err) {
      if (err) return reject(err);
      return resolve(id);
    });
  });
}

/**
 * shortUrl(url)
 * - nếu url đã tồn tại -> trả về id tồn tại
 * - nếu chưa -> tạo id mới, cố insert; xử lý collision / race condition
 */
async function shortUrl(url) {
  // 1) check if url already shortened
  const existing = await findByUrl(url);
  if (existing) return existing;

  // 2) try create new id; if collision on id -> retry; if conflict on url -> return that url's id
  while (true) {
    const newID = makeID(5);
    try {
      await createEntry(newID, url);
      return newID;
    } catch (err) {
      // err.code === 'SQLITE_CONSTRAINT' for constraint violations
      const code = err && err.code;
      // If another process inserted the same URL concurrently, return that id
      if (code === 'SQLITE_CONSTRAINT') {
        // Determine whether conflict is on url or id:
        // easiest: try findByUrl again
        const existingNow = await findByUrl(url);
        if (existingNow) return existingNow;
        // else it was likely id collision -> retry with a new id
        continue;
      }
      // other unexpected errors -> rethrow
      throw err;
    }
  }
}

module.exports = {
  findOrigin,
  shortUrl
};