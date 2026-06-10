const db = require('../services/localDb');
const logger = require('../utils/logger');

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
exports.searchVoters = (req, res, next) => {
  try {
    const startTime = Date.now();
    const {
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    } = req.query;

    // Invoke the high-speed phonetic indexed search engine
    const { results, total, page: currentPage, limit: currentLimit } = db.searchVoters({
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    });

    const duration = Date.now() - startTime;
    logger.logSearch({ name, fatherName, village, district }, results.length, duration, req.id);

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
exports.deleteVotersByPdf = (req, res, next) => {
  try {
    const { pdfUploadId } = req.params;
    const count = db.deleteVotersByPdf(pdfUploadId);
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
exports.deleteVoter = (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteVoterById(id);
    if (deleted === 0) {
      return res.status(404).json({ success: false, message: 'ভোটার পাওয়া যায়নি।' });
    }
    res.json({ success: true, message: 'ভোটার মুছে ফেলা হয়েছে।' });
  } catch (err) {
    next(err);
  }
};
