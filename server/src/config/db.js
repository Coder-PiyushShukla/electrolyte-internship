// ─── PostgreSQL Connection Pool ───
const { Pool } = require('pg');

// Render provides DATABASE_URL; fall back to individual vars for local dev
const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  : new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
  });

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

// Run database migrations on startup
pool.query(`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
  UPDATE users SET email = 'admin@gmail.com' WHERE username = 'admin' AND email IS NULL;
`).then(() => {
  console.log('🌱 Database migration complete: email column verified.');
}).catch(err => {
  console.error('❌ Database migration failed:', err);
});

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL error:', err);
  process.exit(-1);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
