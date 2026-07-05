-- ============================================================
-- Adds a proper `brands` (companies) table so new customer
-- companies can be added from the UI instead of being hardcoded.
-- Run: psql -U postgres -d pcb_tracker -f add_brands_table.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS brands (
    brand_key      VARCHAR(50)  PRIMARY KEY,   -- short key used everywhere (e.g. "Atomberg")
    company_name   VARCHAR(255) NOT NULL,      -- full legal name for challans
    address        TEXT,
    phone          VARCHAR(50),
    gstin          VARCHAR(50),
    email          VARCHAR(255),
    hsn_code       VARCHAR(20),
    default_rate   NUMERIC(10, 2) DEFAULT 0,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with the two companies that were previously hardcoded, so nothing
-- changes for existing data.
INSERT INTO brands (brand_key, company_name, address, phone, gstin, email, hsn_code, default_rate)
VALUES (
    'Atomberg',
    'Atomberg Technologies Pvt. Ltd.',
    'Mind Space Shelters LLP/Vithai Developers LLP, Gate No 51-59, Opp-Dana india, Bhamboli, Chakan, Pune - 410507',
    '+91 7738590086',
    '27AAKCA4836H1ZI',
    '',
    '85340000',
    70
) ON CONFLICT (brand_key) DO NOTHING;

INSERT INTO brands (brand_key, company_name, address, phone, gstin, email, hsn_code, default_rate)
VALUES (
    'Bajaj',
    'Bajaj Electricals Limited',
    'Shed B7, Galal No.1,2,3,4,5,6,7A,7B & 8A, Antariksh Logidrome, Mumbai-Nasik Highway, Amane Village, Bhiwandi, Maharashtra - 421302',
    '+91 9833999575',
    '27AAACB2484Q1Z8',
    '',
    '85166000',
    80
) ON CONFLICT (brand_key) DO NOTHING;

-- The `pcb_transactions` table originally locked brand_name to only
-- ('Atomberg', 'Bajaj') via a CHECK constraint. That has to go, otherwise
-- transactions for any newly-added company will fail to save.
ALTER TABLE pcb_transactions DROP CONSTRAINT IF EXISTS pcb_transactions_brand_name_check;
