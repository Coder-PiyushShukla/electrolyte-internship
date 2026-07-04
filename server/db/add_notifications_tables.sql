-- ============================================================
-- Notifications feature — Migration Script
-- Run: psql -U postgres -d pcb_tracker -f add_notifications_tables.sql
-- (Also auto-created at runtime by notificationService.ensureNotificationTables.)
-- ============================================================

-- ── Activity / notification records ──
-- One row per meaningful event (email sent, user registered, dispatch created, ...).
-- `audience` controls visibility: 'all' = every logged-in user, 'admin' = admins only.
-- `metadata` holds event-specific context (challan no, dispatch id, provider, ...).
CREATE TABLE IF NOT EXISTS notifications (
    id          SERIAL PRIMARY KEY,
    type        VARCHAR(50)  NOT NULL,
    title       VARCHAR(255) NOT NULL,
    message     TEXT,
    actor       VARCHAR(100),                       -- username who triggered it
    recipient   VARCHAR(255),                       -- email recipient, when applicable
    audience    VARCHAR(20)  NOT NULL DEFAULT 'all', -- 'all' | 'admin'
    metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications (audience);

-- ── Per-user read state ──
-- Presence of a row = that user has read that notification. Absence = unread.
CREATE TABLE IF NOT EXISTS notification_reads (
    notification_id INTEGER     NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads (user_id);
