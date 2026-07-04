// ─── Auth Routes ───
const express    = require('express');
const router     = express.Router();
const authCtrl   = require('../controllers/auth.controller');
const auth       = require('../middleware/auth');

// Public routes
router.post('/register',        authCtrl.register);
router.post('/login',           authCtrl.login);
router.post('/forgot-password', authCtrl.forgotPassword);

// Admin routes (require auth + admin role check in controller)
router.get('/users',            auth, authCtrl.listUsers);
router.patch('/approve/:id',    auth, authCtrl.approveUser);
router.delete('/users/:id',     auth, authCtrl.rejectUser);

module.exports = router;
