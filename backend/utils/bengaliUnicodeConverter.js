'use strict';

/**
 * @file BENGALI UNICODE CONVERTER PIPELINE
 * @description Core conversion service that translates raw, legacy-font encoded text 
 * (SutonnyMJ or Bijoy ASCII/Latin mappings) into standardized Unicode Bengali.
 * 
 * THE BENGALI RENDERING CONUNDRUM & PIPELINE ARCHITECTURE:
 *   - Legacy ASCII fonts map visual shapes to keyboard characters. 
 *   - In visual typing (e.g. SutonnyMJ), vowel marks called "pre-matras" (ি, ে, ৈ)
 *     are typed BEFORE the consonant they modify (e.g., ে + শ + খ = শেখ).
 *   - Unicode, however, requires logical ordering: Consonant first, then Matra (শ + ে + খ = শেখ).
 *   - Directly replacing glyphs yields logically broken strings.
 *   - To solve this, our pipeline performs the following steps:
 * 
 *     Step 1: Glyph Substitution — Swap Latin Extended characters with their Bengali counterparts.
 *             Misplaced pre-matras are tagged with a SENTINEL character (\u0002).
 *     Step 2: Pre-Matra Reordering — Shift sentinel-tagged pre-matras AFTER their consonants.
 *             Naturally correctly placed Unicode matras are left untouched.
 *     Step 3: Complex Matra Merge — Combine adjacent split marks (ে + া ➔ ো; ে + ৗ ➔ ৌ).
 *     Step 4: Unicode Normalization — Convert to standard Canonical Normalization Form (NFC).
 *     Step 5: Spelling Fixes & Artifact Corrections — Correct OCR typos and font-level artifacts.
 *     Step 6: Garbage Cleanup — Strip remaining stray Latin characters to preserve clean Bengali.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

const { SUTONNY_MAP, PRE_MATRAS } = require('./sutonnyMJMap');
const { BIJOY_MAP } = require('./bijoyMap');

// Unicode ranges to detect Bengali text and Latin Extended blocks
const BENGALI_RANGE = /[\u0980-\u09FF]/;
const LATIN_EXT_RANGE = /[\u00C0-\u00FF\u0100-\u017F\u0180-\u024F]/;

// Set of Unicode pre-matra code points: ি (U+09BF), ে (U+09C7), ৈ (U+09C8)
const PRE_MATRA_CP = new Set([0x09BF, 0x09C7, 0x09C8]);

// Pre-calculate sets of legacy characters that map directly to pre-matras.
// This allows the substitution pass to identify and tag them instantly.
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

// Sentinel character used to track visually-ordered pre-matras.
// We use the non-printable ASCII control character "Start of Text" (STX, \u0002).
const SENTINEL = '\u0002';

// Regular expression components to identify Bengali consonant clusters.
// Consonants range from ক to হ, plus flapped Rs (ড়, ঢ়), khanda-ta, and Y-phala.
// Clusters can consist of multiple consonants linked by hasanta (্) (e.g., শ + ্ + র = শ্র).
const CONSONANT_RE = '[\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1]';
const HASANTA = '\u09CD';

// Regex to capture tagged pre-matras followed by a consonant cluster.
// Pattern: [SENTINEL] + [pre-matra] + [consonant cluster]
// Matching group 1 = pre-matra, group 2 = full consonant cluster.
const SENTINEL_CLUSTER_RE = new RegExp(
  SENTINEL + '([\u09BF\u09C7\u09C8])(' + CONSONANT_RE + '(?:' + HASANTA + CONSONANT_RE + ')*)',
  'gu'
);

/**
 * Maps legacy ASCII font glyph characters to their Unicode equivalents.
 * Tag-pre-matra substitutions with the SENTINEL prefix to denote they require reordering.
 *
 * @param {string} str - Raw legacy string.
 * @param {object} map - Font glyph translation dictionary (Sutonny or Bijoy).
 * @param {Set<number>} preSources - Set of legacy character code points mapping to pre-matras.
 * @returns {string} Converted string with sentinel-tagged pre-matras.
 */
function applyGlyphMap(str, map, preSources) {
  let result = '';
  for (const char of str) {
    const cp = char.codePointAt(0);
    if (map[char] !== undefined) {
      // If the glyph maps to a pre-matra, prepend the sentinel marker
      result += (preSources && preSources.has(cp) ? SENTINEL : '') + map[char];
    } else {
      result += char;
    }
  }
  return result;
}

