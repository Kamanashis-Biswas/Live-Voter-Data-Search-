const fs = require('fs');
const path = require('path');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

const DB_PATH = path.join(__dirname, '../data/db.json');

// ── In-memory cache & indexing ──────────────────────────────────────────────
// Avoids reading/parsing 1.6MB+ JSON file on every request
// Pre-calculates normalized consonant skeletons for high-speed indexing
let _cache = null;
let _writeTimer = null;
const WRITE_DEBOUNCE_MS = 500;

const BACKUP_PATH = DB_PATH + '.bak';
const TEMP_PATH = DB_PATH + '.tmp';

function rebuildIndexes() {
  if (!_cache || !_cache.voters) return;
  const voters = _cache.voters;
  
  // Attach pre-normalized consonant skeletons directly to voter objects in memory
  for (let i = 0; i < voters.length; i++) {
    const v = voters[i];
    v.normalName = v.nameBn ? normalizeBengali(v.nameBn) : '';
    v.normalFather = v.fatherName ? normalizeBengali(v.fatherName) : '';
    v.normalMother = v.motherName ? normalizeBengali(v.motherName) : '';
    v.normalVillage = v.village ? normalizeBengali(v.village) : '';
    v.normalVoterArea = v.voterArea ? normalizeBengali(v.voterArea) : '';
    v.normalUpazila = v.upazila ? normalizeBengali(v.upazila) : '';
    v.normalDistrict = v.district ? normalizeBengali(v.district) : '';
    v.normalOccupation = v.occupation ? normalizeBengali(v.occupation) : '';
  }
}

function readDb() {
  if (_cache) return _cache;
  
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, { encoding: 'utf8' });
      _cache = JSON.parse(raw);
      rebuildIndexes();
      return _cache;
    }
  } catch (err) {
    console.error('[DB] Database read error, attempting backup recovery:', err.message);
    // Corruption recovery: attempt to load from automatic backup file
    try {
      if (fs.existsSync(BACKUP_PATH)) {
        const raw = fs.readFileSync(BACKUP_PATH, { encoding: 'utf8' });
        _cache = JSON.parse(raw);
        // Recover main database file
        fs.writeFileSync(DB_PATH, raw, { encoding: 'utf8' });
        console.log('[DB] Database recovery successful: restored from db.json.bak');
        rebuildIndexes();
        return _cache;
      }
    } catch (bakErr) {
      console.error('[DB] Backup restoration failed:', bakErr.message);
    }
  }

  // Fallback to fresh database state if both files are missing/corrupted
  _cache = { voters: [], pdfs: [] };
  rebuildIndexes();
  return _cache;
}

function writeDb(data) {
  _cache = data;
  rebuildIndexes(); // update in-memory pre-calculated fields immediately

  // Debounce writes to avoid hammering disk during batch operations
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    try {
      // 1. Write atomically using a temporary file
      fs.writeFileSync(TEMP_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
      fs.renameSync(TEMP_PATH, DB_PATH);
      
      // 2. Refresh the backup file
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    } catch (err) {
      console.error('[DB] Atomic write error:', err.message);
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
      fs.writeFileSync(TEMP_PATH, JSON.stringify(_cache, null, 2), { encoding: 'utf8' });
      fs.renameSync(TEMP_PATH, DB_PATH);
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
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
 * High-performance matching using pre-normalized consonant skeletons.
 * Extremely fast as it avoids calling normalizeBengali on database entries inside filter loops.
 */
function bengaliMatchFast(stored, normalStored, query, normalQuery) {
  if (!stored || !query) return false;
  
  // 1. Direct substring match (handles exact Unicode matches instantly)
  if (stored.includes(query)) return true;

  // 2. Pre-normalized match — checks against cached consonant skeletons
  if (normalQuery && normalStored && normalStored.includes(normalQuery)) return true;

  // 3. Word-level partial match (all query words must be present)
  const queryWords = normalQuery.split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length > 1) {
    return queryWords.every(word => normalStored && normalStored.includes(word));
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
    // Trigger lazy DB load
    readDb();
    
    let voters = _cache.voters;

    if (name && name.trim()) {
      const q = name.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.nameBn, v.normalName, q, nq));
    }
    if (fatherName && fatherName.trim()) {
      const q = fatherName.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.fatherName, v.normalFather, q, nq));
    }
    if (motherName && motherName.trim()) {
      const q = motherName.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.motherName, v.normalMother, q, nq));
    }
    if (village && village.trim()) {
      const q = village.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v =>
        bengaliMatchFast(v.village, v.normalVillage, q, nq) ||
        bengaliMatchFast(v.voterArea, v.normalVoterArea, q, nq)
      );
    }
    if (voterArea && voterArea.trim()) {
      const q = voterArea.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v =>
        bengaliMatchFast(v.voterArea, v.normalVoterArea, q, nq) ||
        bengaliMatchFast(v.village, v.normalVillage, q, nq)
      );
    }
    if (upazila && upazila.trim()) {
      const q = upazila.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.upazila, v.normalUpazila, q, nq));
    }
    if (district && district.trim()) {
      const q = district.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.district, v.normalDistrict, q, nq));
    }
    if (occupation && occupation.trim()) {
      const q = occupation.trim();
      const nq = normalizeBengali(q);
      voters = voters.filter(v => bengaliMatchFast(v.occupation, v.normalOccupation, q, nq));
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
  },

  flush: flushDb,
};

module.exports = db;
