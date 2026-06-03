// ─── Entry Routes ───
const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const entryCtrl = require('../controllers/entry.controller');

// All routes require authentication
router.use(auth);

router.get('/',           entryCtrl.getAll);
router.get('/part-codes', entryCtrl.getPartCodes);
router.post('/',          entryCtrl.create);
router.delete('/:id',     entryCtrl.remove);

module.exports = router;
