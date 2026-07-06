// ─── Gmail API Utility ───
// Sends emails via Google's Gmail REST API (HTTPS - no SMTP ports needed).
// Works on Render free tier, and can send to ANY recipient.
//
// Required env vars:
//   GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER
//
// Setup instructions:
//   1. Go to https://console.cloud.google.com → Create a project
//   2. Enable "Gmail API"
//   3. Create OAuth 2.0 credentials (Desktop app type)
//   4. Use OAuth 2.0 Playground (https://developers.google.com/oauthplayground)
//      to get a refresh token with scope: https://www.googleapis.com/auth/gmail.send
//   5. Set the env vars in your .env / Render dashboard

const fs = require('fs');

let cachedToken = null;
let tokenExpiresAt = 0;

// ── Get a fresh access token using the refresh token ──
async function getAccessToken() {
  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID?.trim();
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET?.trim();
  const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN?.trim();
  
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) return null;

  // Reuse cached token if it hasn't expired (with 60s buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GMAIL_CLIENT_ID,
      client_secret: GMAIL_CLIENT_SECRET,
      refresh_token: GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gmail OAuth2 token error: ${err.error_description || response.statusText}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

// ── Build an RFC 2822 MIME email message ──
function buildRawEmail({ from, to, subject, html, text, attachments }) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const altBoundary = `alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const headers = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
  ];

  const hasAttachments = attachments && attachments.length > 0;

  if (hasAttachments) {
    headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);

    let body = '';

    // ── HTML + Text alternative part ──
    body += `--${boundary}\r\n`;
    body += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;

    if (text) {
      body += `--${altBoundary}\r\n`;
      body += 'Content-Type: text/plain; charset="UTF-8"\r\n';
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += Buffer.from(text).toString('base64') + '\r\n\r\n';
    }
    if (html) {
      body += `--${altBoundary}\r\n`;
      body += 'Content-Type: text/html; charset="UTF-8"\r\n';
      body += 'Content-Transfer-Encoding: base64\r\n\r\n';
      body += Buffer.from(html).toString('base64') + '\r\n\r\n';
    }
    body += `--${altBoundary}--\r\n\r\n`;

    // ── Attachments ──
    for (const att of attachments) {
      if (att.path && fs.existsSync(att.path)) {
        const fileBuffer = fs.readFileSync(att.path);
        const mimeType = att.filename.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream';
        body += `--${boundary}\r\n`;
        body += `Content-Type: ${mimeType}; name="${att.filename}"\r\n`;
        body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`;
        body += 'Content-Transfer-Encoding: base64\r\n\r\n';
        body += fileBuffer.toString('base64') + '\r\n\r\n';
      }
    }
    body += `--${boundary}--`;

    return headers.join('\r\n') + '\r\n\r\n' + body;
  }

  // ── No attachments - simple multipart/alternative ──
  headers.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);

  let body = '';
  if (text) {
    body += `--${altBoundary}\r\n`;
    body += 'Content-Type: text/plain; charset="UTF-8"\r\n';
    body += 'Content-Transfer-Encoding: base64\r\n\r\n';
    body += Buffer.from(text).toString('base64') + '\r\n\r\n';
  }
  if (html) {
    body += `--${altBoundary}\r\n`;
    body += 'Content-Type: text/html; charset="UTF-8"\r\n';
    body += 'Content-Transfer-Encoding: base64\r\n\r\n';
    body += Buffer.from(html).toString('base64') + '\r\n\r\n';
  }
  body += `--${altBoundary}--`;

  return headers.join('\r\n') + '\r\n\r\n' + body;
}

// ── Send email via Gmail REST API ──
async function sendViaGmailApi({ from, to, subject, html, text, attachments }) {
  const accessToken = await getAccessToken();
  if (!accessToken) return null; // Not configured

  const senderAddress = from || process.env.GMAIL_USER;
  const rawMessage = buildRawEmail({
    from: senderAddress,
    to,
    subject,
    html,
    text,
    attachments,
  });

  // Base64url encode the raw MIME message
  const encoded = Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encoded }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      `Gmail API error (${response.status}): ${err.error?.message || response.statusText}`
    );
  }

  return await response.json();
}

// ── Check if Gmail API is configured ──
function isGmailApiConfigured() {
  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID?.trim();
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET?.trim();
  const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN?.trim();
  return !!(GMAIL_CLIENT_ID && GMAIL_CLIENT_SECRET && GMAIL_REFRESH_TOKEN);
}

module.exports = { sendViaGmailApi, isGmailApiConfigured };
