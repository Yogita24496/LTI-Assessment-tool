const express = require('express');
const router = express.Router();
const axios = require('axios');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

// Helper function to transform camelCase to snake_case for questions
function transformQuestionsForPython(questions) {
  return questions.map(question => {
    // Create a new object with the transformed field
    const transformed = {
      ...question,
      correct_answer: question.correctAnswer
    };
    
    // Remove the original camelCase field
    delete transformed.correctAnswer;
    
    return transformed;
  });
}

router.post('/grade', async (req, res) => {
  try {
    console.log('Request received:', JSON.stringify(req.body, null, 2));

    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ 
        error: 'Request body is required',
        details: 'Please provide questions and answers for grading'
      });
    }

    // Validate questions
    if (!req.body.questions || !Array.isArray(req.body.questions)) {
      return res.status(400).json({
        error: 'Invalid questions format',
        details: 'Questions field is required and must be an array'
      });
    }

    // Handle answers - convert object format to array format if needed
    let answers = req.body.answers;
    
    if (!answers) {
      return res.status(400).json({
        error: 'Missing answers field',
        details: 'Answers field is required'
      });
    }

    // If answers is an object (key-value pairs), convert to array format
    if (typeof answers === 'object' && !Array.isArray(answers)) {
      console.log('Converting answers object to array format');
      answers = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
        questionId: parseInt(questionId), // Convert string ID to number
        selectedAnswer: selectedAnswer
      }));
      console.log('Converted answers:', answers);
    }

    // Validate that answers is now an array
    if (!Array.isArray(answers)) {
      return res.status(400).json({
        error: 'Invalid answers format',
        details: 'Answers must be an array or object with question IDs as keys',
        received: typeof answers
      });
    }

    // Update the request body with converted answers
    const processedBody = {
      ...req.body,
      answers: answers,
      questions: transformQuestionsForPython(req.body.questions)
    };

    console.log('Processed body for Python service:', JSON.stringify(processedBody, null, 2));

    // Make the request to Python service
    const response = await axios.post(`${PYTHON_SERVICE_URL}/assessments/grade`, processedBody, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('Python service response:', response.data);
    res.json(response.data);

  } catch (error) {
    console.error('Error in grade endpoint:', error);
    
    if (error.response) {
      // Python service returned an error
      console.error('Python service error:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message);
      res.status(503).json({
        error: 'Service unavailable',
        details: 'Could not connect to grading service'
      });
    } else {
      // Other error
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
});

// Health check endpoint to test Python service connectivity
router.get('/health', async (req, res) => {
  try {
    const response = await axios.get(`${PYTHON_SERVICE_URL}/health`, {
      timeout: 5000
    });
    res.json({
      status: 'healthy',
      pythonService: 'connected',
      pythonServiceUrl: PYTHON_SERVICE_URL,
      pythonServiceStatus: response.status
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      pythonService: 'disconnected',
      pythonServiceUrl: PYTHON_SERVICE_URL,
      error: error.message
    });
  }
});

module.exports = router;