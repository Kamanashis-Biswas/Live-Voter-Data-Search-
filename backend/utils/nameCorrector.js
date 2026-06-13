"use strict";

/**
 * @file nameCorrector.js
 * @description Comprehensive Bengali person name correction and validation engine.
 *
 * Uses fuzzy matching, phonetic comparison, and pattern recognition to correct
 * common Bengali names with spelling variations from EC PDFs.
 *
 * @version 6.0.0 — Expanded from 22 names to 300+ with comprehensive variants
 */

const {
  levenshteinDistance,
  calculateSimilarity,
  phoneticSimilarity,
} = require("./dictionaryCorrector");

/**
 * Common Bengali male first names and their variant spellings.
 */
const BENGALI_MALE_NAMES = {
  মোহাম্মদ: ["মহম্মদ", "মহামদ", "মোহামদ", "মুহাম্মদ", "মুহম্মদ", "মহনতদ", "মোহম্মদ", "মোহান্তাদ", "মুহান্তদ"],
  আব্দুল: ["আবদুল", "আব্দুর", "আব্দুস", "আল্পুল", "আল্পুর"],
  আব্দুর: ["আবদুর"],
  রহমান: ["রহমাণ", "রহমন"],
  হোসেন: ["হোসাইন", "হুসেন", "হসন", "হোসেইন", "হুসাইন"],
  করিম: ["করীম", "কারিম"],
  আলী: ["আলি", "আলি"],
  ইসলাম: ["ইশলাম", "ইসলাম"],
  কামাল: ["কামাল"],
  জালাল: ["জালিল", "জালাল"],
  নূর: ["নুর", "নূর"],
  সিরাজ: ["শিরাজ", "সেরাজ"],
  মঞ্জুর: ["মাঞ্জুর", "মঞ্জুর"],
  আহমদ: ["আহমেদ", "আহমদ"],
  শামসুল: ["শামশুল", "সামসুল"],
  আমিনুল: ["আমিনুল"],
  কামরুল: ["কামরুল"],
  শফিকুল: ["সফিকুল", "শফিকুল"],
  হাফিজুর: ["হাফেজুর", "হাফিজুর"],
  মনিরুল: ["মনিরুল"],
  আনোয়ার: ["আনোয়ার", "আনোয়র"],
  রফিকুল: ["রফিকুল"],
  শামসুদ্দিন: ["শামসুদ্দীন", "সামসুদ্দিন"],
  নূরুল: ["নুরুল"],
  ফজলুল: ["ফজলুল"],
  মোস্তফা: ["মোস্তাফা", "মুস্তফা", "মোস্তফা"],
  আক্তার: ["আকতর", "আক্তর", "আ্রার"],
  জাহাঙ্গীর: ["জাহাংগীর", "জাহাঙ্গির"],
  আলাউদ্দিন: ["আলাউদ্দীন"],
  নাসির: ["নাশির"],
  বাবুল: ["বাবুল"],
  হারুন: ["হারুন"],
  মকবুল: ["মকবুল"],
  শেখ: ["শখ"],
  খান: ["খান"],
  রাজু: ["রাজু"],
  সোহেল: ["সোহেল"],
  মাসুদ: ["মাশুদ"],
  ফারুক: ["ফারুক"],
  তারিকুল: ["তারিকুল"],
  আবুল: ["আবুল"],
  লিটন: ["লিটন"],
  জসিম: ["জসিম", "জশিম"],
  আজিজ: ["আজিজ"],
  হাসান: ["হাশান", "হাসন"],
  সাইফুল: ["সাইফুল"],
  রবিউল: ["রবিউল"],
  শহিদুল: ["সহিদুল"],
  আসাদুল: ["আশাদুল"],
  গোলাম: ["গোলাম"],
  দেলোয়ার: ["দেলোয়ার"],
  তোফায়েল: ["তোফায়েল"],
  জামাল: ["জামাল"],
  বদরুল: ["বদরুল"],
  আতিকুল: ["আতিকুল"],
  ইউসুফ: ["ইউসুফ"],
  ওমর: ["ওমর", "উমর"],
  ইব্রাহিম: ["ইব্রাহীম", "ইব্রাহিম", "ইত্নাহীম"],
  ইদ্রিস: ["ইদ্রিশ", "ইিসৈ"],
  প্রদীপ: ["জ্ঞদীপ", "প্রদিপ"],
  প্রকাশ: ["জ্ঞকাশ"],
  সুব্রত: ["সুত্নত"],
  বিপ্লব: ["বি্ছম", "বিল্পব"],
  অনুপম: ["অপম"],
  অমল: ["অমেল"],
  সন্তোষ: ["সেন্তাষ"],
  রসিক: ["রিশক"],
  বিনোদ: ["বিেনাদ"],
  নিত্যানন্দ: ["নিত্যানহ্ন"],
  সুধাংশু: ["সুধাং"],
  বঙ্কিম: ["বংি্ছম"],
  রসময়: ["রেসাময়"],
  সবিতা: ["সিবতা"],
  বিশ্বজিৎ: ["বিজ্ঞজিৎ"],
  উৎপল: ["উৎল"],
  পরিমল: ["পিরমল"],
  মনীষ: ["মিনষ"],
  অংশুমান: ["অংমান"],
  মৃদুল: ["মৃল"],
  সৈয়দ: ["সৗয়দ", "সৗয়দ", "সৈয়দ", "দ্ধসয়দ"],
  দেবেন্দ্র: ["দেবন্দ্র"],
  লক্ষ্মীকান্ত: ["লিক্ষকান্ত"],
  প্রদ্যুম্ন: ["জ্ঞমানহ্ন", "প্রদ্যুন্ম"],
  প্রভাকর: ["জ্ঞভাকর"],
  নগেন: ["ত্নজেন"],
  জ্ঞানদা: ["ৗানদা"],
  "তৈয়বুর": ["তৈয়েবুর", "দ্ধতয়বুর", "তৈয়েবুর"],
  "নির্মল": ["নিমলে"],
  "রাজ্জাক": ["রাওাক"],
  "মোমেন": [],
  "রুস্তম": ["রুস্টম", "রুস্টমআলী"],
  "আমজেদ": ["আমেজদ"],
  "ছলেমান": ["ছেলমান"],
  "মাজেদ": [],
  "মোদাচ্ছের": ["মোদোআর"],
  "রুহুল": ["রুশুল"],
  "আপ্তাব": ["আোাব"],
  "হুদা": ["শুদা"],
  "ছত্তার": ["ছদ্বার"],
  "শহিদ": ["সাহিদ"],
  "গনি": ["গিন"],
  "ইউনুছ": ["ইউছ"],
  "আহম্মদ": ["আহন্তদ"],
  "শুকুর": ["দুকুর"],
};

