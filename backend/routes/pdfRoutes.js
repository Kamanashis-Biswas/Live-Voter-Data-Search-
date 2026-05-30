const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfController = require('../controllers/pdfController');

/**
 * @file pdfRoutes.js
 * @description API router mapping endpoints for uploading, listing, deleting, 
 * and serving PDF files. Configures the Multer middleware memory limits.
 * 
 * DESIGN DECISIONS:
 *   - The raw file buffer is held in memoryStorage() instead of writing directly to disk first.
 *     This allows the parser to inspect and validate the file before committing permanent file writes.
 *   - Restricts file sizes to a max boundary of 50 Megabytes to prevent server crash crashes.
 *   - Validates the mime type and extension explicitly to ensure only .pdf files are accepted.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

// Configure Multer storage to allocate binary buffers inside server RAM
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB maximum upload ceiling
  fileFilter: (req, file, cb) => {
    // Restrict uploads strictly to valid PDF documents
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('শুধুমাত্র PDF ফাইল গ্রহণযোগ্য।'));
    }
  }
});

// GET /api/pdf/list — Retrieves a list of all uploaded PDFs from DB metadata
router.get('/list', pdfController.getPdfList);

// POST /api/pdf/upload — Intercepts file uploads, runs the extraction parser, and saves records
router.post('/upload', upload.single('pdfFile'), pdfController.uploadPdf);

// GET /api/pdf/:id/file — Streams the static PDF inline for viewing inside client canvas frames
router.get('/:id/file', pdfController.servePdfFile);

// DELETE /api/pdf/:id — Cascades deletion of the metadata record, physical file, and loaded voters
router.delete('/:id', pdfController.deletePdf);

module.exports = router;
