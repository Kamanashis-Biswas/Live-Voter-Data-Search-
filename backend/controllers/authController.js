const { supabase, supabaseAdmin } = require('../config/supabaseClient');
const crypto = require('crypto');

// In-memory store for reset tokens (since we bypass email OTP)
// maps email -> { token, userId }
const localAuthStore = {
  tokens: {}
};

/**
 * Sign up a new user using Supabase Auth
 */
exports.signup = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

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
 * Log in an existing user
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

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
 * Custom Forgot Password (No Email Required)
 * Generates a token and returns it directly in the response.
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server is missing Service Role Key to verify user.' });
    }

    // Verify if the user exists in Supabase
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      return res.status(500).json({ success: false, message: 'Failed to query users.' });
    }

    const targetUser = users.find(u => u.email === email);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'এই ইমেইল দিয়ে কোনো ইউজার পাওয়া যায়নি!' });
    }

    // Generate a 6-digit random token
    const token = Math.floor(100000 + Math.random() * 900000).toString();
    localAuthStore.tokens[email] = { token, userId: targetUser.id };

    // Send it directly back to the frontend (as requested)
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
 * Verify custom token and reset password locally
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and new password are required' });
    }

    const record = localAuthStore.tokens[email];

    if (!record || record.token !== token) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token.' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ success: false, message: 'Server is missing Service Role Key to update password.' });
    }

    // Update password actually in Supabase using Admin API
    const { data, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      record.userId,
      { password: newPassword }
    );

    if (updateError) {
      return res.status(400).json({ success: false, message: updateError.message });
    }

    // Consume the token
    delete localAuthStore.tokens[email];

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (err) {
    next(err);
  }
};
