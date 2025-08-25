# Detailed Implementation Plan for "AI Study Buddy" MERN Stack Project

## Overview
This project builds “AI Study Buddy” using a React frontend with functional components/hooks and a Node.js/Express backend. Data is stored in MongoDB Atlas via Mongoose, with files stored in GridFS. Authentication uses JWT and AI functionalities are provided by the Hugging Face Inference API. Real-time study rooms are enabled via Socket.IO, and the UI uses pure CSS with a modern, minimal, and responsive card-based design including dark mode support.

## Project Structure
```
Project Root/

├── client/                 # Frontend (React/Next.js)
│   ├── package.json
│   ├── public/
│   │   └── (static assets)
│   └── src/
│       ├── app/           # Pages: Landing.jsx, Auth.jsx, Dashboard.jsx, Notes.jsx, AiTools.jsx, StudyRoom.jsx, Profile.jsx
│       ├── components/    # Reusable UI components (Navbar, Sidebar, Card, Toast, etc.)
│       ├── hooks/         # Custom hooks (useAuth.js, useSocket.js)
│       └── lib/           # API service (api.js)
│       └── styles/        # Global CSS (globals.css) with dark mode variables
└── server/                 # Backend (Express server)
    ├── package.json
    ├── server.js          # Main entry point
    ├── config/
    │     └── db.js        # MongoDB connection configuration
    ├── controllers/
    │     ├── authController.js      # Signup, login, profile retrieval
    │     ├── fileController.js      # File upload, GridFS handling, pdf-parse integration
    │     ├── notesController.js     # CRUD operations for notes with tag and search
    │     ├── aiController.js        # Endpoints for summarizer, flashcards, quiz, and chatbot using Hugging Face
    │     ├── studyRoomController.js # Socket.IO event handling for room chat and note sharing
    │     └── progressController.js  # User progress metrics
    ├── middlewares/
    │     ├── authMiddleware.js      # JWT token verification
    │     └── errorMiddleware.js     # Centralized error handling
    ├── models/
    │     ├── User.js                # User schema: name, email, hashed password, courses, files, study history, streaks, badges
    │     └── Note.js                # Note schema: user reference, content, tags, timestamps
    ├── routes/
    │     ├── authRoutes.js          # Routes for signup/login (/api/auth/signup, /api/auth/login)
    │     ├── fileRoutes.js          # File upload routes (/api/files/upload)
    │     ├── notesRoutes.js         # Note CRUD endpoints
    │     ├── aiRoutes.js            # AI tool endpoints (/api/ai/summarize, /api/ai/flashcards, etc.)
    │     ├── progressRoutes.js      # Progress tracking GET endpoint (/api/progress)
    │     └── (additional routes as needed)
    └── utils/
          └── pdfParser.js           # Utility to extract text from PDFs using pdf-parse
```

## Backend Implementation Details
1. **Setup & Configuration**  
   - In `server/package.json`, add dependencies: express, mongoose, dotenv, jsonwebtoken, bcrypt, multer, multer-gridfs-storage, pdf-parse, axios, socket.io.  
   - Create a `.env` file with `MONGO_URI`, `JWT_SECRET`, and `HUGGING_FACE_API_KEY`.  
   - In `server/server.js`: Initialize Express, connect to MongoDB (using the configuration in `config/db.js`), set up GridFS storage, instantiate Socket.IO, and include all route files; finally, add the error handling middleware.

2. **Models and Controllers**  
   - **User.js & Note.js:** Define schemas with required fields and relationships.  
   - **authController.js:** Implement signup and login with bcrypt; issue JWT token with secure error messages on invalid inputs.  
   - **fileController.js:** Use multer with GridFS to handle file uploads. Integrate `pdfParser.js` for PDF text extraction and send corresponding responses.  
   - **notesController.js:** Implement CRUD operations with tag-based filtering and search support.  
   - **aiController.js:** Implement endpoints for summarization, flashcards generation, quiz maker, and chatbot; use axios to call Hugging Face’s API (handle error responses and timeouts).  
   - **studyRoomController.js:** Configure Socket.IO events for joining/leaving rooms, real-time chat, shared notes and quizzes.  
   - **progressController.js:** Calculate and return user progress metrics.

