const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

function readDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch {
    return { voters: [], pdfs: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
}

/**
 * Normalize Bengali text for fuzzy search.
 *
 * Problem: PDFs use legacy Bengali font encoding:
 *   1. Vowel matras placed BEFORE consonants visually (not after, as Unicode requires)
 *   2. Some glyphs encoded as Latin Extended chars (ƣ=কু, Ï=ে, etc.)
 *
 * Solution: Strip ALL vowel marks AND all non-Bengali chars → compare pure consonant skeletons.
 * This makes "শেখ" and "Ïশখ" both normalize to "শখ" for comparison.
 */
function normalizeBengali(str) {
  if (!str) return '';
  
  let result = str;

  // Map of common legacy Bengali font Latin glyphs → Bengali Unicode
  const glyphMap = {
    '\u00CF': '\u09C7', // Ï → ে
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
    '\u01A3': '\u0995\u09C1', // ƣ → কু
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

  for (const [from, to] of Object.entries(glyphMap)) {
    if (result.includes(from)) {
      result = result.split(from).join(to);
    }
  }

  // Remove common legacy misspelling for "শেখ"
  result = result.replace(/\u09CB\u09B8\u0996/g, '\u09B8\u09C7\u0996'); // োস্খ -> সেখ
  result = result.replace(/\u09C7\u09B8\u0996/g, '\u09B8\u09C7\u0996'); // েস্খ -> সেখ

  // Normalize Bengali composite characters (Nukta handling)
  // Keyboards like Avro/Gboard often send (base + ়) instead of the precomposed character
  result = result
    .replace(/\u09AF\u09BC/g, '\u09DF') // য + ় = য়
    .replace(/\u09A1\u09BC/g, '\u09DC') // ড + ় = ড়
    .replace(/\u09A2\u09BC/g, '\u09DD'); // ঢ + ় = ঢ়

  return result
    // Step 1: Remove Bengali vowel signs, hasanta, anusvara, visarga, etc.
    .replace(/[\u09BE-\u09CC\u09D7\u09BC\u0981-\u0983\u09CD]/g, '')
    // Step 2: Remove ALL non-Bengali, non-digit, non-space chars
    .replace(/[^\u0980-\u09FF\u0030-\u0039\u0020]/g, '')
    // Step 3: Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if stored text fuzzy-matches a user query.
 * Works for both standard Unicode Bengali and legacy PDF font encoding.
 */
function bengaliMatch(stored, query) {
  if (!stored || !query) return false;
  const normalStored = normalizeBengali(stored);
  const normalQuery = normalizeBengali(query.trim());
  if (!normalQuery) return false;
  // Direct normalized match
  if (normalStored.includes(normalQuery)) return true;
  // Also try raw includes (for already-Unicode data)
  if (stored.toLowerCase().includes(query.trim().toLowerCase())) return true;
  // Word-level partial: all query words must appear somewhere in stored
  const queryWords = normalQuery.split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length > 0) {
    return queryWords.every(word => normalStored.includes(word));
  }
  return false;
}

const db = {
  // Voters
  getVoters() { return readDb().voters; },

  addVoters(newVoters) {
    const data = readDb();
    data.voters = [...data.voters, ...newVoters];
    writeDb(data);
    return newVoters.length;
  },

  deleteVotersByPdf(pdfId) {
    const data = readDb();
    const before = data.voters.length;
    data.voters = data.voters.filter(v => v.pdfUploadId !== pdfId);
    writeDb(data);
    return before - data.voters.length;
  },

  searchVoters({ name, fatherName, motherName, village, voterArea, upazila, district, voterNo, nid }) {
    let voters = readDb().voters;

    if (name && name.trim()) {
      voters = voters.filter(v => bengaliMatch(v.nameBn, name));
    }
    if (fatherName && fatherName.trim()) {
      voters = voters.filter(v => bengaliMatch(v.fatherName, fatherName));
    }
    if (motherName && motherName.trim()) {
      voters = voters.filter(v => bengaliMatch(v.motherName, motherName));
    }
    if (village && village.trim()) {
      voters = voters.filter(v =>
        bengaliMatch(v.village, village) ||
        bengaliMatch(v.voterArea, village)
      );
    }
    if (voterArea && voterArea.trim()) {
      voters = voters.filter(v =>
        bengaliMatch(v.voterArea, voterArea) ||
        bengaliMatch(v.village, voterArea)
      );
    }
    if (upazila && upazila.trim()) {
      voters = voters.filter(v => bengaliMatch(v.upazila, upazila));
    }
    if (district && district.trim()) {
      voters = voters.filter(v => bengaliMatch(v.district, district));
    }
    if (voterNo && voterNo.trim()) {
      voters = voters.filter(v => (v.voterNo || '').includes(voterNo.trim()));
    }
    if (nid && nid.trim()) {
      voters = voters.filter(v => (v.nid || '') === nid.trim());
    }

    return voters.slice(0, 100);
  },

  // PDFs
  getPdfs() { return readDb().pdfs; },

  addPdf(pdf) {
    const data = readDb();
    data.pdfs = [pdf, ...data.pdfs];
    writeDb(data);
    return pdf;
  },

  getPdfById(id) { return readDb().pdfs.find(p => p.id === id) || null; },

  updatePdfVoterCount(id, count) {
    const data = readDb();
    const pdf = data.pdfs.find(p => p.id === id);
    if (pdf) { pdf.voterCount = count; writeDb(data); }
  },

  deletePdf(id) {
    const data = readDb();
    data.pdfs = data.pdfs.filter(p => p.id !== id);
    writeDb(data);
  }
};

module.exports = db;
