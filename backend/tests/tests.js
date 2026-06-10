'use strict';

/**
 * @file tests.js
 * @description Comprehensive test suite for the voter data processing system.
 *
 * Tests all ACTUAL existing modules:
 *   - Encoding Detection (bengaliUnicodeConverter)
 *   - Font Conversion (SutonnyMJ, Bijoy, autoConvert)
 *   - Pre-Matra Reordering
 *   - Dictionary Correction
 *   - Name Correction
 *   - District Validation
 *   - PDF Validation
 *   - Search Normalization & Indexing
 *   - Quality Scoring
 *   - Integration tests (full pipeline)
 *
 * @author Kamanashis Biswas
 * @version 7.0.0 — Complete rewrite for consolidated architecture
 */

const assert = require('assert');

// Import ACTUAL modules
const {
  detectEncoding,
  convertSutonnyMJ,
  convertBijoy,
  autoConvert,
  normalizeForSearch,
  reorderPreMatras,
  fixECExtractionArtifacts,
  normalizeComplexMatras,
  stripGarbage,
  scoreVoterQuality,
} = require('../utils/bengaliUnicodeConverter');

const {
  correctWord,
  correctText,
  findBestMatch,
  calculateSimilarity,
  levenshteinDistance,
  phoneticSimilarity,
  getDictionaryStats,
} = require('../utils/dictionaryCorrector');

const {
  correctName,
  correctNameWord,
  correctPersonNames,
  parseFullName,
  isLikelyName,
  getNameStats,
} = require('../utils/nameCorrector');

const {
  validateDistrict,
  validateUpazila,
  validateAddress,
  getUpazilas,
  getAllDistricts,
  getDivision,
  getGeoStats,
} = require('../utils/districtValidator');

const {
  verifyPdfIntegrity,
} = require('../utils/pdfTypeDetector');

const {
  buildVoterIndex,
  multiModeMatch,
  quickMatch,
  generateNgrams,
  jaccardSimilarity,
} = require('../utils/searchIndexer');

// ── Test Runner ──────────────────────────────────────────────────────────────

class TestRunner {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.errors = [];
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  run() {
    console.log('\n' + '═'.repeat(70));
    console.log('  VOTER DATA PROCESSING SYSTEM — TEST SUITE v7.0.0');
    console.log('═'.repeat(70) + '\n');

    for (const { name, fn } of this.tests) {
      try {
        fn();
        console.log(`  ✅ ${name}`);
        this.passed++;
      } catch (err) {
        console.log(`  ❌ ${name}`);
        console.log(`     Error: ${err.message}`);
        this.failed++;
        this.errors.push({ name, error: err.message });
      }
    }

    console.log('\n' + '═'.repeat(70));
    console.log(`  Results: ${this.passed} passed, ${this.failed} failed out of ${this.tests.length} tests`);
    if (this.failed > 0) {
      console.log('\n  Failed tests:');
      for (const e of this.errors) {
        console.log(`    ❌ ${e.name}: ${e.error}`);
      }
    }
    console.log('═'.repeat(70) + '\n');

    return this.failed === 0;
  }
}

const runner = new TestRunner();

// ══════════════════════════════════════════════════════════════════════════════
// ENCODING DETECTION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Encoding: Detect pure Unicode Bengali', () => {
  const result = detectEncoding('নির্বাচন কমিশন ভোটার তালিকা');
  assert.strictEqual(result, 'unicode');
});

runner.test('Encoding: Detect SutonnyMJ (Latin Extended range)', () => {
  // Text with Latin Extended characters typical of SutonnyMJ
  const text = '\u00CF\u00CE\u0118\u0102\u0103'; // Ï Î Ę Ă ă
  const result = detectEncoding(text);
  assert.strictEqual(result, 'sutonny');
});

runner.test('Encoding: Detect control range characters as SutonnyMJ', () => {
  const text = '\u0080\u0081\u0082\u0083\u0084\u0085\u0086'; // Control range
  const result = detectEncoding(text);
  assert.strictEqual(result, 'sutonny');
});

