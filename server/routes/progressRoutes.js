const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const { getUserProgress } = require('../controllers/progressController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// @route   GET /api/progress
// @desc    Get user progress metrics
// @access  Private
router.get('/', getUserProgress);

module.exports = router;
