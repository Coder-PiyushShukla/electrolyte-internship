// ─── PCB Inventory Tracker — Server Entry Point ───
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');
const fs      = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Ensure uploads directory exists ──
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ── Ensure outward_pdfs directory exists ──
const outwardPdfsDir = path.join(__dirname, '..', 'outward_pdfs');
if (!fs.existsSync(outwardPdfsDir)) {
  fs.mkdirSync(outwardPdfsDir, { recursive: true });
}

// ── Middleware ──
app.use(helmet());

// Dynamic CORS — reads allowed origins from env (comma-separated)
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim().replace(/\/+$/, ''))
  : ['http://localhost:5173', 'http://localhost:3000'];

console.log('🌐 Allowed CORS origins:', allowedOrigins);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ──
app.use('/api/auth',         require('./routes/auth.routes'));
app.use('/api/transactions', require('./routes/transaction.routes'));
app.use('/api/upload',       require('./routes/upload.routes'));
app.use('/api/entries',      require('./routes/entry.routes'));
app.use('/api/lot-counter',  require('./routes/lotCounter.routes'));
app.use('/api/email',        require('./routes/email.routes'));
app.use('/api/inward',       require('./routes/inward.routes'));
app.use('/api/outward',      require('./routes/outward.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Email Config Diagnostic (helps debug Render env vars) ──
app.get('/api/health/email-config', async (req, res) => {
  const mask = (val) => {
    if (!val) return '❌ NOT SET';
    if (val.length <= 8) return val.slice(0, 2) + '***';
    return val.slice(0, 6) + '...' + val.slice(-4) + ` (${val.length} chars)`;
  };

  const config = {
    gmail: {
      GMAIL_CLIENT_ID: mask(process.env.GMAIL_CLIENT_ID),
      GMAIL_CLIENT_SECRET: mask(process.env.GMAIL_CLIENT_SECRET),
      GMAIL_REFRESH_TOKEN: mask(process.env.GMAIL_REFRESH_TOKEN),
      GMAIL_USER: process.env.GMAIL_USER || '❌ NOT SET',
    },
    resend: {
      RESEND_API_KEY: mask(process.env.RESEND_API_KEY),
    },
    smtp: {
      SMTP_HOST: process.env.SMTP_HOST || '❌ NOT SET',
      SMTP_USER: process.env.SMTP_USER || '❌ NOT SET',
    },
  };

  // Quick Gmail token test
  if (process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN) {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GMAIL_CLIENT_ID,
          client_secret: process.env.GMAIL_CLIENT_SECRET,
          refresh_token: process.env.GMAIL_REFRESH_TOKEN,
          grant_type: 'refresh_token',
        }),
      });
      const data = await tokenRes.json();
      config.gmail.tokenTest = data.access_token ? '✅ Token OK' : `❌ ${data.error}: ${data.error_description}`;
    } catch (e) {
      config.gmail.tokenTest = `❌ Error: ${e.message}`;
    }
  } else {
    config.gmail.tokenTest = '⏭️ Skipped (not configured)';
  }

  res.json(config);
});

// ── Global Error Handler ──
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: 'An unexpected error occurred.',
    ...(process.env.NODE_ENV === 'development' && { details: err.message }),
  });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════╗
  ║   PCB Inventory Tracker — API Server       ║
  ║   Running on http://localhost:${PORT}          ║
  ╚════════════════════════════════════════════╝
  `);
});
