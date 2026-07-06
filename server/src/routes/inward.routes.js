// ─── Inward Inventory Route ───
// Called by ChallanVerification.jsx when the user clicks "Save Challan".
// Bulk-inserts one pcb_transactions row per item line (transaction_type = 'in_ward')
// so the Outward page's inventory check can see the received stock.

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const db = require('../config/db');
const { createNotification, TYPES } = require('../services/notificationService');

router.use(auth);

// POST /api/inward/record
// Body: { brand, challanNo, challanDate, lotNo, rows }
// rows: [{ itemCode, description, physicalQty }]
// Uses physicalQty (the count the operator actually received, not the challan qty)
// as the authoritative quantity added to inventory.
router.post('/record', async (req, res) => {
  try {
    const { brand, challanNo, challanDate, lotNo, rows } = req.body;

    if (!brand || !challanNo || !challanDate) {
      return res.status(400).json({ error: 'brand, challanNo, and challanDate are required.' });
    }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'At least one item row is required.' });
    }

    // Filter to rows that have a valid item code and a physical qty > 0
    const validRows = rows.filter(
      (r) => r.itemCode && r.itemCode.trim() && parseInt(r.physicalQty, 10) > 0
    );

    if (validRows.length === 0) {
      return res.status(400).json({ error: 'No rows with a valid item code and physical quantity > 0 found.' });
    }

    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      const inserted = [];
      for (const row of validRows) {
        const qty = parseInt(row.physicalQty, 10);
        const lotRemarks = lotNo ? `Lot No: ${lotNo}` : null;

        const result = await client.query(
          `INSERT INTO pcb_transactions
             (brand_name, transaction_type, dc_number, transaction_date, part_code, quantity, status, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            brand,
            'in_ward',
            challanNo.trim(),
            challanDate,
            row.itemCode.trim(),
            qty,
            null,   // status - not applicable for in_ward
            lotRemarks,
          ]
        );
        inserted.push(result.rows[0]);
      }

      await client.query('COMMIT');

      await createNotification({
        type: TYPES.INWARD_RECORDED,
        title: 'Inward challan recorded',
        message: `${req.user?.username || 'A user'} recorded inward challan ${challanNo.trim()} for ${brand} (${inserted.length} item(s)).`,
        actor: req.user?.username,
        audience: 'all',
        metadata: { challanNo: challanNo.trim(), brand, lotNo: lotNo || null, items: inserted.length },
      });

      res.status(201).json({ message: `Inventory updated. ${inserted.length} item(s) recorded.`, data: inserted });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Inward record error:', err);
    res.status(500).json({ error: `Failed to record inward inventory: ${err.message}` });
  }
});

module.exports = router;
