const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  createNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
  searchNotes,
  addTags,
  removeTags,
  shareNote,
  getAllTags
} = require('../controllers/notesController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// @route   GET /api/notes/search
// @desc    Search notes
// @access  Private
router.get('/search', searchNotes);

// @route   GET /api/notes/tags
// @desc    Get all available tags
// @access  Private
router.get('/tags', getAllTags);

// @route   POST /api/notes
// @desc    Create a new note
// @access  Private
router.post('/', createNote);

// @route   GET /api/notes
// @desc    Get all user notes
// @access  Private
router.get('/', getNotes);

// @route   GET /api/notes/:id
// @desc    Get single note
// @access  Private
router.get('/:id', getNote);

// @route   PUT /api/notes/:id
// @desc    Update note
// @access  Private
router.put('/:id', updateNote);

// @route   DELETE /api/notes/:id
// @desc    Delete note
// @access  Private
router.delete('/:id', deleteNote);

// @route   POST /api/notes/:id/tags
// @desc    Add tags to note
// @access  Private
router.post('/:id/tags', addTags);

// @route   DELETE /api/notes/:id/tags
// @desc    Remove tags from note
// @access  Private
router.delete('/:id/tags', removeTags);

// @route   POST /api/notes/:id/share
// @desc    Share note with user
// @access  Private
router.post('/:id/share', shareNote);

module.exports = router;
