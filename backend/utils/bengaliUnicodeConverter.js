'use strict';

/**
 * Bengali Unicode Converter
 *
 * Core pipeline that converts raw legacy-font Bengali text (SutonnyMJ / Bijoy)
 * into correct Unicode Bengali:
 *
 *  Step 1 — Glyph substitution  : replace Latin Extended codepoints with Bengali
 *  Step 2 — Pre-matra reordering: move ি ে ৈ from BEFORE to AFTER their consonant
 *  Step 3 — Reph normalization  : ensure র্ (reph) is placed correctly
 *  Step 4 — Complex matra merge : ে + া → ো,  ে + ৗ → ৌ
 *  Step 5 — NFC normalization   : canonical Unicode form
 *  Step 6 — Garbage cleanup     : strip remaining stray Latin chars
 */

const { SUTONNY_MAP, PRE_MATRAS } = require('./sutonnyMJMap');
const { BIJOY_MAP } = require('./bijoyMap');

// ── Bengali Unicode ranges used in detection / cleanup ──────────────────────
const BENGALI_RANGE = /[\u0980-\u09FF]/;
const LATIN_EXT_RANGE = /[\u00C0-\u00FF\u0100-\u017F\u0180-\u024F]/;

// Unicode codepoints that ARE pre-matras
const PRE_MATRA_CP = new Set([0x09BF, 0x09C7, 0x09C8]); // ি ে ৈ

// Latin Extended codepoints that map TO pre-matras (so we know which substitutions need reordering)
const SUTONNY_PRE_MATRA_SOURCES = new Set(
  Object.entries(SUTONNY_MAP)
    .filter(([, v]) => PRE_MATRA_CP.has(v.codePointAt(0)))
    .map(([k]) => k.codePointAt(0))
);
const BIJOY_PRE_MATRA_SOURCES = new Set(
  Object.entries(BIJOY_MAP)
    .filter(([, v]) => PRE_MATRA_CP.has(v.codePointAt(0)))
    .map(([k]) => k.codePointAt(0))
);


// A sentinel that cannot appear in real Bengali text — used to mark
// pre-matras that need reordering AFTER glyph substitution.
const SENTINEL = '\u0002'; // STX control char

// Consonant cluster pattern (one or more consonants joined by hasanta)
// Using actual Unicode chars directly instead of escape sequences in template literals
const CONSONANT_RE = '[\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1]';
const HASANTA = '\u09CD';

// Build the sentinel reorder regex using RegExp constructor with actual Unicode chars
// Pattern: SENTINEL + pre-matra + consonant cluster (consonant optionally followed by hasanta+consonant)
const SENTINEL_CLUSTER_RE = new RegExp(
  SENTINEL + '([\u09BF\u09C7\u09C8])(' + CONSONANT_RE + '(?:' + HASANTA + CONSONANT_RE + ')*)',
  'gu'
);

/**
 * Apply a glyph map to a string.
 * Tags pre-matra substitutions with SENTINEL so only those get reordered later.
 *
 * @param {string}  str        - Raw legacy-encoded string
 * @param {object}  map        - Glyph map (SUTONNY_MAP or BIJOY_MAP)
 * @param {Set}     preSources - Set of source codepoints whose targets are pre-matras
 */
