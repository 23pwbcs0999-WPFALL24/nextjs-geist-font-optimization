const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const {
  upload,
  uploadFile,
  getFile,
  deleteFile,
  getUserFiles,
  extractTextFromFile
} = require('../controllers/fileController');

// Apply auth middleware to all routes
router.use(authMiddleware);

// @route   POST /api/files/upload
// @desc    Upload file
// @access  Private
router.post('/upload', upload.single('file'), uploadFile);

// @route   GET /api/files
// @desc    Get user's files
// @access  Private
router.get('/', getUserFiles);

// @route   GET /api/files/:id
// @desc    Get file by ID
// @access  Private
router.get('/:id', getFile);

// @route   DELETE /api/files/:id
// @desc    Delete file
// @access  Private
router.delete('/:id', deleteFile);

// @route   POST /api/files/extract-text
// @desc    Extract text from uploaded file
// @access  Private
router.post('/extract-text', upload.single('file'), extractTextFromFile);

module.exports = router;
