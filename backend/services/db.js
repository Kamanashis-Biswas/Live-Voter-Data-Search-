const { supabaseAdmin } = require('../config/supabaseClient');
const localDb = require('./localDb');
const logger = require('../utils/logger');
const { normalizeForSearch } = require('../utils/bengaliUnicodeConverter');

const hasSupabase = !!supabaseAdmin;

// Mappers to bridge camelCase Javascript and snake_case PostgreSQL
const mapVoterToDb = (v) => ({
  id: v.id,
  nid: v.nid || null,
  voter_no: v.voterNo || null,
  name_bn: v.nameBn,
  name_en: v.nameEn || null,
  father_name: v.fatherName || null,
  mother_name: v.motherName || null,
  dob: v.dob || null,
  village: v.village || null,
  gender: v.gender || null,
  blood_group: v.bloodGroup || null,
  photo_url: v.photoUrl || null,
  occupation: v.occupation || null,
  serial_no: v.serialNo ? String(v.serialNo) : null,
  union_name: v.unionName || null,
  ward_no: v.wardNo || null,
  voter_area: v.voterArea || null,
  voter_area_no: v.voterAreaNo || null,
  upazila: v.upazila || null,
  district: v.district || null,
  post_code: v.postCode || null,
  publication_date: v.publicationDate || null,
  page_number: v.pdfPageNumber ? String(v.pdfPageNumber) : null,
  pdf_upload_id: v.pdfUploadId || null,
  status: v.status || 'সক্রিয়'
});

const mapVoterFromDb = (db) => ({
  id: db.id,
  nid: db.nid,
  voterNo: db.voter_no,
  nameBn: db.name_bn,
  nameEn: db.name_en,
  fatherName: db.father_name,
  motherName: db.mother_name,
  dob: db.dob,
  village: db.village,
  gender: db.gender,
  bloodGroup: db.blood_group,
  photoUrl: db.photo_url,
  occupation: db.occupation,
  serialNo: db.serial_no ? Number(db.serial_no) : null,
  unionName: db.union_name,
  wardNo: db.ward_no,
  voterArea: db.voter_area,
  voterAreaNo: db.voter_area_no,
  upazila: db.upazila,
  district: db.district,
  postCode: db.post_code,
  publicationDate: db.publication_date,
  pdfPageNumber: db.page_number ? Number(db.page_number) : null,
  pdfUploadId: db.pdf_upload_id,
  status: db.status
});

const mapPdfToDb = (p) => ({
  id: p.id,
  file_name: p.fileName,
  file_size: p.fileSize || null,
  district: p.district || null,
  upazila: p.upazila || null,
  union_name: p.unionName || null,
  ward_no: p.wardNo || null,
  voter_area: p.voterArea || null,
  voter_area_no: p.voterAreaNo || null,
  total_voters: p.totalVoters || 0,
  total_female_voters: p.totalFemaleVoters || 0,
  gender_type: p.genderType || 'উভয়',
  publication_date: p.publicationDate || null,
  post_code: p.postCode || null,
  voter_count: p.voterCount || 0,
  status: p.status || 'সফল',
  uploaded_at: p.uploadedAt || new Date().toISOString()
});

const mapPdfFromDb = (db) => ({
  id: db.id,
  fileName: db.file_name,
  fileSize: db.file_size,
  district: db.district,
  upazila: db.upazila,
  unionName: db.union_name,
  wardNo: db.ward_no,
  voterArea: db.voter_area,
  voterAreaNo: db.voter_area_no,
  totalVoters: db.total_voters,
  totalFemaleVoters: db.total_female_voters,
  genderType: db.gender_type,
  publicationDate: db.publication_date,
  postCode: db.post_code,
  voterCount: db.voter_count,
  status: db.status,
  uploadedAt: db.uploaded_at
});

const mapSearchLogToDb = (log) => ({
  id: log.id,
  date_time: log.dateTime || new Date().toISOString(),
  ip_address: log.ipAddress || null,
  query: log.query || null,
  response_time: log.responseTime || null,
  status: log.status || null,
  method: log.method || 'GET'
});

const mapSearchLogFromDb = (db) => ({
  id: db.id,
  dateTime: db.date_time,
  ipAddress: db.ip_address,
  query: db.query,
  responseTime: db.response_time,
  status: db.status,
  method: db.method
});

// In-memory cache for search log count to prevent overloading Supabase with polling
let cachedSearchLogsCount = null;
let lastCountFetchTime = 0;
const COUNT_CACHE_TTL_MS = 30000; // 30 seconds

