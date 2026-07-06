// ─── E-Way Bill Controller ───
// Handles saving E-Way Bill details against an outward dispatch, and
// generating a printable/downloadable PDF copy of those details.
//
// Note: this does NOT file anything with the government E-Way Bill portal.
// The actual E-Way Bill number must still be generated on ewaybillgst.gov.in -
// this just lets you record those details against the dispatch and produce
// a clean internal copy for your records / the driver to carry alongside
// the delivery challan.

const path = require('path');
const fs = require('fs');
const PdfPrinter = require('pdfmake');
const db = require('../config/db');
const { getCompany } = require('../config/companyData');

const PDF_DIR = path.join(__dirname, '..', '..', 'outward_pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
const printer = new PdfPrinter(fonts);

function safe(val) {
  return String(val ?? '-');
}

function formatDateTime(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(d) {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatCurrency(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Ensure the table exists (safety net if migration wasn't run manually).
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS outward_eway_bills (
      id                   SERIAL PRIMARY KEY,
      dispatch_id          INTEGER NOT NULL UNIQUE REFERENCES outward_dispatches(id) ON DELETE CASCADE,
      eway_bill_no         VARCHAR(50),
      eway_bill_date       DATE,
      generated_by_gstin   VARCHAR(50),
      generated_by_name    VARCHAR(255),
      distance_km          INTEGER,
      valid_from           TIMESTAMPTZ,
      valid_until          TIMESTAMPTZ,
      supplier_gstin       VARCHAR(50),
      place_of_dispatch    TEXT,
      recipient_gstin      VARCHAR(50),
      place_of_delivery    TEXT,
      document_no          VARCHAR(50),
      document_date        DATE,
      value_of_goods       NUMERIC(12, 2),
      reason               VARCHAR(100),
      transporter_name     VARCHAR(255),
      transport_mode       VARCHAR(20),
      vehicle_no           VARCHAR(20),
      from_state           VARCHAR(100),
      entered_date         DATE,
      entered_by           VARCHAR(100),
      created_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

// GET /api/outward/dispatches/:id/eway - fetch saved e-way bill details (or null)
exports.getEwayBill = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const result = await db.query('SELECT * FROM outward_eway_bills WHERE dispatch_id = $1', [id]);
    res.json({ data: result.rows[0] || null });
  } catch (err) {
    console.error('Get e-way bill error:', err);
    res.status(500).json({ error: 'Failed to load e-way bill details.' });
  }
};

// POST /api/outward/dispatches/:id/eway - create or update e-way bill details
exports.saveEwayBill = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;

    const dispatchCheck = await db.query('SELECT id FROM outward_dispatches WHERE id = $1', [id]);
    if (dispatchCheck.rows.length === 0) return res.status(404).json({ error: 'Dispatch not found.' });

    const {
      ewayBillNo, ewayBillDate, generatedByGstin, generatedByName, distanceKm,
      validFrom, validUntil, supplierGstin, placeOfDispatch, recipientGstin,
      placeOfDelivery, documentNo, documentDate, valueOfGoods, reason,
      transporterName, transportMode, vehicleNo, fromState, enteredDate, enteredBy,
    } = req.body;

    const result = await db.query(
      `INSERT INTO outward_eway_bills (
         dispatch_id, eway_bill_no, eway_bill_date, generated_by_gstin, generated_by_name,
         distance_km, valid_from, valid_until, supplier_gstin, place_of_dispatch,
         recipient_gstin, place_of_delivery, document_no, document_date, value_of_goods,
         reason, transporter_name, transport_mode, vehicle_no, from_state,
         entered_date, entered_by, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, NOW()
       )
       ON CONFLICT (dispatch_id) DO UPDATE SET
         eway_bill_no = EXCLUDED.eway_bill_no,
         eway_bill_date = EXCLUDED.eway_bill_date,
         generated_by_gstin = EXCLUDED.generated_by_gstin,
         generated_by_name = EXCLUDED.generated_by_name,
         distance_km = EXCLUDED.distance_km,
         valid_from = EXCLUDED.valid_from,
         valid_until = EXCLUDED.valid_until,
         supplier_gstin = EXCLUDED.supplier_gstin,
         place_of_dispatch = EXCLUDED.place_of_dispatch,
         recipient_gstin = EXCLUDED.recipient_gstin,
         place_of_delivery = EXCLUDED.place_of_delivery,
         document_no = EXCLUDED.document_no,
         document_date = EXCLUDED.document_date,
         value_of_goods = EXCLUDED.value_of_goods,
         reason = EXCLUDED.reason,
         transporter_name = EXCLUDED.transporter_name,
         transport_mode = EXCLUDED.transport_mode,
         vehicle_no = EXCLUDED.vehicle_no,
         from_state = EXCLUDED.from_state,
         entered_date = EXCLUDED.entered_date,
         entered_by = EXCLUDED.entered_by,
         updated_at = NOW()
       RETURNING *`,
      [
        id, ewayBillNo || null, ewayBillDate || null, generatedByGstin || null, generatedByName || null,
        distanceKm || null, validFrom || null, validUntil || null, supplierGstin || null, placeOfDispatch || null,
        recipientGstin || null, placeOfDelivery || null, documentNo || null, documentDate || null, valueOfGoods || null,
        reason || null, transporterName || null, transportMode || null, vehicleNo || null, fromState || null,
        enteredDate || null, enteredBy || null,
      ]
    );

    res.status(201).json({ message: 'E-Way Bill details saved.', data: result.rows[0] });
  } catch (err) {
    console.error('Save e-way bill error:', err);
    res.status(500).json({ error: `Failed to save e-way bill details: ${err.message}` });
  }
};

// ── PDF generation ──

function buildInfoRow(label, value, width = 130) {
  return {
    columns: [
      { width, text: label, style: 'label' },
      { width: '*', text: safe(value), style: 'value' },
    ],
    margin: [0, 0, 0, 5],
  };
}

function buildDocDefinition(eway, dispatch) {
  const company = getCompany();

  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#1e293b' },
    pageSize: 'A4',
    pageMargins: [30, 30, 30, 30],
    styles: {
      title: { fontSize: 18, bold: true, color: '#1e3a8a' },
      partHeader: { fontSize: 11, bold: true, color: '#ffffff' },
      label: { fontSize: 9, color: '#64748b' },
      value: { fontSize: 10, bold: true, color: '#0f172a' },
      note: { fontSize: 8, italics: true, color: '#94a3b8' },
    },
    content: [
      { text: 'e-Way Bill', style: 'title', margin: [0, 0, 0, 4] },
      { text: `Internal record: generated on ${formatDateTime(new Date())} by ${safe(eway.entered_by)}`, style: 'note', margin: [0, 0, 0, 14] },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 12] },

      buildInfoRow('e-Way Bill No.', eway.eway_bill_no),
      buildInfoRow('e-Way Bill Date', formatDate(eway.eway_bill_date)),
      buildInfoRow('Generated By', `${safe(eway.generated_by_gstin)}${eway.generated_by_name ? ', ' + eway.generated_by_name : ''}`),
      buildInfoRow('Valid From', formatDateTime(eway.valid_from) + (eway.distance_km ? ` (${eway.distance_km} km)` : '')),
      buildInfoRow('Valid Until', formatDateTime(eway.valid_until)),

      { text: '', margin: [0, 6, 0, 0] },
      {
        table: { widths: ['*'], body: [[{ text: 'PART - A', style: 'partHeader', fillColor: '#1e3a8a' }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 10],
      },

      buildInfoRow('GSTIN of Supplier', eway.supplier_gstin, 160),
      buildInfoRow('Place of Dispatch', eway.place_of_dispatch, 160),
      buildInfoRow('GSTIN of Recipient', eway.recipient_gstin, 160),
      buildInfoRow('Place of Delivery', eway.place_of_delivery, 160),
      buildInfoRow('Document No.', eway.document_no, 160),
      buildInfoRow('Document Date', formatDate(eway.document_date), 160),
      buildInfoRow('Value of Goods', formatCurrency(eway.value_of_goods), 160),
      buildInfoRow('Reason for Transportation', eway.reason, 160),
      buildInfoRow('Transporter', eway.transporter_name, 160),

      { text: '', margin: [0, 10, 0, 0] },
      {
        table: { widths: ['*'], body: [[{ text: 'PART - B', style: 'partHeader', fillColor: '#1e3a8a' }]] },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: () => 0,
          paddingLeft: () => 8,
          paddingRight: () => 8,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 10],
      },

      {
        table: {
          headerRows: 1,
          widths: ['*', '*', '*', '*', '*'],
          body: [
            [
              { text: 'Mode', style: 'label', bold: true },
              { text: 'Vehicle No.', style: 'label', bold: true },
              { text: 'From (State)', style: 'label', bold: true },
              { text: 'Entered Date', style: 'label', bold: true },
              { text: 'Entered By', style: 'label', bold: true },
            ],
            [
              { text: safe(eway.transport_mode), style: 'value', fontSize: 9 },
              { text: safe(eway.vehicle_no), style: 'value', fontSize: 9 },
              { text: safe(eway.from_state), style: 'value', fontSize: 9 },
              { text: formatDate(eway.entered_date), style: 'value', fontSize: 9 },
              { text: safe(eway.entered_by), style: 'value', fontSize: 9 },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 6,
          paddingBottom: () => 6,
        },
        margin: [0, 0, 0, 20],
      },

      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 535, y2: 0, lineWidth: 1, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 8] },
      {
        text: 'This is an internally generated record of E-Way Bill details for dispatch reference. It does not replace the official E-Way Bill generated on the GST E-Way Bill Portal (ewaybillgst.gov.in), which must be carried with the shipment as per Section 68 of the CGST Act.',
        style: 'note',
      },
    ],
  };

  return docDefinition;
}