/**
 * Common Bengali female first names and their variants.
 */
const BENGALI_FEMALE_NAMES = {
  বেগম: ["বগম", "বিগম"],
  আয়েশা: ["আয়েশ", "আয়শা", "আয়েশা"],
  ফাতেমা: ["ফাতিমা", "ফাতমা"],
  মারিয়াম: ["মেরিয়াম", "মরিয়ম"],
  রোকেয়া: ["রোকেয়া"],
  জামিলা: ["জেমিলা"],
  সালমা: ["সালমা"],
  খাদিজা: ["খাদিজা", "খাদেজা"],
  সুফিয়া: ["সুফিয়া"],
  জাহানারা: ["জাহানারা"],
  হাসিনা: ["হাশিনা"],
  নাসরিন: ["নাসিরন", "নাশরিন"],
  শিরিন: ["শিরীন"],
  পারভীন: ["পারবিন", "পারভীন"],
  রহিমা: ["রহিমা"],
  কুলসুম: ["কুলসুম"],
  আমিনা: ["আমিনা"],
  "মোসাঃ": ["মোসাম্মৎ", "মোছাঃ"],
  রাবেয়া: ["রাবিয়া"],
  শাহিদা: ["সাহিদা"],
  রেহানা: ["রেহানা"],
  নূরজাহান: ["নুরজাহান", "রজাহান"],
  রুবিনা: ["রুবিনা"],
  সেলিনা: ["সেলিনা"],
  ফিরোজা: ["ফিরোজা"],
  জোবায়দা: ["জোবাইদা"],
  মোমেনা: ["মোমেনা"],
  আকলিমা: ["আকলিমা"],
  জরিনা: ["জরিনা"],
  আলেয়া: ["আলেয়া"],
  সাবিনা: ["সাবিনা"],
  মাজেদা: ["মাজেদা"],
  লাকী: ["লাকি"],
  রিনা: ["রিনা"],
  "রানী": ["রানি"],
  "নূরী": ["নুরী"],
  শাহানা: ["শাহানা"],
  "রত্না": ["রদা"],
  "রেকসোনা": ["রেকেসানা", "রেকছনা"],
  "আক্তারা": ["আ্রারা"],
  "মার্জিনা": ["মজিনো"],
  "আম্বিয়া": ["আণ্ডিয়া", "আম্বিয়া"],
  "রতনা": [],
  "আফরোজা": ["আফেরাজা"],
  "আনোয়ারা": [],
  "লিপিয়া": ["লিপয়া"],
  "নিজেলা": ["নিখিলা", "নজিলা"],
  "ভবিনি": ["ভাবিনী", "ভবিন"],
  "শুকতা": ["দুকতা"],
  "শেবিকা": ["সেবিকা", "শেিবকা"],
  "জামিনী": ["যামিনী"],
  "এলোকেশি": ["এলোকেশী", "এলোকেিশ"],
  "নিরু": [],
  "মুক্তা": ["মু্রা"],
  "শুকজান": ["দুকجان"],
  "মনোয়ারা": ["মেনায়ারা"],
  "শ্যামেলা": ["রামেলা"],
};

