// routes/lti.js
const express = require('express');
const router = express.Router();
const ltiController = require('../controllers/ltiController');

// Support both GET and POST for the login endpoint
// GET is the standard, but some LMS platforms use POST
router.get('/login', (req, res, next) => {
  console.log('LTI Login GET endpoint hit with query params:', req.query);
  next();
}, ltiController.handleLtiLogin);

router.post('/login', (req, res, next) => {
  // Log the raw body for debugging - safely handle undefined body
  console.log('LTI Login POST endpoint hit:');
  console.log('- Body:', req.body ? req.body : 'undefined');
  console.log('- Query:', req.query);
  
  // Inspect the content type for debugging
  console.log('- Content Type:', req.get('content-type'));
  
  next();
}, ltiController.handleLtiLoginPost);

// LTI 1.3 launch endpoint (this should remain POST)
router.post('/launch', ltiController.handleLtiLaunch);

module.exports = router;