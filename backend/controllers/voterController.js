const db = require('../services/localDb');

/**
 * Convert legacy Bengali PDF font text to proper Unicode.
 *
 * Legacy govt PDFs (Bijoy-style fonts) have two issues:
 *  1. Some characters encoded as Latin Extended glyphs (Ï=ে, ƣ=কু, etc.)
 *  2. Vowel matras (ি, ে, etc.) placed BEFORE consonants visually
 *
 * This function fixes both for proper display.
 */
function fixBengaliDisplay(str) {
  if (!str) return '';

  // Map of common legacy Bengali font Latin glyphs → Bengali Unicode
  // Based on Bijoy/Sutonny/SutonnyMJ font encoding (most govt PDFs)
  const glyphMap = {
    '\u00CF': '\u09C7', // Ï → ে (e matra) - FIXED: was mapping to ো instead of ে
    '\u00CE': '\u09C7', // Î → ে
    '\u00C0': '\u09BE', // À → া
    '\u0100': '\u09BE', // Ā → া
    '\u0101': '\u09BE', // ā → া
    '\u00C3': '\u09CB', // Ã → ো
    '\u012A': '\u09C0', // Ī → ী
    '\u012B': '\u09BF', // ī → ি
    '\u012C': '\u09BF', // Ĭ → ি
    '\u012D': '\u09BF', // ĭ → ি
    '\u014C': '\u09CB', // Ō → ো
    '\u014D': '\u09CB', // ō → ো
    '\u014E': '\u09CB', // Ŏ → ো
    '\u0150': '\u09CC', // Ő → ৌ
    '\u014B': '\u0982', // ŋ → ং
    '\u0147': '\u09A3', // Ň → ণ
    '\u0148': '\u09A8', // ň → ন
    '\u0144': '\u09A8', // ń → ন
    '\u01A3': '\u0995\u09C1', // ƣ → কু (common in names like কুমার, কুলসুম)
    '\u01A2': '\u0995\u09C1', // Ƣ → কু
    '\u0108': '\u099B', // Ĉ → ছ
    '\u0124': '\u09B9', // Ĥ → হ
    '\u0125': '\u09B9', // ĥ → হ
    '\u0134': '\u099C', // Ĵ → জ
    '\u0135': '\u099C', // ĵ → জ
    '\u0139': '\u09B2', // Ĺ → ল
    '\u013A': '\u09B2', // ĺ → ল
    '\u013C': '\u09B2', // ļ → ল
    '\u015A': '\u09B6\u09CD\u09AC', // Ś → শ্ব (was শ)
    '\u015B': '\u09B6\u09CD\u09AC', // ś → শ্ব (was শ)
    '\u0160': '\u09B7', // Š → ষ
    '\u0161': '\u09B7', // š → ষ
    '\u015E': '\u09B6', // Ş → শ
    '\u0106': '\u099A', // Ć → চ
    '\u0107': '\u099A', // ć → চ
    '\u016A': '\u09C2', // Ū → ূ
    '\u016B': '\u09C1', // ū → ু
    '\u016C': '\u09C1', // Ŭ → ু
    '\u016D': '\u09C1', // ŭ → ু
    '\u0179': '\u09AF', // Ź → য
    '\u017A': '\u09AF', // ź → য
    '\u017B': '\u09AF', // Ż → য
    '\u017D': '\u099C', // Ž → জ
    '\u017E': '\u099C', // ž → জ
    '\u0128': '\u0987', // Ĩ → ই
    '\u0129': '\u0987', // ĩ → ই
    '\u0158': '\u09B0', // Ř → র
    '\u0159': '\u09B0', // ř → র
    '\u010C': '\u099A', // Č → চ
    '\u010D': '\u099A', // č → চ
    '\u0110': '\u09A6', // Đ → দ
    '\u0111': '\u09A6', // đ → দ
    '\u0122': '\u0997', // Ģ → গ
    '\u01D0': '\u09BF', // ǐ → ি
    '\u01D2': '\u09CB', // ǒ → ো
    '\u0174': '\u09AC', // Ŵ → ব
    '\u0175': '\u09AC', // ŵ → ব
    '\u0162': '\u09A4', // Ţ → ত
    '\u0163': '\u09A4', // ţ → ত
    '\u0166': '\u09A5', // Ŧ → থ
    '\u00CB': '\u09AC\u09CD\u09AF', // Ë → ব্য
    '\u00D4': '\u09A4\u09CD\u09A4', // Ô → ত্ত
    '\u0168': '\u09B8\u09CD\u099F', // Ũ → স্ট
    '\u0169': '\u09B8\u09CD\u099F', // ũ → স্ট
    '\u0154': '\u09B0\u09CD', // Ŕ → র্ (রেফ)
    '\u0155': '\u09B0\u09CD', // ŕ → র্
    '\u0165': '\u09B8\u09CD\u0995', // ť → স্ক
    '\u00B6': '\u0995\u09CD\u09B7', // ¶ → ক্ষ
    '\u0131': '\u09AA\u09CD\u09B2', // ı → প্ল
    '\u0127': '\u09A8\u09CD\u09A6\u09CD\u09B0', // ħ → ন্দ্র
    '\u00D9': '\u0995\u09CD\u09B7', // Ù → ক্ষ
    '\u0114': '\u09A4\u09CD\u09B0', // Ĕ → ত্র
    '\u015D': '\u09B7\u09CD\u09A3', // ŝ → ষ্ণ
    '\u00D0': '\u09A6\u09CD\u09A7', // Ð → দ্ধ
    '\u00F0': '\u09A6\u09CD\u09A7', // ð → দ্ধ
    '\u008C': '\u09A3\u09CD', // Œ (\x8C) → ণ্
    '\u0073': '\u09A8\u09C1', // s → নু
  };

  let result = str;

  // Apply glyph mapping
  for (const [from, to] of Object.entries(glyphMap)) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }

  // Remove common legacy misspelling for "শেখ"
  result = result.replace(/\u09CB\u09B8\u0996/g, '\u09B8\u09C7\u0996'); // োস্খ -> সেখ
  result = result.replace(/\u09C7\u09B8\u0996/g, '\u09B8\u09C7\u0996'); // েস্খ -> সেখ

  // Fix misplaced matras: move vowel matra that's BEFORE a consonant to AFTER it
  // In legacy encoding, ONLY these matras are typed before the consonant: ি (i), ে (e), ৈ (ai), ো (o), ৌ (au)
  const preMatras = '\u09BF\u09C7\u09C8\u09CB\u09CC';

  // Match 1 or more consonants linked by hasant \u09CD (for handling conjuncts like ক্ষ)
  const consonantCluster = '([\\u0995-\\u09B9\\u09DC-\\u09DF\\u09CE\\u09F0-\\u09F1](?:\\u09CD[\\u0995-\\u09B9\\u09DC-\\u09DF\\u09CE\\u09F0-\\u09F1])*)';

  // Apply reordering: (matra)(consonant cluster) → (consonant cluster)(matra)
  result = result.replace(
    new RegExp(`([${preMatras}])${consonantCluster}`, 'g'),
    (match, matra, cluster) => cluster + matra
  );

  // Remove remaining non-Bengali, non-digit, non-space Latin garbage
  result = result.replace(/[^\u0980-\u09FF\u0030-\u0039\u0020\u002F\u002E\u002D]/g, '');
  result = result.replace(/\s+/g, ' ').trim();

  return result;
}

