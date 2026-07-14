const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const companyCtrl = require('../controllers/company.controller');
const productCtrl = require('../controllers/product.controller');

// All company management endpoints require authentication
router.use(auth);

// Companies
router.get('/', companyCtrl.list);
router.post('/', companyCtrl.create);
router.patch('/:brand', companyCtrl.update);
router.patch('/:brand/deactivate', companyCtrl.deactivate);

// Products for a company
router.get('/:brand/products', productCtrl.getProductsByBrand);
router.post('/:brand/products', productCtrl.addProductsToBrand);

// Direct product management
router.patch('/products/:id', productCtrl.updateProduct);
router.delete('/products/:id', productCtrl.deleteProduct);

module.exports = router;
