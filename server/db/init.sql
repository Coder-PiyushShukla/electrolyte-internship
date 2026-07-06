-- ============================================================
-- PCB Inventory Tracker - Database Initialization Script
-- Run: psql -U postgres -d pcb_tracker -f init.sql
-- ============================================================

-- 1. Create ENUM types
DO $$ BEGIN
    CREATE TYPE transaction_type_enum AS ENUM ('in_ward', 'out_ward');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE status_enum AS ENUM ('ok', 'scrap');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Users table (for JWT authentication)
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PCB Transactions table
CREATE TABLE IF NOT EXISTS pcb_transactions (
    id                SERIAL PRIMARY KEY,
    brand_name        VARCHAR(50)  NOT NULL CHECK (brand_name IN ('Atomberg', 'Bajaj')),
    transaction_type  transaction_type_enum NOT NULL,
    dc_number         VARCHAR(100) NOT NULL,
    transaction_date  DATE         NOT NULL,
    part_code         VARCHAR(100) NOT NULL,
    quantity          INTEGER      NOT NULL CHECK (quantity >= 0),
    status            status_enum  DEFAULT NULL,  -- only relevant for out_ward
    remarks           TEXT         DEFAULT NULL,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- 4. Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_txn_brand      ON pcb_transactions (brand_name);
CREATE INDEX IF NOT EXISTS idx_txn_type       ON pcb_transactions (transaction_type);
CREATE INDEX IF NOT EXISTS idx_txn_part_code  ON pcb_transactions (part_code);
CREATE INDEX IF NOT EXISTS idx_txn_date       ON pcb_transactions (transaction_date);

-- 5. Seed a default admin user
-- Password: admin123  (bcrypt hash with 10 rounds)
INSERT INTO users (username, password_hash)
VALUES (
    'admin',
    '$2a$10$rS5P5Gq5K7bQZ0z0z0z0zOe1234567890abcdefghijklmnopqrstuv'
)
ON CONFLICT (username) DO NOTHING;

-- NOTE: The above hash is a placeholder. The actual admin user
-- will be created on first server start via the seed script,
-- or you can register via the /api/auth/register endpoint.
-- Default credentials: admin / admin123
