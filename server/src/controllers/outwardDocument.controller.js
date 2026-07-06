// ─── Outward Document (PDF) Controller ───
// Uses pdfmake (pure JS) instead of Puppeteer - no Chrome dependency required.
const path = require('path');
const fs = require('fs');
const PdfPrinter = require('pdfmake');
const db = require('../config/db');
const { getCompany } = require('../config/companyData');

const PDF_DIR = path.join(__dirname, '..', '..', 'outward_pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

// ── Font definitions for pdfmake ──
const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};
const printer = new PdfPrinter(fonts);

function formatCurrency(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safe(val) {
  return String(val ?? '');
}

// ── Build the pdfmake document definition ──
function buildDocDefinition(dispatch) {
  const company = getCompany();
  const items = dispatch.items || [];

  const okQty = items.filter((i) => i.status === 'OK').reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const scrapQty = items.filter((i) => i.status === 'SCRAP').reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const grandQty = okQty + scrapQty;
  const numProducts = new Set(items.map((i) => i.item_code || i.itemCode)).size;

  // ── Table body rows ──
  const tableHeader = [
    { text: 'Sr', style: 'tableHeader' },
    { text: 'Item Code', style: 'tableHeader' },
    { text: 'Product', style: 'tableHeader' },
    { text: 'HSN', style: 'tableHeader' },
    { text: 'Unit', style: 'tableHeader' },
    { text: 'Status', style: 'tableHeader' },
    { text: 'Qty', style: 'tableHeader', alignment: 'right' },
    { text: 'Rate', style: 'tableHeader', alignment: 'right' },
    { text: 'Amount', style: 'tableHeader', alignment: 'right' },
  ];

  const tableRows = items.map((item, idx) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const rate = parseFloat(item.rate) || 0;
    const amount = parseFloat(item.amount) || qty * rate;
    const isOk = item.status === 'OK';
    const fillColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

    return [
      { text: String(idx + 1), alignment: 'center', fillColor },
      { text: safe(item.item_code || item.itemCode), font: 'Helvetica', fillColor },
      { text: safe(item.description), fillColor },
      { text: safe(item.hsn_code || item.hsnCode), alignment: 'center', fillColor },
      { text: safe(item.unit || 'Nos'), alignment: 'center', fillColor },
      {
        text: safe(item.status),
        alignment: 'center',
        color: isOk ? '#059669' : '#dc2626',
        bold: true,
        fontSize: 9,
        fillColor,
      },
      { text: String(qty), alignment: 'right', fillColor },
      { text: formatCurrency(rate), alignment: 'right', fillColor },
      { text: formatCurrency(amount), alignment: 'right', fillColor },
    ];
  });

  // ── Terms list ──
  const terms = (company.terms || []).map((t, i) => `${i + 1}. ${t}`).join('\n');

  // ── Document definition ──
  const docDefinition = {
    defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#1e293b' },
    pageSize: 'A4',
    pageMargins: [28, 28, 28, 28],
    styles: {
      companyName: { fontSize: 18, bold: true, color: '#1e3a8a' },
      companyMeta: { fontSize: 9, color: '#475569', lineHeight: 1.4 },
      docTitle: { fontSize: 14, bold: true, color: '#1e3a8a', alignment: 'center' },
      sectionHeader: { fontSize: 10, bold: true, color: '#1e3a8a', margin: [0, 0, 0, 6] },
      tableHeader: { bold: true, fontSize: 9, color: '#ffffff', fillColor: '#1e3a8a', alignment: 'left' },
      label: { fontSize: 9, color: '#64748b' },
      value: { fontSize: 9, bold: true, color: '#1e293b' },
      totalLabel: { fontSize: 10, color: '#1e293b' },
      totalValue: { fontSize: 10, bold: true, color: '#1e293b', alignment: 'right' },
      grandTotalLabel: { fontSize: 10, bold: true, color: '#ffffff' },
      grandTotalValue: { fontSize: 10, bold: true, color: '#ffffff', alignment: 'right' },
    },
    content: [
      // ── Header: Company Info + Logo Box ──
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: safe(company.companyName), style: 'companyName', margin: [0, 0, 0, 4] },
              {
                text: [
                  safe(company.address), '\n',
                  `Phone: ${safe(company.phone)}`,
                  company.email ? ` | Email: ${safe(company.email)}` : '',
                  '\n',
                  `GSTIN: ${safe(company.gstin)}`,
                  company.website ? ` | ${safe(company.website)}` : '',
                ].join(''),
                style: 'companyMeta',
              },
            ],
          },
          {
            width: 54,
            stack: [
              {
                canvas: [
                  { type: 'rect', x: 0, y: 0, w: 54, h: 54, r: 8, color: '#1e3a8a' },
                ],
              },
              {
                text: 'ES',
                fontSize: 18,
                bold: true,
                color: '#ffffff',
                alignment: 'center',
                relativePosition: { x: 0, y: -40 },
              },
            ],
            alignment: 'right',
          },
        ],
        margin: [0, 0, 0, 10],
      },

      // ── Divider line ──
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 2.5, lineColor: '#1e3a8a' }], margin: [0, 0, 0, 10] },

      // ── Document Title ──
      {
        text: 'OUTWARD PCB DELIVERY CHALLAN',
        style: 'docTitle',
        margin: [0, 4, 0, 14],
      },

      // ── Customer + Dispatch Details (two columns) ──
      {
        columns: [
          {
            width: '50%',
            stack: [
              { text: 'CUSTOMER DETAILS', style: 'sectionHeader' },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 6] },
              buildInfoRow('Company', safe(dispatch.company_name)),
              buildInfoRow('Address', safe(dispatch.company_address)),
              buildInfoRow('Phone', safe(dispatch.phone_no)),
              buildInfoRow('GSTIN', safe(dispatch.gstin)),
            ],
            margin: [0, 0, 10, 0],
          },
          {
            width: '50%',
            stack: [
              { text: 'DISPATCH DETAILS', style: 'sectionHeader' },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 250, y2: 0, lineWidth: 0.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 6] },
              buildInfoRow('Challan No.', safe(dispatch.dc_no)),
              buildInfoRow('Challan Date', formatDate(dispatch.challan_date)),
              buildInfoRow('Lot No.', safe(dispatch.lot_no)),
              buildInfoRow('Vehicle No.', safe(dispatch.vehicle_no || '-')),
              buildInfoRow('Courier Partner', safe(dispatch.courier_partner || '-')),
            ],
          },
        ],
        margin: [0, 0, 0, 16],
      },

      // ── Items Table ──
      {
        table: {
          headerRows: 1,
          widths: [22, 60, '*', 48, 32, 42, 36, 50, 56],
          body: [tableHeader, ...tableRows],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          paddingLeft: () => 6,
          paddingRight: () => 6,
          paddingTop: () => 5,
          paddingBottom: () => 5,
        },
        margin: [0, 0, 0, 14],
      },

      // ── Totals Box (right-aligned) ──
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 260,
            table: {
              widths: ['*', 'auto'],
              body: [
                [
                  { text: 'Number of Products', style: 'totalLabel' },
                  { text: String(numProducts), style: 'totalValue' },
                ],
                [
                  { text: 'Total OK Qty', style: 'totalLabel' },
                  { text: String(okQty), style: 'totalValue' },
                ],
                [
                  { text: 'Total Scrap Qty', style: 'totalLabel' },
                  { text: String(scrapQty), style: 'totalValue' },
                ],
                [
                  { text: 'Grand Total Qty / Amount', style: 'grandTotalLabel', fillColor: '#1e3a8a' },
                  { text: `${grandQty} / ₹${formatCurrency(dispatch.total_amount)}`, style: 'grandTotalValue', fillColor: '#1e3a8a' },
                ],
              ],
            },
            layout: {
              hLineWidth: () => 0.5,
              vLineWidth: () => 0,
              hLineColor: () => '#e2e8f0',
              paddingLeft: () => 10,
              paddingRight: () => 10,
              paddingTop: () => 5,
              paddingBottom: () => 5,
            },
          },
        ],
        margin: [0, 0, 0, 14],
      },

      // ── Remarks (conditional) ──
      ...(dispatch.remarks
        ? [
            {
              text: [
                { text: 'Remarks: ', bold: true },
                safe(dispatch.remarks),
              ],
              fontSize: 10,
              color: '#92400e',
              background: '#fffbeb',
              margin: [0, 0, 0, 14],
            },
          ]
        : []),

      // ── Terms & Conditions ──
      { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 539, y2: 0, lineWidth: 1.5, lineColor: '#cbd5e1' }], margin: [0, 0, 0, 8] },
      { text: 'Terms & Conditions', fontSize: 10, bold: true, color: '#1e3a8a', margin: [0, 0, 0, 6] },
      { text: terms, fontSize: 9, color: '#475569', lineHeight: 1.5, margin: [0, 0, 0, 20] },

      // ── Signature Area ──
      {
        columns: [
          {
            width: '45%',
            stack: [
              { text: '', margin: [0, 40, 0, 0] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: '#1e293b' }] },
              { text: 'Receiver Signature & Date', fontSize: 9, bold: true, alignment: 'center', margin: [0, 6, 0, 0] },
            ],
          },
          { width: '*', text: '' },
          {
            width: '45%',
            stack: [
              { text: '', margin: [0, 40, 0, 0] },
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: '#1e293b' }] },
              { text: `Authorized Signatory - ${safe(company.companyName)} (Company Stamp)`, fontSize: 9, bold: true, alignment: 'center', margin: [0, 6, 0, 0] },
            ],
          },
        ],
      },
    ],
  };

  return docDefinition;
}

