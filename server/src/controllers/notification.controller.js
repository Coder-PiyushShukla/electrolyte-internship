// ─── Notification Controller ───
const db = require('../config/db');
const { ensureNotificationTables } = require('../services/notificationService');

// Non-admins only see 'all'-audience notifications; admins see everything.
// The returned clause is a constant (no user input) so it is injection-safe.
function audienceClause(role) {
  return role === 'admin' ? '' : `AND n.audience = 'all'`;
}

// GET /api/notifications?limit=30
exports.list = async (req, res) => {
  try {
    await ensureNotificationTables();
    const userId = req.user.id;
    const aud = audienceClause(req.user.role);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);

    const result = await db.query(
      `SELECT n.*, (r.user_id IS NOT NULL) AS is_read
         FROM notifications n
         LEFT JOIN notification_reads r
           ON r.notification_id = n.id AND r.user_id = $1
        WHERE 1 = 1 ${aud}
        ORDER BY n.created_at DESC
        LIMIT $2`,
      [userId, limit]
    );

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS unread
         FROM notifications n
         LEFT JOIN notification_reads r
           ON r.notification_id = n.id AND r.user_id = $1
        WHERE r.user_id IS NULL ${aud}`,
      [userId]
    );

    res.json({ notifications: result.rows, unread: countResult.rows[0].unread });
  } catch (err) {
    console.error('List notifications error:', err);
    res.status(500).json({ error: 'Failed to load notifications.' });
  }
};

// GET /api/notifications/unread-count
exports.unreadCount = async (req, res) => {
  try {
    await ensureNotificationTables();
    const userId = req.user.id;
    const aud = audienceClause(req.user.role);
    const r = await db.query(
      `SELECT COUNT(*)::int AS unread
         FROM notifications n
         LEFT JOIN notification_reads r
           ON r.notification_id = n.id AND r.user_id = $1
        WHERE r.user_id IS NULL ${aud}`,
      [userId]
    );
    res.json({ unread: r.rows[0].unread });
  } catch (err) {
    console.error('Unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count.' });
  }
};

// PATCH /api/notifications/:id/read
exports.markRead = async (req, res) => {
  try {
    await ensureNotificationTables();
    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [req.params.id, req.user.id]
    );
    res.json({ message: 'Marked as read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Failed to mark as read.' });
  }
};

// POST /api/notifications/mark-all-read
exports.markAllRead = async (req, res) => {
  try {
    await ensureNotificationTables();
    const userId = req.user.id;
    const aud = audienceClause(req.user.role);
    await db.query(
      `INSERT INTO notification_reads (notification_id, user_id)
       SELECT n.id, $1 FROM notifications n
        WHERE 1 = 1 ${aud}
       ON CONFLICT (notification_id, user_id) DO NOTHING`,
      [userId]
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    console.error('Mark all read error:', err);
    res.status(500).json({ error: 'Failed to mark all as read.' });
  }
};

// DELETE /api/notifications/:id  (admin only - removes the record for everyone)
exports.remove = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    await ensureNotificationTables();
    const result = await db.query('DELETE FROM notifications WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Notification not found.' });
    res.json({ message: 'Notification deleted.' });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification.' });
  }
};
