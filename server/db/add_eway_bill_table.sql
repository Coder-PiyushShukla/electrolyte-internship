-- ============================================================
-- E-Way Bill details - one row per outward dispatch that needs one
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
    eway_pdf_path        TEXT,
    eway_pdf_original_name VARCHAR(255),
    from_state           VARCHAR(100),
    entered_date         DATE,
    entered_by           VARCHAR(100),

    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eway_dispatch ON outward_eway_bills (dispatch_id);

ALTER TABLE outward_eway_bills ADD COLUMN IF NOT EXISTS eway_pdf_path TEXT;
ALTER TABLE outward_eway_bills ADD COLUMN IF NOT EXISTS eway_pdf_original_name VARCHAR(255);

CREATE TABLE IF NOT EXISTS eway_bill_rules (
    id SERIAL PRIMARY KEY,
    supplier_state VARCHAR(100) NOT NULL,
    movement_type VARCHAR(20) NOT NULL CHECK (movement_type IN ('INTRA_STATE', 'INTER_STATE')),
    threshold_amount NUMERIC(12, 2) NOT NULL,
    portal_url TEXT NOT NULL DEFAULT 'https://ewaybillgst.gov.in/',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (supplier_state, movement_type)
);

INSERT INTO eway_bill_rules (supplier_state, movement_type, threshold_amount, portal_url)
VALUES
    ('Maharashtra', 'INTRA_STATE', 100000, 'https://ewaybillgst.gov.in/'),
    ('Maharashtra', 'INTER_STATE', 50000, 'https://ewaybillgst.gov.in/')
ON CONFLICT (supplier_state, movement_type) DO NOTHING;

ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_required BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_status VARCHAR(30) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_movement_type VARCHAR(20);
ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_threshold_amount NUMERIC(12, 2);
ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_portal_url TEXT;
ALTER TABLE outward_dispatches ADD COLUMN IF NOT EXISTS eway_reason TEXT;
