// ─── PCB Entry Controller ───
const db = require('../config/db');

// GET /api/entries - List all entries
exports.getAll = async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM pcb_entries ORDER BY created_at DESC'
    );
    res.json({ count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Get entries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries.' });
  }
};

// POST /api/entries - Create a new entry
exports.create = async (req, res) => {
  try {
    const { doc_no, lot_no, dc_date, part_code } = req.body;

    // Validation
    const errors = [];
    if (!doc_no || !doc_no.trim()) errors.push('doc_no is required.');
    if (!lot_no || !lot_no.trim()) errors.push('lot_no is required.');
    if (!dc_date) errors.push('dc_date is required.');
    if (!part_code || !part_code.trim()) errors.push('part_code is required.');

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    // Get username from JWT token (set by auth middleware)
    const created_by = req.user?.username || null;

    const result = await db.query(
      `INSERT INTO pcb_entries (doc_no, lot_no, dc_date, part_code, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [doc_no.trim(), lot_no.trim(), dc_date, part_code.trim(), created_by]
    );

    res.status(201).json({ message: 'Entry created.', data: result.rows[0] });
  } catch (err) {
    console.error('Create entry error:', err);
    res.status(500).json({ error: 'Failed to create entry.' });
  }
};

// DELETE /api/entries/:id
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM pcb_entries WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entry not found.' });
    }

    res.json({ message: 'Entry deleted.', data: result.rows[0] });
  } catch (err) {
    console.error('Delete entry error:', err);
    res.status(500).json({ error: 'Failed to delete entry.' });
  }
};

// GET /api/entries/part-codes - Get distinct part codes for dropdown
exports.getPartCodes = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT part_code FROM pcb_transactions
       UNION
       SELECT DISTINCT part_code FROM pcb_entries
       ORDER BY part_code`
    );
    res.json({ data: result.rows.map(r => r.part_code) });
  } catch (err) {
    console.error('Get part codes error:', err);
    res.status(500).json({ error: 'Failed to fetch part codes.' });
  }
};
