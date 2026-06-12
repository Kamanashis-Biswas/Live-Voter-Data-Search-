const express = require('express');
const router = express.Router();
const voterController = require('../controllers/voterController');

/**
 * @file voterRoutes.js
 * @description API router mapping endpoints for querying voter indexes, 
 * purging entries by uploaded document, and removing single records.
 * 
 * @author Kamanashis Biswas
 * @version 5.0.0
 */

// GET /api/voters/search — Invokes fast fuzzy phonetic searches on voter records
router.get('/search', voterController.searchVoters);

// GET /api/voters/search-logs — Exposes logged search activity
router.get('/search-logs', voterController.getSearchLogs);

// DELETE /api/voters/by-pdf/:pdfUploadId — Deletes all voter records associated with a parent PDF
router.delete('/by-pdf/:pdfUploadId', voterController.deleteVotersByPdf);

// DELETE /api/voters/:id — Removes a single voter record by its database UUID
router.delete('/:id', voterController.deleteVoter);

module.exports = router;
