// ─── Outward Routes ───
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const outwardCtrl = require('../controllers/outward.controller');
const outwardDocCtrl = require('../controllers/outwardDocument.controller');
const outwardEmailCtrl = require('../controllers/outwardEmail.controller');

// All routes require authentication
router.use(auth);

// Master data
router.get('/company', outwardCtrl.getCompanyInfo);
router.get('/customers', outwardCtrl.getCustomers);
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
router.post('/generate-document', outwardDocCtrl.generateDocument);
router.post('/send-email', outwardEmailCtrl.sendOutwardEmail);

module.exports = router;