async function generateEwayPdfFile(eway, dispatch) {
  const docDefinition = buildDocDefinition(eway, dispatch);
  const fileName = `EWAY-${(dispatch.dc_no || eway.dispatch_id).toString().replace(/\//g, '-')}.pdf`;
  const filePath = path.join(PDF_DIR, fileName);

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const writeStream = fs.createWriteStream(filePath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();
    writeStream.on('finish', () => resolve({ filePath, fileName }));
    writeStream.on('error', reject);
  });
}

// GET /api/outward/dispatches/:id/eway/download
exports.downloadEwayBill = async (req, res) => {
  try {
    await ensureTable();
    const { id } = req.params;

    const ewayResult = await db.query('SELECT * FROM outward_eway_bills WHERE dispatch_id = $1', [id]);
    if (ewayResult.rows.length === 0) {
      return res.status(404).json({ error: 'No e-way bill details saved for this dispatch yet. Please fill in the details first.' });
    }
    const dispatchResult = await db.query('SELECT * FROM outward_dispatches WHERE id = $1', [id]);
    if (dispatchResult.rows.length === 0) return res.status(404).json({ error: 'Dispatch not found.' });

    const { filePath, fileName } = await generateEwayPdfFile(ewayResult.rows[0], dispatchResult.rows[0]);
    res.download(filePath, fileName);
  } catch (err) {
    console.error('Download e-way bill error:', err);
    res.status(500).json({ error: `Failed to generate e-way bill PDF: ${err.message}` });
  }
};
