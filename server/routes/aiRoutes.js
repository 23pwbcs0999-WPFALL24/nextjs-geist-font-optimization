const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  generateSummary,
  generateFlashcards,
  generateQuiz,
  chatWithAI
} = require('../controllers/aiController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// @route   POST /api/ai/summarize
// @desc    Generate text summary
// @access  Private
router.post('/summarize', generateSummary);

// @route   POST /api/ai/flashcards
// @desc    Generate flashcards
// @access  Private
router.post('/flashcards', generateFlashcards);

// @route   POST /api/ai/quiz
// @desc    Generate quiz
// @access  Private
router.post('/quiz', generateQuiz);

// @route   POST /api/ai/chat
// @desc    Chat with AI assistant
// @access  Private
router.post('/chat', chatWithAI);

module.exports = router;
