const db = require('../services/db');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * @file voterController.js
 * @description Controller handling Express voter query routes, removal endpoints, 
 * and search parameter parsing to query the flat-file database.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

/**
 * Performs a fuzzy phonetic search on voter records.
 * 
 * @param {object} req - Express request holding query parameters.
 * @param {object} res - Express response containing paginated result sets.
 * @param {function} next - Express next callback.
 */
exports.searchVoters = async (req, res, next) => {
  try {
    const startTime = Date.now();
    const {
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    } = req.query;

    // Invoke the high-speed phonetic indexed search engine
    const { results, total, page: currentPage, limit: currentLimit } = await db.searchVoters({
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    });

    const duration = Date.now() - startTime;
    logger.logSearch({ name, fatherName, village, district }, results.length, duration, req.id);

    // Save search log to DB asynchronously
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const queryParts = [];
    if (name) queryParts.push(`নাম: ${name}`);
    if (fatherName) queryParts.push(`পিতা: ${fatherName}`);
    if (motherName) queryParts.push(`মাতা: ${motherName}`);
    if (village) queryParts.push(`গ্রাম/মহল্লা: ${village}`);
    if (voterArea) queryParts.push(`এলাকা: ${voterArea}`);
    if (upazila) queryParts.push(`উপজেলা: ${upazila}`);
    if (district) queryParts.push(`জেলা: ${district}`);
    if (voterNo) queryParts.push(`ভোটার নম্বর: ${voterNo}`);
    if (nid) queryParts.push(`NID: ${nid}`);
    const querySummary = queryParts.join(', ') || 'সাধারণ অনুসন্ধান';

    const logEntry = {
      id: uuidv4(),
      dateTime: new Date().toISOString(),
      ipAddress: ip.split(',')[0].trim(), // Extract client IP if multiple proxies exist
      query: querySummary,
      responseTime: `${duration}ms`,
      status: results.length > 0 ? 'Success' : 'Failed',
      method: village ? 'VILLAGE_SEARCH' : 'NAME_SEARCH'
    };
    db.addSearchLog(logEntry).catch(err => logger.error('[DB] Failed to save search log', err));

    res.json({
      success: true,
      count: results.length,
      total,
      page: currentPage,
      limit: currentLimit,
      results,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Purges all voters uploaded from a specific PDF identifier.
 * 
 * @param {object} req - Express request holding `pdfUploadId` in params.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.deleteVotersByPdf = async (req, res, next) => {
  try {
    const { pdfUploadId } = req.params;
    const count = await db.deleteVotersByPdf(pdfUploadId);
    res.json({ success: true, message: `${count} জন ভোটার মুছে ফেলা হয়েছে।`, count });
  } catch (err) {
    next(err);
  }
};

/**
 * Purges a single voter record by its database identifier.
 * 
 * @param {object} req - Express request holding voter UUID in params.
 * @param {object} res - Express response.
 * @param {function} next - Express next callback.
 */
exports.deleteVoter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteVoterById(id);
    if (deleted === 0) {
      return res.status(404).json({ success: false, message: 'ভোটার পাওয়া যায়নি।' });
    }
    res.json({ success: true, message: 'ভোটার মুছে ফেলা হয়েছে।' });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches recent search logs from the system.
 */
exports.getSearchLogs = async (req, res, next) => {
  try {
    const logs = await db.getSearchLogs(100);
    res.json({ success: true, logs });
  } catch (err) {
    next(err);
  }
};

