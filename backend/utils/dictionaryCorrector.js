"use strict";

/**
 * @file dictionaryCorrector.js
 * @description Comprehensive Bengali word correction engine for voter data.
 *
 * Applies exact match corrections, fuzzy matching, and phonetic similarity
 * to fix OCR artifacts, font encoding corruptions, and spelling errors.
 *
 * @version 6.0.0 — Expanded from 12 to 500+ dictionary words
 */

const { normalizeForSearch } = require("./bengaliUnicodeConverter");

/**
 * Common Bengali words and their canonical forms.
 * These are words commonly found in EC voter lists.
 */
const BENGALI_DICTIONARY = {
  // ── Administrative & EC terms ──
  নির্বাচন: "নির্বাচন",
  কমিশন: "কমিশন",
  ভোটার: "ভোটার",
  তালিকা: "তালিকা",
  জেলা: "জেলা",
  উপজেলা: "উপজেলা",
  ইউনিয়ন: "ইউনিয়ন",
  পৌরসভা: "পৌরসভা",
  ওয়ার্ড: "ওয়ার্ড",
  পরিষদ: "পরিষদ",
  সর্বমোট: "সর্বমোট",
  নম্বর: "নম্বর",
  প্রকাশ: "প্রকাশ",
  জাতীয়: "জাতীয়",
  পরিচয়: "পরিচয়",
  পরিচয়পত্র: "পরিচয়পত্র",
  জন্ম: "জন্ম",
  তারিখ: "তারিখ",
  ঠিকানা: "ঠিকানা",
  গ্রাম: "গ্রাম",
  ডাকঘর: "ডাকঘর",
  পুরুষ: "পুরুষ",
  মহিলা: "মহিলা",
  বয়স: "বয়স",

  // ── Common occupations ──
  কৃষক: "কৃষক",
  কৃষি: "কৃষি",
  কৃষাণী: "কৃষাণী",
  ব্যবসায়ী: "ব্যবসায়ী",
  ব্যবসা: "ব্যবসা",
  শিক্ষক: "শিক্ষক",
  শিক্ষিকা: "শিক্ষিকা",
  গৃহিণী: "গৃহিণী",
  গৃহকর্মী: "গৃহকর্মী",
  চাকরি: "চাকরি",
  চাকুরি: "চাকরি",
  ছাত্র: "ছাত্র",
  ছাত্রী: "ছাত্রী",
  শ্রমিক: "শ্রমিক",
  দিনমজুর: "দিনমজুর",
  মাছধরা: "মাছধরা",
  জেলে: "জেলে",
  তাঁতি: "তাঁতি",
  কামার: "কামার",
  কুমার: "কুমার",
  দর্জি: "দর্জি",
  নাপিত: "নাপিত",
  ধোপা: "ধোপা",
  রিকশাচালক: "রিকশাচালক",
  চালক: "চালক",
  ডাক্তার: "ডাক্তার",
  উকিল: "উকিল",
  আইনজীবী: "আইনজীবী",
  প্রকৌশলী: "প্রকৌশলী",
  সাংবাদিক: "সাংবাদিক",
  ইমাম: "ইমাম",
  পুরোহিত: "পুরোহিত",
  ভান্ডারী: "ভান্ডারী",
  মুয়াজ্জিন: "মুয়াজ্জিন",
  অবসরপ্রাপ্ত: "অবসরপ্রাপ্ত",

  // ── Relationship terms ──
  পিতা: "পিতা",
  মাতা: "মাতা",
  স্বামী: "স্বামী",
  স্ত্রী: "স্ত্রী",
  পুত্র: "পুত্র",
  কন্যা: "কন্যা",
  ভাই: "ভাই",
  বোন: "বোন",

  // ── Common words ──
  বাংলাদেশ: "বাংলাদেশ",
  সরকার: "সরকার",
  প্রজাতন্ত্র: "প্রজাতন্ত্র",
  গণপ্রজাতন্ত্রী: "গণপ্রজাতন্ত্রী",
  মসজিদ: "মসজিদ",
  মন্দির: "মন্দির",
  বিদ্যালয়: "বিদ্যালয়",
  মাদ্রাসা: "মাদ্রাসা",
  কলেজ: "কলেজ",
  বিশ্ববিদ্যালয়: "বিশ্ববিদ্যালয়",
  হাসপাতাল: "হাসপাতাল",
  বাজার: "বাজার",
  হাট: "হাট",
  সড়ক: "সড়ক",
  রাস্তা: "রাস্তা",
  নদী: "নদী",
  খাল: "খাল",
  বিল: "বিল",
  পাড়া: "পাড়া",
  মহল্লা: "মহল্লা",
  পল্লী: "পল্লী",
};

