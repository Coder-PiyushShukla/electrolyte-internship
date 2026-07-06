// ─── Lot Counter Controller ───
// Manages a per-brand auto-incrementing Lot No. counter.
// Each brand (Atomberg, Bajaj) has its own independent counter starting at 0.
const db = require('../config/db');

// Ensure the lot_counters table + seed rows exist (safety net if migration
// hasn't been run manually yet).
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS lot_counters (
      brand_name   VARCHAR(50) PRIMARY KEY,
      last_lot_no  INTEGER NOT NULL DEFAULT 0
    )
  `);
}

// GET /api/lot-counter/:brand - peek at the next lot number WITHOUT incrementing.
// Used so the UI can display the upcoming lot no. before the user saves.
exports.peek = async (req, res) => {
  try {
    await ensureTable();
    const { brand } = req.params;
    if (!brand) return res.status(400).json({ error: 'Brand is required.' });

    const result = await db.query(
      'SELECT last_lot_no FROM lot_counters WHERE brand_name = $1',
      [brand]
    );
    const current = result.rows.length > 0 ? result.rows[0].last_lot_no : 0;
    res.json({ brand, nextLotNo: current + 1 });
  } catch (err) {
    console.error('Peek lot counter error:', err);
    res.status(500).json({ error: 'Failed to read lot counter.' });
  }
};

// POST /api/lot-counter/:brand/increment - atomically bump and return the new lot number.
// Call this only when a challan is actually being saved/finalized.
exports.increment = async (req, res) => {
  try {
    await ensureTable();
    const { brand } = req.params;
    if (!brand) return res.status(400).json({ error: 'Brand is required.' });

    const result = await db.query(
      `INSERT INTO lot_counters (brand_name, last_lot_no)
       VALUES ($1, 1)
       ON CONFLICT (brand_name)
       DO UPDATE SET last_lot_no = lot_counters.last_lot_no + 1
       RETURNING last_lot_no`,
      [brand]
    );
    res.json({ brand, lotNo: result.rows[0].last_lot_no });
  } catch (err) {
    console.error('Increment lot counter error:', err);
    res.status(500).json({ error: 'Failed to increment lot counter.' });
  }
};