3. **Middleware & Error Handling**  
   - **authMiddleware.js:** Validate the JWT token from Authorization headers.  
   - **errorMiddleware.js:** Centralized error capturing returning proper HTTP status codes and messages.

## Frontend Implementation Details
1. **Routing & Global Setup**  
   - In `client/package.json`, include React, react-router-dom (or Next.js routing), axios, and socket.io-client.  
   - Configure routes/pages for Landing, Auth (Signup/Login), Dashboard, Notes, AI Tools, Study Room, and Profile in `src/app`.

2. **UI Pages and Components**  
   - **Landing.jsx:** Present a hero section with a welcoming headline, a brief description, and “Sign Up” and “Login” buttons. Optionally include a placeholder `<img>`:
     ```html
     <img src="https://placehold.co/1920x1080?text=Modern+minimalist+app+landing+page+with+soft+colors" alt="Modern minimalist app landing page with soft colors" onerror="this.onerror=null;this.src='fallback.jpg';" />
     ```
   - **Auth.jsx:** Build secure login and registration forms with real-time input validation and clear error messages.  
   - **Dashboard.jsx:** Display a sidebar (with navigation links to Notes, AI Tools, Study Room, Profile) and a top nav featuring a dark mode toggle and logout functionality; use card layouts to show recent courses, files, and study history.  
   - **Notes.jsx:** Allow users to upload files and view extracted text; include controls for editing, tagging, and searching notes; use a modern card layout with soft shadows and rounded corners.  
   - **AiTools.jsx:** Divide the page into distinct cards for each AI tool: summarizer, flashcards generator, quiz maker, and a chatbot assistant. Each card should have an input area, a submit button, and a results display panel with smooth hover and transition effects.  
   - **StudyRoom.jsx:** Establish a real-time chat interface using a custom `useSocket` hook. Provide a UI for entering room names, displaying active users, shared note areas, and live chat messages.  
   - **Profile.jsx:** Display user profile information, a CSS-based progress bar chart, streaks, and badges. Provide options for exporting notes/flashcards/quizzes as PDF.

3. **Global Styling & Dark Mode**  
   - In `src/styles/globals.css`, define CSS variables for primary, secondary, background colors, and include media queries for responsiveness.  
   - Implement a dark mode toggle that switches CSS variable values and uses smooth transitions.  
   - Use flexbox and grid layouts for modern card designs, hover effects, and minimal typography.

4. **State Management & API Integration**  
   - Implement a React Context (or custom hook `useAuth`) to manage user authentication state and token storage.  
   - Create an API utility in `src/lib/api.js` using axios to handle HTTP requests to the backend endpoints, with proper error handling and response parsing.  
   - Build a custom hook `useSocket.js` to manage Socket.IO interactions with proper event listeners and cleanup.

## API Testing & Best Practices
- Validate all endpoints using curl commands, ensuring proper HTTP status, JSON payloads, and error messages (e.g., test authentication, file uploads, PDF extraction, AI endpoints, and Socket.IO events).  
- Use try-catch blocks for async operations on both backend and frontend.  
- Sanitize inputs and restrict uploaded file types.  
- Log server errors securely while providing minimal error details to clients.

## Summary
- Developed a MERN stack project with separate `client` (React/Next.js) and `server` (Node.js/Express) directories.  
- Implemented JWT-based authentication, file uploads using GridFS, and PDF text extraction via pdf-parse.  
- Integrated AI tools (summarizer, flashcards, quiz maker, chatbot) using the Hugging Face Inference API with axios.  
- Enabled real-time study rooms using Socket.IO.  
- Designed a modern, responsive UI with a card-based layout, dark mode toggle, and minimal pure CSS styling.  
- Established modular controllers, routes, models, and middleware for robust error handling and security.  
- Ensured the code is production-ready and deployable on Vercel (frontend) and Render/Railway (backend).

