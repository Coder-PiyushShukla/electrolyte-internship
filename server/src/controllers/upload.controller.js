// ─── Upload Controller ───
const path = require('path');
const fs   = require('fs');
const ExcelJS = require('exceljs');
const db   = require('../config/db');
const { parseExcelFile } = require('../utils/excelParser');
const { getItemsForBrand } = require('../config/productData');

function normalizeBrand(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'atomberg') return 'Atomberg';
  if (raw === 'bajaj') return 'Bajaj';
  return null;
}

function normalizeType(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]/g, '_');
  if (raw === 'inward' || raw === 'in_ward') return 'in_ward';
  if (raw === 'outward' || raw === 'out_ward') return 'out_ward';
  return null;
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
  row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
}

// GET /api/upload/template?brand=Bajaj&type=inward
exports.downloadTemplate = async (req, res) => {
  try {
    const brand = normalizeBrand(req.query.brand);
    const type = normalizeType(req.query.type);

    if (!brand || !type) {
      return res.status(400).json({ error: 'Please select a valid brand and type.' });
    }

    const items = Object.keys(await getItemsForBrand(brand));
    if (items.length === 0) {
      return res.status(400).json({ error: `No item codes configured for ${brand}.` });
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PCB Tracker';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Pivoted Import');
    const dcHeader = type === 'out_ward' ? 'Out-Ward DC No.' : 'In-Ward DC No.';
    const fixedHeaders = [dcHeader, 'DC Date', 'Lot No.'];
    const itemHeaders = type === 'out_ward'
      ? items.flatMap((code) => [`${code} OK`, `${code} SCRAP`])
      : items;
    const headers = [...fixedHeaders, ...itemHeaders, 'Grand Total', 'Remarks'];

    worksheet.addRow(headers);
    styleHeader(worksheet.getRow(1));
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    headers.forEach((header, index) => {
      const col = worksheet.getColumn(index + 1);
      col.width = Math.min(Math.max(String(header).length + 4, 14), 22);
      if (index >= fixedHeaders.length && index < fixedHeaders.length + itemHeaders.length) {
        col.numFmt = '0';
      }
    });
    worksheet.getColumn(2).numFmt = 'yyyy-mm-dd';

    const exampleRow = worksheet.addRow([
      type === 'out_ward' ? 'DC-EXAMPLE' : 'IN-DC-EXAMPLE',
      new Date(),
      '1',
      ...itemHeaders.map(() => ''),
      '',
      '',
    ]);
    exampleRow.getCell(2).numFmt = 'yyyy-mm-dd';
    exampleRow.font = { color: { argb: 'FF6B7280' }, italic: true };

    worksheet.addRow([]);
    const noteRow = worksheet.addRow([
      'Fill one row per DC/Lot. Enter quantities only under the item-code columns. Keep auto-filled details such as description, HSN, unit, rate, company address, phone and GSTIN out of this file.',
    ]);
    worksheet.mergeCells(noteRow.number, 1, noteRow.number, headers.length);
    noteRow.alignment = { wrapText: true };
    noteRow.font = { color: { argb: 'FF6B7280' } };

    const fileName = `${brand}_${type === 'out_ward' ? 'Outward' : 'Inward'}_Pivoted_Template.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({ error: `Template generation failed: ${err.message}` });
  }
};

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

      const balances = new Map();
      const balanceKey = (brand, partCode) => `${brand}::${partCode}`;

      for (const row of rows) {
        const key = balanceKey(row.brand_name, row.part_code);
        if (!balances.has(key)) {
          const balanceResult = await client.query(
            `SELECT
               COALESCE(SUM(CASE WHEN transaction_type = 'in_ward' THEN quantity ELSE 0 END), 0) -
               COALESCE(SUM(CASE WHEN transaction_type = 'out_ward' THEN quantity ELSE 0 END), 0) AS balance
             FROM pcb_transactions
             WHERE brand_name = $1 AND part_code = $2`,
            [row.brand_name, row.part_code]
          );
          balances.set(key, Number(balanceResult.rows[0]?.balance || 0));
        }

        const currentBalance = balances.get(key);
        if (row.transaction_type === 'out_ward' && row.quantity > currentBalance) {
          throw new Error(`Cannot import outward quantity ${row.quantity} for "${row.part_code}" (${row.brand_name}). Only ${currentBalance} unit(s) remain available.`);
        }

        balances.set(
          key,
          row.transaction_type === 'in_ward'
            ? currentBalance + row.quantity
            : currentBalance - row.quantity
        );
      }

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