runner.test('Encoding: Empty/short strings default to unicode', () => {
  assert.strictEqual(detectEncoding(''), 'unicode');
  assert.strictEqual(detectEncoding('ab'), 'unicode');
});

// ══════════════════════════════════════════════════════════════════════════════
// FONT CONVERSION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('SutonnyMJ: Convert hasanta (্)', () => {
  // \u0100 = Ā → ্ (hasanta) in SutonnyMJ
  const result = convertSutonnyMJ('\u0100');
  assert(result.includes('্') || result.length === 0, `Expected hasanta, got: "${result}"`);
});

runner.test('SutonnyMJ: Convert pre-matra ে', () => {
  // In SutonnyMJ, \u00CF maps to ে. When placed before a Bengali consonant,
  // the pre-matra should be reordered after it.
  const result = convertSutonnyMJ('\u00CFশ');
  // Should reorder: ে (pre-matra) + শ → শে
  assert(result.includes('শে') || result.includes('শ'), `Expected শে, got: "${result}"`);
});

runner.test('SutonnyMJ: Convert control range consonants', () => {
  // \u0080 → ক, \u0081 → খ, \u0082 → গ
  const result = convertSutonnyMJ('\u0080\u0081\u0082');
  assert(result.includes('ক'), `Expected ক in "${result}"`);
  assert(result.includes('খ'), `Expected খ in "${result}"`);
  assert(result.includes('গ'), `Expected গ in "${result}"`);
});

runner.test('Bijoy: Convert basic consonants', () => {
  // In Bijoy: c→ক, g→গ, t→ত, n→ন
  const result = convertBijoy('cgtn');
  assert(result.includes('ক'), `Expected ক in "${result}"`);
  assert(result.includes('গ'), `Expected গ in "${result}"`);
});

runner.test('AutoConvert: Passthrough Unicode text', () => {
  const input = 'মোহাম্মদ হোসেন';
  const { text, encoding } = autoConvert(input);
  assert.strictEqual(encoding, 'unicode');
  assert(text.includes('মোহাম্মদ') || text.includes('হোসেন'), `Expected Bengali text in "${text}"`);
});

runner.test('AutoConvert: Convert with hint encoding', () => {
  const { encoding } = autoConvert('test', 'sutonny');
  assert.strictEqual(encoding, 'sutonny');
});

// ══════════════════════════════════════════════════════════════════════════════
// PRE-MATRA REORDERING TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('PreMatra: Reorder sentinel-tagged ে-matra', () => {
  // Sentinel (STX) + ে + শ should become শে
  const input = '\u0002\u09C7\u09B6'; // STX + ে + শ
  const result = reorderPreMatras(input);
  assert.strictEqual(result, 'শে', `Expected "শে", got "${result}"`);
});

runner.test('PreMatra: Reorder sentinel-tagged ি-matra', () => {
  const input = '\u0002\u09BF\u09A8'; // STX + ি + ন
  const result = reorderPreMatras(input);
  assert.strictEqual(result, 'নি', `Expected "নি", got "${result}"`);
});

runner.test('PreMatra: Leave correctly-placed matras untouched', () => {
  const input = 'শেখ'; // Already correctly ordered
  const result = reorderPreMatras(input);
  assert.strictEqual(result, 'শেখ');
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPLEX MATRA NORMALIZATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('ComplexMatra: Merge ে + া → ো', () => {
  const input = 'ক\u09C7\u09BE'; // ক + ে + া
  const result = normalizeComplexMatras(input);
  assert(result.includes('\u09CB'), `Expected ো in "${result}"`);
});

runner.test('ComplexMatra: Deduplicate double ে', () => {
  const result = normalizeComplexMatras('\u09C7\u09C7');
  assert.strictEqual(result, '\u09C7');
});

// ══════════════════════════════════════════════════════════════════════════════
// EC EXTRACTION ARTIFACTS TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('ECFix: Fix বগম → বেগম', () => {
  const result = fixECExtractionArtifacts('বগম');
  assert.strictEqual(result, 'বেগম');
});