/**
 * Common Bengali surnames/family names and their variants.
 */
const BENGALI_SURNAMES = {
  হাওলাদার: ["হাওয়ালদার", "হাওলাদর"],
  মোল্লা: ["মল্লা", "মুল্লা", "মলদর"],
  শেখ: ["শখ"],
  খান: ["খান"],
  সরদার: ["সরদর"],
  দাস: ["দাস"],
  রায়: ["রায়"],
  পাল: ["পাল"],
  সিং: ["সিং"],
  চৌধুরী: ["চউধুরী", "চৌধরী"],
  মণ্ডল: ["মন্ডল"],
  "মলোংগী": ["মেলাংগী"],
  "মলঙ্গী": [],
  বর্মন: ["বর্ম"],
  গোস্বামী: ["গোস্বামী"],
  ভট্টাচার্য: ["ভট্টাচার্য", "ভট্টাচার্য্য"],
  রায়চৌধুরী: ["রায়চৌধুরী"],
  আকন্দ: ["আকন", "আকন্দ"],
  তালুকদার: ["তালুকদার"],
  মজুমদার: ["মজুমদর"],
  সরকার: ["সরকর"],
  হালদার: ["হালদর"],
  প্রামাণিক: ["প্রামানিক", "প্রামাণিক"],
  ভূঁইয়া: ["ভূইয়া", "ভুঁইয়া"],
  মিয়া: ["মিয়া"],
  বিশ্বাস: ["বিশ্বাশ"],
  আহমেদ: ["আহমদ", "আহমেদ"],
  বেপারী: ["বেপারি", "ব্যাপারী"],
  প্রধান: ["প্রধান"],
  নাথ: ["নাথ"],
  ঘোষ: ["ঘোষ"],
  চক্রবর্তী: ["চক্রবর্তি"],
  দেবনাথ: ["দেবনাথ"],
  মিত্র: ["মিত্র"],
  সাহা: ["শাহা"],
  পোদ্দার: ["পোদ্দর"],
  কুণ্ডু: ["কুন্ডু"],
  সেন: ["সেন"],
  বসু: ["বশু"],
  দত্ত: ["দত্ত"],
  বৈদ্য: ["বৈদ্য"],
  কর: ["কর"],
  দে: ["দে"],
  গুহ: ["গুহ"],
  নন্দী: ["নন্দি"],
  ব্যানার্জী: ["ব্যানার্জি", "বানার্জী"],
  চ্যাটার্জী: ["চ্যাটার্জি", "চট্টোপাধ্যায়"],
  মুখার্জী: ["মুখার্জি", "মুখোপাধ্যায়"],
};

