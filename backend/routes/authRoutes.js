const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * @file authRoutes.js
 * @description API router mapping paths for registrations, credentials logins, 
 * forgot password tokens, and final resets to authController triggers.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

// POST /api/auth/signup - Register a new user profile
router.post('/signup', authController.signup);

// POST /api/auth/login - Authenticate credentials and establish session
router.post('/login', authController.login);

// POST /api/auth/forgot-password - Generates copyable password reset token
router.post('/forgot-password', authController.forgotPassword);

// POST /api/auth/reset-password - Verify token and update password
router.post('/reset-password', authController.resetPassword);

module.exports = router;
