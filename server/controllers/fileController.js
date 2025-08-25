const mongoose = require('mongoose');
const multer = require('multer');
const { GridFSBucket } = require('mongodb');
const User = require('../models/User');
const { processPDF } = require('../utils/pdfParser');

let gfsBucket;

// Initialize GridFS
mongoose.connection.once('open', () => {
  gfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow PDF and text files
  if (file.mimetype === 'application/pdf' || 
      file.mimetype === 'text/plain' || 
      file.mimetype === 'text/markdown') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF and text files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// @desc    Upload file
// @route   POST /api/files/upload
// @access  Private
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { originalname, mimetype, buffer } = req.file;
    const userId = req.user.id;

    // Create upload stream to GridFS
    const uploadStream = gfsBucket.openUploadStream(originalname, {
      metadata: {
        userId,
        originalName: originalname,
        mimetype,
        uploadDate: new Date()
      }
    });

    let extractedText = '';
    let processingResult = null;

    // Process file based on type
    if (mimetype === 'application/pdf') {
      processingResult = await processPDF(buffer);
      if (processingResult.success) {
        extractedText = processingResult.cleanedText;
      }
    } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
      extractedText = buffer.toString('utf-8');
    }

    // Upload file to GridFS
    uploadStream.end(buffer);

    uploadStream.on('finish', async () => {
      try {
        // Update user's uploaded files
        const user = await User.findById(userId);
        user.uploadedFiles.push({
          filename: uploadStream.filename,
          originalName: originalname,
          fileId: uploadStream.id,
          fileType: mimetype,
          extractedText
        });

        // Update stats
        user.stats.totalNotes += 1;
        
        // Add study activity
        user.studyHistory.push({
          activity: 'note_created',
          details: `Uploaded file: ${originalname}`,
          timestamp: new Date()
        });

        // Update streak
        user.updateStreak();

        // Check for badges
        if (user.uploadedFiles.length === 1) {
          user.addBadge('First Upload', 'Uploaded your first file!', '📁');
        } else if (user.uploadedFiles.length === 10) {
          user.addBadge('File Master', 'Uploaded 10 files!', '🗂️');
        }

        await user.save();

        res.status(201).json({
          success: true,
          message: 'File uploaded successfully',
          file: {
            id: uploadStream.id,
            filename: uploadStream.filename,
            originalName: originalname,
            mimetype,
            extractedText,
            processingResult: processingResult?.keyInfo || null
          }
        });
      } catch (error) {
        console.error('Error updating user after file upload:', error);
        res.status(500).json({
          success: false,
          message: 'File uploaded but failed to update user data'
        });
      }
    });

    uploadStream.on('error', (error) => {
      console.error('GridFS upload error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    });

  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during file upload'
    });
  }
};

// @desc    Get file by ID
// @route   GET /api/files/:id
// @access  Private
const getFile = async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Check if file exists and user has access
    const file = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!file || file.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileDoc = file[0];
    
    // Check if user owns the file
    if (fileDoc.metadata.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Set appropriate headers
    res.set({
      'Content-Type': fileDoc.metadata.mimetype,
      'Content-Disposition': `attachment; filename="${fileDoc.metadata.originalName}"`
    });

    // Stream file to response
    const downloadStream = gfsBucket.openDownloadStream(fileId);
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('File download error:', error);
      res.status(500).json({
        success: false,
        message: 'Error downloading file'
      });
    });

  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving file'
    });
  }
};

// @desc    Delete file
// @route   DELETE /api/files/:id
// @access  Private
const deleteFile = async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    
    // Check if file exists and user has access
    const file = await gfsBucket.find({ _id: fileId }).toArray();
    
    if (!file || file.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'File not found'
      });
    }

    const fileDoc = file[0];
    
    // Check if user owns the file
    if (fileDoc.metadata.userId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Delete file from GridFS
    await gfsBucket.delete(fileId);

    // Remove from user's uploaded files
    const user = await User.findById(req.user.id);
    user.uploadedFiles = user.uploadedFiles.filter(
      file => file.fileId.toString() !== fileId.toString()
    );
    await user.save();

    res.status(200).json({
      success: true,
      message: 'File deleted successfully'
    });

  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting file'
    });
  }
};

// @desc    Get user's files
// @route   GET /api/files
// @access  Private
const getUserFiles = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('uploadedFiles');
    
    res.status(200).json({
      success: true,
      files: user.uploadedFiles
    });
  } catch (error) {
    console.error('Get user files error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving files'
    });
  }
};

// @desc    Extract text from uploaded file
// @route   POST /api/files/extract-text
// @access  Private
const extractTextFromFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const { mimetype, buffer } = req.file;
    let extractedText = '';
    let processingResult = null;

    // Process file based on type
    if (mimetype === 'application/pdf') {
      processingResult = await processPDF(buffer);
      if (processingResult.success) {
        extractedText = processingResult.cleanedText;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Failed to extract text from PDF',
          error: processingResult.error
        });
      }
    } else if (mimetype === 'text/plain' || mimetype === 'text/markdown') {
      extractedText = buffer.toString('utf-8');
    }

    res.status(200).json({
      success: true,
      extractedText,
      processingResult: processingResult?.keyInfo || null
    });

  } catch (error) {
    console.error('Text extraction error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during text extraction'
    });
  }
};

module.exports = {
  upload,
  uploadFile,
  getFile,
  deleteFile,
  getUserFiles,
  extractTextFromFile
};
