// ─── Upload Routes ───
const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const path       = require('path');
const auth       = require('../middleware/auth');
const uploadCtrl = require('../controllers/upload.controller');

// ── Multer Configuration ──
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowedExts = ['.xlsx', '.csv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .xlsx and .csv files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// GET /api/upload/template?brand=Bajaj&type=inward (protected)
router.get('/template', auth, uploadCtrl.downloadTemplate);

// POST /api/upload (protected)
router.post('/', auth, upload.single('file'), uploadCtrl.uploadFile);

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds the 10MB limit.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
