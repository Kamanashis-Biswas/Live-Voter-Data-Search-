const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// POST /api/auth/signup - Register a new user
router.post('/signup', authController.signup);

// POST /api/auth/login - Authenticate a user
router.post('/login', authController.login);

// POST /api/auth/forgot-password - Send password reset email
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password - Verify token and update password
router.post('/reset-password', authController.resetPassword);

module.exports = router;
