const User = require('../models/User');

// @desc    Get user progress metrics
// @route   GET /api/progress
// @access  Private
const getUserProgress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Calculate additional progress metrics
    const totalActivities = user.studyHistory.length;
    const recentActivities = user.studyHistory.slice(-10);
    
    // Calculate study streak
    const currentStreak = user.streaks.current;
    const longestStreak = user.streaks.longest;
    
    // Calculate completion rates
    const completionRate = user.stats.totalQuizzes > 0 
      ? Math.round((user.stats.totalQuizzes / (user.stats.totalNotes + user.stats.totalQuizzes)) * 100)
      : 0;

    // Calculate weekly activity
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weeklyActivities = user.studyHistory.filter(
      activity => new Date(activity.timestamp) >= oneWeekAgo
    ).length;

    // Calculate monthly activity
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const monthlyActivities = user.studyHistory.filter(
      activity => new Date(activity.timestamp) >= oneMonthAgo
    ).length;

    // Progress levels based on total activities
    let level = 1;
    let nextLevelThreshold = 10;
    
    if (totalActivities >= 100) {
      level = 10;
      nextLevelThreshold = 150;
    } else if (totalActivities >= 50) {
      level = 5;
      nextLevelThreshold = 100;
    } else if (totalActivities >= 25) {
      level = 3;
      nextLevelThreshold = 50;
    } else if (totalActivities >= 10) {
      level = 2;
      nextLevelThreshold = 25;
    }

    const progressToNextLevel = Math.round((totalActivities / nextLevelThreshold) * 100);

    // Activity breakdown by type
    const activityBreakdown = {
      notes: user.studyHistory.filter(a => a.activity.includes('note')).length,
      summaries: user.studyHistory.filter(a => a.activity.includes('summary')).length,
      flashcards: user.studyHistory.filter(a => a.activity.includes('flashcard')).length,
      quizzes: user.studyHistory.filter(a => a.activity.includes('quiz')).length,
      uploads: user.studyHistory.filter(a => a.activity.includes('upload')).length
    };

    // Study consistency (days studied in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const studyDays = new Set();
    user.studyHistory.forEach(activity => {
      const activityDate = new Date(activity.timestamp);
      if (activityDate >= thirtyDaysAgo) {
        studyDays.add(activityDate.toDateString());
      }
    });

    const studyConsistency = Math.round((studyDays.size / 30) * 100);

    res.status(200).json({
      success: true,
      progress: {
        // Basic stats
        stats: user.stats,
        streaks: user.streaks,
        badges: user.badges,
        
        // Calculated metrics
        level,
        nextLevelThreshold,
        progressToNextLevel,
        totalActivities,
        completionRate,
        studyConsistency,
        
        // Time-based activities
        weeklyActivities,
        monthlyActivities,
        
        // Activity breakdown
        activityBreakdown,
        
        // Recent activities
        recentActivities,
        
        // Additional insights
        insights: {
          mostActiveDay: getMostActiveDay(user.studyHistory),
          averageSessionLength: calculateAverageSessionLength(user.studyHistory),
          favoriteActivity: getMostFrequentActivity(user.studyHistory),
          improvementSuggestions: generateImprovementSuggestions(user.stats, currentStreak)
        }
      }
    });

  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching progress'
    });
  }
};

// Helper function to get most active day of the week
const getMostActiveDay = (studyHistory) => {
  const dayCount = {};
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  studyHistory.forEach(activity => {
    const day = new Date(activity.timestamp).getDay();
    const dayName = days[day];
    dayCount[dayName] = (dayCount[dayName] || 0) + 1;
  });
  
  return Object.keys(dayCount).reduce((a, b) => dayCount[a] > dayCount[b] ? a : b, 'Monday');
};

// Helper function to calculate average session length
const calculateAverageSessionLength = (studyHistory) => {
  if (studyHistory.length === 0) return 0;
  
  // Group activities by day and calculate session lengths
  const sessionsByDay = {};
  
  studyHistory.forEach(activity => {
    const date = new Date(activity.timestamp).toDateString();
    if (!sessionsByDay[date]) {
      sessionsByDay[date] = [];
    }
    sessionsByDay[date].push(new Date(activity.timestamp));
  });
  
  let totalSessionTime = 0;
  let sessionCount = 0;
  
  Object.values(sessionsByDay).forEach(sessions => {
    if (sessions.length > 1) {
      sessions.sort((a, b) => a - b);
      const sessionLength = (sessions[sessions.length - 1] - sessions[0]) / (1000 * 60); // in minutes
      totalSessionTime += sessionLength;
      sessionCount++;
    }
  });
  
  return sessionCount > 0 ? Math.round(totalSessionTime / sessionCount) : 15; // default 15 minutes
};

// Helper function to get most frequent activity type
const getMostFrequentActivity = (studyHistory) => {
  const activityCount = {};
  
  studyHistory.forEach(activity => {
    const type = activity.activity.split('_')[0]; // Get first part of activity type
    activityCount[type] = (activityCount[type] || 0) + 1;
  });
  
  return Object.keys(activityCount).reduce((a, b) => 
    activityCount[a] > activityCount[b] ? a : b, 'note'
  );
};

// Helper function to generate improvement suggestions
const generateImprovementSuggestions = (stats, currentStreak) => {
  const suggestions = [];
  
  if (currentStreak === 0) {
    suggestions.push("Start a study streak by completing an activity today!");
  } else if (currentStreak < 7) {
    suggestions.push("Keep building your study streak - you're doing great!");
  }
  
  if (stats.totalNotes < 10) {
    suggestions.push("Try creating more notes to organize your learning better.");
  }
  
  if (stats.totalSummaries === 0) {
    suggestions.push("Use the AI summarizer to quickly understand key concepts.");
  }
  
  if (stats.totalFlashcards < 20) {
    suggestions.push("Create more flashcards to improve your retention.");
  }
  
  if (stats.totalQuizzes < 5) {
    suggestions.push("Take more quizzes to test your knowledge.");
  }
  
  if (suggestions.length === 0) {
    suggestions.push("You're doing excellent! Keep up the consistent study habits.");
  }
  
  return suggestions;
};

module.exports = {
  getUserProgress
};
