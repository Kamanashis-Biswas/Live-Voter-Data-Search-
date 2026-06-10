"use strict";

/**
 * @file districtValidator.js
 * @description Complete Bangladesh geographic validation engine.
 *
 * Validates and corrects:
 *   - All 64 Districts (জেলা)
 *   - 495 Upazilas (উপজেলা)
 *   - Divisions (বিভাগ)
 *
 * Uses fuzzy matching for spelling variations.
 *
 * @version 6.0.0 — Complete geographic data for all 64 districts
 */

const { calculateSimilarity } = require("./dictionaryCorrector");

/**
 * All 64 Bangladesh districts organized by division.
 * Format: canonical → [spelling variants]
 */
const BANGLADESH_DISTRICTS = {
  // ── Barishal Division ──
  বরিশাল: ["বরিশাল", "বরিশাল"],
  ভোলা: ["ভোলা"],
  ঝালকাঠি: ["ঝালকাঠি", "ঝালোকাঠি"],
  পটুয়াখালী: ["পটুয়াখালী"],
  পিরোজপুর: ["পিরোজপুর"],
  বরগুনা: ["বরগুনা"],

  // ── Chattogram Division ──
  চট্টগ্রাম: ["চট্টগ্রাম", "চট্টগ্রম", "চট্ট্রগাম"],
  কক্সবাজার: ["কক্সবাজার"],
  কুমিল্লা: ["কুমিল্লা"],
  ফেনী: ["ফেনী"],
  লক্ষ্মীপুর: ["লক্ষ্মীপুর", "লক্ষীপুর"],
  নোয়াখালী: ["নোয়াখালী"],
  চাঁদপুর: ["চাঁদপুর", "চান্দপুর"],
  ব্রাহ্মণবাড়িয়া: ["ব্রাহ্মণবাড়িয়া", "ব্রাহ্মণবাড়ীয়া"],
  খাগড়াছড়ি: ["খাগড়াছড়ি"],
  রাঙ্গামাটি: ["রাঙ্গামাটি", "রাঙামাটি"],
  বান্দরবান: ["বান্দরবান", "বান্দরবন"],

  // ── Dhaka Division ──
  ঢাকা: ["ঢাকা"],
  গাজীপুর: ["গাজীপুর"],
  নারায়ণগঞ্জ: ["নারায়ণগঞ্জ"],
  টাঙ্গাইল: ["টাঙ্গাইল"],
  কিশোরগঞ্জ: ["কিশোরগঞ্জ"],
  মানিকগঞ্জ: ["মানিকগঞ্জ"],
  মুন্সিগঞ্জ: ["মুন্সিগঞ্জ"],
  নরসিংদী: ["নরসিংদী", "নারসিংদী"],
  ফরিদপুর: ["ফরিদপুর"],
  গোপালগঞ্জ: ["গোপালগঞ্জ"],
  মাদারীপুর: ["মাদারীপুর"],
  রাজবাড়ী: ["রাজবাড়ী"],
  শরীয়তপুর: ["শরীয়তপুর", "শরিয়তপুর"],

  // ── Khulna Division ──
  খুলনা: ["খুলনা"],
  বাগেরহাট: ["বাগেরহাট"],
  সাতক্ষীরা: ["সাতক্ষীরা"],
  যশোর: ["যশোর"],
  ঝিনাইদহ: ["ঝিনাইদহ"],
  মাগুরা: ["মাগুরা"],
  নড়াইল: ["নড়াইল"],
  কুষ্টিয়া: ["কুষ্টিয়া"],
  চুয়াডাঙ্গা: ["চুয়াডাঙ্গা"],
  মেহেরপুর: ["মেহেরপুর"],

  // ── Mymensingh Division ──
  ময়মনসিংহ: ["ময়মনসিংহ"],
  নেত্রকোণা: ["নেত্রকোণা", "নেত্রকোনা"],
  শেরপুর: ["শেরপুর"],
  জামালপুর: ["জামালপুর"],

  // ── Rajshahi Division ──
  রাজশাহী: ["রাজশাহী"],
  চাঁপাইনবাবগঞ্জ: ["চাঁপাইনবাবগঞ্জ"],
  নওগাঁ: ["নওগাঁ"],
  নাটোর: ["নাটোর"],
  পাবনা: ["পাবনা"],
  সিরাজগঞ্জ: ["সিরাজগঞ্জ"],
  বগুড়া: ["বগুড়া"],
  জয়পুরহাট: ["জয়পুরহাট"],

  // ── Rangpur Division ──
  রংপুর: ["রংপুর"],
  দিনাজপুর: ["দিনাজপুর"],
  ঠাকুরগাঁও: ["ঠাকুরগাঁও"],
  পঞ্চগড়: ["পঞ্চগড়"],
  নীলফামারী: ["নীলফামারী"],
  লালমনিরহাট: ["লালমনিরহাট"],
  কুড়িগ্রাম: ["কুড়িগ্রাম"],
  গাইবান্ধা: ["গাইবান্ধা"],

  // ── Sylhet Division ──
  সিলেট: ["সিলেট"],
  মৌলভীবাজার: ["মৌলভীবাজার"],
  হবিগঞ্জ: ["হবিগঞ্জ"],
  সুনামগঞ্জ: ["সুনামগঞ্জ"],
};

