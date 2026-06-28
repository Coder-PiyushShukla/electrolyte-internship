// ─── Email Routes ───
const express   = require('express');
const router    = express.Router();
const auth      = require('../middleware/auth');
const emailCtrl = require('../controllers/email.controller');

// All routes require authentication
router.use(auth);

router.post('/send-report', emailCtrl.sendReport);

module.exports = router;
