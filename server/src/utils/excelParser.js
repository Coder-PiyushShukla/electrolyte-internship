// ─── Excel / CSV Parser Utility ───
const ExcelJS = require('exceljs');
const path    = require('path');

/**
 * Parse an uploaded .xlsx or .csv file and extract PCB transaction rows.
 * Supports both "Flat" format and "Pivoted" format.
 *
 * @param {string} filePath - Absolute path to the uploaded file
 * @returns {Promise<{ rows: Array, errors: Array }>}
 */
async function parseExcelFile(filePath) {
  const workbook = new ExcelJS.Workbook();
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    await workbook.csv.readFile(filePath);
  } else {
    await workbook.xlsx.readFile(filePath);
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error('No worksheet found in the uploaded file.');
  }

  // ── Map header row to column indices ──
  const headerRow = worksheet.getRow(1);
  const headerMap = {};
  const headerNames = []; // Keep original casing for part codes

  headerRow.eachCell((cell, colNumber) => {
    let rawVal = '';
    if (cell.value && cell.value.richText) {
      rawVal = cell.value.richText.map(rt => rt.text).join('');
    } else {
      rawVal = String(cell.value || '');
    }
    // Clean up newlines and extra spaces that might mess up mapping
    rawVal = rawVal.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
    
    headerMap[rawVal.toLowerCase()] = colNumber;
    headerNames[colNumber] = rawVal;
  });

  // Check if it's the Pivoted format
  const headerKeys = Object.keys(headerMap);
  const isPivoted = headerKeys.some(k => k.includes('in-ward') || k.includes('out-ward') || k.includes('lot no'));
  
  if (isPivoted) {
    return parsePivotedFormat(worksheet, headerMap, headerNames);
  }

  return parseFlatFormat(worksheet, headerMap);
}

// ─── Pivoted Format Parser ───
function parsePivotedFormat(worksheet, headerMap, headerNames) {
  const rows = [];
  const errors = [];
  const headerKeys = Object.keys(headerMap);
  
  // Identify key columns using robust substring matching
  const dcInKey = headerKeys.find(k => k.includes('in-ward dc'));
  const dcOutKey = headerKeys.find(k => k.includes('out-ward dc'));
  const dcKey = dcInKey || dcOutKey || headerKeys.find(k => k === 'dc no' || k === 'dc no.');
  const dcCol = dcKey ? headerMap[dcKey] : null;

  const dateKey = headerKeys.find(k => k.includes('dc date') || k === 'date');
  const dateCol = dateKey ? headerMap[dateKey] : null;

  const lotKey = headerKeys.find(k => k.includes('lot no'));
  const lotCol = lotKey ? headerMap[lotKey] : null;
  
  // Find remarks column
  const remarksKey = headerKeys.find(k => k.startsWith('re') && !k.includes('renesa'));
  const remarksCol = remarksKey ? headerMap[remarksKey] : null;

  const transactionType = dcOutKey ? 'out_ward' : 'in_ward';
  // Infer Brand from headers (Efficio, Renesa, Ozeo are Atomberg models)
  const isAtomberg = Object.keys(headerMap).some(k => k.includes('efficio') || k.includes('renesa') || k.includes('ozeo') || k.includes('sa00'));
  const defaultBrand = isAtomberg ? 'Atomberg' : 'Bajaj';

  if (!dcCol) {
    throw new Error(`Missing required DC No. column. Found headers: ${headerKeys.join(', ')}`);
  }

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    
    const rawDC = String(row.getCell(dcCol).value || '').trim();
    if (!rawDC) return; // Skip empty rows
    
    // Parse Date safely
    const rawDate = dateCol ? row.getCell(dateCol).value : '';
    let parsedDate = null;
    if (rawDate instanceof Date) {
      parsedDate = rawDate.toISOString().split('T')[0];
    } else {
      const dStr = String(rawDate || '').trim();
      if (dStr) {
        try {
          // Handle common DD/MM/YYYY or DD-MM-YYYY formats in Excel exports
          const parts = dStr.split(/[-/]/);
          if (parts.length === 3 && parts[0].length <= 2 && parts[2].length === 4) {
            // It's DD-MM-YYYY
            parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).toISOString().split('T')[0];
          } else {
            // Standard JS parse
            const d = new Date(dStr);
            if (!isNaN(d.getTime())) {
              parsedDate = d.toISOString().split('T')[0];
            }
          }
        } catch (e) {
          // Ignore and let fallback handle it
          parsedDate = null;
        }
      }
    }
    // Fallback to today if date is completely unparseable
    if (!parsedDate || parsedDate.includes('NaN')) {
      parsedDate = new Date().toISOString().split('T')[0];
    }
    
    // Parse Remarks
    const lotNo = lotCol ? String(row.getCell(lotCol).value || '').trim() : '';
    const remarksCell = remarksCol ? String(row.getCell(remarksCol).value || '').trim() : '';
    let remarks = remarksCell;
    if (lotNo) remarks = `Lot No: ${lotNo}${remarks ? ' | ' + remarks : ''}`;

    // Iterate over all columns to find part quantities
    row.eachCell((cell, colNumber) => {
      // Skip known non-part columns
      if (colNumber === dcCol || colNumber === dateCol || colNumber === lotCol || colNumber === remarksCol) return;
      
      const headerName = headerNames[colNumber];
      if (!headerName) return;
      
      const lowerHeader = headerName.toLowerCase();
      if (lowerHeader.includes('grand total') || lowerHeader.startsWith('re')) return;

      let partCode = headerName;
      let status = null;
      if (transactionType === 'out_ward') {
        const statusMatch = headerName.match(/\s+(ok|scrap)$/i);
        if (statusMatch) {
          status = statusMatch[1].toLowerCase();
          partCode = headerName.slice(0, statusMatch.index).trim();
        } else {
          status = 'ok';
        }
      }
      
      // If cell has a number > 0, create a transaction record for this part
      const qty = parseInt(cell.value, 10);
      if (!isNaN(qty) && qty > 0) {
        rows.push({
          brand_name: defaultBrand,
          transaction_type: transactionType,
          dc_number: rawDC,
          transaction_date: parsedDate,
          part_code: partCode,
          quantity: qty,
          status,
          remarks: remarks || null
        });
      }
    });
  });
  
  return { rows, errors };
}

