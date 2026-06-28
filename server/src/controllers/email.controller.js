// ─── Email Controller ───
// Sends the PCB Verification Report as a real email via SMTP (nodemailer),
// instead of relying on the browser's mailto: handler (which fails silently
// on desktops without a configured default mail client).
const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  // ── SMTP credentials come from environment variables ──
  // Set these on Render (and in server/.env for local dev):
  //   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (optional)
  // For Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=465,
  //            SMTP_USER=youraddress@gmail.com, SMTP_PASS=<16-char App Password>
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return null; // Not configured yet
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10) || 465,
    secure: (parseInt(SMTP_PORT, 10) || 465) === 465, // true for 465, false for 587
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  return cachedTransporter;
}

// Escape a value for safe insertion into HTML
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Build a proper HTML table report (fixes jagged plain-text alignment) ──
function buildHtmlReport({ brand, challanNo, challanDate, lotNo, rows }) {
  let totalChallan = 0;
  let totalPhysical = 0;

  const rowsHtml = rows.map((row) => {
    const c = parseInt(row.challanQty, 10) || 0;
    const p = parseInt(row.physicalQty, 10) || 0;
    totalChallan += c;
    totalPhysical += p;
    const diff = (parseInt(row.physicalQty, 10) || 0) - (parseInt(row.challanQty, 10) || 0);
    const hasDiff = row.challanQty !== '' && row.physicalQty !== '' && !isNaN(diff);
    const diffStr = hasDiff ? (diff > 0 ? `+${diff}` : String(diff)) : '-';
    const remark = !hasDiff ? '' : diff === 0 ? 'OK' : diff > 0 ? 'Excess' : 'Short';
    const remarkColor = remark === 'OK' ? '#059669' : remark === 'Excess' ? '#d97706' : remark === 'Short' ? '#dc2626' : '#475569';
    const remarkBg = remark === 'OK' ? '#d1fae5' : remark === 'Excess' ? '#fef3c7' : remark === 'Short' ? '#fee2e2' : '#f1f5f9';

    return `
      <tr>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(row.itemCode)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;">${escapeHtml(row.description)}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${c}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${p}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${diffStr}</td>
        <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;">
          <span style="background:${remarkBg};color:${remarkColor};padding:2px 8px;border-radius:6px;font-size:12px;font-weight:600;">${remark}</span>
        </td>
      </tr>`;
  }).join('');

  const totalDiff = totalPhysical - totalChallan;
  const totalDiffStr = totalDiff > 0 ? `+${totalDiff}` : String(totalDiff);

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:760px;">
    <h2 style="margin:0 0 4px;">PCB Verification Report</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:14px;">
      <strong>Challan No:</strong> ${escapeHtml(challanNo)} &nbsp;&nbsp;
      <strong>Date:</strong> ${escapeHtml(challanDate)} &nbsp;&nbsp;
      <strong>Brand:</strong> ${escapeHtml(brand)} &nbsp;&nbsp;
      <strong>Lot No:</strong> ${escapeHtml(lotNo)}
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:13px;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;">Item Code</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;">Description</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Challan Qty</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Physical Qty</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">Difference</th>
          <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:center;">Remark</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr style="background:#f8fafc;font-weight:700;">
          <td colspan="2" style="padding:8px 10px;border:1px solid #e2e8f0;">TOTAL</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${totalChallan}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${totalPhysical}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;text-align:right;">${totalDiffStr}</td>
          <td style="padding:8px 10px;border:1px solid #e2e8f0;"></td>
        </tr>
      </tbody>
    </table>
    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">Generated by PCB Tracker — Electrolyte Inventory</p>
  </div>`;
}

// Build a plain-text fallback (for mail clients that don't render HTML)
function buildPlainTextReport({ brand, challanNo, challanDate, lotNo, rows }) {
  const lines = [
    'PCB Verification Report',
    `Challan No: ${challanNo}    Date: ${challanDate}    Brand: ${brand}    Lot No: ${lotNo}`,
    '',
  ];
  rows.forEach((row) => {
    const c = parseInt(row.challanQty, 10) || 0;
    const p = parseInt(row.physicalQty, 10) || 0;
    const diff = p - c;
    lines.push(`${row.itemCode} - ${row.description}: Challan ${c}, Physical ${p}, Diff ${diff > 0 ? '+' + diff : diff}`);
  });
  lines.push('', 'Generated by PCB Tracker — Electrolyte Inventory');
  return lines.join('\n');
}

// POST /api/email/send-report
exports.sendReport = async (req, res) => {
  try {
    const { to, brand, challanNo, challanDate, lotNo, rows } = req.body;

    if (!to || !to.trim()) {
      return res.status(400).json({ error: 'Recipient email address is required.' });
    }
    if (!challanNo || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Challan number and at least one item row are required.' });
    }

    const transporter = getTransporter();
    if (!transporter) {
      return res.status(503).json({
        error: 'Email sending is not configured on the server yet. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.',
      });
    }

    const html = buildHtmlReport({ brand, challanNo, challanDate, lotNo, rows });
    const text = buildPlainTextReport({ brand, challanNo, challanDate, lotNo, rows });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to.trim(),
      subject: `PCB Verification Report - ${challanNo}`,
      text,
      html,
    });

    res.json({ message: 'Email successfully sent.' });
  } catch (err) {
    console.error('Send email error:', err);
    res.status(500).json({ error: `Failed to send email: ${err.message}` });
  }
};
