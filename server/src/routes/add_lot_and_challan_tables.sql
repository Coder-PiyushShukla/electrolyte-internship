-- ============================================================
-- Lot Counters + Challan History - Migration Script
-- Run: psql -U postgres -d pcb_tracker -f add_lot_and_challan_tables.sql
-- ============================================================

-- Tracks the last-used Lot No. per brand (Atomberg / Bajaj).
-- Lot numbers increment independently per brand, starting from 0.
CREATE TABLE IF NOT EXISTS lot_counters (
    brand_name   VARCHAR(50) PRIMARY KEY,
    last_lot_no  INTEGER NOT NULL DEFAULT 0
);

-- Seed the two known brands at 0 (first shipment for each will become 1).
INSERT INTO lot_counters (brand_name, last_lot_no) VALUES ('Atomberg', 0)
ON CONFLICT (brand_name) DO NOTHING;
INSERT INTO lot_counters (brand_name, last_lot_no) VALUES ('Bajaj', 0)
ON CONFLICT (brand_name) DO NOTHING;