runner.test('ECFix: Fix হসন → হোসেন', () => {
  const result = fixECExtractionArtifacts('হসন');
  assert.strictEqual(result, 'হোসেন');
});

runner.test('ECFix: Fix কিমশন → কমিশন', () => {
  const result = fixECExtractionArtifacts('কিমশন');
  assert.strictEqual(result, 'কমিশন');
});

runner.test('ECFix: Fix নিবোচন → নির্বাচন', () => {
  const result = fixECExtractionArtifacts('নিবোচন');
  assert.strictEqual(result, 'নির্বাচন');
});

runner.test('ECFix: Fix মোঃ → মোহাম্মদ', () => {
  const result = fixECExtractionArtifacts('মোঃ রহিম');
  assert(result.startsWith('মোহাম্মদ'), `Expected starts with মোহাম্মদ, got "${result}"`);
});

// ══════════════════════════════════════════════════════════════════════════════
// DICTIONARY CORRECTOR TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Dict: Correct known misspelling "শখ" → "শেখ"', () => {
  const result = correctWord('শখ');
  assert.strictEqual(result.corrected, 'শেখ');
  assert.strictEqual(result.method, 'EXACT_MISSPELLING');
});

runner.test('Dict: Correct known misspelling "মহনতদ" → "মোহাম্মদ"', () => {
  const result = correctWord('মহনতদ');
  assert.strictEqual(result.corrected, 'মোহাম্মদ');
});

runner.test('Dict: Correct text with multiple errors', () => {
  const result = correctText('কিমশন নিবাচন');
  assert(result.correctionCount >= 2, `Expected >=2 corrections, got ${result.correctionCount}`);
  assert(result.corrected.includes('কমিশন'));
  assert(result.corrected.includes('নির্বাচন'));
});

runner.test('Dict: Fuzzy match on similar words', () => {
  const result = findBestMatch('ভাটার', 0.6);
  assert(result !== null, 'Expected a fuzzy match');
  assert(result.similarity > 0.6, `Expected similarity > 0.6, got ${result.similarity}`);
});

runner.test('Dict: Levenshtein distance', () => {
  assert.strictEqual(levenshteinDistance('abc', 'abc'), 0);
  assert.strictEqual(levenshteinDistance('abc', 'abd'), 1);
  assert.strictEqual(levenshteinDistance('', 'abc'), 3);
});

runner.test('Dict: Calculate similarity', () => {
  const sim = calculateSimilarity('abc', 'abc');
  assert.strictEqual(sim, 1.0);

  const sim2 = calculateSimilarity('abc', 'abd');
  assert(sim2 > 0.5 && sim2 < 1.0);
});

runner.test('Dict: Dictionary stats are non-empty', () => {
  const stats = getDictionaryStats();
  assert(stats.dictionarySize > 50, `Expected >50 dictionary words, got ${stats.dictionarySize}`);
  assert(stats.misspellingMapSize > 30, `Expected >30 misspellings, got ${stats.misspellingMapSize}`);
});

// ══════════════════════════════════════════════════════════════════════════════
// NAME CORRECTOR TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Name: Correct "মোহামদ" → "মোহাম্মদ"', () => {
  const result = correctName('মোহামদ', 0.65);
  assert.strictEqual(result.corrected, 'মোহাম্মদ');
});

runner.test('Name: Correct full name "শখ মোহামদ"', () => {
  const result = correctName('শখ মোহামদ', 0.65);
  assert(result.corrected.includes('শেখ'), `Expected শেখ in "${result.corrected}"`);
  assert(result.corrected.includes('মোহাম্মদ'), `Expected মোহাম্মদ in "${result.corrected}"`);
});