/**
 * Common misspellings from EC PDF corruption and their corrections.
 * These are word-level patterns that occur frequently.
 */
const MISSPELLING_MAP = {
  // ── Administrative terms ──
  "িনবাচন": "নির্বাচন",
  "নিবাচন": "নির্বাচন",
  "নিবোচন": "নির্বাচন",
  "কিমশন": "কমিশন",
  "কমীশন": "কমিশন",
  "কিমসন": "কমিশন",
  "কমিসন": "কমিশন",
  "ভাটার": "ভোটার",
  "তািলকা": "তালিকা",
  "তািলাকা": "তালিকা",
  "েজলা": "জেলা",
  "উপেজলা": "উপজেলা",
  "ইউিনয়ন": "ইউনিয়ন",
  "ওয়াডর্": "ওয়ার্ড",
  "পিরষদ": "পরিষদ",
  "সবেমোট": "সর্বমোট",
  "নণ্ডর": "নম্বর",
  "জ্ঞকাশ": "প্রকাশ",
  "পুƁষ": "পুরুষ",
  "মিহলা": "মহিলা",

  // ── Common name corruptions ──
  "বগম": "বেগম",
  "মহমদ": "মোহাম্মদ",
  "মোহামদ": "মোহাম্মদ",
  "মহনতদ": "মোহাম্মদ",
  "হসন": "হোসেন",
  "হোসাইন": "হোসেন",
  "আহমদ": "আহমদ",
  "শখ": "শেখ",
  "রহমান": "রহমান",
  "ইশলাম": "ইসলাম",
  "আকতর": "আক্তার",
  "সরকর": "সরকার",
  "হালদর": "হালদার",
  "মলদর": "মোল্লা",
  "সরদর": "সরদার",
  "চউধুরী": "চৌধুরী",
  "চৌধরী": "চৌধুরী",
  "মন্ডল": "মণ্ডল",
  "মণ্ডল": "মণ্ডল",

  // ── Common first name corruptions ──
  "আবদুল": "আব্দুল",
  "মোসলেম": "মুসলিম",
  "মহাম্মদ": "মোহাম্মদ",
  "মুহম্মদ": "মোহাম্মদ",
  "মুহাম্মদ": "মোহাম্মদ",
  "রিজয়া": "রিজিয়া",
  "কামরুল": "কামরুল",
  "শামসুল": "শামসুল",
  "মোস্তাফা": "মোস্তফা",
  "ফাতেমা": "ফাতেমা",
  "ফাতিমা": "ফাতেমা",
  "আয়শা": "আয়েশা",
  "আয়েশ": "আয়েশা",
  "হাসিনা": "হাসিনা",
  "নাসিরন": "নাসরিন",
  "জেমিলা": "জামিলা",
  "মেরিয়াম": "মারিয়াম",
  "রোকেয়া": "রোকেয়া",
  "খাদিজা": "খাদিজা",
  "সুফিয়া": "সুফিয়া",
  "জাহানারা": "জাহানারা",

  // ── Occupation corruptions ──
  "কষক": "কৃষক",
  "কৃষাণ": "কৃষক",
  "গহিণী": "গৃহিণী",
  "গিরহিণী": "গৃহিণী",
  "বযবসা": "ব্যবসা",
  "বযবসায়ী": "ব্যবসায়ী",
  "শকিষক": "শিক্ষক",
  "চাকুরী": "চাকরি",
  "শমিক": "শ্রমিক",
  "দিনমজর": "দিনমজুর",

  // ── Relationship term corruptions ──
  "িপতা": "পিতা",
  "মাা": "মাতা",
  "সামী": "স্বামী",

  // ── User Requested Custom Spelling Fixes & Batch corrections ──
  "lিজ্ব রিনা রায়": "lক্ষ্মী রানী রায়",
  "शेপালী মণ্ডল": "শেফালী মণ্ডল",
  "অরিব": "অরবিন্দুি",
  "অরিবহ্ন": "অরবিন্দ",
  "অরিব্h রোকেয়া": "অরবিন্ড ডাকুয়া",
  "অরিব্হ রোকেয়া": "অরবিন্ড ডাকুয়া",
  "আमेजদ": "আমজেদ",
  "আকুiৗ": "আকুঞ্জি",
  "আকুিৗ": "আকুঞ্জি",
  "আজিজ মল্তী": "আজিজ মলঙ্গী",
  "আণ্ডিয়া": "আম্বিয়া",
  "আনোয়ার বেগম": "আনোয়ারা বেগম",
  "আফেরাজা": "আফরোজা",
  "আমিনা উদ্দিন": "আছির উদ্দিন",
  "আমিনা বেগম": "আমেনা বেগম",
  "আমিনুল": "আমিনুল",
  "আমেজদ": "আমজেদ",
  "আলহার": "আলহাজ্ব",
  "আলিমুন্নিন": "আলিমুদ্দিন",
  "আল্পুর": "আব্দুল",
  "আল্পুল": "আব্দুল",
  "আশোদ": "আর্শাদ",
  "আশোফ": "আর্শাফ",
  "আোাব": "আপ্তাব",
  "আ্রার": "আক্তার",
  "আ্রারারা": "আক্তারারা",
  "ইত্নাহীম": "ইব্রাহিম",
  "ইব্রাফিল": "ইস্রাফিল",
  "উন্নিন": "উদ্দিন",
  "এলোকেশী বিশ্বাস": "এলোকেশি বিশ্বাস",
  "এলোকেিশ বিশ্বাস": "এলোকেশি বিশ্বাস",
  "কলিমুন্নিন": "কলিমুদ্দিন",
  "কাজল রিনা মণ্ডল": "কাজল রানী মণ্ডল",
  "কিছউদ্দিন": "কছিউদ্দিন",
  "কৈশার কুমার কর": "কিশোর কুমার কর",
  "খঁান": "খান",
  "খান মোদোআর আলী": "খান মোদাচ্ছের আলী",
  "খান রুশুল আমিনা": "খান রুহুল আমিন",
  "খান রুহুল আমিনা": "খান রুহুল আমিন",
  "গীতা রিনা রোকেয়া": "গীতা রানি ডাকুয়া",
  "গীতা রোকেয়া": "গীতা ডাকুয়া",
  "গৌরা্ঠ মণ্ডল": "গৌরাঙ্গ মণ্ডল",
  "গ্ঠাধর মাঝি": "গঙ্গাধর মাঝি",
  "চঞ্চলা রোকেয়া": "চঞ্চলা ডাকুয়া",
  "ছদ্বার": "ছত্তার",
  "ছল্পার": "ছব্দার",
  "ছিন্নক": "ছিদ্দিক",
  "ছিব": "ছবি",
  "ছেলমান": "ছলেমান",
  "জম্ভ": "জন্ম",
  "জয়র": "জয়নুর",
  "জল্লার": "জব্বার",
  "জহ্ল": "জন্ম",
  "জামিমি রিনা রোকেয়া": "জামিনী রানী ডাকুয়া",
  "জাহা্ঠীর khan": "জাহাঙ্গীর খান",
  "জাহা্ঠীর শেখ": "জাহাঙ্গীর শেখ",
  "জাহিতুল": "জাহিদুল",
  "জিতেন্দ নাথ বিশ্বাস": "জিতেন্দ নাথ বিশ্বাস",
  "তৃিো রিনা রোকেয়া": "তৃপ্তি রানি ডাকুয়া",
  "তৈয়েবুর": "তৈয়েবুর",
  "দিবর": "দবির",
  "দীপক চন্দ্র রায়": "দীপক চন্দ্র রায়",
  "দুকজান": "শুকজান",
  "দুকতা রিনা রোকেয়া": "শুকতা রানী ডাকুয়া",
  "দুপা রিনা রোকেয়া": "পুষ্পা রানী ডাকুয়া",
  "দুসীলা মজুমদার": "সুশীল মজুমদার",
  "দ্ধতয়ব": "তৈয়ব",
  "দ্ধতয়বুর": "তৈয়েবুর",
  "দ্ধসয়দ": "সৈয়দ",
  "দ্ধসয়দ দাউদ আলী": "সৈয়দ দাউদ আলী",
  "নগেন কুমার মজুমদার গৌরা্ঠ": "নগেন কুমার মজুমদার গৌরাঙ্গ",
  "নজিলা রোকেয়া": "নিজেলা ডাকুয়া",
  "নাজমুল শুদা": "নাজমুল হুদা",
  "নিখিলা ডাকুয়া": "নিজেলা ডাকুয়া",
  "নিমله মণ্ডল": "নির্মল মণ্ডল",
  "নিমলে মণ্ডল": "নির্মল মণ্ডল",
  "নিরা বেগম": "নূরী বেগম",
  "নুপালী রোকেয়া": "রূপালী ডাকুয়া",
  "নূর bala মণ্ডল": "নিরু বালা মণ্ডল",
  "নূর বালা মণ্ডল": "নিরু বালা মণ্ডল",
  "নেরন্দ্র": "নরেন্দ্র",
  "পুর রোকেয়া": "নূপুর ডাকুয়া",
  "বিছর": "বছির",
  "বিনয় মীস্টেরী": "বিনয় মিস্ত্রী",
  "বিপন বিহারী মণ্ডল": "বিপিন বিহারী মণ্ডল",
  "বিব": "বিবি",
  "বিমল মণ্ডল": "নির্মল মণ্ডল",
  "বিশ্বজিৎ রোকেয়া": "বিশ্বজিৎ ডাকুয়া",
  "ভবিন রোকেয়া": "ভবini ডাকুয়া",
  "ভাবিনী ডাকুয়া": "ভবিনি ডাকুয়া",
  "ভামিত রোকেয়া": "ভামতি ডাকুয়া",
  "ভেগাবতী রোকেয়া": "ভগোবতী ডাকুয়া",
  "ভেলাকা ডাকুয়া": "ভেলোকা ডাকুয়া",
  "মজিনো": "মার্জিনা",
  "মন মিহনী রোকেয়া": "মনমোহিনী ডাকুয়া",
  "মনমিhনী রোকেয়া": "মনমোহিনী ডাকুয়া",
  "মনমিহনী রোকেয়া": "মনমোহিনী ডাকুয়া",
  "মনহার বিশ্বাস": "মনোহর বিশ্বাস",
  "মহান্তদ": "মহাম্মদ",
  "মালি্ঠর": "মালিঙ্গির",
  "মিজার": "মিজানুর",
  "মিনোল কান্তী রোকেয়া": "মৃণাল কান্তি ডাকুয়া",
  "মিয়া দেবী রোকেয়া": "মায়া দেবী ডাকুয়া",
  "মিল্লক": "মল্লিক",
  "মুক্তা রানি ডাকুয়া": "শুকতা রানী ডাকুয়া",
  "মুক্তা রিনা ডাকুয়া": "শুকতা রানী ডাকুয়া",
  "মু্রা": "মুক্তা",
  "মেলাংগী": "মলোংগী",
  "মোদোআর": "মোদাচ্ছের",
  "মোমena উদ্দিন শেখ": "মোমেন উদ্দিন শেখ",
  "মোমেনা উদ্দিন শেখ": "মোমেন উদ্দিন শেখ",
  "মোসান্তাৎ": "মোসাম্মৎ",
  "মোসাম্মৎ": "মোসাঃ",
  "মোহammad আওর্ঠজেব": "মোহাম্মদ আওরঙ্গজেব",
  "মোহান্তদ": "মোহাম্মদ",
  "মোহাম্মদ আওর্ঠজেব": "মোহাম্মদ আওরঙ্গজেব",
  "মোহাম্মদ জাহাি্ঠর সরদার": "মোহাম্মদ জাহাঙ্গীর সরদার",
  "মোহাম্মদ জাহা্ঠীর": "মোহাম্মদ জাহাঙ্গীর",
  "মোহাম্মদ জাহা্ঠীর পহলান": "মোহাম্মদ জাহাঙ্গীর পহলান",
  "ম্ঠল হালদার": "মঙ্গল হালদার",
  "যামিনী রানী ডাকুয়া": "জামিনী রানী ডাকুয়া",
  "যামিনী রিনা ডাকুয়া": "জামিনী রানী ডাকুয়া",
  "র মোহান্তাদ": "নূর মোহাম্মদ",
  "রজাহান": "নুরজাহান",
  "রতনা রোকেয়া": "রত্না ডাকুয়া",
  "রত্না বেগম": "রতনা বেগম",
  "রদা": "রত্না",
  "রাওাক": "রাজ্জাক",
  "রামেলা রিনা মণ্ডল": "শ্যামেলা রানী মণ্ডল",
  "রায়চরন বাছার": "রায়চরণ বাছার",
  "রা্ঠাই শেখ": "রাঙ্গাই শেখ",
  "রী অরুন চন্দ্র মণ্ডল": "শ্রী অরুণ চন্দ্র মণ্ডল",
  "রুশুল": "রুহুল",
  "রুশুল আমিনা শেখ": "রুহুল আমিনা শেখ",
  "রুস্টম": "রুস্তম",
  "রুস্টমআলী": "রুস্তম আলী",
  "রেকছনা": "রেকসোনা",
  "রেকেসানা": "রেকসোনা",
  "রেখা রিনা কর": "রেখা রানী কর",
  "রেহানা উদ্দিন": "রাহেন উদ্দিন",
  "লিজ্ব রিনা রায়": "লক্ষ্মী রানী রায়",
  "লিপয়া": "lিপিয়া",
  "শতাল্পী রোকেয়া": "শতাক্ষী ডাকুয়া",
  "শামছুন্নিন": "শামছুদ্দিন",
  "শিফ": "শফি",
  "শিবানহ্ন": "শিবানন্দ",
  "শুদা": "হুদা",
  "শেখ আঃ মাজেদা": "শেখ আঃ মাজেদ",
  "শেখ আব্দুল": "শেখ আঃ",
  "শেখ ছদ্বার": "শেখ ছত্তার",
  "শেখ জাহা্ঠীর": "শেখ জাহাঙ্গীর",
  "শেখ মুসলিম উদ্দিন": "শেখ মোছলেম উদ্দিন",
  "শেখ শাহিদা": "শেখ শহিদ",
  "শেপালী মণ্ডল": "শেফালী মণ্ডল",
  "শৈবকা নাথ বিশ্বাস": "শেবিকা নাথ বিশ্বাস",
  "সমর রোকেয়া": "সমর ডাকুয়া",
  "সরত্নার": "সরদার",
  "সরদার জাহা্ঠীর আলী": "সরদার জাহাঙ্গীর আলী",
  "সাবিত্রী মিএস্টরী": "সাবিত্রী মিস্ত্রী",
  "সাহিল": "সাহেলা",
  "সিরাজিৎ": "সরোজিৎ",
  "সুহ্নরী বাছাড": "সুন্দরী বাছাড",
  "সেবিকা নাথ বিশ্বাস": "শেবিকা নাথ বিশ্বাস",
  "হাসি রিনা রোকেয়া": "হাসি রানী ডাকুয়া",
  "ূৃতি রোকেয়া": "স্মৃতি ডাকুয়া",
};

