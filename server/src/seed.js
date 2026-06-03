// ─── Seed Script: Create default admin user ───
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db     = require('./config/db');

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Check if admin exists
    const existing = await db.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (existing.rows.length > 0) {
      console.log('ℹ️  Admin user already exists. Skipping seed.');
      process.exit(0);
    }

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);

    await db.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2)',
      ['admin', hash]
    );

    console.log('✅ Admin user created successfully.');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