// Helper to build a label/value row for the info sections
function buildInfoRow(label, value) {
  return {
    columns: [
      { width: 90, text: label, style: 'label' },
      { width: '*', text: value, style: 'value' },
    ],
    margin: [0, 0, 0, 3],
  };
}

// Generates the PDF file on disk and returns its path.
async function generatePdfFile(dispatch) {
  const docDefinition = buildDocDefinition(dispatch);
  const fileName = `${dispatch.dc_no.replace(/\//g, '-')}.pdf`;
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

// POST /api/outward/generate-document  { dispatchId }
exports.generateDocument = async (req, res) => {
  try {
    const { dispatchId } = req.body;
    if (!dispatchId) return res.status(400).json({ error: 'dispatchId is required.' });

    const dispatchResult = await db.query('SELECT * FROM outward_dispatches WHERE id = $1', [dispatchId]);
    if (dispatchResult.rows.length === 0) return res.status(404).json({ error: 'Dispatch not found.' });
    const itemsResult = await db.query('SELECT * FROM outward_dispatch_items WHERE dispatch_id = $1 ORDER BY id', [dispatchId]);

    const dispatch = { ...dispatchResult.rows[0], items: itemsResult.rows };
    const { filePath, fileName } = await generatePdfFile(dispatch);

    await db.query('UPDATE outward_dispatches SET pdf_path = $1 WHERE id = $2', [filePath, dispatchId]);

    res.json({ message: 'Document generated.', fileName, downloadUrl: `/api/outward/dispatches/${dispatchId}/download` });
  } catch (err) {
    console.error('Generate document error:', err);
    res.status(500).json({ error: `Failed to generate document: ${err.message}` });
  }
};

// GET /api/outward/dispatches/:id/download
exports.downloadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT pdf_path, dc_no FROM outward_dispatches WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dispatch not found.' });

    let { pdf_path: pdfPath, dc_no: dcNo } = result.rows[0];

    // If the PDF hasn't been generated yet (or the file is missing), generate it on the fly.
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const dispatchResult = await db.query('SELECT * FROM outward_dispatches WHERE id = $1', [id]);
      const itemsResult = await db.query('SELECT * FROM outward_dispatch_items WHERE dispatch_id = $1 ORDER BY id', [id]);
      const dispatch = { ...dispatchResult.rows[0], items: itemsResult.rows };
      const generated = await generatePdfFile(dispatch);
      pdfPath = generated.filePath;
      await db.query('UPDATE outward_dispatches SET pdf_path = $1 WHERE id = $2', [pdfPath, id]);
    }

    res.download(pdfPath, `${dcNo.replace(/\//g, '-')}.pdf`);
  } catch (err) {
    console.error('Download document error:', err);
    res.status(500).json({ error: `Failed to download document: ${err.message}` });
  }
};

module.exports.generatePdfFile = generatePdfFile;
