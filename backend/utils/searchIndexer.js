'use strict';

/**
 * @file searchIndexer.js
 * @description Advanced search index builder for Bengali voter data.
 *
 * Features:
 *   - Phonetic consonant skeleton indexes (normalizeForSearch)
 *   - N-gram substring indexes for fast partial matching
 *   - Multi-mode search: exact, partial, fuzzy, phonetic
 *
 * The indexes are pre-computed when voters are loaded/modified,
 * enabling sub-millisecond search on large datasets.
 *
 * @version 7.0.0
 */

const { normalizeForSearch } = require('./bengaliUnicodeConverter');
const { levenshteinDistance } = require('./dictionaryCorrector');

/**
 * Generate character n-grams from a string.
 *
 * @param {string} str - Input string
 * @param {number} n - N-gram size (default: 2 for bigrams)
 * @returns {Set<string>} Set of n-grams
 */
function generateNgrams(str, n = 2) {
  const grams = new Set();
  if (!str || str.length < n) return grams;

  const clean = str.replace(/\s+/g, '').toLowerCase();
  for (let i = 0; i <= clean.length - n; i++) {
    grams.add(clean.substring(i, i + n));
  }
  return grams;
}

/**
 * Compute Jaccard similarity between two n-gram sets.
 *
 * @param {Set<string>} set1 - First n-gram set
 * @param {Set<string>} set2 - Second n-gram set
 * @returns {number} Similarity score (0-1)
 */
function jaccardSimilarity(set1, set2) {
  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  for (const gram of set1) {
    if (set2.has(gram)) intersection++;
  }

  return intersection / (set1.size + set2.size - intersection);
}

/**
 * Build search index entry for a voter record.
 * Pre-computes phonetic skeletons and n-gram sets.
 *
 * @param {object} voter - Voter record
 * @returns {object} Index entry with precomputed search data
 */
function buildVoterIndex(voter) {
  const normalName = voter.nameBn ? normalizeForSearch(voter.nameBn).toLowerCase() : '';
  const normalFather = voter.fatherName ? normalizeForSearch(voter.fatherName).toLowerCase() : '';
  const normalMother = voter.motherName ? normalizeForSearch(voter.motherName).toLowerCase() : '';
  const normalVillage = voter.village ? normalizeForSearch(voter.village).toLowerCase() : '';
  const normalVoterArea = voter.voterArea ? normalizeForSearch(voter.voterArea).toLowerCase() : '';
  const normalUpazila = voter.upazila ? normalizeForSearch(voter.upazila).toLowerCase() : '';
  const normalDistrict = voter.district ? normalizeForSearch(voter.district).toLowerCase() : '';
  const normalOccupation = voter.occupation ? normalizeForSearch(voter.occupation).toLowerCase() : '';

  return {
    normalName,
    normalFather,
    normalMother,
    normalVillage,
    normalVoterArea,
    normalUpazila,
    normalDistrict,
    normalOccupation,
    // N-gram indexes for fuzzy matching
    nameNgrams: generateNgrams(normalName, 2),
    fatherNgrams: generateNgrams(normalFather, 2),
  };
}

/**
 * Multi-mode match function supporting exact, partial, phonetic, and fuzzy matching.
 *
 * @param {string} stored - Original stored Bengali text
 * @param {string} normalStored - Pre-computed phonetic skeleton
 * @param {Set<string>} storedNgrams - Pre-computed n-grams (optional)
 * @param {string} query - Raw search query
 * @param {string} normalQuery - Pre-computed phonetic skeleton of query
 * @param {Set<string>} queryNgrams - Pre-computed n-grams of query (optional)
 * @param {string} mode - Search mode: 'exact', 'partial', 'phonetic', 'fuzzy', 'all'
 * @returns {{ matched: boolean, score: number, method: string }}
 */
function multiModeMatch(stored, normalStored, storedNgrams, query, normalQuery, queryNgrams, mode = 'all') {
  if (!stored || !query) return { matched: false, score: 0, method: 'none' };

  // 1. Exact match
  if (mode === 'exact' || mode === 'all') {
    if (stored === query) return { matched: true, score: 1.0, method: 'exact' };
  }

  // 2. Partial / substring match
  if (mode === 'partial' || mode === 'all') {
    if (stored.includes(query)) return { matched: true, score: 0.95, method: 'partial' };
  }

  // 3. Phonetic skeleton match
  if (mode === 'phonetic' || mode === 'all') {
    if (normalQuery && normalStored && normalStored.includes(normalQuery)) {
      return { matched: true, score: 0.85, method: 'phonetic' };
    }
  }

  // 4. Multi-word phonetic match
  if (mode === 'phonetic' || mode === 'all') {
    const queryWords = (normalQuery || '').split(/\s+/).filter(w => w.length >= 2);
    if (queryWords.length > 1) {
      const allMatch = queryWords.every(word => normalStored && normalStored.includes(word));
      if (allMatch) return { matched: true, score: 0.80, method: 'phonetic_multiword' };
    }
  }

  // 5. N-gram fuzzy match
  if ((mode === 'fuzzy' || mode === 'all') && storedNgrams && queryNgrams) {
    const similarity = jaccardSimilarity(storedNgrams, queryNgrams);
    if (similarity >= 0.35) {
      return { matched: true, score: similarity, method: 'fuzzy_ngram' };
    }
  }

  return { matched: false, score: 0, method: 'none' };
}

/**
 * Quick check if a field matches a query (performance-optimized for filters).
 *
 * @param {string} stored - Stored field value
 * @param {string} normalStored - Phonetic skeleton
 * @param {string} query - Search query
 * @param {string} normalQuery - Phonetic query skeleton
 * @returns {boolean}
 */
function quickMatch(stored, normalStored, query, normalQuery) {
  if (!stored || !query) return false;
  if (stored.includes(query)) return true;
  if (normalQuery && normalStored && normalStored.includes(normalQuery)) return true;

  const queryWords = (normalQuery || '').split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length > 1) {
    return queryWords.every(word => normalStored && normalStored.includes(word));
  }

  return false;
}

module.exports = {
  buildVoterIndex,
  multiModeMatch,
  quickMatch,
  generateNgrams,
  jaccardSimilarity,
};
