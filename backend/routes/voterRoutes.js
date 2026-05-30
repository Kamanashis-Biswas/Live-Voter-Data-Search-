const express = require('express');
const router = express.Router();
const voterController = require('../controllers/voterController');

/**
 * --- Voter Management Routes ---
 */

// GET /api/voters/search - Query voters dynamically with parameters
router.get('/search', voterController.searchVoters);

// POST /api/voters/register - Add or insert new voter records
router.post('/register', voterController.createVoter);

module.exports = router;
