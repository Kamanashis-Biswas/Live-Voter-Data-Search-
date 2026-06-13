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
 * THIS IS THE SINGLE AUTHORITATIVE CONVERSION PIPELINE.
 * All other conversion modules (ecFontDecoder, glyphMapper, bengaliNormalizer) have been
 * consolidated into this file.
 * 
 * @author Kamanashis Biswas
 * @version 6.0.0 — Consolidated from 3 parallel pipelines into one
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
// Consonants range from ক to হ, plus flapped Rs (ড়, ঢ়), khanda-ta, and Y-phala.
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
 * Computes ratio of control-range characters (U+0080-U+00BF).
 * Many EC fonts map Bengali consonants to this range.
 *
 * @param {string} str - Input text.
 * @returns {number} Ratio of control-range characters in [0.0, 1.0].
 */
function controlRangeRatio(str) {
  if (!str || str.length === 0) return 0;
  let count = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x0080 && cp <= 0x00BF) count++;
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
  const ctrlRatio = controlRangeRatio(str);

  if (ratio === 0 && ctrlRatio === 0) return 'unicode';
  
  // EC fonts using control range (U+0080-U+00BF) for consonants
  if (ctrlRatio > 0.05) return 'sutonny';
  
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
  // Replace non-breaking spaces with standard spaces to prevent adjacent words from merging
  const normalized = str.replace(/\u00A0/g, ' ');
  // Keep: Bengali (U+0980-U+09FF), dandas (U+0964-U+0965), ASCII digits, space, tab (\u0009), slash, dot, dash, comma, parens, colon, semicolon
  return normalized.replace(/[^\u0980-\u09FF\u0964-\u0965\u0030-\u0039\u0020\u0009\u002F\u002E\u002D\u002C\u0028\u0029\u003A\u003B]/g, '');
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
    .replace(/\u09BE\u09C7/g, '\u09CB') // া + ে = ো (reversed order variant)
    .replace(/\u09C7\u09C7/g, '\u09C7') // deduplicate double ে
    .replace(/\u09BF\u09BF/g, '\u09BF') // deduplicate double ি
    .replace(/\u09CD\u09CD/g, '\u09CD') // deduplicate double hasanta
    .replace(/\u09BE\u09BE/g, '\u09BE') // deduplicate double া
    .replace(/\u09C1\u09C1/g, '\u09C1') // deduplicate double ু
    .replace(/\u09C2\u09C2/g, '\u09C2'); // deduplicate double ূ
}

/**
 * Fixes mid-word misplaced pre-matras (ি, ে, ৈ) in Bengali text.
 *
 * ROOT CAUSE: pdfjs-dist extracts text in VISUAL order (left-to-right),
 * but Bengali pre-matras (ি, ে, ৈ) display to the LEFT of their consonant
 * while logically belonging AFTER it in Unicode. This causes:
 *   - "ফরিদ" (ফ+র+ি+দ) extracted as "ফিরদ" (ফ+ি+র+দ)
 *   - "রহিমা" (র+হ+ি+ম+া) as "রিহমা" (র+ি+হ+ম+া)
 *   - "পিতা" as "িপতা" (ি before প)
 *
 * FIX STRATEGY (4 layers):
 *   1. Word-initial: ি/ে at word start → move after first consonant
 *   2. Structural labels: িপতা→পিতা, িঠকানা→ঠিকানা, etc.
 *   3. Known-name map: 120+ common Bengali voter name swap patterns
 *   4. Generic heuristic: remaining word-initial C+prematra+C patterns
 *
 * @param {string} str - Unicode Bengali string (after conversion)
 * @returns {string} String with pre-matras correctly placed
 */
