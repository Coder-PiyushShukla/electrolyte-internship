-- ============================================================
-- E-Way Bill details — one row per outward dispatch that needs one
-- (dispatch value > ₹50,000, per CGST Act Section 68 interstate rule).
-- Run: psql -U postgres -d pcb_tracker -f add_eway_bill_table.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS outward_eway_bills (
    id                   SERIAL PRIMARY KEY,
    dispatch_id          INTEGER NOT NULL UNIQUE REFERENCES outward_dispatches(id) ON DELETE CASCADE,

    -- Header
    eway_bill_no         VARCHAR(50),   -- the real number obtained from the govt EWB portal
    eway_bill_date       DATE,
    generated_by_gstin   VARCHAR(50),
    generated_by_name    VARCHAR(255),
    distance_km          INTEGER,
    valid_from           TIMESTAMPTZ,
    valid_until          TIMESTAMPTZ,

    -- Part A
    supplier_gstin       VARCHAR(50),
    place_of_dispatch    TEXT,
    recipient_gstin      VARCHAR(50),
    place_of_delivery    TEXT,
    document_no          VARCHAR(50),
    document_date        DATE,
    value_of_goods       NUMERIC(12, 2),
    reason                VARCHAR(100),
    transporter_name     VARCHAR(255),

    -- Part B
    transport_mode       VARCHAR(20),
    vehicle_no           VARCHAR(20),
    from_state           VARCHAR(100),
    entered_date         DATE,
    entered_by           VARCHAR(100),

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eway_dispatch ON outward_eway_bills (dispatch_id);
