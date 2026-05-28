const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', notificationController.getAll);
router.post('/', authorize('owner'), notificationController.create);
router.put('/:id/read', notificationController.markRead);
router.put('/mark-all-read', notificationController.markAllRead);
router.delete('/:id', notificationController.delete);

module.exports = router;
