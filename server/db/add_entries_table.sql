-- ============================================================
-- PCB Entries Table - Migration Script
-- Run: psql -U postgres -d pcb_tracker -f add_entries_table.sql
-- ============================================================

-- New table for the simplified entry form
CREATE TABLE IF NOT EXISTS pcb_entries (
    id                SERIAL PRIMARY KEY,
    doc_no            VARCHAR(100) NOT NULL,
    lot_no            VARCHAR(100) NOT NULL,
    dc_date           DATE         NOT NULL,
    part_code         VARCHAR(100) NOT NULL,
    created_by        VARCHAR(100) DEFAULT NULL,
    created_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_entry_doc_no    ON pcb_entries (doc_no);
CREATE INDEX IF NOT EXISTS idx_entry_lot_no    ON pcb_entries (lot_no);
CREATE INDEX IF NOT EXISTS idx_entry_part_code ON pcb_entries (part_code);
CREATE INDEX IF NOT EXISTS idx_entry_dc_date   ON pcb_entries (dc_date);