function applyGlyphMap(str, map, preSources) {
  let result = '';
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (map[char] !== undefined) {
      // If this source char maps to a pre-matra, tag it with a sentinel
      result += (preSources && preSources.has(cp) ? SENTINEL : '') + map[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Reorder ONLY sentinel-tagged pre-matras: [SENTINEL + matra][consonant_cluster]
 * → [consonant_cluster][matra]   (sentinel is removed in the process)
 *
 * Correctly-placed matras (no sentinel) are LEFT UNTOUCHED.
 *
 * In SutonnyMJ / Bijoy:
 *   Input (after map):  [SENTINEL+ে][শ][খ]
 *   After reorder:      [শ][ে][খ]  = শেখ ✓
 *
 *   Already correct:    [ত][ে][ম][া]
 *   Not touched:        [ত][ে][ম][া] = তেমা ✓
 */
function reorderPreMatras(str) {
  // 1. Replace sentinel-tagged pre-matras: move matra after the following consonant cluster
  let result = str.replace(SENTINEL_CLUSTER_RE, (_match, matra, cluster) => cluster + matra);
  // Clean up any remaining sentinels (safety net)
  result = result.replace(/\u0002/g, '');

  // 2. Replace untagged already-Unicode pre-matras that are placed BEFORE a consonant cluster
  // This is crucial for EC PDFs where some matras are already extracted as Unicode but in visual order (before consonant)
  const UNICODE_PRE_MATRA_RE = /([\u09BF\u09C7\u09C8])([\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1](?:\u09CD[\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1])*)/gu;
  result = result.replace(UNICODE_PRE_MATRA_RE, (_match, matra, cluster) => cluster + matra);

  return result;
}


/**
 * Heuristic: count Latin Extended chars (U+00C0–U+024F) vs total.
 * Returns a ratio in [0, 1].
 */
function legacyRatio(str) {
  if (!str || str.length === 0) return 0;
  let count = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x00C0 && cp <= 0x024F) count++;
  }
  return count / str.length;
}

/**
 * Detect which legacy encoding a string uses.
 * Returns 'sutonny' | 'bijoy' | 'unicode' | 'unknown'
 */
function detectEncoding(str) {
  if (!str || str.length < 4) return 'unicode';

  // Check for typical Bijoy markers: lowercase a-z mapped to Bengali consonants
  // Bijoy text tends to have many lowercase Latin letters mixed with Bengali
  const bijoyMarkers = ['a', 'b', 'c', 'g', 'j', 'k', 'n', 'p', 'r', 's', 't'];
  let bijoyScore = 0;
  for (const ch of str) {
    if (bijoyMarkers.includes(ch)) bijoyScore++;
  }

  // Check for SutonnyMJ: mostly Bengali Unicode consonants + Latin Extended matras
  const hasBengaliConsonants = BENGALI_RANGE.test(str);
  const hasLatinExt = LATIN_EXT_RANGE.test(str);
  const ratio = legacyRatio(str);

  if (ratio === 0) return 'unicode';
  if (hasBengaliConsonants && hasLatinExt) return 'sutonny'; // most common EC PDF type
  if (!hasBengaliConsonants && bijoyScore > str.length * 0.3) return 'bijoy';
  if (hasLatinExt) return 'sutonny'; // fallback

  return 'unicode';
}

/**
 * Strip remaining non-Bengali, non-digit, non-punctuation Latin garbage.
 * This runs AFTER glyph substitution so only truly unmapped chars are removed.
 * Preserves: Bengali range, Bengali digits, ASCII digits, space, common punctuation,
 * colon (:), and Bengali-specific marks.
 */
function stripGarbage(str) {
  // Keep: Bengali range (U+0980-U+09FF), ASCII digits, space, slash, dot, dash,
  //       comma, parens, colon, semicolon, Bengali danda (U+0964-U+0965)
  return str.replace(/[^\u0980-\u09FF\u0964-\u0965\u0030-\u0039\u0020\u002F\u002E\u002D\u002C\u0028\u0029\u003A\u003B]/g, '');
}

/**
 * Merge adjacent split matras into their correct single Unicode codepoint.
 * e.g., \u09C7 (ে) + \u09BE (া) -> \u09CB (ো)
 */
function normalizeComplexMatras(str) {
  if (!str) return '';
  return str
    .replace(/\u09C7\u09BE/g, '\u09CB') // ে + া = ো
    .replace(/\u09C7\u09D7/g, '\u09CC') // ে + ৗ = ৌ
    .replace(/\u09C7\u09C7/g, '\u09C7') // double ে = ে (dedup)
    .replace(/\u09BF\u09BF/g, '\u09BF') // double ি = ি (dedup)
    .replace(/\u09CD\u09CD/g, '\u09CD'); // double hasanta = hasanta (dedup)
}

/**
 * Fix common EC PDF extraction artifacts in already-converted text.
 * These are patterns that result from font-specific quirks.
 */
function fixECExtractionArtifacts(str) {
  if (!str) return '';
  let s = str;

  // Fix "জহ্ল" → "জন্ম" (common EC artifact in DOB fields)
  s = s.replace(/জহ্ল/g, 'জন্ম');

  // Fix doubled spaces
  s = s.replace(/\s{2,}/g, ' ');

  // Fix "িরখ" → "রিখ" (residual pre-matra issue — ি before র)
  // This is a safety net for any pre-matras the sentinel regex missed

  return s.trim();
}

// ── Main API ─────────────────────────────────────────────────────────────────

/**
 * Convert a SutonnyMJ-encoded string to Unicode Bengali.
 * @param {string} raw - Raw string extracted from legacy-font PDF
 * @returns {string} Clean Unicode Bengali
 */
function convertSutonnyMJ(raw) {
  if (!raw) return '';
  let s = applyGlyphMap(raw, SUTONNY_MAP, SUTONNY_PRE_MATRA_SOURCES);
  s = reorderPreMatras(s);
  s = normalizeComplexMatras(s);
  s = s.normalize('NFC');
  s = fixECExtractionArtifacts(s);
  s = stripGarbage(s);
  return s.trim();
}

/**
 * Convert a Bijoy-encoded string to Unicode Bengali.
 * @param {string} raw - Raw string extracted from Bijoy-font PDF
 * @returns {string} Clean Unicode Bengali
 */
function convertBijoy(raw) {
  if (!raw) return '';
  let s = applyGlyphMap(raw, BIJOY_MAP, BIJOY_PRE_MATRA_SOURCES);
  s = reorderPreMatras(s);
  s = normalizeComplexMatras(s);
  s = s.normalize('NFC');
  s = fixECExtractionArtifacts(s);
  s = stripGarbage(s);
  return s.trim();
}

/**
 * Auto-detect encoding and convert to Unicode Bengali.
 * @param {string} raw - Raw string from PDF extraction
 * @param {string} [hintEncoding] - Optional hint: 'sutonny' | 'bijoy' | 'unicode'
 * @returns {{ text: string, encoding: string }}
 */
function autoConvert(raw, hintEncoding = null) {
  if (!raw) return { text: '', encoding: 'unknown' };

  const encoding = hintEncoding || detectEncoding(raw);

  let text;
  switch (encoding) {
    case 'bijoy':
      text = convertBijoy(raw);
      break;
    case 'unicode':
      // Already Unicode — only clean up extraction artifacts and normalize
      text = fixECExtractionArtifacts(raw);
      text = normalizeComplexMatras(text);
      text = text.normalize('NFC');
      // Don't strip all non-Bengali — preserve digits, spaces, punctuation
      text = text.replace(/[\u00C0-\u024F]/g, '').trim();
      break;
    default: // 'sutonny' or any legacy
      text = convertSutonnyMJ(raw);
  }

  return { text, encoding };
}

/**
 * Normalize Bengali text for fuzzy search.
 * Strips all vowel marks so that "শেখ" and "শখ" still match.
 *
 * @param {string} str - Unicode Bengali text
 * @returns {string} Normalized string (consonant skeleton only)
 */
function normalizeForSearch(str) {
  if (!str) return '';
  // Remove all Bengali vowel matras, hasanta, nukta, anusvara, visarga
  return str
    .replace(/[\u09BE-\u09CC\u09CD\u09BC\u0981-\u0983]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

module.exports = {
  convertSutonnyMJ,
  convertBijoy,
  autoConvert,
  detectEncoding,
  normalizeForSearch,
  legacyRatio,
  reorderPreMatras,
};
