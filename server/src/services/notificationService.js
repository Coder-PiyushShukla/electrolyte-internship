// ─── Notification Service ───
// Central helper for recording application activity as notifications.
// Tables auto-create on first use (mirrors the ensureTables pattern used by
// outward.controller) so the feature works even if the SQL migration in
// db/add_notifications_tables.sql was never run manually.
const db = require('../config/db');

// Known notification types (kept as constants to avoid typos at call sites).
const TYPES = {
  EMAIL_REPORT_SENT: 'email_report_sent',
  EMAIL_CHALLAN_SENT: 'email_challan_sent',
  EMAIL_FAILED: 'email_failed',
  USER_REGISTERED: 'user_registered',
  USER_APPROVED: 'user_approved',
  USER_REJECTED: 'user_rejected',
  DISPATCH_CREATED: 'dispatch_created',
  INWARD_RECORDED: 'inward_recorded',
};

let tablesReady = false;

async function ensureNotificationTables() {
  if (tablesReady) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      type        VARCHAR(50)  NOT NULL,
      title       VARCHAR(255) NOT NULL,
      message     TEXT,
      actor       VARCHAR(100),
      recipient   VARCHAR(255),
      audience    VARCHAR(20)  NOT NULL DEFAULT 'all',
      metadata    JSONB        NOT NULL DEFAULT '{}'::jsonb,
      created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications (created_at DESC)`);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notifications_audience ON notifications (audience)`);
  await db.query(`
    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id INTEGER     NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (notification_id, user_id)
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON notification_reads (user_id)`);
  tablesReady = true;
}

// Record a notification. Deliberately never throws — a logging failure must not
// break the primary action (sending an email, creating a dispatch, ...).
async function createNotification({
  type,
  title,
  message = null,
  actor = null,
  recipient = null,
  audience = 'all',
  metadata = {},
}) {
  try {
    await ensureNotificationTables();
    const result = await db.query(
      `INSERT INTO notifications (type, title, message, actor, recipient, audience, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [type, title, message, actor, recipient, audience === 'admin' ? 'admin' : 'all', JSON.stringify(metadata || {})]
    );
    return result.rows[0];
  } catch (err) {
    console.warn('⚠️ createNotification failed (non-fatal):', err.message);
    return null;
  }
}

module.exports = { ensureNotificationTables, createNotification, TYPES };
