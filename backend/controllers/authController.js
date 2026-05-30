const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const crypto = require('crypto');

/**
 * @file authController.js
 * @description Authentication controller managing registrations, logins, 
 * and custom OTP password resets via Supabase Auth services.
 * 
 * SECURITY DESIGN & TOKEN BYPASS LOGIC:
 *   - Custom Forgot Password: A standard SMTP setup is often missing or blocked in local environments.
 *     Instead of sending a password reset email via SMTP, our custom `forgotPassword` endpoint
 *     verifies user presence in Supabase, generates a random 6-digit numeric token, saves it
 *     in-memory (`localAuthStore`), and returns it directly in the HTTP response.
 *   - The user copies this token and calls `resetPassword`, which consumes the token and updates the
 *     password via the administrative `supabaseAdmin.auth.admin.updateUserById` API.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

// In-memory token store mapping emails to verification tokens and user IDs
const localAuthStore = {
  tokens: {}
};

/**
 * Registers a new user inside Supabase Auth database.
 * 
 * @param {object} req - Express request holding email and password in body.
 * @param {object} res - Express response.
 * @param {function} next - Express next middleware callback.
 */
exports.signup = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Call Supabase SignUp API
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(201).json({
      success: true,
      message: 'Signup successful! Please verify your email if required by Supabase.',
      user: data.user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Authenticates user credentials returning a valid Supabase JWT session token.
 * 
 * @param {object} req - Express request.
 * @param {object} res - Express response.
 * @param {function} next - Express next middleware.
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    // Call Supabase SignIn API
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ success: false, message: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      session: data.session,
      user: data.user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates an administrative 6-digit password-reset token and returns it directly
 * inside the API response (bypasses standard email transport triggers).
 * 
 * @param {object} req - Express request holding the target email.
 * @param {object} res - Express response containing the raw token.
 * @param {function} next - Express next callback.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server is missing Service Role Key to verify user.' });
    }

    // Retrieve full user directory from Supabase using administrative elevated privileges
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return res.status(500).json({ success: false, message: 'Failed to query users.' });
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'এই ইমেইল দিয়ে কোনো ইউজার পাওয়া যায়নি!' });
    }

    // Generate a secure random 6-digit token and cache the association
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    localAuthStore.tokens[email] = { token, userId: targetUser.id };

    // Return the generated reset token directly to support copy actions
    res.status(200).json({
      success: true,
      message: 'Token generated successfully.',
      token: token
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verifies custom OTP reset tokens and overwrites user password via Administrative API.
 * 
 * @param {object} req - Express request holding email, token, and newPassword.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and new password are required' });
    }

    const record = localAuthStore.tokens[email];

    // Verify token validity
    if (!record || record.token !== token) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server is missing Service Role Key to update password.' });
    }

    // Overwrite the password directly in Supabase using the Admin API
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      record.userId,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({ success: false, message: updateError.message });
    }

    // Consume the token after successful password reset
    delete localAuthStore.tokens[email];

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (err) {
    next(err);
  }
};
