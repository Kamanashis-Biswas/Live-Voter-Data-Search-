const express = require('express');
const router = express.Router();
const voterController = require('../controllers/voterController');

// GET /api/voters/search — Search voters
router.get('/search', voterController.searchVoters);

// DELETE /api/voters/by-pdf/:pdfUploadId — Delete by PDF
router.delete('/by-pdf/:pdfUploadId', voterController.deleteVotersByPdf);

// DELETE /api/voters/:id — Delete single voter
router.delete('/:id', voterController.deleteVoter);

module.exports = router;
