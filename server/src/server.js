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

// ── Health Check ──
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
