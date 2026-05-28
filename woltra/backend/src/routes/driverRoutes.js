const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', driverController.getAll);
router.get('/lookup', driverController.lookupByCode);
router.get('/:id', driverController.getById);
router.post('/', authorize('owner'), driverController.create);
router.put('/:id', authorize('owner'), driverController.update);
router.delete('/:id', authorize('owner'), driverController.delete);
router.post('/:id/checkin', driverController.checkIn);
router.post('/:id/checkout', driverController.checkOut);

module.exports = router;
