// ─── Transaction Routes ───
const express        = require('express');
const router         = express.Router();
const auth           = require('../middleware/auth');
const transactionCtrl = require('../controllers/transaction.controller');

// All routes require authentication
router.use(auth);

router.get('/',        transactionCtrl.getAll);
router.get('/summary', transactionCtrl.getSummary);
router.post('/',       transactionCtrl.create);
router.delete('/:id',  transactionCtrl.remove);

module.exports = router;
