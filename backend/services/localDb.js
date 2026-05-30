const fs = require('fs');
const path = require('path');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

const DB_PATH = path.join(__dirname, '../data/db.json');

// ── In-memory cache ─────────────────────────────────────────────────────────
// Avoids reading/parsing 1.6MB+ JSON file on every request
let _cache = null;
let _cacheTime = 0;
let _writeTimer = null;
const WRITE_DEBOUNCE_MS = 500;

function readDb() {
  try {
    // Use cache if available and fresh
    if (_cache) return _cache;
    const raw = fs.readFileSync(DB_PATH, { encoding: 'utf8' });
    _cache = JSON.parse(raw);
    _cacheTime = Date.now();
    return _cache;
  } catch {
    _cache = { voters: [], pdfs: [] };
    return _cache;
  }
}

function writeDb(data) {
  _cache = data;
  // Debounce writes to avoid hammering disk during batch operations
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
    } catch (err) {
      console.error('[DB] Write error:', err.message);
    }
    _writeTimer = null;
  }, WRITE_DEBOUNCE_MS);
}

function flushDb() {
  // Force immediate write (e.g., before process exit)
  if (_writeTimer) {
    clearTimeout(_writeTimer);
    _writeTimer = null;
  }
  if (_cache) {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(_cache, null, 2), { encoding: 'utf8' });
    } catch (err) {
      console.error('[DB] Flush error:', err.message);
    }
  }
}

// Flush on process exit
process.on('beforeExit', flushDb);
process.on('SIGINT', () => { flushDb(); process.exit(0); });
process.on('SIGTERM', () => { flushDb(); process.exit(0); });

/**
 * Normalize Bengali text for fuzzy search.
 *
 * Strips all vowel matras, hasanta, nukta so that consonant skeletons are compared.
 * Example: "শেখ মোহাম্মদ" → "শখ মহমমদ"
 *
 * This means a user searching "শেখ" will match "শেখ", "শেখ্", "শখ" variants.
 * Requires database to store clean Unicode Bengali (done by the new converter pipeline).
 */
function normalizeBengali(str) {
  if (!str) return '';
  // Use the shared utility from bengaliUnicodeConverter
  return normalizeForSearch(str).toLowerCase();
}

/**
 * Check if stored Unicode Bengali text fuzzy-matches a user search query.
 * Both stored text and query are normalized to consonant skeletons before comparing.
 */
function bengaliMatch(stored, query) {
  if (!stored || !query) return false;
  const q = query.trim();
  if (!q) return false;

  // 1. Direct substring match (handles exact Unicode queries)
  if (stored.includes(q)) return true;

  // 2. Normalized (consonant skeleton) match — tolerates matra differences
  const normalStored = normalizeBengali(stored);
  const normalQuery = normalizeBengali(q);
  if (normalQuery && normalStored.includes(normalQuery)) return true;

  // 3. Word-level partial match (all query words must appear)
  const queryWords = normalQuery.split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length > 1) {
    return queryWords.every(word => normalStored.includes(word));
  }

  return false;
}

const db = {
  // ── Voters ──────────────────────────────────────────────────────────────

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

  deleteVoterById(id) {
    const data = readDb();
    const before = data.voters.length;
    data.voters = data.voters.filter(v => v.id !== id);
    writeDb(data);
    return before - data.voters.length;
  },

  searchVoters({ name, fatherName, motherName, village, voterArea, upazila, district, voterNo, nid, occupation, gender, page = 1, limit = 100 }) {
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
    if (occupation && occupation.trim()) {
      voters = voters.filter(v => bengaliMatch(v.occupation, occupation));
    }
    if (voterNo && voterNo.trim()) {
      voters = voters.filter(v => (v.voterNo || '').includes(voterNo.trim()));
    }
    if (nid && nid.trim()) {
      voters = voters.filter(v => (v.nid || '') === nid.trim());
    }
    if (gender && gender !== 'all') {
      const genderBn = gender === 'male' ? 'পুরুষ' : gender === 'female' ? 'মহিলা' : '';
      if (genderBn) {
        voters = voters.filter(v => v.gender === genderBn);
      }
    }

    // Pagination
    const total = voters.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 100));
    const start = (pageNum - 1) * pageSize;
    const paged = voters.slice(start, start + pageSize);

    return { results: paged, total, page: pageNum, limit: pageSize };
  },

  // ── PDFs ────────────────────────────────────────────────────────────────

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
  },

  // ── Cache management ──────────────────────────────────────────────────

  invalidateCache() {
    _cache = null;
    _cacheTime = 0;
  },

  flush: flushDb,
};

module.exports = db;
