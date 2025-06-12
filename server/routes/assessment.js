// server/routes/assessment.js
const express = require('express');
const router = express.Router();
const assessmentController = require('../controllers/assessmentController');
// Create a new assessment
router.post('/', assessmentController.createAssessment);


// Add this before submitScore call

// Submit grade to LMS
router.post('/:assessmentId/submit', assessmentController.submitGrade);

// Get user's assessments
router.get('/user/:userId', assessmentController.getUserAssessments);

module.exports = router;