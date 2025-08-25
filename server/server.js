const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const server = createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com'] 
      : ['http://localhost:3000', 'http://localhost:8000'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-frontend-domain.com'] 
    : ['http://localhost:3000', 'http://localhost:8000'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));
app.use('/api/notes', require('./routes/notesRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join study room
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', { userId, socketId: socket.id });
    console.log(`User ${userId} joined room ${roomId}`);
  });

  // Leave study room
  socket.on('leave-room', (roomId, userId) => {
    socket.leave(roomId);
    socket.to(roomId).emit('user-left', { userId, socketId: socket.id });
    console.log(`User ${userId} left room ${roomId}`);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    socket.to(data.roomId).emit('chat-message', {
      message: data.message,
      userId: data.userId,
      username: data.username,
      timestamp: new Date().toISOString()
    });
  });

  // Handle note sharing
  socket.on('share-note', (data) => {
    socket.to(data.roomId).emit('shared-note', {
      noteId: data.noteId,
      noteTitle: data.noteTitle,
      noteContent: data.noteContent,
      sharedBy: data.userId,
      timestamp: new Date().toISOString()
    });
  });

  // Handle quiz sharing
  socket.on('share-quiz', (data) => {
    socket.to(data.roomId).emit('shared-quiz', {
      quiz: data.quiz,
      sharedBy: data.userId,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Error handling middleware
app.use(require('./middlewares/errorMiddleware'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    message: 'AI Study Buddy Server is running!',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app, io };
