// ─── Outward Document (PDF) Controller ───
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const db = require('../config/db');
const { getCompany } = require('../config/companyData');

const PDF_DIR = path.join(__dirname, '..', '..', 'outward_pdfs');
if (!fs.existsSync(PDF_DIR)) fs.mkdirSync(PDF_DIR, { recursive: true });

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCurrency(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Build the full HTML for the delivery challan ──
function buildChallanHtml(dispatch) {
  const company = getCompany();
  const items = dispatch.items || [];

  const okQty = items.filter((i) => i.status === 'OK').reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const scrapQty = items.filter((i) => i.status === 'SCRAP').reduce((s, i) => s + (parseInt(i.quantity, 10) || 0), 0);
  const grandQty = okQty + scrapQty;
  const numProducts = new Set(items.map((i) => i.item_code || i.itemCode)).size;

  const rowsHtml = items.map((item, idx) => {
    const qty = parseInt(item.quantity, 10) || 0;
    const rate = parseFloat(item.rate) || 0;
    const amount = parseFloat(item.amount) || qty * rate;
    const statusColor = item.status === 'OK' ? '#059669' : '#dc2626';
    const statusBg = item.status === 'OK' ? '#d1fae5' : '#fee2e2';
    return `
      <tr style="background:${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;font-family:monospace;">${escapeHtml(item.item_code || item.itemCode)}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;">${escapeHtml(item.description)}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(item.hsn_code || item.hsnCode)}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">${escapeHtml(item.unit || 'Nos')}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:center;">
          <span style="background:${statusBg};color:${statusColor};padding:2px 8px;border-radius:5px;font-size:11px;font-weight:700;">${escapeHtml(item.status)}</span>
        </td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:right;">${qty}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(rate)}</td>
        <td style="padding:7px 10px;border:1px solid #cbd5e1;text-align:right;">${formatCurrency(amount)}</td>
      </tr>`;
  }).join('');

  const termsHtml = (company.terms || [])
    .map((t, i) => `<li style="margin-bottom:4px;">${escapeHtml(t)}</li>`)
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; margin: 0; padding: 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e3a8a; padding-bottom: 14px; margin-bottom: 14px; }
  .company-name { font-size: 22px; font-weight: 800; color: #1e3a8a; margin: 0 0 4px; }
  .company-meta { font-size: 11.5px; color: #475569; line-height: 1.5; max-width: 380px; }
  .logo-box { width: 64px; height: 64px; border-radius: 10px; background: #1e3a8a; color: white; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 22px; }
  .title { text-align: center; font-size: 17px; font-weight: 800; letter-spacing: 0.5px; margin: 8px 0 18px; padding: 8px 0; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; color: #1e3a8a; }
  .two-col { display: flex; gap: 24px; margin-bottom: 18px; }
  .col { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 14px; background: #f8fafc; }
  .col h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #1e3a8a; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; }
  .row { display: flex; margin-bottom: 4px; font-size: 12px; }
  .row .label { width: 110px; color: #64748b; flex-shrink: 0; }
  .row .value { color: #1e293b; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 12px; }
  thead tr { background: #1e3a8a; color: white; }
  th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; border: 1px solid #1e3a8a; }
  .totals-box { display: flex; justify-content: flex-end; margin-bottom: 18px; }
  .totals-table { width: 320px; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; }
  .totals-table .trow { display: flex; justify-content: space-between; padding: 7px 14px; font-size: 12.5px; border-bottom: 1px solid #e2e8f0; }
  .totals-table .trow:last-child { border-bottom: none; background: #1e3a8a; color: white; font-weight: 700; }
  .remarks-box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 12px; background: #fffbeb; }
  .terms-box { border-top: 2px solid #cbd5e1; padding-top: 12px; margin-bottom: 30px; font-size: 11px; color: #475569; }
  .terms-box h4 { font-size: 12px; color: #1e3a8a; margin: 0 0 8px; }
  .terms-box ol { margin: 0; padding-left: 18px; }
  .sign-area { display: flex; justify-content: space-between; margin-top: 40px; }
  .sign-box { width: 45%; text-align: center; }
  .sign-line { border-top: 1px solid #1e293b; margin-top: 50px; padding-top: 6px; font-size: 11.5px; font-weight: 600; }
</style>
</head>
<body>

  <div class="header">
    <div>
      <p class="company-name">${escapeHtml(company.companyName)}</p>
      <p class="company-meta">
        ${escapeHtml(company.address)}<br/>
        Phone: ${escapeHtml(company.phone)} ${company.email ? `| Email: ${escapeHtml(company.email)}` : ''}<br/>
        GSTIN: ${escapeHtml(company.gstin)} ${company.website ? `| ${escapeHtml(company.website)}` : ''}
      </p>
    </div>
    <div class="logo-box">ES</div>
  </div>

  <div class="title">OUTWARD PCB DELIVERY CHALLAN</div>

  <div class="two-col">
    <div class="col">
      <h4>Customer Details</h4>
      <div class="row"><span class="label">Company</span><span class="value">${escapeHtml(dispatch.company_name)}</span></div>
      <div class="row"><span class="label">Address</span><span class="value">${escapeHtml(dispatch.company_address)}</span></div>
      <div class="row"><span class="label">Phone</span><span class="value">${escapeHtml(dispatch.phone_no)}</span></div>
      <div class="row"><span class="label">GSTIN</span><span class="value">${escapeHtml(dispatch.gstin)}</span></div>
    </div>
    <div class="col">
      <h4>Dispatch Details</h4>
      <div class="row"><span class="label">Challan No.</span><span class="value">${escapeHtml(dispatch.dc_no)}</span></div>
      <div class="row"><span class="label">Challan Date</span><span class="value">${formatDate(dispatch.challan_date)}</span></div>
      <div class="row"><span class="label">Lot No.</span><span class="value">${escapeHtml(dispatch.lot_no)}</span></div>
      <div class="row"><span class="label">Vehicle No.</span><span class="value">${escapeHtml(dispatch.vehicle_no || '—')}</span></div>
      <div class="row"><span class="label">Courier Partner</span><span class="value">${escapeHtml(dispatch.courier_partner || '—')}</span></div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Sr</th><th>Item Code</th><th>Product</th><th>HSN</th><th>Unit</th><th>Status</th>
        <th style="text-align:right;">Qty</th><th style="text-align:right;">Rate</th><th style="text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="totals-box">
    <div class="totals-table">
      <div class="trow"><span>Number of Products</span><span>${numProducts}</span></div>
      <div class="trow"><span>Total OK Qty</span><span>${okQty}</span></div>
      <div class="trow"><span>Total Scrap Qty</span><span>${scrapQty}</span></div>
      <div class="trow"><span>Grand Total Qty / Amount</span><span>${grandQty} / ₹${formatCurrency(dispatch.total_amount)}</span></div>
    </div>
  </div>

  ${dispatch.remarks ? `<div class="remarks-box"><strong>Remarks:</strong> ${escapeHtml(dispatch.remarks)}</div>` : ''}

  <div class="terms-box">
    <h4>Terms &amp; Conditions</h4>
    <ol>${termsHtml}</ol>
  </div>

  <div class="sign-area">
    <div class="sign-box">
      <div class="sign-line">Receiver Signature &amp; Date</div>
    </div>
    <div class="sign-box">
      <div class="sign-line">Authorized Signatory — ${escapeHtml(company.companyName)} (Company Stamp)</div>
    </div>
  </div>

</body>
</html>`;
}

let sharedBrowser = null;
async function getBrowser() {
  if (sharedBrowser) return sharedBrowser;
  sharedBrowser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  return sharedBrowser;
}

// Generates the PDF file on disk and returns its path.
async function generatePdfFile(dispatch) {
  const html = buildChallanHtml(dispatch);
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const fileName = `${dispatch.dc_no.replace(/\//g, '-')}.pdf`;
    const filePath = path.join(PDF_DIR, fileName);
    await page.pdf({
      path: filePath,
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    return { filePath, fileName };
  } finally {
    await page.close();
  }
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

module.exports.buildChallanHtml = buildChallanHtml;
module.exports.generatePdfFile = generatePdfFile;