function cleanVoter(v) {
  return {
    ...v,
    nameBn: fixBengaliDisplay(v.nameBn),
    fatherName: fixBengaliDisplay(v.fatherName),
    motherName: fixBengaliDisplay(v.motherName),
    occupation: fixBengaliDisplay(v.occupation),
    voterArea: fixBengaliDisplay(v.voterArea),
    unionName: fixBengaliDisplay(v.unionName),
    upazila: fixBengaliDisplay(v.upazila),
    district: fixBengaliDisplay(v.district),
    village: fixBengaliDisplay(v.village),
    address: fixBengaliDisplay(v.address),
  };
}

/**
 * GET /api/voters/search
 * Search voter records from local JSON database.
 */
exports.searchVoters = (req, res, next) => {
  try {
    const { name, fatherName, motherName, village, voterArea, upazila, district, nid, voterNo } = req.query;
    const results = db.searchVoters({ name, fatherName, motherName, village, voterArea, upazila, district, nid, voterNo });
    // Clean encoding artifacts before sending to frontend
    const cleaned = results.map(cleanVoter);
    res.json({ success: true, count: cleaned.length, results: cleaned });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/voters/by-pdf/:pdfUploadId
 * Delete all voters associated with a PDF.
 */
exports.deleteVotersByPdf = (req, res, next) => {
  try {
    const { pdfUploadId } = req.params;
    const count = db.deleteVotersByPdf(pdfUploadId);
    res.json({ success: true, message: `${count} জন ভোটার মুছে ফেলা হয়েছে।`, count });
  } catch (err) {
    next(err);
  }
};