// ─── Flat Format Parser (Original Behavior) ───
function parseFlatFormat(worksheet, headerMap) {
  const rows = [];
  const errors = [];
  
  const columnAliases = {
    brand:     ['brand', 'brand_name', 'brand name'],
    type:      ['type', 'transaction_type', 'transaction type', 'txn type'],
    dc_number: ['dc no', 'dc_number', 'dc number', 'dcno', 'dc_no'],
    date:      ['date', 'transaction_date', 'transaction date', 'txn date'],
    part_code: ['part code', 'part_code', 'partcode'],
    quantity:  ['quantity', 'qty'],
    status:    ['status'],
    remarks:   ['remarks', 'remark', 'notes', 'note'],
  };

  const colMap = {};
  for (const [field, aliases] of Object.entries(columnAliases)) {
    for (const alias of aliases) {
      if (headerMap[alias] !== undefined) {
        colMap[field] = headerMap[alias];
        break;
      }
    }
  }

  const requiredCols = ['brand', 'type', 'dc_number', 'date', 'part_code', 'quantity'];
  const missingCols = requiredCols.filter(c => colMap[c] === undefined);
  if (missingCols.length > 0) {
    throw new Error(`Missing required columns: ${missingCols.join(', ')}. Found headers: ${Object.keys(headerMap).join(', ')}`);
  }

  const validBrands = ['atomberg', 'bajaj'];
  const validStatus = ['ok', 'scrap'];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    try {
      const rawBrand   = String(row.getCell(colMap.brand).value || '').trim();
      const rawType    = String(row.getCell(colMap.type).value || '').trim();
      const rawDC      = String(row.getCell(colMap.dc_number).value || '').trim();
      const rawDate    = row.getCell(colMap.date).value;
      const rawPartCode = String(row.getCell(colMap.part_code).value || '').trim();
      const rawQty     = row.getCell(colMap.quantity).value;
      const rawStatus  = colMap.status ? String(row.getCell(colMap.status).value || '').trim().toLowerCase() : '';
      const rawRemarks = colMap.remarks ? String(row.getCell(colMap.remarks).value || '').trim() : '';

      if (!rawBrand && !rawType && !rawDC && !rawPartCode) return;

      const brand = rawBrand.charAt(0).toUpperCase() + rawBrand.slice(1).toLowerCase();
      if (!validBrands.includes(brand.toLowerCase())) {
        errors.push({ row: rowNumber, message: `Invalid brand "${rawBrand}".` });
        return;
      }

      let txnType = rawType.toLowerCase().replace(/[\s-]/g, '_');
      if (['inward', 'in_ward'].includes(txnType)) txnType = 'in_ward';
      else if (['outward', 'out_ward'].includes(txnType)) txnType = 'out_ward';
      else {
        errors.push({ row: rowNumber, message: `Invalid type "${rawType}".` });
        return;
      }

      let parsedDate;
      if (rawDate instanceof Date) {
        parsedDate = rawDate.toISOString().split('T')[0];
      } else {
        parsedDate = String(rawDate || '').trim();
        if (!parsedDate) {
          errors.push({ row: rowNumber, message: 'Date is required.' });
          return;
        }
      }

      const qty = parseInt(rawQty, 10);
      if (isNaN(qty) || qty < 0) {
        errors.push({ row: rowNumber, message: `Invalid quantity "${rawQty}".` });
        return;
      }

      let status = null;
      if (rawStatus && validStatus.includes(rawStatus)) {
        status = rawStatus;
      } else if (rawStatus && rawStatus !== 'null' && rawStatus !== '') {
        errors.push({ row: rowNumber, message: `Invalid status "${rawStatus}".` });
        return;
      }

      if (!rawDC || !rawPartCode) {
        errors.push({ row: rowNumber, message: 'DC and Part Code are required.' });
        return;
      }

      rows.push({
        brand_name: brand,
        transaction_type: txnType,
        dc_number: rawDC,
        transaction_date: parsedDate,
        part_code: rawPartCode,
        quantity: qty,
        status,
        remarks: rawRemarks || null,
      });
    } catch (err) {
      errors.push({ row: rowNumber, message: `Parse error: ${err.message}` });
    }
  });

  return { rows, errors };
}

module.exports = { parseExcelFile };

