const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const notificationController = require('../controllers/notificationController');

router.use(authenticate);

router.get('/', notificationController.getNotifications);
router.put('/:id/read', notificationController.markAsRead);
router.put('/read-all', notificationController.markAllAsRead);

module.exports = router;