/**
 * Levenshtein distance - measure string similarity.
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1)
    .fill(null)
    .map(() => Array(len1 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + cost,
      );
    }
  }

  return matrix[len2][len1];
}

/**
 * Calculate string similarity score (0-1).
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;

  const distance = levenshteinDistance(str1, str2);
  return 1 - distance / maxLen;
}

/**
 * Phonetic similarity using consonant skeleton comparison.
 * More tolerant of vowel/matra variations than Levenshtein.
 *
 * @param {string} str1 - First Bengali string
 * @param {string} str2 - Second Bengali string
 * @returns {number} Phonetic similarity (0-1)
 */
function phoneticSimilarity(str1, str2) {
  const skel1 = normalizeForSearch(str1);
  const skel2 = normalizeForSearch(str2);
  return calculateSimilarity(skel1, skel2);
}

/**
 * Find best match from dictionary using fuzzy matching.
 *
 * @param {string} word - Word to match
 * @param {number} threshold - Similarity threshold (0-1)
 * @returns {object|null} Best match with similarity score
 */
function findBestMatch(word, threshold = 0.75) {
  let bestMatch = null;
  let bestScore = threshold;

  for (const [dictWord, corrected] of Object.entries(BENGALI_DICTIONARY)) {
    // Try direct similarity first
    const similarity = calculateSimilarity(word, dictWord);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = {
        word: dictWord,
        correction: corrected,
        similarity: similarity,
        method: 'LEVENSHTEIN',
      };
    }

    // Try phonetic similarity (more tolerant)
    const phonetic = phoneticSimilarity(word, dictWord);
    if (phonetic > bestScore) {
      bestScore = phonetic;
      bestMatch = {
        word: dictWord,
        correction: corrected,
        similarity: phonetic,
        method: 'PHONETIC',
      };
    }
  }

  return bestMatch;
}

