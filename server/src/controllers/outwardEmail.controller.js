// ─── Outward Email Controller ───
// Sends outward delivery challan email with PDF attachment.
// Supports three providers (tried in order):
//   1. Gmail API (HTTPS)  - works everywhere, sends to anyone (set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)
//   2. Resend (HTTP API)  - works on Render free tier (set RESEND_API_KEY)
//   3. Nodemailer SMTP    - works locally (set SMTP_HOST, SMTP_USER, SMTP_PASS)
const fs = require('fs');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { getCompany } = require('../config/companyData');
const { generatePdfFile } = require('./outwardDocument.controller');
const { sendViaGmailApi, isGmailApiConfigured } = require('../utils/gmailApi');
const { createNotification, TYPES } = require('../services/notificationService');

// Record a "challan emailed" notification (best-effort; never blocks the response).
async function notifyChallanSent({ actor, to, dispatch, provider }) {
  await createNotification({
    type: TYPES.EMAIL_CHALLAN_SENT,
    title: 'Delivery challan emailed',
    message: `${actor || 'A user'} sent the outward delivery challan ${dispatch.dc_no} to ${to} (via ${provider}).`,
    actor,
    recipient: to,
    audience: 'all',
    metadata: { dispatchId: dispatch.id, dcNo: dispatch.dc_no, customer: dispatch.company_name, provider },
  });
}

let cachedTransporter = null;

// ── Resend HTTP API sender (supports attachments) ──
async function sendViaResend({ to, from, subject, html, attachments }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null; // Not configured

  // Build attachments array for Resend API
  const resendAttachments = [];
  if (attachments && attachments.length > 0) {
    for (const att of attachments) {
      if (att.path && fs.existsSync(att.path)) {
        const fileBuffer = fs.readFileSync(att.path);
        resendAttachments.push({
          filename: att.filename,
          content: fileBuffer.toString('base64'),
        });
      }
    }
  }

  const body = {
    from: from || 'PCB Tracker <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (resendAttachments.length > 0) {
    body.attachments = resendAttachments;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`Resend API error (${response.status}): ${errorData.message || response.statusText}`);
  }

  return await response.json();
}

