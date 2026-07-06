-- ============================================================
-- Outward PCB System - Migration Script
-- Run: psql -U postgres -d pcb_tracker -f add_outward_tables.sql
-- ============================================================

-- ── DC No. counter, scoped to financial year (e.g. "26-27") ──
-- Format used: ES/26-27/DC001 - increments by 1 globally (not per-brand),
-- and resets whenever the financial year string changes.
CREATE TABLE IF NOT EXISTS outward_dc_counter (
    financial_year   VARCHAR(10) PRIMARY KEY,
    last_dc_no       INTEGER NOT NULL DEFAULT 0
);

-- ── Lot No. counter for OUTWARD, scoped to financial year + brand ──
-- Independent from the Inward lot counter. Resets to 0 every financial year,
-- and increments separately per brand within that year.
CREATE TABLE IF NOT EXISTS outward_lot_counter (
    financial_year   VARCHAR(10) NOT NULL,
    brand_name       VARCHAR(50) NOT NULL,
    last_lot_no      INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (financial_year, brand_name)
);

-- ── Outward Dispatch header ──
CREATE TABLE IF NOT EXISTS outward_dispatches (
    id                SERIAL PRIMARY KEY,
    dc_no             VARCHAR(50)  NOT NULL UNIQUE,
    lot_no            INTEGER      NOT NULL,
    financial_year    VARCHAR(10)  NOT NULL,
    brand_name        VARCHAR(50)  NOT NULL,
    company_name      VARCHAR(255) NOT NULL,
    company_address   TEXT,
    phone_no          VARCHAR(50),
    gstin             VARCHAR(50),
    vehicle_no        VARCHAR(50),
    courier_partner   VARCHAR(255),
    challan_date      DATE         NOT NULL,
    remarks           TEXT,
    total_qty         INTEGER      NOT NULL DEFAULT 0,
    total_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
    pdf_path          TEXT,
    created_by        VARCHAR(100),
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outward_brand ON outward_dispatches (brand_name);
CREATE INDEX IF NOT EXISTS idx_outward_dc    ON outward_dispatches (dc_no);
CREATE INDEX IF NOT EXISTS idx_outward_fy    ON outward_dispatches (financial_year);

-- ── Outward Dispatch line items ──
-- One row per (item_code, status) combination per dispatch.
-- Inventory validation (sum of OK + SCRAP per item_code across all dispatches
-- for that brand) is enforced at the application layer against Inward totals.
CREATE TABLE IF NOT EXISTS outward_dispatch_items (
    id              SERIAL PRIMARY KEY,
    dispatch_id     INTEGER NOT NULL REFERENCES outward_dispatches(id) ON DELETE CASCADE,
    item_code       VARCHAR(100) NOT NULL,
    description     TEXT,
    status          VARCHAR(10) NOT NULL CHECK (status IN ('OK', 'SCRAP')),
    hsn_code        VARCHAR(20),
    unit            VARCHAR(20) DEFAULT 'Nos',
    quantity        INTEGER NOT NULL CHECK (quantity >= 0),
    rate            NUMERIC(10, 2) DEFAULT 0,
    amount          NUMERIC(12, 2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_outward_items_dispatch  ON outward_dispatch_items (dispatch_id);
CREATE INDEX IF NOT EXISTS idx_outward_items_item_code ON outward_dispatch_items (item_code);