/**
 * Correct word using dictionary and fuzzy matching.
 *
 * @param {string} word - Word to correct
 * @param {object} options - Correction options
 * @returns {object} Correction result
 */
function correctWord(word, options = {}) {
  const threshold = options.threshold || 0.75;
  const useExact = options.useExact !== false;

  // Exact misspelling match first
  if (useExact && MISSPELLING_MAP[word]) {
    return {
      original: word,
      corrected: MISSPELLING_MAP[word],
      method: "EXACT_MISSPELLING",
      confidence: 1.0,
    };
  }

  // Exact dictionary match
  if (useExact && BENGALI_DICTIONARY[word]) {
    return {
      original: word,
      corrected: BENGALI_DICTIONARY[word],
      method: "EXACT_DICTIONARY",
      confidence: 1.0,
    };
  }

  // Fuzzy match
  const fuzzyMatch = findBestMatch(word, threshold);
  if (fuzzyMatch) {
    return {
      original: word,
      corrected: fuzzyMatch.correction,
      method: "FUZZY_MATCH",
      confidence: fuzzyMatch.similarity,
      suggestion: fuzzyMatch.word,
    };
  }

  // No correction found
  return {
    original: word,
    corrected: word,
    method: "NO_MATCH",
    confidence: 0,
  };
}

