// ─── Upload Controller ───
const path = require('path');
const fs   = require('fs');
const db   = require('../config/db');
const { parseExcelFile } = require('../utils/excelParser');

// POST /api/upload
exports.uploadFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded. Please select a .xlsx or .csv file.' });
  }

  const filePath = req.file.path;

  try {
    // Parse the uploaded file
    const { rows, errors } = await parseExcelFile(filePath);

    if (rows.length === 0) {
      return res.status(400).json({
        error: 'No valid rows found in the uploaded file.',
        parseErrors: errors,
      });
    }

    // ── Bulk insert using a PostgreSQL transaction ──
    const client = await db.pool.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO pcb_transactions 
          (brand_name, transaction_type, dc_number, transaction_date, part_code, quantity, status, remarks)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      for (const row of rows) {
        await client.query(insertQuery, [
          row.brand_name,
          row.transaction_type,
          row.dc_number,
          row.transaction_date,
          row.part_code,
          row.quantity,
          row.status,
          row.remarks,
        ]);
        insertedCount++;
      }

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    // Clean up uploaded file
    fs.unlink(filePath, () => {});

    res.json({
      message: `Successfully imported ${insertedCount} transaction(s).`,
      inserted: insertedCount,
      skipped: errors.length,
      parseErrors: errors,
    });
  } catch (err) {
    // Clean up uploaded file on error
    fs.unlink(filePath, () => {});
    console.error('Upload error:', err);
    res.status(500).json({ error: `File processing failed: ${err.message}` });
  }
};
