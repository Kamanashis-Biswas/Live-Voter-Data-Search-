const express = require('express');
const router = express.Router();
const pdfController = require('../controllers/pdfController');

/**
 * --- PDF Upload Metadata Routes ---
 */

// GET /api/pdf/list — Get all uploaded PDF records
router.get('/list', pdfController.getPdfList);

// POST /api/pdf/upload-meta — Save PDF cover page metadata
router.post('/upload-meta', pdfController.createPdfUpload);

// PATCH /api/pdf/:id/voter-count — Update voter count for a PDF
router.patch('/:id/voter-count', pdfController.updatePdfVoterCount);

// DELETE /api/pdf/:id — Delete PDF metadata record
router.delete('/:id', pdfController.deletePdfUpload);

module.exports = router;