/**
 * Scan raw strings for pre-existing Unicode pre-matras that might be visually misaligned.
 * Tags them with the sentinel if they are not preceded by a consonant or hasanta.
 *
 * @param {string} str - Converted string.
 * @returns {string} String with tagged misaligned pre-matras.
 */
function tagRawUnicodePreMatras(str) {
  if (!str) return '';
  // Tag pre-matras that are NOT preceded by a valid consonant or hasanta
  const TAG_REGEX = /(?<![\u0995-\u09B9\u09DC-\u09DF\u09CE\u09F0-\u09F1\u09CD])([\u09BF\u09C7\u09C8])/g;
  return str.replace(TAG_REGEX, SENTINEL + '$1');
}

/**
 * Shifts sentinel-tagged pre-matras AFTER their associated consonant clusters.
 * Strips out the sentinel markers in the process.
 * 
 * EXAMPLES:
 *   - Tagged text: \u0002ে + শ + খ (ে is tagged because it was visually ordered)
 *     Reordered:  শ + ে + খ ➔ শেখ (Correct Unicode order)
 *   - Correct text: ত + ে + ম + া (no sentinel because ে was already after ত)
 *     Reordered:  ত + ে + ম + া ➔ তেমা (Left untouched)
 *
 * @param {string} str - Tagged string.
 * @returns {string} Reordered Unicode string.
 */
function reorderPreMatras(str) {
  // Swap matches: [SENTINEL][matra][consonant_cluster] ➔ [consonant_cluster][matra]
  let result = str.replace(SENTINEL_CLUSTER_RE, (_match, matra, cluster) => cluster + matra);
  // Clean up any stray, unused sentinel marks as a safety fallback
  return result.replace(/\u0002/g, '');
}

/**
 * Computes the ratio of Latin Extended characters to the overall string length.
 * Used as a heuristic to detect if a PDF utilizes legacy encoding (SutonnyMJ).
 *
 * @param {string} str - Input text.
 * @returns {number} Ratio of legacy characters in the range [0.0, 1.0].
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
 * Heuristically detects the text encoding of an extracted PDF text stream.
 *
 * @param {string} str - Extracted text sample.
 * @returns {'sutonny'|'bijoy'|'unicode'|'unknown'} The detected encoding classification.
 */
function detectEncoding(str) {
  if (!str || str.length < 4) return 'unicode';

  // Bijoy typing outputs lowercase ASCII letters for consonants.
  // We count common Bijoy consonant keys to detect Bijoy encoding.
  const bijoyMarkers = ['a', 'b', 'c', 'g', 'j', 'k', 'n', 'p', 'r', 's', 't'];
  let bijoyScore = 0;
  for (const ch of str) {
    if (bijoyMarkers.includes(ch)) bijoyScore++;
  }

  const hasBengaliConsonants = BENGALI_RANGE.test(str);
  const hasLatinExt = LATIN_EXT_RANGE.test(str);
  const ratio = legacyRatio(str);

  if (ratio === 0) return 'unicode';
  // Sutonny lists contain raw Bengali letters mixed with Latin Extended matra shapes
  if (hasBengaliConsonants && hasLatinExt) return 'sutonny';
  if (!hasBengaliConsonants && bijoyScore > str.length * 0.3) return 'bijoy';
  if (hasLatinExt) return 'sutonny'; // Fallback

  return 'unicode';
}

/**
 * Removes non-Bengali, non-digit, and non-punctuation characters from converted text.
 * Runs AFTER glyph substitution so we only clean up stray, unmapped legacy bytes.
 * Preserves Bengali letters, digits, spaces, and standard punctuation marks.
 *
 * @param {string} str - Unicode string.
 * @returns {string} Stripped, clean string.
 */
function stripGarbage(str) {
  // Keep: Bengali (U+0980-U+09FF), dandas (U+0964-U+0965), ASCII digits, space, slash, dot, dash, comma, parens, colon, semicolon
  return str.replace(/[^\u0980-\u09FF\u0964-\u0965\u0030-\u0039\u0020\u002F\u002E\u002D\u002C\u0028\u0029\u003A\u003B]/g, '');
}

