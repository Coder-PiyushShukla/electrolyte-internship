// ─── Lot Counter Routes ───
const express      = require('express');
const router       = express.Router();
const auth         = require('../middleware/auth');
const lotCtrl      = require('../controllers/lotCounter.controller');

// All routes require authentication
router.use(auth);

router.get('/:brand/peek',         lotCtrl.peek);
router.post('/:brand/increment',   lotCtrl.increment);

module.exports = router;
