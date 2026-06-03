// ─── Transaction Controller ───
const db = require('../config/db');

// GET /api/transactions?brand=Atomberg&type=in_ward
exports.getAll = async (req, res) => {
  try {
    const { brand, type } = req.query;
    let queryText = 'SELECT * FROM pcb_transactions WHERE 1=1';
    const params = [];

    if (brand) {
      params.push(brand);
      queryText += ` AND brand_name = $${params.length}`;
    }

    if (type) {
      params.push(type);
      queryText += ` AND transaction_type = $${params.length}`;
    }

    queryText += ' ORDER BY transaction_date DESC, created_at DESC';

    const result = await db.query(queryText, params);
    res.json({ count: result.rows.length, data: result.rows });
  } catch (err) {
    console.error('Get transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
};

// GET /api/transactions/summary
// Returns grand totals grouped by part_code and brand_name
exports.getSummary = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        part_code,
        brand_name,
        COALESCE(SUM(CASE WHEN transaction_type = 'in_ward'  THEN quantity ELSE 0 END), 0) AS total_in,
        COALESCE(SUM(CASE WHEN transaction_type = 'out_ward' THEN quantity ELSE 0 END), 0) AS total_out,
        COALESCE(SUM(CASE WHEN transaction_type = 'in_ward'  THEN quantity ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN transaction_type = 'out_ward' THEN quantity ELSE 0 END), 0) AS balance
      FROM pcb_transactions
      GROUP BY part_code, brand_name
      ORDER BY brand_name, part_code
    `);

    res.json({ data: result.rows });
  } catch (err) {
    console.error('Get summary error:', err);
    res.status(500).json({ error: 'Failed to fetch summary.' });
  }
};

// POST /api/transactions  (single manual entry)
exports.create = async (req, res) => {
  try {
    const { brand_name, transaction_type, dc_number, transaction_date, part_code, quantity, status, remarks } = req.body;

    // Validation
    const errors = [];
    if (!brand_name || !['Atomberg', 'Bajaj'].includes(brand_name)) {
      errors.push('brand_name must be "Atomberg" or "Bajaj".');
    }
    if (!transaction_type || !['in_ward', 'out_ward'].includes(transaction_type)) {
      errors.push('transaction_type must be "in_ward" or "out_ward".');
    }
    if (!dc_number) errors.push('dc_number is required.');
    if (!transaction_date) errors.push('transaction_date is required.');
    if (!part_code) errors.push('part_code is required.');
    if (quantity === undefined || quantity === null || quantity < 0) {
      errors.push('quantity must be a non-negative integer.');
    }
    if (status && !['ok', 'scrap'].includes(status)) {
      errors.push('status must be "ok", "scrap", or null.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed.', details: errors });
    }

    const result = await db.query(
      `INSERT INTO pcb_transactions 
        (brand_name, transaction_type, dc_number, transaction_date, part_code, quantity, status, remarks)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [brand_name, transaction_type, dc_number, transaction_date, part_code, parseInt(quantity, 10), status || null, remarks || null]
    );

    res.status(201).json({ message: 'Transaction created.', data: result.rows[0] });
  } catch (err) {
    console.error('Create transaction error:', err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
};

// DELETE /api/transactions/:id
exports.remove = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM pcb_transactions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found.' });
    }

    res.json({ message: 'Transaction deleted.', data: result.rows[0] });
  } catch (err) {
    console.error('Delete transaction error:', err);
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
};
