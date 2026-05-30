const supabase = require('../config/supabaseClient');

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
 * Send forgot password email with OTP/token
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    // This sends an email containing the OTP if Supabase is configured for it
    const { error } = await supabase.auth.resetPasswordForEmail(email);

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to email.'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Verify OTP/token and reset password
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, token, newPassword } = req.body;
    
    if (!email || !token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, token, and new password are required' });
    }

    // Verify OTP first
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'recovery'
    });

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    // Now update the user's password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      return res.status(400).json({ success: false, message: updateError.message });
    }

    res.status(200).json({
      success: true,
      message: 'Password has been reset successfully.'
    });
  } catch (err) {
    next(err);
  }
};