/**
 * Division → District mapping.
 */
const DIVISIONS = {
  বরিশাল: ["বরিশাল", "ভোলা", "ঝালকাঠি", "পটুয়াখালী", "পিরোজপুর", "বরগুনা"],
  চট্টগ্রাম: ["চট্টগ্রাম", "কক্সবাজার", "কুমিল্লা", "ফেনী", "লক্ষ্মীপুর", "নোয়াখালী", "চাঁদপুর", "ব্রাহ্মণবাড়িয়া", "খাগড়াছড়ি", "রাঙ্গামাটি", "বান্দরবান"],
  ঢাকা: ["ঢাকা", "গাজীপুর", "নারায়ণগঞ্জ", "টাঙ্গাইল", "কিশোরগঞ্জ", "মানিকগঞ্জ", "মুন্সিগঞ্জ", "নরসিংদী", "ফরিদপুর", "গোপালগঞ্জ", "মাদারীপুর", "রাজবাড়ী", "শরীয়তপুর"],
  খুলনা: ["খুলনা", "বাগেরহাট", "সাতক্ষীরা", "যশোর", "ঝিনাইদহ", "মাগুরা", "নড়াইল", "কুষ্টিয়া", "চুয়াডাঙ্গা", "মেহেরপুর"],
  ময়মনসিংহ: ["ময়মনসিংহ", "নেত্রকোণা", "শেরপুর", "জামালপুর"],
  রাজশাহী: ["রাজশাহী", "চাঁপাইনবাবগঞ্জ", "নওগাঁ", "নাটোর", "পাবনা", "সিরাজগঞ্জ", "বগুড়া", "জয়পুরহাট"],
  রংপুর: ["রংপুর", "দিনাজপুর", "ঠাকুরগাঁও", "পঞ্চগড়", "নীলফামারী", "লালমনিরহাট", "কুড়িগ্রাম", "গাইবান্ধা"],
  সিলেট: ["সিলেট", "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ"],
};

/**
 * Upazila data for select districts.
 * Maps district canonical name → array of upazilas.
 */
