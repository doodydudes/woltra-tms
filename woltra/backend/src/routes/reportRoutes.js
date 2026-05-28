const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);
router.use(authorize('owner'));

router.get('/deliveries', reportController.getDeliveryReport);
router.get('/drivers', reportController.getDriverReport);
router.get('/bo', reportController.getBOReport);
router.get('/returns', reportController.getReturnReport);
router.get('/export/csv', reportController.exportCSV);

module.exports = router;
