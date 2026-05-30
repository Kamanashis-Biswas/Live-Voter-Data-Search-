'use strict';

/**
 * Bengali text post-processor.
 *
 * This module is the FINAL cleanup step after glyph conversion.
 * The heavy lifting (glyph map, pre-matra reorder) is done in:
 *   utils/bengaliUnicodeConverter.js
 *
 * This module handles:
 *   - Stripping any remaining unmapped Latin garbage chars
 *   - Collapsing double spaces
 *   - Fixing common Unicode rendering issues
 *
 * Kept for backward compatibility — older code calls fixBengaliText().
 * Now delegates to bengaliUnicodeConverter.autoConvert().
 */

const { autoConvert, normalizeForSearch } = require('./bengaliUnicodeConverter');

/**
 * Sanitize and normalize a Bengali string for database storage.
 * Works on both already-Unicode text and legacy-font residual chars.
 *
 * @param {string} str - Input Bengali string
 * @returns {string} Clean Unicode Bengali
 */
function fixBengaliText(str) {
  if (!str || typeof str !== 'string') return str || '';
  const { text } = autoConvert(str);
  return text;
}

module.exports = { fixBengaliText, normalizeForSearch };