const db = {
  // ── Voters Actions ─────────────────────────────────────────────────────────
  async addVoters(newVoters) {
    if (!hasSupabase) {
      return localDb.addVoters(newVoters);
    }
    
    logger.info(`[DB] Inserting ${newVoters.length} voters to Supabase...`);
    const dbVoters = newVoters.map(mapVoterToDb);
    
    // Insert in batches of 500 to avoid request body size limit errors
    const batchSize = 500;
    for (let i = 0; i < dbVoters.length; i += batchSize) {
      const batch = dbVoters.slice(i, i + batchSize);
      const { error } = await supabaseAdmin.from('voters').insert(batch);
      if (error) {
        logger.error(`[DB] Supabase voter insert error at batch starting at ${i}:`, error);
        throw error;
      }
    }
    return newVoters.length;
  },

  async deleteVotersByPdf(pdfUploadId) {
    if (!hasSupabase) {
      return localDb.deleteVotersByPdf(pdfUploadId);
    }
    logger.info(`[DB] Purging voters for PDF ${pdfUploadId} from Supabase...`);
    const { count, error } = await supabaseAdmin
      .from('voters')
      .delete({ count: 'exact' })
      .eq('pdf_upload_id', pdfUploadId);
      
    if (error) {
      logger.error('[DB] Supabase delete voters error:', error);
      throw error;
    }
    return count || 0;
  },

  async deleteVoterById(id) {
    if (!hasSupabase) {
      return localDb.deleteVoterById(id);
    }
    logger.info(`[DB] Purging voter ${id} from Supabase...`);
    const { count, error } = await supabaseAdmin
      .from('voters')
      .delete({ count: 'exact' })
      .eq('id', id);
      
    if (error) {
      logger.error('[DB] Supabase delete voter error:', error);
      throw error;
    }
    return count || 0;
  },

  async searchVoters({ 
    name, fatherName, motherName, village, voterArea, upazila, district, 
    voterNo, nid, occupation, gender, page = 1, limit = 100 
  }) {
    if (!hasSupabase) {
      return localDb.searchVoters({ 
        name, fatherName, motherName, village, voterArea, upazila, district, 
        voterNo, nid, occupation, gender, page, limit 
      });
    }

    logger.debug(`[DB] Running Supabase voter search...`);
    let query = supabaseAdmin.from('voters').select('*', { count: 'exact' });

    // Apply exact filter matches
    if (voterNo && voterNo.trim()) {
      query = query.ilike('voter_no', `%${voterNo.trim()}%`);
    }
    if (nid && nid.trim()) {
      query = query.eq('nid', nid.trim());
    }
    if (gender && gender !== 'all') {
      const genderBn = gender === 'male' ? 'পুরুষ' : gender === 'female' ? 'মহিলা' : '';
      if (genderBn) {
        query = query.eq('gender', genderBn);
      }
    }

    // Apply phonetic search matching using consonant skeleton conversion
    if (name && name.trim()) {
      query = query.ilike('name_bn', `%${name.trim()}%`); 
    }
    if (fatherName && fatherName.trim()) {
      query = query.ilike('father_name', `%${fatherName.trim()}%`);
    }
    if (motherName && motherName.trim()) {
      query = query.ilike('mother_name', `%${motherName.trim()}%`);
    }
    if (village && village.trim()) {
      const term = village.trim();
      query = query.or(`village.ilike.%${term}%,voter_area.ilike.%${term}%`);
    }
    if (voterArea && voterArea.trim()) {
      const term = voterArea.trim();
      query = query.or(`voter_area.ilike.%${term}%,village.ilike.%${term}%`);
    }
    if (upazila && upazila.trim()) {
      query = query.eq('upazila', upazila.trim());
    }
    if (district && district.trim()) {
      query = query.eq('district', district.trim());
    }
    if (occupation && occupation.trim()) {
      query = query.eq('occupation', occupation.trim());
    }

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit) || 100));
    const from = (pageNum - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      logger.error('[DB] Supabase search error:', error);
      throw error;
    }

    const results = (data || []).map(mapVoterFromDb);
    return { results, total: count || 0, page: pageNum, limit: pageSize };
  },

  // ── PDF Metadata Collection Actions ────────────────────────────────────────
  async getPdfs() {
    if (!hasSupabase) {
      return localDb.getPdfs();
    }
    
    logger.debug('[DB] Fetching PDFs list from Supabase...');
    const { data, error } = await supabaseAdmin
      .from('pdf_uploads')
      .select('*')
      .order('uploaded_at', { ascending: false });
      
    if (error) {
      logger.error('[DB] Supabase getPdfs error:', error);
      throw error;
    }
    return (data || []).map(mapPdfFromDb);
  },

  async addPdf(pdf) {
    if (!hasSupabase) {
      return localDb.addPdf(pdf);
    }
    
    logger.info(`[DB] Inserting PDF metadata ${pdf.id} to Supabase...`);
    const dbPdf = mapPdfToDb(pdf);
    const { error } = await supabaseAdmin.from('pdf_uploads').insert(dbPdf);
    if (error) {
      logger.error('[DB] Supabase addPdf error:', error);
      throw error;
    }
    return pdf;
  },

  async getPdfById(id) {
    if (!hasSupabase) {
      return localDb.getPdfById(id);
    }
    
    logger.debug(`[DB] Fetching PDF metadata ${id} from Supabase...`);
    const { data, error } = await supabaseAdmin
      .from('pdf_uploads')
      .select('*')
      .eq('id', id)
      .maybeSingle();
      
    if (error) {
      logger.error('[DB] Supabase getPdfById error:', error);
      throw error;
    }
    return data ? mapPdfFromDb(data) : null;
  },

  async updatePdfVoterCount(id, count) {
    if (!hasSupabase) {
      return localDb.updatePdfVoterCount(id, count);
    }
    
    logger.info(`[DB] Updating voter count on PDF ${id} to ${count} in Supabase...`);
    const { error } = await supabaseAdmin
      .from('pdf_uploads')
      .update({ voter_count: count })
      .eq('id', id);
      
    if (error) {
      logger.error('[DB] Supabase updatePdfVoterCount error:', error);
      throw error;
    }
  },

  async deletePdf(id) {
    if (!hasSupabase) {
      return localDb.deletePdf(id);
    }
    
    logger.info(`[DB] Deleting PDF metadata ${id} from Supabase...`);
    const { error } = await supabaseAdmin
      .from('pdf_uploads')
      .delete()
      .eq('id', id);
      
    if (error) {
      logger.error('[DB] Supabase deletePdf error:', error);
      throw error;
    }
  },

  // ── Search Logs Actions ──────────────────────────────────────────────────
  async addSearchLog(log) {
    if (!hasSupabase) {
      const saved = await localDb.addSearchLog(log);
      if (cachedSearchLogsCount !== null) {
        cachedSearchLogsCount++;
      }
      return saved;
    }
    
    logger.info(`[DB] Inserting search log ${log.id} to Supabase...`);
    const dbLog = mapSearchLogToDb(log);
    const { error } = await supabaseAdmin.from('search_logs').insert(dbLog);
    if (error) {
      logger.error('[DB] Supabase addSearchLog error:', error);
      throw error;
    }
    
    if (cachedSearchLogsCount !== null) {
      cachedSearchLogsCount++;
    }
    
    return log;
  },

  async getSearchLogs(limit = 100) {
    if (!hasSupabase) {
      return localDb.getSearchLogs();
    }
    
    logger.debug('[DB] Fetching search logs from Supabase...');
    const { data, error } = await supabaseAdmin
      .from('search_logs')
      .select('*')
      .order('date_time', { ascending: false })
      .limit(limit);
      
    if (error) {
      logger.error('[DB] Supabase getSearchLogs error:', error);
      throw error;
    }
    return (data || []).map(mapSearchLogFromDb);
  },

  async getSearchLogsCount() {
    if (!hasSupabase) {
      return (localDb.getSearchLogs() || []).length;
    }
    
    const now = Date.now();
    if (cachedSearchLogsCount !== null && (now - lastCountFetchTime < COUNT_CACHE_TTL_MS)) {
      return cachedSearchLogsCount;
    }
    
    logger.debug('[DB] Fetching search logs count from Supabase...');
    const { count, error } = await supabaseAdmin
      .from('search_logs')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      logger.error('[DB] Supabase getSearchLogsCount error:', error);
      if (cachedSearchLogsCount !== null) {
        return cachedSearchLogsCount; // Fallback to stale cache on network/DB failure
      }
      throw error;
    }
    
    cachedSearchLogsCount = count || 0;
    lastCountFetchTime = now;
    return cachedSearchLogsCount;
  },

  invalidateCache() {
    localDb.invalidateCache();
  },

  flush() {
    localDb.flush();
  }
};

module.exports = db;
