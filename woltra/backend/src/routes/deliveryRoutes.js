const express = require('express');
const router = express.Router();
const deliveryController = require('../controllers/deliveryController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.get('/', deliveryController.getAll);
router.get('/:id', deliveryController.getById);
router.post('/', authorize('owner', 'driver'), deliveryController.create);
router.put('/:id', authorize('owner', 'driver'), deliveryController.update);
router.delete('/:id', authorize('owner'), deliveryController.delete);
router.post('/:id/proof', upload.fields([
  { name: 'photo', maxCount: 1 },
  { name: 'signature', maxCount: 1 }
]), deliveryController.uploadProof);

router.post('/:id/phase', authorize('driver'), upload.fields([
  { name: 'loading_photo', maxCount: 1 },
  { name: 'unloading_photo', maxCount: 1 },
  { name: 'document_photos', maxCount: 10 }
]), deliveryController.advancePhase);

module.exports = router;
