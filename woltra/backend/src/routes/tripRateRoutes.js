const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tripRateController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', ctrl.getAll);
router.post('/', authorize('owner'), ctrl.upsert);
router.delete('/:id', authorize('owner'), ctrl.delete);
router.post('/approve/:id', authorize('owner'), ctrl.approve);
router.get('/payroll', authorize('owner'), ctrl.getPayroll);
router.get('/pending-approvals', authorize('owner'), ctrl.getPendingApprovals);
router.get('/driver-trips', authorize('owner'), ctrl.getDriverTrips);
router.get('/my-earnings', ctrl.getMyEarnings);

module.exports = router;
