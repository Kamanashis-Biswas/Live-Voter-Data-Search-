const db = require('../services/localDb');

/**
 * GET /api/voters/search
 * Search voter records from local JSON database.
 */
exports.searchVoters = (req, res, next) => {
  try {
    const {
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    } = req.query;

    const { results, total, page: currentPage, limit: currentLimit } = db.searchVoters({
      name, fatherName, motherName, village, voterArea,
      upazila, district, nid, voterNo, occupation, gender,
      page, limit
    });

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

/**
 * DELETE /api/voters/:id
 * Delete a single voter record by ID.
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