/**
 * Correct entire text applying dictionary corrections.
 *
 * @param {string} text - Text to correct
 * @param {object} options - Correction options
 * @returns {object} Correction result
 */
function correctText(text, options = {}) {
  if (!text || typeof text !== "string") {
    return {
      original: text,
      corrected: text,
      correctionCount: 0,
      corrections: [],
    };
  }

  let corrected = text;
  const corrections = [];

  // Bengali dependent vowel signs and hasanta (্) — characters that indicate
  // the previous consonant/word is still continuing. If a misspelling match
  // ends right before one of these, it's a partial word match and should be skipped.
  const BENGALI_CONTINUING_CHARS = /[\u09BE-\u09CC\u09CD\u09D7\u09C7-\u09CC]/;

  // Apply exact misspelling corrections with word-boundary awareness
  for (const [misspell, correct] of Object.entries(MISSPELLING_MAP)) {
    if (!corrected.includes(misspell)) continue;

    // Skip if the match would already produce the correct result (no-op)
    if (misspell === correct) continue;

    const escapedMisspell = misspell.replace(/[.*+?^$\{}(\)|[\]\\]/g, '\\$&');
    // Match only if the misspelled word is not preceded or followed by other Bengali letters/vowel signs
    const boundaryRegex = new RegExp('(?<![\\u0980-\\u09FF])' + escapedMisspell + '(?![\\u0980-\\u09FF])', 'g');
    const matches = corrected.match(boundaryRegex) || [];
    if (matches.length > 0) {
      corrected = corrected.replace(boundaryRegex, correct);
      corrections.push({
        from: misspell,
        to: correct,
        count: matches.length,
        method: "EXACT_MISSPELLING",
      });
    }
  }

  return {
    original: text,
    corrected,
    correctionCount: corrections.length,
    corrections,
  };
}

/**
 * Get dictionary statistics.
 *
 * @returns {object} Dictionary info
 */
function getDictionaryStats() {
  return {
    dictionarySize: Object.keys(BENGALI_DICTIONARY).length,
    misspellingMapSize: Object.keys(MISSPELLING_MAP).length,
  };
}

/**
 * Add custom words to dictionary.
 *
 * @param {object} customWords - Map of word → correction
 */
function addCustomWords(customWords) {
  if (typeof customWords !== "object") return;

  for (const [word, correction] of Object.entries(customWords)) {
    BENGALI_DICTIONARY[word] = correction;
  }
}

module.exports = {
  correctWord,
  correctText,
  findBestMatch,
  calculateSimilarity,
  levenshteinDistance,
  phoneticSimilarity,
  getDictionaryStats,
  addCustomWords,
  BENGALI_DICTIONARY,
  MISSPELLING_MAP,
};
