// ─── Outward Routes ───
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
const outwardCtrl = require('../controllers/outward.controller');
const outwardDocCtrl = require('../controllers/outwardDocument.controller');
const outwardEmailCtrl = require('../controllers/outwardEmail.controller');
const ewayBillCtrl = require('../controllers/ewayBill.controller');

const ewayUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, `eway-${uniqueSuffix}${path.extname(file.originalname)}`);
    },
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' && file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed for E-Way Bill upload.'), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// All routes require authentication
router.use(auth);

// Master data
router.get('/company', outwardCtrl.getCompanyInfo);
router.get('/customers', outwardCtrl.getCustomers);
router.post('/customers', outwardCtrl.createCustomer);
router.get('/products', outwardCtrl.getProducts);

// Auto-generation
router.get('/next-dc', outwardCtrl.peekNextDc);
router.get('/lot', outwardCtrl.peekNextLot);

// Inventory check
router.get('/inventory-check', outwardCtrl.inventoryCheck);

// Dispatches
router.post('/dispatches', outwardCtrl.createDispatch);
router.get('/dispatches', outwardCtrl.getDispatches);
router.get('/dispatches/:id', outwardCtrl.getDispatchById);
router.get('/dispatches/:id/download', outwardDocCtrl.downloadDocument);

// Document + Email
router.post('/preview-document', outwardDocCtrl.previewDocument);
router.post('/generate-document', outwardDocCtrl.generateDocument);
router.post('/send-email', outwardEmailCtrl.sendOutwardEmail);

// E-Way Bill (required when dispatch value exceeds ₹50,000 for interstate transport)
router.get('/dispatches/:id/eway', ewayBillCtrl.getEwayBill);
router.post('/dispatches/:id/eway', ewayBillCtrl.saveEwayBill);
router.post('/dispatches/:id/eway/upload', ewayUpload.single('file'), ewayBillCtrl.uploadEwayBillPdf);
router.get('/dispatches/:id/eway/download', ewayBillCtrl.downloadEwayBill);

module.exports = router;