/**
 * Combines adjacent split matras into single unified Unicode vowel signs.
 * E.g., ে (U+09C7) + া (U+09BE) ➔ ো (U+09CB).
 * Also deduplicates repeated adjacent vowel marks or hasantas caused by extraction glitches.
 *
 * @param {string} str - Unicode string.
 * @returns {string} Unified matra string.
 */
function normalizeComplexMatras(str) {
  if (!str) return '';
  return str
    .replace(/\u09C7\u09BE/g, '\u09CB') // ে + া = ো (O-matra)
    .replace(/\u09C7\u09D7/g, '\u09CC') // ে + ৗ = ৌ (OU-matra)
    .replace(/\u09C7\u09C7/g, '\u09C7') // deduplicate double ে
    .replace(/\u09BF\u09BF/g, '\u09BF') // deduplicate double ি
    .replace(/\u09CD\u09CD/g, '\u09CD'); // deduplicate double hasanta
}

/**
 * Fixes common Bengali OCR corruptions, font mapping glitches, and election commission spelling bugs.
 * These patches restore broken ligatures or garbled translations.
 *
 * @param {string} str - Converted Bengali string.
 * @returns {string} Normalised and corrected string.
 */
function fixECExtractionArtifacts(str) {
  if (!str) return '';
  let s = str;

  // ── Standard EC OCR & Title Fixes ──
  s = s.replace(/জহ্ল/g, 'জন্ম');
  s = s.replace(/জম্ভ/g, 'জন্ম');
  s = s.replace(/নণ্ডর/g, 'নম্বর');
  s = s.replace(/জ্ঞকাশ/g, 'প্রকাশ');
  s = s.replace(/সবেমোট/g, 'সর্বমোট');
  s = s.replace(/নিবোচন/g, 'নির্বাচন');
  s = s.replace(/কিমশন/g, 'কমিশন');
  s = s.replace(/উন্নিন/g, 'উদ্দিন');
  s = s.replace(/বিছর/g, 'বছির');

  // ── Legacy Font Spelling Normalization Maps ──
  // Corrects corrupted conjuncts and glyph overlaps from Sutonny/Bijoy PDF exports.
  s = s.replace(/সিবতা/g, 'সবিতা');
  s = s.replace(/রী বীরেন/g, 'শ্রী বীরেন');
  s = s.replace(/বিজ্ঞজিৎ/g, 'বিশ্বজিৎ');
  s = s.replace(/উৎল/g, 'উৎপল');
  s = s.replace(/দিো/g, 'দেবী');
  s = s.replace(/সৗয়দ/g, 'সৈয়দ');
  s = s.replace(/সৗয়/g, 'সৈয়দ');
  s = s.replace(/ুাগতম/g, 'স্বাগতম');
  s = s.replace(/জ্ঞভাকর/g, 'প্রভাকর');
  s = s.replace(/পিরমল/g, 'পরিমল');
  s = s.replace(/বি্ছম/g, 'বিপ্লব');
  s = s.replace(/অমেল/g, 'অমল');
  s = s.replace(/মিনষ/g, 'মনীষ');
  s = s.replace(/অংমান/g, 'অংশুমান');
  s = s.replace(/অপম/g, 'অনুপম');
  s = s.replace(/জ্ঞমানহ্ন/g, 'প্রদ্যুন্ম');
  s = s.replace(/জ্ঞদীপ/g, 'প্রদীপ');
  s = s.replace(/শিল/g, 'শীল');
  s = s.replace(/lিক্ষকান্ত/g, 'লক্ষ্মীকান্ত').replace(/লিক্ষকান্ত/g, 'লক্ষ্মীকান্ত');
  s = s.replace(/রিশক/g, 'রসিক');
  s = s.replace(/সেন্তাষ/g, 'সন্তোষ');
  s = s.replace(/সেরাজ/g, 'সিরাজ');
  s = s.replace(/মৃল/g, 'মৃদুল');
  s = s.replace(/বংি্ছম/g, 'বঙ্কিম');
  s = s.replace(/রেসাময়/g, 'রসময়');
  s = s.replace(/সুধাং/g, 'সুধাংশু');
  s = s.replace(/নিত্যানহ্ন/g, 'নিত্যানন্দ');
  s = s.replace(/ত্নজেন/g, 'নগেন');
  s = s.replace(/বিেনাদ/g, 'বিনোদ');
  s = s.replace(/ৗানদা/g, 'জ্ঞানদা');
  s = s.replace(/দেবন্দ্র/g, 'দেবেন্দ্র');
  s = s.replace(/देवन्द्र/g, 'দেবেন্দ্র');
  s = s.replace(/সুত্নত/g, 'সুব্রত');
  s = s.replace(/প্রদ্যুন্ম/g, 'প্রদ্যুম্ন');

  // Collapse multiple spaces
  s = s.replace(/\s{2,}/g, ' ');

  return s.trim();
}

