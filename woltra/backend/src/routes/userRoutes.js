const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');

router.use(authenticate);

router.get('/', authorize('owner'), userController.getAll);
router.get('/:id', authorize('owner'), userController.getById);
router.post('/', authorize('owner'), userController.create);
router.put('/:id', authorize('owner'), userController.update);
router.delete('/:id', authorize('owner'), userController.delete);
router.put('/:id/reset-password', authorize('owner'), userController.resetPassword);

module.exports = router;
