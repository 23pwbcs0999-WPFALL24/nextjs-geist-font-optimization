const axios = require('axios');
const User = require('../models/User');
const Note = require('../models/Note');

// Hugging Face API configuration
const HF_API_URL = 'https://api-inference.huggingface.co/models';
const HF_HEADERS = {
  'Authorization': `Bearer ${process.env.HUGGING_FACE_API_KEY}`,
  'Content-Type': 'application/json'
};

// Helper function to make Hugging Face API calls
const callHuggingFaceAPI = async (modelEndpoint, payload, retries = 3) => {
  try {
    const response = await axios.post(`${HF_API_URL}/${modelEndpoint}`, payload, {
      headers: HF_HEADERS,
      timeout: 30000 // 30 seconds timeout
    });
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 503 && retries > 0) {
      // Model is loading, wait and retry
      console.log(`Model loading, retrying in 5 seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return callHuggingFaceAPI(modelEndpoint, payload, retries - 1);
    }
    
    throw error;
  }
};

// @desc    Generate text summary
// @route   POST /api/ai/summarize
// @access  Private
const generateSummary = async (req, res) => {
  try {
    const { text, maxLength = 150 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for summarization'
      });
    }

    if (text.length < 100) {
      return res.status(400).json({
        success: false,
        message: 'Text is too short for meaningful summarization (minimum 100 characters)'
      });
    }

    // Use Facebook's BART model for summarization
    const payload = {
      inputs: text,
      parameters: {
        max_length: Math.min(maxLength, 500),
        min_length: 30,
        do_sample: false
      }
    };

    const result = await callHuggingFaceAPI('facebook/bart-large-cnn', payload);
    
    let summary = '';
    if (Array.isArray(result) && result.length > 0) {
      summary = result[0].summary_text || result[0].generated_text || '';
    }

    if (!summary) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate summary'
      });
    }

    // Update user stats
    const user = await User.findById(req.user.id);
    user.stats.totalSummaries += 1;
    user.studyHistory.push({
      activity: 'summary_generated',
      details: `Generated summary (${summary.length} characters)`,
      timestamp: new Date()
    });

    // Check for badges
    if (user.stats.totalSummaries === 1) {
      user.addBadge('AI Assistant', 'Generated your first AI summary!', '🤖');
    } else if (user.stats.totalSummaries === 25) {
      user.addBadge('Summary Master', 'Generated 25 AI summaries!', '📝');
    }

    await user.save();

    res.status(200).json({
      success: true,
      summary,
      originalLength: text.length,
      summaryLength: summary.length,
      compressionRatio: Math.round((1 - summary.length / text.length) * 100)
    });

  } catch (error) {
    console.error('Summary generation error:', error);
    
    if (error.response?.status === 503) {
      return res.status(503).json({
        success: false,
        message: 'AI model is currently loading. Please try again in a few moments.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// @desc    Generate flashcards
// @route   POST /api/ai/flashcards
// @access  Private
const generateFlashcards = async (req, res) => {
  try {
    const { text, count = 5 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for flashcard generation'
      });
    }

    // Create a prompt for flashcard generation
    const prompt = `Based on the following text, create ${count} educational flashcards in JSON format. Each flashcard should have a "question" and "answer" field. Focus on key concepts, definitions, and important facts.

Text: ${text}

Generate exactly ${count} flashcards in this JSON format:
[
  {"question": "What is...", "answer": "..."},
  {"question": "How does...", "answer": "..."}
]`;

    // Use a text generation model
    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: 1000,
        temperature: 0.7,
        return_full_text: false
      }
    };

    const result = await callHuggingFaceAPI('microsoft/DialoGPT-large', payload);
    
    let flashcards = [];
    
    try {
      // Try to extract JSON from the response
      let generatedText = '';
      if (Array.isArray(result) && result.length > 0) {
        generatedText = result[0].generated_text || '';
      }
      
      // Fallback: Create flashcards from key sentences
      if (!generatedText || !generatedText.includes('[')) {
        flashcards = createFallbackFlashcards(text, count);
      } else {
        // Try to parse JSON from response
        const jsonMatch = generatedText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          flashcards = JSON.parse(jsonMatch[0]);
        } else {
          flashcards = createFallbackFlashcards(text, count);
        }
      }
    } catch (parseError) {
      console.log('JSON parsing failed, using fallback method');
      flashcards = createFallbackFlashcards(text, count);
    }

    // Ensure we have valid flashcards
    if (!Array.isArray(flashcards) || flashcards.length === 0) {
      flashcards = createFallbackFlashcards(text, count);
    }

    // Update user stats
    const user = await User.findById(req.user.id);
    user.stats.totalFlashcards += flashcards.length;
    user.studyHistory.push({
      activity: 'flashcard_created',
      details: `Generated ${flashcards.length} flashcards`,
      timestamp: new Date()
    });

    // Check for badges
    if (user.stats.totalFlashcards >= 10 && user.stats.totalFlashcards < 20) {
      user.addBadge('Flashcard Creator', 'Created 10 flashcards!', '🎴');
    }

    await user.save();

    res.status(200).json({
      success: true,
      flashcards,
      count: flashcards.length
    });

  } catch (error) {
    console.error('Flashcard generation error:', error);
    
    // Fallback to simple flashcard generation
    try {
      const fallbackFlashcards = createFallbackFlashcards(req.body.text, req.body.count || 5);
      
      res.status(200).json({
        success: true,
        flashcards: fallbackFlashcards,
        count: fallbackFlashcards.length,
        note: 'Generated using fallback method'
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate flashcards'
      });
    }
  }
};

// Fallback flashcard generation
const createFallbackFlashcards = (text, count) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const flashcards = [];
  
  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const sentence = sentences[i].trim();
    if (sentence.length > 0) {
      // Create simple Q&A from sentences
      const words = sentence.split(' ');
      if (words.length > 5) {
        const keyWord = words.find(w => w.length > 4) || words[Math.floor(words.length / 2)];
        flashcards.push({
          question: `What is mentioned about ${keyWord}?`,
          answer: sentence,
          difficulty: 'medium'
        });
      }
    }
  }
  
  return flashcards.length > 0 ? flashcards : [
    {
      question: "What is the main topic of this text?",
      answer: text.substring(0, 100) + "...",
      difficulty: "easy"
    }
  ];
};

// @desc    Generate quiz
// @route   POST /api/ai/quiz
// @access  Private
const generateQuiz = async (req, res) => {
  try {
    const { text, questionCount = 5 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Text content is required for quiz generation'
      });
    }

    // Generate quiz using fallback method (more reliable)
    const quiz = createFallbackQuiz(text, questionCount);

    // Update user stats
    const user = await User.findById(req.user.id);
    user.stats.totalQuizzes += 1;
    user.studyHistory.push({
      activity: 'quiz_completed',
      details: `Generated quiz with ${quiz.length} questions`,
      timestamp: new Date()
    });

    // Check for badges
    if (user.stats.totalQuizzes === 5) {
      user.addBadge('Quiz Master', 'Generated 5 quizzes!', '🧠');
    }

    await user.save();

    res.status(200).json({
      success: true,
      quiz,
      questionCount: quiz.length
    });

  } catch (error) {
    console.error('Quiz generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz'
    });
  }
};

// Fallback quiz generation
const createFallbackQuiz = (text, count) => {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 30);
  const quiz = [];
  
  for (let i = 0; i < Math.min(count, sentences.length); i++) {
    const sentence = sentences[i].trim();
    const words = sentence.split(' ').filter(w => w.length > 3);
    
    if (words.length > 5) {
      const keyWord = words[Math.floor(Math.random() * words.length)];
      const options = [
        keyWord,
        generateRandomOption(keyWord),
        generateRandomOption(keyWord),
        generateRandomOption(keyWord)
      ].sort(() => Math.random() - 0.5);
      
      quiz.push({
        question: `According to the text, which word completes this context: "${sentence.replace(keyWord, '____')}"?`,
        options,
        correctAnswer: options.indexOf(keyWord),
        explanation: `The correct answer is "${keyWord}" as mentioned in the original text.`
      });
    }
  }
  
  return quiz.length > 0 ? quiz : [
    {
      question: "What is the main subject of this text?",
      options: ["Education", "Technology", "Science", "General Knowledge"],
      correctAnswer: 0,
      explanation: "This appears to be educational content."
    }
  ];
};

const generateRandomOption = (word) => {
  const alternatives = [
    word + 's', word.slice(0, -1), word + 'ing', word + 'ed',
    'alternative', 'option', 'choice', 'different'
  ];
  return alternatives[Math.floor(Math.random() * alternatives.length)];
};

// @desc    Chat with AI assistant
// @route   POST /api/ai/chat
// @access  Private
const chatWithAI = async (req, res) => {
  try {
    const { message, context = '' } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message is required for chat'
      });
    }

    // Create a study-focused prompt
    const prompt = `You are a helpful AI study assistant. ${context ? `Context: ${context}` : ''} 
    
Student question: ${message}

Provide a helpful, educational response:`;

    const payload = {
      inputs: prompt,
      parameters: {
        max_new_tokens: 200,
        temperature: 0.7,
        return_full_text: false
      }
    };

    let response = '';
    
    try {
      const result = await callHuggingFaceAPI('microsoft/DialoGPT-large', payload);
      
      if (Array.isArray(result) && result.length > 0) {
        response = result[0].generated_text || '';
      }
    } catch (apiError) {
      console.log('AI API failed, using fallback response');
    }

    // Fallback response if AI fails
    if (!response || response.length < 10) {
      response = generateFallbackResponse(message);
    }

    res.status(200).json({
      success: true,
      response: response.trim(),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat error:', error);
    
    // Always provide a fallback response
    const fallbackResponse = generateFallbackResponse(req.body.message);
    
    res.status(200).json({
      success: true,
      response: fallbackResponse,
      timestamp: new Date().toISOString(),
      note: 'Fallback response provided'
    });
  }
};

const generateFallbackResponse = (message) => {
  const responses = [
    "That's an interesting question! Let me help you think through this step by step.",
    "Great question! This topic requires careful consideration of several factors.",
    "I understand you're asking about this concept. Let's break it down together.",
    "This is a valuable learning opportunity. Consider researching this topic further.",
    "Excellent inquiry! This relates to important foundational concepts in your studies."
  ];
  
  return responses[Math.floor(Math.random() * responses.length)] + 
         " For more detailed information, I recommend consulting your study materials or asking your instructor.";
};

module.exports = {
  generateSummary,
  generateFlashcards,
  generateQuiz,
  chatWithAI
};
