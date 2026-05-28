const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);

router.post('/claim', vehicleController.claim);
router.get('/', vehicleController.getAll);
router.get('/:id', vehicleController.getById);
router.post('/', authorize('owner'), vehicleController.create);
router.put('/:id', authorize('owner'), vehicleController.update);
router.delete('/:id', authorize('owner'), vehicleController.delete);
router.post('/:id/maintenance', authorize('owner'), vehicleController.addMaintenance);

module.exports = router;