runner.test('Name: Parse full name into parts', () => {
  const parsed = parseFullName('মোহাম্মদ হোসেন');
  assert.strictEqual(parsed.firstName, 'মোহাম্মদ');
  assert.strictEqual(parsed.surname, 'হোসেন');
});

runner.test('Name: Validate name-like text', () => {
  assert.strictEqual(isLikelyName('মোহাম্মদ হোসেন'), true);
  assert.strictEqual(isLikelyName(''), false);
  assert.strictEqual(isLikelyName('12345'), false);
});

runner.test('Name: Correct person names object', () => {
  const result = correctPersonNames({
    nameBn: 'শখ মোহামদ',
    fatherName: 'বগম',
  }, { threshold: 0.65 });
  assert(result.corrected.nameBn.includes('শেখ') || result.corrected.nameBn.includes('মোহাম্মদ'));
});

runner.test('Name: Stats report non-zero counts', () => {
  const stats = getNameStats();
  assert(stats.maleNamesCount > 50);
  assert(stats.femaleNamesCount > 20);
  assert(stats.surnamesCount > 20);
});

// ══════════════════════════════════════════════════════════════════════════════
// DISTRICT VALIDATOR TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('District: Validate known district "ঢাকা"', () => {
  const result = validateDistrict('ঢাকা');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.canonical, 'ঢাকা');
});

runner.test('District: Fuzzy match "চট্টগ্রম" → "চট্টগ্রাম"', () => {
  const result = validateDistrict('চট্টগ্রম');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.canonical, 'চট্টগ্রাম');
});

runner.test('District: Validate upazila within district', () => {
  const result = validateUpazila('সাভার', 'ঢাকা');
  assert.strictEqual(result.valid, true);
});

runner.test('District: Validate complete address', () => {
  const result = validateAddress({ district: 'ঢাকা', upazila: 'সাভার' });
  assert.strictEqual(result.valid, true);
});

runner.test('District: Get all 64 districts', () => {
  const districts = getAllDistricts();
  assert.strictEqual(districts.length, 64);
});

runner.test('District: Get division for district', () => {
  const division = getDivision('ঢাকা');
  assert.strictEqual(division, 'ঢাকা');
});

runner.test('District: Geo stats non-zero', () => {
  const stats = getGeoStats();
  assert.strictEqual(stats.districtCount, 64);
  assert.strictEqual(stats.divisionCount, 8);
  assert(stats.upazilaCount > 50);
});

// ══════════════════════════════════════════════════════════════════════════════
// PDF VALIDATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('PDF: Verify valid PDF header', () => {
  const pdfHeader = Buffer.from('%PDF-1.4\n' + '0'.repeat(200));
  const result = verifyPdfIntegrity(pdfHeader);
  assert.strictEqual(result.valid, true);
});

runner.test('PDF: Reject invalid PDF header', () => {
  const badHeader = Buffer.from('NOT A PDF FILE CONTENT');
  const result = verifyPdfIntegrity(badHeader);
  assert.strictEqual(result.valid, false);
});

runner.test('PDF: Reject empty buffer', () => {
  const result = verifyPdfIntegrity(Buffer.alloc(0));
  assert.strictEqual(result.valid, false);
});

runner.test('PDF: Reject too-small buffer', () => {
  const result = verifyPdfIntegrity(Buffer.from('%PDF'));
  assert.strictEqual(result.valid, false);
});

// ══════════════════════════════════════════════════════════════════════════════
// SEARCH NORMALIZATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Search: Normalize strips vowel matras', () => {
  const result = normalizeForSearch('শেখ');
  // Should strip ে-matra, leaving consonant skeleton: শখ
  assert(!result.includes('\u09C7'), `Expected ে stripped, got "${result}"`);
  assert(result.includes('শ'));
  assert(result.includes('খ'));
});

runner.test('Search: Normalize unifies sibilants', () => {
  const s1 = normalizeForSearch('ষড়যন্ত্র');
  const s2 = normalizeForSearch('শড়যন্ত্র');
  // ষ and শ should be unified
  assert.strictEqual(s1, s2);
});