// ── SMTP transporter (for local dev) ──
function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10) || 587,
    secure: (parseInt(SMTP_PORT, 10) || 587) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    tls: {
      rejectUnauthorized: false,
    },
  });
  return cachedTransporter;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildSummaryHtml(dispatch) {
  const company = getCompany();
  const items = dispatch.items || [];
  const rowsHtml = items.map((item) => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;font-family:monospace;">${escapeHtml(item.item_code)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;">${escapeHtml(item.description)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:center;">${escapeHtml(item.status)}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${item.quantity}</td>
      <td style="padding:6px 10px;border:1px solid #e2e8f0;text-align:right;">${parseFloat(item.amount).toFixed(2)}</td>
    </tr>`).join('');

  return `
  <div style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;max-width:700px;">
    <h2 style="margin:0 0 4px;color:#1e3a8a;">${escapeHtml(company.companyName)}</h2>
    <p style="margin:0 0 16px;color:#475569;font-size:13px;">Outward PCB Delivery Challan Summary</p>
    <p style="font-size:13px;">
      <strong>Challan No:</strong> ${escapeHtml(dispatch.dc_no)} &nbsp;
      <strong>Lot No:</strong> ${escapeHtml(dispatch.lot_no)} &nbsp;
      <strong>Date:</strong> ${escapeHtml(dispatch.challan_date)} &nbsp;
      <strong>Customer:</strong> ${escapeHtml(dispatch.company_name)}
    </p>
    <table style="border-collapse:collapse;width:100%;font-size:12.5px;margin:10px 0;">
      <thead>
        <tr style="background:#1e3a8a;color:white;">
          <th style="padding:6px 10px;border:1px solid #1e3a8a;text-align:left;">Item Code</th>
          <th style="padding:6px 10px;border:1px solid #1e3a8a;text-align:left;">Description</th>
          <th style="padding:6px 10px;border:1px solid #1e3a8a;text-align:center;">Status</th>
          <th style="padding:6px 10px;border:1px solid #1e3a8a;text-align:right;">Qty</th>
          <th style="padding:6px 10px;border:1px solid #1e3a8a;text-align:right;">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <p style="font-size:13px;"><strong>Total Qty:</strong> ${dispatch.total_qty} &nbsp; <strong>Total Amount:</strong> ₹${parseFloat(dispatch.total_amount).toFixed(2)}</p>
    <p style="margin-top:18px;color:#64748b;font-size:12px;">The full delivery challan PDF is attached to this email.</p>
    <p style="margin:18px 0 0;color:#94a3b8;font-size:12px;">Generated by PCB Tracker - Electrolyte Inventory</p>
  </div>`;
}

// POST /api/outward/send-email  { dispatchId, to, recipients }
exports.sendOutwardEmail = async (req, res) => {
  try {
    const { dispatchId, to, recipients } = req.body;
    if (!dispatchId) return res.status(400).json({ error: 'dispatchId is required.' });

    const normalizedRecipients = (Array.isArray(recipients) ? recipients : (to ? [{ email: to, sendEway: false }] : []))
      .map((entry) => (typeof entry === 'string' ? { email: entry.trim(), sendEway: false } : { email: String(entry?.email || '').trim(), sendEway: Boolean(entry?.sendEway) }))
      .filter((entry) => entry.email);

    if (normalizedRecipients.length === 0) return res.status(400).json({ error: 'Recipient email address is required.' });

    const dispatchResult = await db.query('SELECT * FROM outward_dispatches WHERE id = $1', [dispatchId]);
    if (dispatchResult.rows.length === 0) return res.status(404).json({ error: 'Dispatch not found.' });
    const itemsResult = await db.query('SELECT * FROM outward_dispatch_items WHERE dispatch_id = $1 ORDER BY id', [dispatchId]);
    const ewayResult = await db.query('SELECT * FROM outward_eway_bills WHERE dispatch_id = $1', [dispatchId]);
    const eway = ewayResult.rows[0] || null;
    const dispatch = { ...dispatchResult.rows[0], items: itemsResult.rows, eway };

    if (dispatch.eway_required && (!eway?.eway_bill_no || !eway?.eway_bill_date || !eway?.eway_pdf_path || !fs.existsSync(eway.eway_pdf_path))) {
      return res.status(400).json({
        error: 'Dispatch Status: E-WAY BILL PENDING. Upload the E-Way Bill PDF and save the E-Way Bill number before sending.',
      });
    }

    // Ensure the PDF exists (generate on the fly if needed)
    let pdfPath = dispatch.pdf_path;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      const generated = await generatePdfFile(dispatch);
      pdfPath = generated.filePath;
      await db.query('UPDATE outward_dispatches SET pdf_path = $1 WHERE id = $2', [pdfPath, dispatchId]);
    }

    const actor = req.user?.username;
    const html = buildSummaryHtml(dispatch);
    const pdfFilename = `${dispatch.dc_no.replace(/\//g, '-')}.pdf`;
    const subject = `Outward PCB Delivery Challan - ${dispatch.dc_no}`;
    const fromAddress = process.env.GMAIL_USER || process.env.RESEND_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

    for (const recipientEntry of normalizedRecipients) {
      const recipient = recipientEntry.email.trim();
      const attachments = [{ filename: pdfFilename, path: pdfPath }];
      if (recipientEntry.sendEway && eway?.eway_pdf_path && fs.existsSync(eway.eway_pdf_path)) {
        attachments.push({
          filename: eway.eway_pdf_original_name || `EWAY-${dispatch.dc_no.replace(/\//g, '-')}.pdf`,
          path: eway.eway_pdf_path,
        });
      }

      const provider = await (async () => {
        if (isGmailApiConfigured()) {
          try {
            console.log('📧 Sending outward email via Gmail API...');
            await sendViaGmailApi({
              from: process.env.GMAIL_USER,
              to: recipient,
              subject,
              html,
              attachments,
            });
            return 'Gmail API';
          } catch (gmailErr) {
            console.warn('⚠️ Gmail API failed, falling back to next provider:', gmailErr.message);
          }
        }

        if (process.env.RESEND_API_KEY) {
          try {
            console.log('📧 Sending outward email via Resend API...');
            const resendFrom = process.env.RESEND_FROM || 'PCB Tracker <onboarding@resend.dev>';
            await sendViaResend({
              to: recipient,
              from: resendFrom,
              subject,
              html,
              attachments,
            });
            return 'Resend';
          } catch (resendErr) {
            console.warn('⚠️ Resend API failed, falling back to SMTP:', resendErr.message);
          }
        }

        const transporter = getTransporter();
        if (!transporter) {
          throw new Error('Email sending is not configured. Set GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN (recommended), or RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS.');
        }

        console.log('📧 Sending outward email via SMTP...');
        await transporter.sendMail({
          from: fromAddress,
          to: recipient,
          subject,
          html,
          attachments,
        });
        return 'SMTP';
      })();

      await notifyChallanSent({ actor, to: recipient, dispatch, provider });
    }

    res.json({ message: `Email successfully sent to ${normalizedRecipients.length} recipient(s).` });
  } catch (err) {
    console.error('Send outward email error:', err);
    const { dispatchId, to } = req.body || {};
    await createNotification({
      type: TYPES.EMAIL_FAILED,
      title: 'Challan email failed',
      message: `${req.user?.username || 'A user'} tried to email the outward challan (dispatch #${dispatchId || '?'}) to ${to || '?'} but it failed: ${err.message}`,
      actor: req.user?.username,
      recipient: to,
      audience: 'admin',
      metadata: { dispatchId, error: err.message },
    });
    res.status(500).json({ error: `Failed to send email: ${err.message}` });
  }
};
