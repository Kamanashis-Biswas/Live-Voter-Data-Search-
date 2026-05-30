const fs = require('fs');
const path = require('path');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

/**
 * @file localDb.js
 * @description In-memory flat-file database engine with transactional atomic writes,
 * background thread debouncing, cache-recovery mechanisms, and fast phonetic-indexed search.
 * 
 * DESIGN DECISIONS:
 *   - Direct disk reads/writes on every query cause severe bottlenecks for large voter lists.
 *     We implement a persistent in-memory `_cache` of all PDF assets and voter records.
 *   - During bootstrap or write actions, we pre-calculate "consonant skeletons" (`rebuildIndexes`)
 *     so that filter searches evaluate in sub-millisecond ranges instead of recalculating
 *     phonetic skeletons on every request.
 *   - Sudden power cuts or app crashes can corrupt db.json if written directly. We write to a
 *     temporary file (`.tmp`) and perform atomic renames (`fs.renameSync`) to ensure transactions
 *     succeed completely or fail cleanly. We also maintain a automatic `.bak` copy for recovery.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

const DB_PATH = path.join(__dirname, '../data/db.json');
const BACKUP_PATH = DB_PATH + '.bak';
const TEMP_PATH = DB_PATH + '.tmp';

// ── In-Memory Cache and Background Write State ──────────────────────────────
let _cache = null;
let _writeTimer = null;
const WRITE_DEBOUNCE_MS = 500; // Debounce write operations to aggregate burst writes

/**
 * Pre-calculates and caches visual consonant skeletons directly on the cached voter models.
 * Bypasses redundant phonetic normalization during incoming search filters.
 */
function rebuildIndexes() {
  if (!_cache || !_cache.voters) return;
  const voters = _cache.voters;
  
  // Attach pre-calculated consonant skeletons for fast indexing
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

/**
 * Reads and parses the flat JSON database file.
 * Automatically recovers from corruption or file absences using the backup (.bak) repository.
 * 
 * @returns {object} The parsed database cache object holding `{ voters: [], pdfs: [] }`.
 */
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
    // CORRUPTION RECOVERY: Attempt to load from the automatic .bak backup file
    try {
      if (fs.existsSync(BACKUP_PATH)) {
        const raw = fs.readFileSync(BACKUP_PATH, { encoding: 'utf8' });
        _cache = JSON.parse(raw);
        // Repair the primary database file instantly
        fs.writeFileSync(DB_PATH, raw, { encoding: 'utf8' });
        console.log('[DB] Database recovery successful: restored from db.json.bak');
        rebuildIndexes();
        return _cache;
      }
    } catch (bakErr) {
      console.error('[DB] Backup restoration failed:', bakErr.message);
    }
  }

  // Fallback to fresh database state if both files are missing or unreadable
  _cache = { voters: [], pdfs: [] };
  rebuildIndexes();
  return _cache;
}

/**
 * Commits the database state to disk using a debounced, atomic transaction.
 * 
 * @param {object} data - Complete database object to write.
 */
function writeDb(data) {
  _cache = data;
  rebuildIndexes(); // Refresh cache indexes instantly in memory

  // Clear pending write timers and configure a debounced save
  if (_writeTimer) clearTimeout(_writeTimer);
  _writeTimer = setTimeout(() => {
    try {
      // 1. Transactional atomic write: Save to a temporary file
      fs.writeFileSync(TEMP_PATH, JSON.stringify(data, null, 2), { encoding: 'utf8' });
      // 2. Perform atomic rename (guarantees transaction integrity on POSIX and Windows filesystems)
      fs.renameSync(TEMP_PATH, DB_PATH);
      
      // 3. Keep the backup file synchronized
      fs.copyFileSync(DB_PATH, BACKUP_PATH);
    } catch (err) {
      console.error('[DB] Atomic write error:', err.message);
    }
    _writeTimer = null;
  }, WRITE_DEBOUNCE_MS);
}

/**
 * Flushes any pending write tasks immediately to disk.
 * Used during graceful shutdowns or process interruptions.
 */
