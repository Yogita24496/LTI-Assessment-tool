require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const session = require('express-session'); // Add session support
const bodyParser = require('body-parser'); // Explicitly require body-parser
const { errorHandler } = require('./utils/errorHandler');
const debugMiddleware = require('./middleware/debugMiddleware'); // Import debug middleware

// Import routes
const ltiRoutes = require('./routes/lti');
const assessmentRoutes = require('./routes/assessment');
// Add this line with your other route imports
const diagnosticRoutes = require('./routes/diagnostic');
// Database connection
const { connectDB } = require('./config/database');
connectDB();

const app = express();

// Basic middleware - ORDER IS IMPORTANT!
// 1. CORS
app.use(cors());

// 2. Logging
app.use(morgan('dev'));

// 3. Body parsing middleware - MUST COME BEFORE ROUTES
// For parsing application/json
app.use(express.json());

// For parsing application/x-www-form-urlencoded
// The extended option allows for rich objects and arrays to be encoded
app.use(express.urlencoded({ extended: true }));

// For parsing raw bodies for debugging if needed
app.use(bodyParser.raw({ type: '*/*', limit: '10mb' }));

// Custom middleware to ensure req.body exists
app.use((req, res, next) => {
  // If body parsing failed or wasn't applied, ensure req.body exists
  if (!req.body) {
    req.body = {};
  }
  // Add this line after your other middleware
app.use(express.static('public'));
  // If raw body was captured, log it for debugging
  if (req.body && Buffer.isBuffer(req.body)) {
    console.log('Raw request body:', req.body.toString());
    
    // Try to parse as URL-encoded if content-type suggests it
    const contentType = req.get('content-type') || '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      try {
        const bodyStr = req.body.toString();
        const params = new URLSearchParams(bodyStr);
        const parsedBody = {};
        
        for (const [key, value] of params.entries()) {
          parsedBody[key] = value;
        }
        
        console.log('Manually parsed body:', parsedBody);
        req.body = parsedBody;
      } catch (err) {
        console.error('Failed to manually parse body:', err);
      }
    }
  }
  
  next();
});

// Enhanced debug middleware (only in development)
if (process.env.NODE_ENV !== 'production') {
  app.use(debugMiddleware);
} else {
  // Basic request logging in production
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });
}

// Session middleware - required for LTI workflow
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key', // Use environment variable in production
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Routes
app.use('/api/lti', ltiRoutes);
app.use('/api/assessment', assessmentRoutes);


// Add this line with your other route definitions
app.use('/api/diagnostic', diagnosticRoutes);
// Add a simple root route for testing
app.get('/', (req, res) => {
  res.send('LTI Application Server is running. Access /api/lti/login to initiate LTI login.');
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`LTI login URL: ${process.env.BASE_URL || `http://localhost:${PORT}`}/api/lti/login`);
});