/**
 * Converts a SutonnyMJ legacy-encoded string to standard Unicode Bengali.
 * 
 * @param {string} raw - Raw string.
 * @returns {string} Clean Unicode Bengali.
 */
function convertSutonnyMJ(raw) {
  if (!raw) return '';
  let s = tagRawUnicodePreMatras(raw);
  s = applyGlyphMap(s, SUTONNY_MAP, SUTONNY_PRE_MATRA_SOURCES);
  s = reorderPreMatras(s);
  s = normalizeComplexMatras(s);
  s = s.normalize('NFC');
  s = fixECExtractionArtifacts(s);
  s = stripGarbage(s);
  return s.trim();
}

/**
 * Converts a Bijoy legacy-encoded string to standard Unicode Bengali.
 * 
 * @param {string} raw - Raw string.
 * @returns {string} Clean Unicode Bengali.
 */
function convertBijoy(raw) {
  if (!raw) return '';
  let s = tagRawUnicodePreMatras(raw);
  s = applyGlyphMap(s, BIJOY_MAP, BIJOY_PRE_MATRA_SOURCES);
  s = reorderPreMatras(s);
  s = normalizeComplexMatras(s);
  s = s.normalize('NFC');
  s = fixECExtractionArtifacts(s);
  s = stripGarbage(s);
  return s.trim();
}

/**
 * Auto-detects legacy string encoding and performs safe Unicode translation.
 *
 * @param {string} raw - Raw string extracted from PDF.
 * @param {string|null} [hintEncoding=null] - Optional manual encoding hint ('sutonny'|'bijoy'|'unicode').
 * @returns {{ text: string, encoding: string }} The converted text and the encoding applied.
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
      // Text is already Unicode, normalize matras and clean font artifacts
      text = fixECExtractionArtifacts(raw);
      text = normalizeComplexMatras(text);
      text = text.normalize('NFC');
      // Strip legacy Latin Extended characters
      text = text.replace(/[\u00C0-\u024F]/g, '').trim();
      break;
    default:
      text = convertSutonnyMJ(raw);
  }

  return { text, encoding };
}

/**
 * Normalizes Bengali text to support robust fuzzy matches and search query phonetic routing.
 * Extends phonetic match reliability by removing all vowel marks, hasantas, and grouping homophones:
 * 
 *   - Standardizes sibilants (ষ, স, শ) to a unified শ skeleton.
 *   - Normalizes flapped R (ড়, ঢ়) to standard র.
 *   - Maps ণ to standard ন.
 *   - Standardizes double-formed vowels (ঈ ➔ ই, ঊ ➔ উ).
 *   - Strips all visual vowel matras, hasantas, and sound marks.
 * 
 * Example: "শেখ মোহাম্মদ" ➔ consonant skeleton: "শখ মহমমদ"
 * Search: "শখ" matching "শেখ" yields a positive match despite vowel variances.
 *
 * @param {string} str - Unicode Bengali text.
 * @returns {string} Stripped consonant skeleton.
 */
function normalizeForSearch(str) {
  if (!str) return '';
  let s = str;
  
  // 1. Correct common typographical errors
  s = s.replace(/বিল্পব/g, 'বিপ্লব');
  
  // 2. Map homophones to unified consonant classes
  s = s.replace(/[ষস]/g, 'শ');
  s = s.replace(/[ড়ঢ়]/g, 'র');
  s = s.replace(/ণ/g, 'ন');
  s = s.replace(/ঈ/g, 'ই');
  s = s.replace(/ঊ/g, 'উ');
  
  // 3. Strip all Bengali matras (vowel signs), hasantas, nuktas, and modifiers
  return s
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