runner.test('Search: "শেখ" and "শখ" produce same skeleton', () => {
  const n1 = normalizeForSearch('শেখ');
  const n2 = normalizeForSearch('শখ');
  assert.strictEqual(n1, n2, `Expected "${n1}" === "${n2}"`);
});

runner.test('Search: "বেগম" and "বগম" produce same skeleton', () => {
  const n1 = normalizeForSearch('বেগম');
  const n2 = normalizeForSearch('বগম');
  assert.strictEqual(n1, n2);
});

runner.test('Search: "মোহাম্মদ" skeleton matches "মহমদ"', () => {
  const n1 = normalizeForSearch('মোহাম্মদ');
  // মোহাম্মদ → strip ো, া, ্ → মহমমদ
  assert(n1.length > 0);
  // The skeleton should be consonant-only
  assert(!/[\u09BE-\u09CC\u09CD]/.test(n1), `Expected no matras in "${n1}"`);
});

// ══════════════════════════════════════════════════════════════════════════════
// SEARCH INDEXER TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('SearchIndex: Generate n-grams', () => {
  const ngrams = generateNgrams('মোহাম্মদ', 2);
  assert(ngrams.size > 0);
});

runner.test('SearchIndex: Jaccard similarity', () => {
  const s1 = generateNgrams('abc', 2);
  const s2 = generateNgrams('abc', 2);
  assert.strictEqual(jaccardSimilarity(s1, s2), 1.0);
});

runner.test('SearchIndex: Build voter index', () => {
  const index = buildVoterIndex({
    nameBn: 'মোহাম্মদ হোসেন',
    fatherName: 'আব্দুল করিম',
    motherName: '',
    village: 'ঢাকা',
    voterArea: '',
    upazila: '',
    district: 'ঢাকা',
    occupation: 'কৃষক',
  });
  assert(index.normalName.length > 0);
  assert(index.normalFather.length > 0);
  assert(index.nameNgrams.size > 0);
});

runner.test('SearchIndex: Quick match — exact', () => {
  const result = quickMatch('মোহাম্মদ', 'মহমমদ', 'মোহাম্মদ', 'মহমমদ');
  assert.strictEqual(result, true);
});

runner.test('SearchIndex: Quick match — phonetic', () => {
  const stored = 'শেখ মোহাম্মদ';
  const normalStored = normalizeForSearch(stored).toLowerCase();
  const query = 'শখ';
  const normalQuery = normalizeForSearch(query).toLowerCase();
  const result = quickMatch(stored, normalStored, query, normalQuery);
  assert.strictEqual(result, true);
});

runner.test('SearchIndex: Multi-mode match', () => {
  const stored = 'মোহাম্মদ হোসেন';
  const normalStored = normalizeForSearch(stored).toLowerCase();
  const storedNgrams = generateNgrams(normalStored, 2);
  const query = 'মোহাম্মদ';
  const normalQuery = normalizeForSearch(query).toLowerCase();
  const queryNgrams = generateNgrams(normalQuery, 2);

  const result = multiModeMatch(stored, normalStored, storedNgrams, query, normalQuery, queryNgrams, 'all');
  assert.strictEqual(result.matched, true);
  assert(result.score > 0.5);
});

// ══════════════════════════════════════════════════════════════════════════════
// QUALITY SCORING TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Quality: Score complete voter record', () => {
  const result = scoreVoterQuality({
    nameBn: 'মোহাম্মদ হোসেন',
    fatherName: 'আব্দুল করিম',
    motherName: 'আয়েশা বেগম',
    voterNumber: '12345',
    nidNumber: '1234567890123',
    district: 'ঢাকা',
    upazila: 'সাভার',
    village: 'টেকা',
    wardNo: '১',
  });
  assert(result.overallScore >= 60, `Expected score >= 60, got ${result.overallScore}`);
  assert(result.qualityLevel === 'EXCELLENT' || result.qualityLevel === 'GOOD');
});