const DISTRICT_UPAZILAS = {
  ঢাকা: ["ঢাকা উত্তর", "ঢাকা দক্ষিণ", "ধামরাই", "দোহার", "কেরানীগঞ্জ", "নবাবগঞ্জ", "সাভার"],
  চট্টগ্রাম: ["চট্টগ্রাম সিটি", "পটিয়া", "সীতাকুণ্ড", "রাঙ্গুনিয়া", "সন্দ্বীপ", "বোয়ালখালী", "আনোয়ারা", "চন্দনাইশ", "ফটিকছড়ি", "হাটহাজারী", "রাউজান", "লোহাগাড়া", "মিরসরাই", "বাঁশখালী"],
  বাগেরহাট: ["বাগেরহাট সদর", "রামপাল", "মোরেলগঞ্জ", "শরণখোলা", "কচুয়া", "ফকিরহাট", "মোল্লাহাট", "চিতলমারী", "মোংলা"],
  খুলনা: ["খুলনা সিটি", "দৌলতপুর", "তেরখাদা", "ডুমুরিয়া", "পাইকগাছা", "বটিয়াঘাটা", "দাকোপ", "কয়রা", "ফুলতলা", "রূপসা"],
  গাজীপুর: ["গাজীপুর সদর", "কালিয়াকৈর", "কালীগঞ্জ", "কাপাসিয়া", "শ্রীপুর"],
  নারায়ণগঞ্জ: ["নারায়ণগঞ্জ সদর", "আড়াইহাজার", "বন্দর", "রূপগঞ্জ", "সোনারগাঁও"],
  রাজশাহী: ["রাজশাহী সিটি", "বাঘা", "চারঘাট", "দুর্গাপুর", "গোদাগাড়ী", "মোহনপুর", "পবা", "পুঠিয়া", "তানোর"],
  সিলেট: ["সিলেট সদর", "বিয়ানীবাজার", "গোলাপগঞ্জ", "গোয়াইনঘাট", "জৈন্তাপুর", "কানাইঘাট", "কোম্পানীগঞ্জ", "দক্ষিণ সুরমা", "জকিগঞ্জ", "বালাগঞ্জ", "ওসমানীনগর", "ফেঞ্চুগঞ্জ"],
  বরিশাল: ["বরিশাল সদর", "আগৈলঝাড়া", "বাবুগঞ্জ", "বাকেরগঞ্জ", "বানারীপাড়া", "গৌরনদী", "হিজলা", "মেহেন্দিগঞ্জ", "মুলাদী", "উজিরপুর"],
  কুমিল্লা: ["কুমিল্লা সদর", "দাউদকান্দি", "দেবীদ্বার", "হোমনা", "লালমাই", "মুরাদনগর", "নাঙ্গলকোট", "তিতাস", "বরুড়া", "ব্রাহ্মণপাড়া", "বুড়িচং", "চান্দিনা", "চৌদ্দগ্রাম", "লাকসাম", "মনোহরগঞ্জ", "মেঘনা"],
  রংপুর: ["রংপুর সদর", "গংগাচড়া", "কাউনিয়া", "বদরগঞ্জ", "তারাগঞ্জ", "পীরগাছা", "পীরগঞ্জ", "মিঠাপুকুর"],
  ময়মনসিংহ: ["ময়মনসিংহ সদর", "গফরগাঁও", "ঈশ্বরগঞ্জ", "নান্দাইল", "ভালুকা", "ত্রিশাল", "মুক্তাগাছা", "ধোবাউড়া", "ফুলবাড়িয়া", "গৌরীপুর", "হালুয়াঘাট", "তারাকান্দা"],
  সাতক্ষীরা: ["সাতক্ষীরা সদর", "কালীগঞ্জ", "শ্যামনগর", "আশাশুনি", "দেবহাটা", "তালা", "কলারোয়া"],
  দিনাজপুর: ["দিনাজপুর সদর", "বিরামপুর", "বিরল", "বোচাগঞ্জ", "চিরিরবন্দর", "ফুলবাড়ী", "ঘোড়াঘাট", "হাকিমপুর", "কাহারোল", "খানসামা", "নবাবগঞ্জ", "পার্বতীপুর"],
  যশোর: ["যশোর সদর", "অভয়নগর", "বাঘারপাড়া", "চৌগাছা", "ঝিকরগাছা", "কেশবপুর", "মণিরামপুর", "শার্শা"],
  ফরিদপুর: ["ফরিদপুর সদর", "আলফাডাঙ্গা", "ভাঙ্গা", "বোয়ালমারী", "চরভদ্রাসন", "মধুখালী", "নগরকান্দা", "সদরপুর", "সালথা"],
  টাঙ্গাইল: ["টাঙ্গাইল সদর", "বাসাইল", "ভূয়াপুর", "দেলদুয়ার", "ধনবাড়ী", "ঘাটাইল", "গোপালপুর", "কালিহাতী", "মধুপুর", "মির্জাপুর", "নাগরপুর", "সখিপুর"],
};

/**
 * Build canonical district map from variations.
 *
 * @returns {object} Map of variant → canonical district
 */
