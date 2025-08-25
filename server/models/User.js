const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      'Please enter a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  courses: [{
    name: String,
    description: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  uploadedFiles: [{
    filename: String,
    originalName: String,
    fileId: mongoose.Schema.Types.ObjectId,
    uploadDate: {
      type: Date,
      default: Date.now
    },
    fileType: String,
    extractedText: String
  }],
  studyHistory: [{
    activity: {
      type: String,
      enum: ['note_created', 'summary_generated', 'flashcard_created', 'quiz_completed', 'study_room_joined']
    },
    details: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  streaks: {
    current: {
      type: Number,
      default: 0
    },
    longest: {
      type: Number,
      default: 0
    },
    lastStudyDate: Date
  },
  badges: [{
    name: String,
    description: String,
    earnedAt: {
      type: Date,
      default: Date.now
    },
    icon: String
  }],
  preferences: {
    darkMode: {
      type: Boolean,
      default: false
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  stats: {
    totalNotes: {
      type: Number,
      default: 0
    },
    totalSummaries: {
      type: Number,
      default: 0
    },
    totalFlashcards: {
      type: Number,
      default: 0
    },
    totalQuizzes: {
      type: Number,
      default: 0
    },
    studyRoomsJoined: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Update study streak
userSchema.methods.updateStreak = function() {
  const today = new Date();
  const lastStudy = this.streaks.lastStudyDate;
  
  if (!lastStudy) {
    // First time studying
    this.streaks.current = 1;
    this.streaks.longest = 1;
  } else {
    const daysDiff = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 1) {
      // Consecutive day
      this.streaks.current += 1;
      if (this.streaks.current > this.streaks.longest) {
        this.streaks.longest = this.streaks.current;
      }
    } else if (daysDiff > 1) {
      // Streak broken
      this.streaks.current = 1;
    }
    // If daysDiff === 0, same day, don't update streak
  }
  
  this.streaks.lastStudyDate = today;
};

// Add badge method
userSchema.methods.addBadge = function(name, description, icon) {
  const existingBadge = this.badges.find(badge => badge.name === name);
  if (!existingBadge) {
    this.badges.push({ name, description, icon });
  }
};

module.exports = mongoose.model('User', userSchema);
