const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate, verifyToken } = require('../middleware/auth');

// Profile setup after Supabase signup (JWT only — no app user row required yet)
router.post('/setup-profile', verifyToken, authController.setupProfile);

// App profile management (requires existing public.users row)
router.get('/profile', authenticate, authController.getProfile);
router.put('/profile', authenticate, authController.updateProfile);

module.exports = router;
