// ─── Seed Script: Create default admin user ───
require('dotenv').config();

const bcrypt = require('bcryptjs');
const db     = require('./config/db');

async function seed() {
  try {
    console.log('🌱 Seeding database...');

    // Create or update admin user (with email)
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('admin123', salt);

    await db.query(
      `INSERT INTO users (username, email, password_hash, is_approved, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (username) DO UPDATE
       SET email = EXCLUDED.email,
           password_hash = EXCLUDED.password_hash,
           is_approved = EXCLUDED.is_approved,
           role = EXCLUDED.role`,
      ['admin', 'admin@gmail.com', hash, true, 'admin']
    );

    console.log('✅ Admin user created/updated successfully.');
    console.log('   Username: admin');
    console.log('   Email:    admin@gmail.com');
    console.log('   Password: admin123');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  }
}

seed();
