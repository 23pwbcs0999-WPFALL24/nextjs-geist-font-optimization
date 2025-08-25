const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Note title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  content: {
    type: String,
    required: [true, 'Note content is required']
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  category: {
    type: String,
    enum: ['personal', 'academic', 'work', 'research', 'other'],
    default: 'personal'
  },
  source: {
    type: {
      type: String,
      enum: ['manual', 'pdf_upload', 'text_upload'],
      default: 'manual'
    },
    fileId: mongoose.Schema.Types.ObjectId,
    fileName: String
  },
  aiGenerated: {
    summary: String,
    flashcards: [{
      question: String,
      answer: String,
      difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
      }
    }],
    quiz: [{
      question: String,
      options: [String],
      correctAnswer: Number,
      explanation: String
    }]
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['read', 'edit'],
      default: 'read'
    }
  }],
  studyRooms: [{
    roomId: String,
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    wordCount: Number,
    readingTime: Number, // in minutes
    lastModified: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true
});

// Indexes for better search performance
noteSchema.index({ user: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ title: 'text', content: 'text' });

// Pre-save middleware to calculate metadata
noteSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    // Calculate word count
    this.metadata.wordCount = this.content.split(/\s+/).filter(word => word.length > 0).length;
    
    // Calculate reading time (average 200 words per minute)
    this.metadata.readingTime = Math.ceil(this.metadata.wordCount / 200);
    
    // Update last modified
    this.metadata.lastModified = new Date();
    
    // Increment version if content changed
    if (!this.isNew) {
      this.metadata.version += 1;
    }
  }
  next();
});

// Static method to search notes
noteSchema.statics.searchNotes = function(userId, query, tags = [], category = null) {
  const searchCriteria = { user: userId };
  
  if (query) {
    searchCriteria.$text = { $search: query };
  }
  
  if (tags.length > 0) {
    searchCriteria.tags = { $in: tags };
  }
  
  if (category) {
    searchCriteria.category = category;
  }
  
  return this.find(searchCriteria)
    .sort({ createdAt: -1 })
    .populate('user', 'name email');
};

// Instance method to add tags
noteSchema.methods.addTags = function(newTags) {
  const tagsToAdd = newTags.filter(tag => !this.tags.includes(tag.toLowerCase()));
  this.tags.push(...tagsToAdd.map(tag => tag.toLowerCase()));
  return this.save();
};

// Instance method to remove tags
noteSchema.methods.removeTags = function(tagsToRemove) {
  this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
  return this.save();
};

// Instance method to share note
noteSchema.methods.shareWithUser = function(userId, permission = 'read') {
  const existingShare = this.sharedWith.find(share => share.user.toString() === userId);
  
  if (existingShare) {
    existingShare.permission = permission;
  } else {
    this.sharedWith.push({ user: userId, permission });
  }
  
  return this.save();
};

module.exports = mongoose.model('Note', noteSchema);
