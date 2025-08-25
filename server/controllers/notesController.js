const Note = require('../models/Note');
const User = require('../models/User');

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
const createNote = async (req, res) => {
  try {
    const { title, content, tags = [], category = 'personal', source } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title and content are required'
      });
    }

    const note = await Note.create({
      user: req.user.id,
      title: title.trim(),
      content: content.trim(),
      tags: tags.map(tag => tag.toLowerCase().trim()),
      category,
      source: source || { type: 'manual' }
    });

    // Update user stats
    const user = await User.findById(req.user.id);
    user.stats.totalNotes += 1;
    user.studyHistory.push({
      activity: 'note_created',
      details: `Created note: ${title}`,
      timestamp: new Date()
    });

    // Update streak
    user.updateStreak();

    // Check for badges
    if (user.stats.totalNotes === 1) {
      user.addBadge('Note Taker', 'Created your first note!', '📝');
    } else if (user.stats.totalNotes === 50) {
      user.addBadge('Prolific Writer', 'Created 50 notes!', '✍️');
    }

    await user.save();

    const populatedNote = await Note.findById(note._id).populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note: populatedNote
    });

  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating note'
    });
  }
};

// @desc    Get all user notes
// @route   GET /api/notes
// @access  Private
const getNotes = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      tags, 
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build search criteria
    let searchCriteria = { user: req.user.id };

    if (search) {
      searchCriteria.$text = { $search: search };
    }

    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim().toLowerCase());
      searchCriteria.tags = { $in: tagArray };
    }

    if (category && category !== 'all') {
      searchCriteria.category = category;
    }

    // Build sort criteria
    const sortCriteria = {};
    sortCriteria[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const notes = await Note.find(searchCriteria)
      .sort(sortCriteria)
      .skip(skip)
      .limit(limitNum)
      .populate('user', 'name email');

    const totalNotes = await Note.countDocuments(searchCriteria);
    const totalPages = Math.ceil(totalNotes / limitNum);

    res.status(200).json({
      success: true,
      notes,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalNotes,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });

  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notes'
    });
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
const getNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id).populate('user', 'name email');
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if user owns the note or has access
    if (note.user._id.toString() !== req.user.id && 
        !note.sharedWith.some(share => share.user.toString() === req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      note
    });

  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching note'
    });
  }
};

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
const updateNote = async (req, res) => {
  try {
    const { title, content, tags, category } = req.body;
    
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if user owns the note
    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update fields
    if (title) note.title = title.trim();
    if (content) note.content = content.trim();
    if (tags) note.tags = tags.map(tag => tag.toLowerCase().trim());
    if (category) note.category = category;

    await note.save();

    const updatedNote = await Note.findById(note._id).populate('user', 'name email');

    res.status(200).json({
      success: true,
      message: 'Note updated successfully',
      note: updatedNote
    });

  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating note'
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    // Check if user owns the note
    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await Note.findByIdAndDelete(req.params.id);

    // Update user stats
    const user = await User.findById(req.user.id);
    user.stats.totalNotes = Math.max(0, user.stats.totalNotes - 1);
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Note deleted successfully'
    });

  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting note'
    });
  }
};

// @desc    Search notes
// @route   GET /api/notes/search
// @access  Private
const searchNotes = async (req, res) => {
  try {
    const { q: query, tags, category } = req.query;
    
    if (!query && !tags && !category) {
      return res.status(400).json({
        success: false,
        message: 'Search query, tags, or category is required'
      });
    }

    const tagArray = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()) : [];
    
    const notes = await Note.searchNotes(req.user.id, query, tagArray, category);

    res.status(200).json({
      success: true,
      notes,
      count: notes.length
    });

  } catch (error) {
    console.error('Search notes error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while searching notes'
    });
  }
};

// @desc    Add tags to note
// @route   POST /api/notes/:id/tags
// @access  Private
const addTags = async (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags array is required'
      });
    }

    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await note.addTags(tags);

    res.status(200).json({
      success: true,
      message: 'Tags added successfully',
      tags: note.tags
    });

  } catch (error) {
    console.error('Add tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while adding tags'
    });
  }
};

// @desc    Remove tags from note
// @route   DELETE /api/notes/:id/tags
// @access  Private
const removeTags = async (req, res) => {
  try {
    const { tags } = req.body;
    
    if (!tags || !Array.isArray(tags)) {
      return res.status(400).json({
        success: false,
        message: 'Tags array is required'
      });
    }

    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    await note.removeTags(tags);

    res.status(200).json({
      success: true,
      message: 'Tags removed successfully',
      tags: note.tags
    });

  } catch (error) {
    console.error('Remove tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while removing tags'
    });
  }
};

// @desc    Share note with user
// @route   POST /api/notes/:id/share
// @access  Private
const shareNote = async (req, res) => {
  try {
    const { userEmail, permission = 'read' } = req.body;
    
    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required'
      });
    }

    const note = await Note.findById(req.params.id);
    
    if (!note) {
      return res.status(404).json({
        success: false,
        message: 'Note not found'
      });
    }

    if (note.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find user to share with
    const shareWithUser = await User.findOne({ email: userEmail.toLowerCase() });
    
    if (!shareWithUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await note.shareWithUser(shareWithUser._id, permission);

    res.status(200).json({
      success: true,
      message: 'Note shared successfully'
    });

  } catch (error) {
    console.error('Share note error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sharing note'
    });
  }
};

// @desc    Get all available tags
// @route   GET /api/notes/tags
// @access  Private
const getAllTags = async (req, res) => {
  try {
    const tags = await Note.distinct('tags', { user: req.user.id });
    
    res.status(200).json({
      success: true,
      tags: tags.sort()
    });

  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching tags'
    });
  }
};

module.exports = {
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
};