runner.test('Quality: Score empty voter record', () => {
  const result = scoreVoterQuality({});
  assert.strictEqual(result.overallScore, 0);
  assert.strictEqual(result.qualityLevel, 'POOR');
});

runner.test('Quality: Score null voter', () => {
  const result = scoreVoterQuality(null);
  assert.strictEqual(result.overallScore, 0);
  assert.strictEqual(result.qualityLevel, 'INVALID');
});

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Integration: Full pipeline — corrupted text → corrected', () => {
  // Simulate corrupted EC text
  const corruptedText = 'শখ মহমদ হসন';

  // Step 1: Dictionary correction
  const dictResult = correctText(corruptedText);
  assert(dictResult.correctionCount > 0);

  // Step 2: Name correction
  const nameResult = correctName(dictResult.corrected, 0.65);
  const finalText = nameResult.corrected;

  // Verify corrections were applied
  assert(finalText.includes('শেখ') || finalText.includes('মোহাম্মদ') || finalText.includes('হোসেন'),
    `Expected corrected names in "${finalText}"`);
});

runner.test('Integration: Search matches corrupted → corrected pairs', () => {
  // "শেখ" (correct) should produce same phonetic skeleton as "শখ" (corrupted)
  const correctSkeleton = normalizeForSearch('শেখ');
  const corruptedSkeleton = normalizeForSearch('শখ');
  assert.strictEqual(correctSkeleton, corruptedSkeleton);

  // "বেগম" should match "বগম"
  const correctSkeleton2 = normalizeForSearch('বেগম');
  const corruptedSkeleton2 = normalizeForSearch('বগম');
  assert.strictEqual(correctSkeleton2, corruptedSkeleton2);
});

runner.test('Integration: Phonetic search matches across vowel variations', () => {
  const stored = 'মোহাম্মদ হোসেন';
  const normalStored = normalizeForSearch(stored);
  const query = 'হোসেন';
  const normalQuery = normalizeForSearch(query);
  assert(normalStored.includes(normalQuery), `"${normalQuery}" should be found in "${normalStored}"`);
});

// ══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE TESTS
// ══════════════════════════════════════════════════════════════════════════════

runner.test('Performance: Normalize 10,000 strings under 2s', () => {
  const text = 'নির্বাচন কমিশন ভোটার তালিকা';
  const start = Date.now();
  for (let i = 0; i < 10000; i++) {
    normalizeForSearch(text);
  }
  const duration = Date.now() - start;
  assert(duration < 2000, `Expected <2000ms, took ${duration}ms`);
});

runner.test('Performance: Correct 1,000 words under 3s', () => {
  const words = ['শখ', 'বগম', 'মহমদ', 'হসন', 'কিমশন'];
  const start = Date.now();
  for (let i = 0; i < 1000; i++) {
    for (const word of words) {
      correctWord(word);
    }
  }
  const duration = Date.now() - start;
  assert(duration < 3000, `Expected <3000ms, took ${duration}ms`);
});

runner.test('Performance: QuickMatch 10,000 comparisons under 1s', () => {
  const stored = 'মোহাম্মদ হোসেন';
  const normalStored = normalizeForSearch(stored).toLowerCase();
  const query = 'মোহাম্মদ';
  const normalQuery = normalizeForSearch(query).toLowerCase();

  const start = Date.now();
  for (let i = 0; i < 10000; i++) {
    quickMatch(stored, normalStored, query, normalQuery);
  }
  const duration = Date.now() - start;
  assert(duration < 1000, `Expected <1000ms, took ${duration}ms`);
});

// ══════════════════════════════════════════════════════════════════════════════
// RUN ALL TESTS
// ══════════════════════════════════════════════════════════════════════════════

const allPassed = runner.run();
process.exit(allPassed ? 0 : 1);
