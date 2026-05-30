const express = require('express');
const router = express.Router();
const voterController = require('../controllers/voterController');

/**
 * --- Voter Management Routes ---
 */

// GET /api/voters/search — Query voters dynamically
router.get('/search', voterController.searchVoters);

// POST /api/voters/register — Add single voter record
router.post('/register', voterController.createVoter);

// POST /api/voters/bulk-import — Bulk import voters from CSV/manual entry
router.post('/bulk-import', voterController.bulkImportVoters);

// DELETE /api/voters/:id — Delete a single voter
router.delete('/:id', voterController.deleteVoter);

// DELETE /api/voters/by-pdf/:pdfUploadId — Delete all voters linked to a PDF
router.delete('/by-pdf/:pdfUploadId', voterController.deleteVotersByPdf);

module.exports = router;