function flushDb() {
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

// Graceful shutdown hooks: Ensure database is completely committed before exit
process.on('beforeExit', flushDb);
process.on('SIGINT', () => { flushDb(); process.exit(0); });
process.on('SIGTERM', () => { flushDb(); process.exit(0); });

/**
 * Translates a Bengali string into its consonant search skeleton.
 *
 * @param {string} str - Raw Bengali Unicode.
 * @returns {string} Lowercased consonant search skeleton.
 */
function normalizeBengali(str) {
  if (!str) return '';
  return normalizeForSearch(str).toLowerCase();
}

/**
 * High-performance matching evaluating search entries against cached records.
 * Optimized to bypass execution loops.
 *
 * @param {string} stored - Original Bengali Unicode field inside database.
 * @param {string} normalStored - Pre-calculated cached consonant skeleton.
 * @param {string} query - Raw search query input.
 * @param {string} normalQuery - Phonetic normalized search query input.
 * @returns {boolean} True if matching, false otherwise.
 */
function bengaliMatchFast(stored, normalStored, query, normalQuery) {
  if (!stored || !query) return false;
  
  // 1. Direct substring match (handles exact Unicode queries instantly)
  if (stored.includes(query)) return true;

  // 2. Pre-calculated phonetic match comparing cached consonant skeletons
  if (normalQuery && normalStored && normalStored.includes(normalQuery)) return true;

  // 3. Multi-word search (every queried word must appear in the stored skeleton)
  const queryWords = normalQuery.split(/\s+/).filter(w => w.length >= 2);
  if (queryWords.length > 1) {
    return queryWords.every(word => normalStored && normalStored.includes(word));
  }

  return false;
}

const db = {
  // ── Voters Collection Actions ──────────────────────────────────────────────

  /**
   * Retrieves all voters in database cache.
   * @returns {object[]} Array of voters.
   */
  getVoters() { return readDb().voters; },

  /**
   * Inserts list of parsed voters to cache and triggers disk write.
   * @param {object[]} newVoters - Voters list.
   * @returns {number} Inserted record count.
   */
  addVoters(newVoters) {
    const data = readDb();
    data.voters = [...data.voters, ...newVoters];
    writeDb(data);
    return newVoters.length;
  },

  /**
   * Removes all voters associated with a specific PDF identifier.
   * @param {string} pdfId - The PDF UUID.
   * @returns {number} Removed record count.
   */
  deleteVotersByPdf(pdfId) {
    const data = readDb();
    const before = data.voters.length;
    data.voters = data.voters.filter(v => v.pdfUploadId !== pdfId);
    writeDb(data);
    return before - data.voters.length;
  },

  /**
   * Deletes a single voter by database identifier.
   * @param {string} id - The voter's UUID.
   * @returns {number} Removed record count.
   */
  deleteVoterById(id) {
    const data = readDb();
    const before = data.voters.length;
    data.voters = data.voters.filter(v => v.id !== id);
    writeDb(data);
    return before - data.voters.length;
  },

  /**
   * High-speed, layout-optimized multi-field search engine.
   * Leverages pre-calculated cached skeletons to support real-time sub-millisecond filtering.
   *
   * @param {object} searchParams - Search fields and pagination criteria.
   * @returns {{ results: object[], total: number, page: number, limit: number }} Evaluated page.
   */
  searchVoters({ name, fatherName, motherName, village, voterArea, upazila, district, voterNo, nid, occupation, gender, page = 1, limit = 100 }) {
    // Force cache initialization if empty
    readDb();
    
    let voters = _cache.voters;

    // Apply filters based on input fields, translating query terms to normal forms once on entry
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

    // Apply pagination rules
    const total = voters.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 100));
    const start = (pageNum - 1) * pageSize;
    const paged = voters.slice(start, start + pageSize);

    return { results: paged, total, page: pageNum, limit: pageSize };
  },

  // ── PDF Metadata Collection Actions ────────────────────────────────────────

  /**
   * Retrieves all PDFs loaded in cache.
   * @returns {object[]} PDFs list.
   */
  getPdfs() { return readDb().pdfs; },

  /**
   * Saves metadata for a new uploaded PDF.
   * @param {object} pdf - PDF metadata.
   * @returns {object} The saved object.
   */
  addPdf(pdf) {
    const data = readDb();
    data.pdfs = [pdf, ...data.pdfs];
    writeDb(data);
    return pdf;
  },

  /**
   * Searches PDF metadata using a UUID.
   * @param {string} id - The PDF UUID.
   * @returns {object|null} Found PDF record or null.
   */
  getPdfById(id) { return readDb().pdfs.find(p => p.id === id) || null; },

  /**
   * Modifies the recorded extracted voter count on a PDF.
   */
  updatePdfVoterCount(id, count) {
    const data = readDb();
    const pdf = data.pdfs.find(p => p.id === id);
    if (pdf) { pdf.voterCount = count; writeDb(data); }
  },

  /**
   * Deletes PDF record from registry.
   * @param {string} id - PDF UUID.
   */
  deletePdf(id) {
    const data = readDb();
    data.pdfs = data.pdfs.filter(p => p.id !== id);
    writeDb(data);
  },

  // ── Cache Operational Hooks ────────────────────────────────────────────────

  /**
   * Clears in-memory references to trigger disk reload on the next call.
   */
  invalidateCache() {
    _cache = null;
  },

  flush: flushDb,
};

module.exports = db;