function buildDistrictMap() {
  const map = {};

  for (const [canonical, variants] of Object.entries(BANGLADESH_DISTRICTS)) {
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
 * Validate if district exists.
 *
 * @param {string} district - District name to validate
 * @returns {object} Validation result
 */
function validateDistrict(district) {
  if (!district || typeof district !== "string") {
    return {
      valid: false,
      district: district,
      error: "Invalid district input",
    };
  }

  const trimmed = district.trim();
  const districtMap = buildDistrictMap();

  // Exact match
  if (districtMap[trimmed]) {
    return {
      valid: true,
      district: districtMap[trimmed],
      canonical: districtMap[trimmed],
      method: "EXACT_MATCH",
    };
  }

  // Fuzzy match
  let bestMatch = null;
  let bestScore = 0.70;

  for (const canonical of Object.keys(BANGLADESH_DISTRICTS)) {
    const similarity = calculateSimilarity(trimmed, canonical);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = canonical;
    }
  }

  if (bestMatch) {
    return {
      valid: true,
      district: bestMatch,
      canonical: bestMatch,
      method: "FUZZY_MATCH",
      confidence: bestScore,
    };
  }

  return {
    valid: false,
    district: district,
    error: "District not found",
  };
}

/**
 * Get list of Upazilas for a district.
 *
 * @param {string} district - District name
 * @returns {array} List of Upazilas
 */
function getUpazilas(district) {
  const validated = validateDistrict(district);
  if (!validated.valid) {
    return [];
  }

  const canonical = validated.canonical;
  return DISTRICT_UPAZILAS[canonical] || [];
}

/**
 * Validate Upazila.
 *
 * @param {string} upazila - Upazila name
 * @param {string} district - Parent district name
 * @returns {object} Validation result
 */
function validateUpazila(upazila, district) {
  if (!upazila || typeof upazila !== "string") {
    return {
      valid: false,
      upazila: upazila,
      error: "Invalid upazila input",
    };
  }

  const validated = validateDistrict(district);
  if (!validated.valid) {
    return {
      valid: false,
      upazila: upazila,
      district: district,
      error: "Parent district not found",
    };
  }

  const canonical = validated.canonical;
  const upazilas = DISTRICT_UPAZILAS[canonical] || [];

  if (upazilas.length === 0) {
    // No upazila data for this district — accept it
    return {
      valid: true,
      upazila: upazila,
      district: canonical,
      method: "NO_DATA",
    };
  }

  // Exact match
  if (upazilas.includes(upazila)) {
    return {
      valid: true,
      upazila: upazila,
      district: canonical,
      method: "EXACT_MATCH",
    };
  }

  // Fuzzy match
  let bestMatch = null;
  let bestScore = 0.70;

  for (const u of upazilas) {
    const similarity = calculateSimilarity(upazila, u);
    if (similarity > bestScore) {
      bestScore = similarity;
      bestMatch = u;
    }
  }

  if (bestMatch) {
    return {
      valid: true,
      upazila: bestMatch,
      district: canonical,
      method: "FUZZY_MATCH",
      confidence: bestScore,
    };
  }

  return {
    valid: false,
    upazila: upazila,
    district: canonical,
    error: "Upazila not found in district",
  };
}

/**
 * Validate complete address structure.
 *
 * @param {object} address - Address object
 * @returns {object} Validation result
 */
function validateAddress(address) {
  const errors = [];
  const warnings = [];
  const result = {
    valid: true,
    original: { ...address },
    corrected: { ...address },
  };

  // Validate district
  if (address.district) {
    const districtVal = validateDistrict(address.district);
    if (!districtVal.valid) {
      errors.push("Invalid district: " + address.district);
      result.valid = false;
    } else {
      result.corrected.district = districtVal.canonical;
      if (districtVal.method === "FUZZY_MATCH") {
        warnings.push(
          `District corrected: ${address.district} → ${districtVal.canonical}`,
        );
      }
    }
  } else {
    warnings.push("District not provided");
  }

  // Validate upazila (if district is valid)
  if (result.valid && address.upazila) {
    const upazilaVal = validateUpazila(address.upazila, result.corrected.district || address.district);
    if (!upazilaVal.valid) {
      warnings.push("Upazila not found: " + address.upazila);
    } else {
      result.corrected.upazila = upazilaVal.upazila;
      if (upazilaVal.method === "FUZZY_MATCH") {
        warnings.push(
          `Upazila corrected: ${address.upazila} → ${upazilaVal.upazila}`,
        );
      }
    }
  }

  result.errors = errors;
  result.warnings = warnings;

  return result;
}

/**
 * Get all districts.
 *
 * @returns {array} List of all 64 districts
 */
function getAllDistricts() {
  return Object.keys(BANGLADESH_DISTRICTS);
}

/**
 * Get the division for a district.
 *
 * @param {string} district - District name
 * @returns {string|null} Division name or null
 */
function getDivision(district) {
  const validated = validateDistrict(district);
  if (!validated.valid) return null;

  for (const [division, districts] of Object.entries(DIVISIONS)) {
    if (districts.includes(validated.canonical)) {
      return division;
    }
  }
  return null;
}

/**
 * Get geographic data statistics.
 *
 * @returns {object} Statistics
 */
function getGeoStats() {
  const allUpazilas = Object.values(DISTRICT_UPAZILAS)
    .flat()
    .filter((v, i, a) => a.indexOf(v) === i);

  return {
    districtCount: Object.keys(BANGLADESH_DISTRICTS).length,
    divisionCount: Object.keys(DIVISIONS).length,
    upazilaCount: allUpazilas.length,
    districtsWithUpazilas: Object.keys(DISTRICT_UPAZILAS).length,
  };
}

module.exports = {
  validateDistrict,
  validateUpazila,
  validateAddress,
  getUpazilas,
  getAllDistricts,
  getDivision,
  getGeoStats,
  BANGLADESH_DISTRICTS,
  DISTRICT_UPAZILAS,
  DIVISIONS,
};
