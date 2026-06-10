'use strict';

/**
 * @file authMiddleware.js
 * @description Supabase JWT verification middleware.
 *
 * Extracts Bearer token from Authorization header, verifies it against
 * Supabase, and attaches the authenticated user to req.user.
 *
 * Optional — routes work without auth when Supabase is not configured.
 * Use as route middleware: router.post('/admin/action', authMiddleware, handler)
 *
 * @version 7.0.0
 */

const { supabase } = require('../config/supabaseClient');
const logger = require('../utils/logger');

/**
 * Require authentication middleware.
 * Verifies Supabase JWT and attaches user to request.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next callback
 */
async function requireAuth(req, res, next) {
  // Skip auth if Supabase is not configured (local-only mode)
  if (!supabase) {
    logger.debug('Auth skipped: Supabase not configured');
    req.user = null;
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Provide Bearer token in Authorization header.',
    });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      logger.warn(`Auth failed: ${error ? error.message : 'No user found'}`, req.id);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error('Auth middleware error', err, req.id);
    return res.status(500).json({
      success: false,
      message: 'Authentication service error.',
    });
  }
}

/**
 * Optional authentication middleware.
 * If a valid token is provided, attaches user. Otherwise continues without auth.
 *
 * @param {object} req - Express request
 * @param {object} res - Express response
 * @param {function} next - Express next callback
 */
async function optionalAuth(req, res, next) {
  req.user = null;

  if (!supabase) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

  const token = authHeader.substring(7);
  try {
    const { data: { user } } = await supabase.auth.getUser(token);
    if (user) req.user = user;
  } catch {
    // Silently continue without auth
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
};