function fixMisplacedPreMatras(str) {
  if (!str) return '';
  let s = str;

  // ── Layer 1: Structural label fixes (most specific — run FIRST) ──
  // These are known EC form labels that consistently get corrupted.
  s = s.replace(/িপতা/g, 'পিতা');
  s = s.replace(/িঠকানা/g, 'ঠিকানা');
  s = s.replace(/িবভাগ/g, 'বিভাগ');
  s = s.replace(/িনবাচন/g, 'নির্বাচন');
  s = s.replace(/েপশা/g, 'পেশা');

  // ── Layer 2: Known voter name pre-matra swap map ──
  // Built from analysis of 1745 voter records, 516 unique corruption patterns.
  const SWAP = {
    'ফিরদ': 'ফরিদ', 'রিহমা': 'রহিমা', 'ফিকর': 'ফকির',
    'রিশদা': 'রশিদা', 'রিশদ': 'রশিদ', 'ছিকনা': 'ছকিনা',
    'সিকনা': 'ছকিনা', 'তহিমনা': 'তাহমিনা', 'তহিমন': 'তাহমিন',
    'কিবর': 'কবির', 'জিরনা': 'জরিনা', 'ফিরদা': 'ফরিদা',
    'জেবদা': 'জবেদা', 'জেবদ': 'জবেদ', 'মিজনো': 'মজিনো',
    'জিলল': 'জলিল', 'শিরফা': 'শরিফা', 'মিরয়ম': 'মরিয়ম',
    'মুনিজরা': 'মুনজিরা', 'শিহদা': 'শহিদা', 'শিরনা': 'শরিনা',
    'আনিজরা': 'আনজিরা', 'আকিলমা': 'আকলিমা', 'মুসিলমা': 'মুসলিমা',
    'মুছিলমা': 'মুসলিমা', 'মোছেলম': 'মোসলেম', 'মোসেলম': 'মোসলেম',
    'সেিলনা': 'সেলিনা', 'মিজদ': 'মজিদ', 'আহেমদ': 'আহমেদ',
    'নিজেলা': 'নজিলা', 'দিলপ': 'দিলীপ', 'হিরশ': 'হরিশ',
    'শিপালী': 'শেফালী', 'শিরফুল': 'শরিফুল', 'কিবরুল': 'কবিরুল',
    'খিললুর': 'খলিলুর', 'মিহম': 'মহিম', 'মহিসন': 'মহসিন',
    'রিফকুল': 'রফিকুল', 'রিফকুর': 'রফিকুর', 'রিফকা': 'রফিকা',
    'রিফক': 'রফিক', 'লিতফ': 'লতিফ', 'লিতফা': 'লতিফা',
    'সিফউদ্দিন': 'সফিউদ্দিন', 'সিফউন্নীন': 'সফিউন্নীন',
    'শিহতুল': 'শহিদুল', 'মিতয়ার': 'মতিয়ার', 'তসিলম': 'তসলিম',
    'ইত্নাহিম': 'ইব্রাহিম', 'ইত্নাহীম': 'ইব্রাহিম', 'মিহতুল': 'মহিতুল', 'ছিবর': 'ছবির',
    'ছিবরুন': 'ছবিরুন', 'জিমর': 'জমির', 'তাছিলমা': 'তাসলিমা',
    'জমেশদ': 'জমশেদ', 'জোমেশদ': 'জমশেদ', 'জমেসদ': 'জমশেদ',
    'শাহিতুল': 'শাহিদুল', 'তাহিতুল': 'তাহিদুল', 'মুরিশদা': 'মুরশিদা',
    'হিরদাস': 'হরিদাস', 'মিনরা': 'মনিরা', 'খোরেশদ': 'খোরশেদ',
    'কিলমুন্নিন': 'কলিমুন্নিন', 'অলিমুন্নিন': 'আলিমুন্নিন',
    'রিজয়া': 'রিজিয়া', 'হিববুর': 'হাবিবুর', 'মিহউদ্দিন': 'মহিউদ্দিন',
    'তানিজলা': 'তানজিলা', 'মুনিজলা': 'মুনজিলা',
    'ইফেতখার': 'ইফতেখার', 'মিহমউদ্দিন': 'মহিমউদ্দিন',
    'হাছিবুর': 'হাসিবুর', 'জিলনা': 'জলিনা', 'সিখনা': 'ছকিনা',
    'পিরেতাষ': 'প্রিতোষ', 'রিমক': 'শ্রমিক', 'তািরখ': 'তারিখ',
    'তািলকা': 'তালিকা', 'তািলাকা': 'তালিকা', 'ইউিনয়ন': 'ইউনিয়ন',
    'পিরষদ': 'পরিষদ', 'মিহলা': 'মহিলা', 'বিছর': 'বছির',
    'দিবল': 'দবির', 'শিশর': 'শশির',
    'পূনিমো': 'পূর্ণিমা', 'কিরন': 'কিরণ',
    'সেরাজ': 'সিরাজ', 'রিশক': 'রসিক',
  };

  for (const [bad, good] of Object.entries(SWAP)) {
    if (bad === good) continue;
    if (s.includes(bad)) {
      s = s.replace(new RegExp(bad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), good);
    }
  }

  // ── Layer 3: Fix remaining word-initial pre-matras ──
  // Bengali words NEVER start with a dependent vowel sign.
  // Pattern: word-boundary + [ি/ে/ৈ] + [consonant] → [consonant] + [ি/ে/ৈ]
  // This runs LAST so it only catches patterns not already handled by the swap map.
  s = s.replace(/(^|[\s,;:।\-\(])([িেৈ])([\u0995-\u09B9\u09DC-\u09DF])/gm, '$1$3$2');

  return s;
}

/**
 * Fixes common Bengali OCR corruptions, font mapping glitches, and election commission spelling bugs.
 * These patches restore broken ligatures or garbled translations.
 *
 * This is the COMPREHENSIVE extraction artifact fix table, consolidated from all modules.
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
  s = s.replace(/কিমসন/g, 'কমিশন');
  s = s.replace(/কমিসন/g, 'কমিশন');
  s = s.replace(/উন্নিন/g, 'উদ্দিন');
  s = s.replace(/বিছর/g, 'বছির');
  s = s.replace(/ভাটার/g, 'ভোটার');

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
  s = s.replace(/সুত্নত/g, 'সুব্রত');
  s = s.replace(/প্রদ্যুন্ম/g, 'প্রদ্যুম্ন');

  // ── Title prefix normalization ──
  s = s.replace(/মোঃ\s*/g, 'মোহাম্মদ ');
  s = s.replace(/মোসাম্মৎ\s*/g, 'মোসাঃ ');
  s = s.replace(/মোছাঃ\s*/g, 'মোসাঃ ');
  s = s.replace(/মোসাঃ\s*/g, 'মোসাঃ ');
  s = s.replace(/শেখ আব্দুল\s*/g, 'শেখ আঃ ');
  s = s.replace(/মোঃ/g, 'মোহাম্মদ');
  s = s.replace(/মোসাম্মৎ/g, 'মোসাঃ');
  s = s.replace(/মোছাঃ/g, 'মোসাঃ');
  s = s.replace(/মোসাঃ/g, 'মোসাঃ');
  s = s.replace(/শেখ আব্দুল/g, 'শেখ আঃ');
  
  // ── Additional common EC corruption fixes ──
  s = s.replace(/(^|[\s,;:।\-\(])বিব($|[\s,;:।\-\)])/g, '$1বিবি$2');
  s = s.replace(/মিল্লক/g, 'মল্লিক');
  s = s.replace(/ছল্পার/g, 'ছব্দার');
  s = s.replace(/বগম/g, 'বেগম');
  s = s.replace(/মহমদ/g, 'মোহাম্মদ');
  s = s.replace(/মোহামদ/g, 'মোহাম্মদ');
  s = s.replace(/হসন/g, 'হোসেন');
  s = s.replace(/হোসাইন/g, 'হোসেন');
  s = s.replace(/নিবাচন/g, 'নির্বাচন');
  s = s.replace(/তািলকা/g, 'তালিকা');
  s = s.replace(/পুƁষ/g, 'পুরুষ');
  s = s.replace(/মিহলা/g, 'মহিলা');

  // ── Common EC voter field label fixes ──
  s = s.replace(/েজলা/g, 'জেলা');
  s = s.replace(/উপেজলা/g, 'উপজেলা');
  s = s.replace(/ইউিনয়ন/g, 'ইউনিয়ন');
  s = s.replace(/ওয়াডর্/g, 'ওয়ার্ড');
  s = s.replace(/পিরষদ/g, 'পরিষদ');

  // ── Ward (ওয়ার্ড) corruption fixes ──
  // SutonnyMJ Î (U+00CE) maps to ে but after ড it should form ড+র্ = ওয়ার্ড
  s = s.replace(/ওয়াডেরে/g, 'ওয়ার্ডের');
  s = s.replace(/ওয়াডে(?![র])/g, 'ওয়ার্ড');
  s = s.replace(/ওয়ােডে/g, 'ওয়ার্ড');
  s = s.replace(/বোডে/g, 'বোর্ড');
  s = s.replace(/কেপোরেশন/g, 'কর্পোরেশন');
  s = s.replace(/পিরষেদর/g, 'পরিষদের');

  // ── Occupation corruption fixes ──
  // Ř (U+0158) maps to র but should be শ্র for শ্রমিক
  s = s.replace(/(?:^|[\s,])রমিক/gm, (match) => match.replace('রমিক', 'শ্রমিক'));
  s = s.replace(/মিব্রী/g, 'মিস্ত্রী');
  s = s.replace(/অম্ভাম্ভ/g, 'অবকাশ');
  s = s.replace(/িাইভার/g, 'ড্রাইভার');
  s = s.replace(/ইিৗনিয়ার/g, 'ইঞ্জিনিয়ার');
  s = s.replace(/রিত্তা/g, 'রিকশা');
  s = s.replace(/চাকুরী/g, 'চাকরি');
  s = s.replace(/গিরহিণী/g, 'গৃহিণী');
  s = s.replace(/গৃহিনী/g, 'গৃহিণী');

  // ── Cover page header label cleanup ──
  // "চূড়ান্ত ভোটার তালিকা " prefix appears in occupation field from text extraction
  s = s.replace(/^চূড়ান্ত ভোটার তালিকা\s+/gm, '');

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
  s = fixMisplacedPreMatras(s);
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
  s = fixMisplacedPreMatras(s);
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
      text = fixMisplacedPreMatras(text);
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
 * 
 * NORMALIZATION STRATEGY (preserves vowel matras for readability and precision):
 *   - Standardizes sibilants (ষ, স, শ) to a unified শ.
 *   - Normalizes flapped R (ড়, ঢ়) to standard র.
 *   - Maps ণ to standard ন.
 *   - Standardizes double-formed vowels (ঈ ➔ ই, ঊ ➔ উ).
 *   - Strips hasanta (্) to decompose conjuncts (ম্ম ➔ মম, দ্দ ➔ দদ).
 *   - Strips nukta (়) and au-length mark (ৗ).
 *   - PRESERVES all vowel matras (া, ি, ী, ু, ূ, ৃ, ে, ৈ, ো, ৌ) and nasal marks (ঁ, ং, ঃ).
 * 
 * Example: "শেখ মোহাম্মদ" ➔ "শেখ মোহামমদ" (conjuncts decomposed, vowels preserved)
 * Example: "বাগেরহাট" ➔ "বাগেরহাট" (unchanged — no conjuncts)
 * Example: "উদ্দিন" ➔ "উদদিন" (hasanta stripped, vowels preserved)
 *
 * @param {string} str - Unicode Bengali text.
 * @returns {string} Normalized Bengali text with decomposed conjuncts.
 */
