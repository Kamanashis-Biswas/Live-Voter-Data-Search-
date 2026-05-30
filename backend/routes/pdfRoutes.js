const express = require('express');
const router = express.Router();
const multer = require('multer');
const pdfController = require('../controllers/pdfController');

// Use memory storage — buffer passed directly to pdf-parse
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('শুধুমাত্র PDF ফাইল গ্রহণযোগ্য।'));
    }
  }
});

// GET /api/pdf/list — All uploaded PDFs
router.get('/list', pdfController.getPdfList);

// POST /api/pdf/upload — Upload + parse actual PDF file
router.post('/upload', upload.single('pdfFile'), pdfController.uploadPdf);

// GET /api/pdf/:id/file — Serve PDF file for browser viewing
router.get('/:id/file', pdfController.servePdfFile);

// DELETE /api/pdf/:id — Delete PDF + voters
router.delete('/:id', pdfController.deletePdf);

module.exports = router;