// Merge all name maps
const BENGALI_FIRST_NAMES = { ...BENGALI_MALE_NAMES, ...BENGALI_FEMALE_NAMES };

/**
 * Build canonical name map from variations.
 *
 * @param {object} nameList - Object of canonical → variants[]
 * @returns {object} Map of variant → canonical name
 */
function buildCanonicalMap(nameList) {
  const map = {};

  for (const [canonical, variants] of Object.entries(nameList)) {
    map[canonical] = canonical;

    if (Array.isArray(variants)) {
      for (const variant of variants) {
        if (variant !== canonical) {
          map[variant] = canonical;
        }
      }
    }
  }

  return map;
}

/**
 * Validate if text is likely a name.
 * Names should be short (1-5 words) and contain mostly consonants/vowels.
 *
 * @param {string} text - Text to validate
 * @returns {boolean} True if likely a name
 */
function isLikelyName(text) {
  if (!text || text.length === 0) return false;

  const words = text.trim().split(/\s+/);

  // Name typically 1-5 words
  if (words.length > 5) return false;

  // Each word typically 2-20 characters
  for (const word of words) {
    if (word.length < 2 || word.length > 20) return false;
  }

  // Should contain mostly Bengali characters
  const bengaliChars = (text.match(/[\u0980-\u09FF]/g) || []).length;
  const otherChars = text.length - bengaliChars;

  if (bengaliChars === 0) return false;
  if (otherChars / text.length > 0.2) return false;

  return true;
}

/**
 * Correct a single name word using fuzzy matching against known names.
 *
 * @param {string} nameWord - Single word to correct
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {object} Correction result
 */
function correctNameWord(nameWord, threshold = 0.70) {
  const firstNameMap = buildCanonicalMap(BENGALI_FIRST_NAMES);
  const surnameMap = buildCanonicalMap(BENGALI_SURNAMES);
  const combined = { ...firstNameMap, ...surnameMap };

  // Check for exact variant match first
  if (combined[nameWord]) {
    return {
      original: nameWord,
      corrected: combined[nameWord],
      method: "EXACT_MATCH",
      confidence: 1.0,
    };
  }

  // Fuzzy matching against all canonical names
  let bestMatch = null;
  let bestScore = threshold;

  const allCanonicalNames = new Set([
    ...Object.keys(BENGALI_FIRST_NAMES),
    ...Object.keys(BENGALI_SURNAMES),
  ]);

  for (const canonical of allCanonicalNames) {
    // Try direct similarity
    const similarity = calculateSimilarity(nameWord, canonical);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = {
        canonical,
        similarity,
        method: 'LEVENSHTEIN',
      };
    }

    // Try phonetic similarity
    const phonetic = phoneticSimilarity(nameWord, canonical);
    if (phonetic > bestScore + 0.05) { // Phonetic needs to be significantly better
      bestScore = phonetic;
      bestMatch = {
        canonical,
        similarity: phonetic,
        method: 'PHONETIC',
      };
    }
  }

  if (bestMatch) {
    return {
      original: nameWord,
      corrected: bestMatch.canonical,
      method: "FUZZY_MATCH",
      confidence: bestMatch.similarity,
    };
  }

  return {
    original: nameWord,
    corrected: nameWord,
    method: "NO_MATCH",
    confidence: 0,
  };
}

/**
 * Correct a full name (multiple words) by correcting each word independently.
 *
 * @param {string} name - Full name to correct
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {object} Correction result
 */
