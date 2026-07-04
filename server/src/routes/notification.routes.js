// ─── Notification Routes ───
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const notificationCtrl = require('../controllers/notification.controller');

// All routes require authentication
router.use(auth);

router.get('/', notificationCtrl.list);
router.get('/unread-count', notificationCtrl.unreadCount);
router.patch('/:id/read', notificationCtrl.markRead);
router.post('/mark-all-read', notificationCtrl.markAllRead);
router.delete('/:id', notificationCtrl.remove);

module.exports = router;
