import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const dbName = process.env.DB_NAME || 'urlshortener';
let pool: mysql.Pool;

export async function initDatabase(): Promise<void> {
  try {
    const tempConnection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password,
      port: dbConfig.port
    });

    await tempConnection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`Database '${dbName}' checked/ready`);
    await tempConnection.end();

    // 2. Khởi tạo Connection Pool (Kết nối thẳng vào database vừa tạo)
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName
    });

    console.log("Connected to MySQL");

    // 3. Tạo bảng urls
    // Lưu ý: ID dùng VARCHAR(10) là đủ cho short code 5 ký tự và nhanh hơn TEXT
    await pool.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id VARCHAR(10) NOT NULL PRIMARY KEY,
        url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Table 'urls' ready");

  } catch (err) {
    console.error("MySQL Init Error:", err);
    process.exit(1); // Dừng app nếu không kết nối được DB
  }
}

export async function findOrigin(id: string): Promise<string | null> {
  // Query SQL chuẩn
  const query = 'SELECT url FROM urls WHERE id = ?';
  
  // mysql2 với promise trả về mảng [rows, fields]
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(query, [id]);

  if (rows.length === 0) {
    return null;
  }

  return rows[0].url as string;
}

export async function createShortUrl(id: string, url: string): Promise<string> {
  // created_at được MySQL tự động điền nhờ DEFAULT CURRENT_TIMESTAMP
  const query = 'INSERT INTO urls (id, url) VALUES (?, ?)';
  await pool.execute(query, [id, url]);
  return id;
}

function makeID(length: number = 5): string {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function shortUrl(url: string): Promise<string> {
  // Logic giữ nguyên: Random ID -> Check trùng -> Insert
  let attempts = 0;
  while (attempts < 10) { // Thêm giới hạn để tránh vòng lặp vô hạn nếu xui
    const newID = makeID(5);
    const existingUrl = await findOrigin(newID);

    if (existingUrl === null) {
      await createShortUrl(newID, url);
      return newID;
    }
    attempts++;
  }
  throw new Error("Failed to generate unique ID after multiple attempts");
}

export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    console.log("MySQL connection closed");
  }
}