function correctName(name, threshold = 0.70) {
  if (!isLikelyName(name)) {
    return {
      original: name,
      corrected: name,
      method: "NOT_A_NAME",
      confidence: 0,
    };
  }

  const words = name.trim().split(/\s+/);
  const correctedWords = [];
  const corrections = [];
  let totalConfidence = 0;
  let correctionCount = 0;

  for (const word of words) {
    const result = correctNameWord(word, threshold);
    correctedWords.push(result.corrected);
    
    if (result.method !== "NO_MATCH") {
      totalConfidence += result.confidence;
      correctionCount++;
    }
    
    if (result.original !== result.corrected) {
      corrections.push({
        from: result.original,
        to: result.corrected,
        method: result.method,
        confidence: result.confidence,
      });
    }
  }

  const avgConfidence = correctionCount > 0 ? totalConfidence / correctionCount : 0;

  return {
    original: name,
    corrected: correctedWords.join(' '),
    method: corrections.length > 0 ? "WORD_BY_WORD" : "NO_MATCH",
    confidence: avgConfidence,
    corrections,
  };
}

/**
 * Correct multiple names (e.g., person, father, mother).
 *
 * @param {object} names - Object with name fields
 * @param {object} options - Correction options
 * @returns {object} Corrected names with details
 */
function correctPersonNames(names, options = {}) {
  const threshold = options.threshold || 0.70;
  const result = {
    original: { ...names },
    corrected: {},
    corrections: [],
  };

  for (const [key, value] of Object.entries(names)) {
    if (!value || typeof value !== "string") {
      result.corrected[key] = value;
      continue;
    }

    const correction = correctName(value, threshold);
    result.corrected[key] = correction.corrected;

    if (correction.corrections && correction.corrections.length > 0) {
      result.corrections.push({
        field: key,
        from: correction.original,
        to: correction.corrected,
        wordCorrections: correction.corrections,
      });
    }
  }

  return result;
}

/**
 * Split full name into first name and surname.
 * Heuristic: last word is surname.
 *
 * @param {string} fullName - Full name to split
 * @returns {object} Parsed name components
 */
function parseFullName(fullName) {
  if (!fullName || typeof fullName !== "string") {
    return { firstName: "", surname: "", fullName: "" };
  }

  const parts = fullName.trim().split(/\s+/);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      surname: "",
      fullName,
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    surname: parts[parts.length - 1],
    fullName,
  };
}

/**
 * Format corrected name back to string.
 *
 * @param {object} parsed - Parsed name components
 * @returns {string} Formatted name
 */
function formatName(parsed) {
  const parts = [];
  if (parsed.firstName) parts.push(parsed.firstName);
  if (parsed.surname) parts.push(parsed.surname);
  return parts.join(" ");
}

/**
 * Get name statistics and insights.
 *
 * @returns {object} Statistics
 */
function getNameStats() {
  return {
    maleNamesCount: Object.keys(BENGALI_MALE_NAMES).length,
    femaleNamesCount: Object.keys(BENGALI_FEMALE_NAMES).length,
    surnamesCount: Object.keys(BENGALI_SURNAMES).length,
    totalNamesCount: Object.keys(BENGALI_FIRST_NAMES).length + Object.keys(BENGALI_SURNAMES).length,
  };
}

/**
 * Validate person name structure (has first name and surname).
 *
 * @param {object} person - Person object with name fields
 * @returns {object} Validation result
 */
function validatePersonNameStructure(person) {
  const errors = [];
  const warnings = [];

  if (!person.name || person.name.trim().length === 0) {
    errors.push("Missing person name");
  }

  if (!person.fatherName || person.fatherName.trim().length === 0) {
    warnings.push("Missing father name");
  }

  if (!person.motherName || person.motherName.trim().length === 0) {
    warnings.push("Missing mother name");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

module.exports = {
  correctName,
  correctNameWord,
  correctPersonNames,
  parseFullName,
  formatName,
  isLikelyName,
  getNameStats,
  validatePersonNameStructure,
  BENGALI_FIRST_NAMES,
  BENGALI_MALE_NAMES,
  BENGALI_FEMALE_NAMES,
  BENGALI_SURNAMES,
};