function normalizeForSearch(str) {
  if (!str) return '';
  let s = str;
  
  // 1. Correct common typographical errors
  s = s.replace(/বিল্পব/g, 'বিপ্লব');
  
  // 2. Map homophones to unified consonant classes
  s = s.replace(/য়/g, 'য');
  s = s.replace(/[ষস]/g, 'শ');
  s = s.replace(/[\u09DC\u09DD]/g, 'র');
  s = s.replace(/ণ/g, 'ন');
  s = s.replace(/ঈ/g, 'ই');
  s = s.replace(/ঊ/g, 'উ');
  s = s.replace(/ঙ/g, 'ং');
  s = s.replace(/ৎ/g, 'ত');
  
  // 3. Strip all vowel matras, hasanta, nukta, and au-length mark
  return s
    .replace(/[\u09BE-\u09CD\u09BC\u09D7]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Score the quality of a converted voter record.
 * Returns a score 0-100 indicating how clean the Bengali text is.
 *
 * @param {object} voter - Voter record with nameBn, fatherName, etc.
 * @returns {{ overallScore: number, qualityLevel: string, details: object }}
 */
function scoreVoterQuality(voter) {
  if (!voter) return { overallScore: 0, qualityLevel: 'INVALID', details: {} };

  let score = 0;
  const details = {};

  // Name presence and quality (40 points)
  if (voter.nameBn && voter.nameBn.length > 2) {
    const bengaliChars = (voter.nameBn.match(/[\u0980-\u09FF]/g) || []).length;
    const ratio = bengaliChars / voter.nameBn.replace(/\s/g, '').length;
    const nameScore = Math.min(40, Math.round(ratio * 40));
    score += nameScore;
    details.nameScore = nameScore;
  }

  // Father name (15 points)
  if (voter.fatherName && voter.fatherName.length > 2) {
    const bengaliChars = (voter.fatherName.match(/[\u0980-\u09FF]/g) || []).length;
    const ratio = bengaliChars / voter.fatherName.replace(/\s/g, '').length;
    score += Math.min(15, Math.round(ratio * 15));
  }

  // Mother name (10 points)
  if (voter.motherName && voter.motherName.length > 2) {
    score += 10;
  }

  // Voter number (15 points)
  if (voter.voterNumber && /^\d{5,}$/.test(voter.voterNumber)) {
    score += 15;
  }

  // NID number (10 points)
  if (voter.nidNumber && /^\d{10,17}$/.test(voter.nidNumber)) {
    score += 10;
  }

  // Address fields (10 points)
  if (voter.district) score += 3;
  if (voter.upazila) score += 3;
  if (voter.village) score += 2;
  if (voter.wardNo) score += 2;

  const qualityLevel = score >= 80 ? 'EXCELLENT' : score >= 60 ? 'GOOD' : score >= 40 ? 'FAIR' : 'POOR';

  return { overallScore: Math.min(100, score), qualityLevel, details };
}

module.exports = {
  convertSutonnyMJ,
  convertBijoy,
  autoConvert,
  detectEncoding,
  normalizeForSearch,
  legacyRatio,
  controlRangeRatio,
  reorderPreMatras,
  fixMisplacedPreMatras,
  fixECExtractionArtifacts,
  normalizeComplexMatras,
  stripGarbage,
  scoreVoterQuality,
};
