const axios = require('axios');
const Assessment = require('../models/Assessment');

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

exports.gradeAssessment = async (req, res, next) => {
    try {
        const { questions, answers, userId, courseId } = req.body;

        // Call Python service for grading
        const response = await axios.post(`${PYTHON_SERVICE_URL}/api/v1/assessments/grade`, {
            questions,
            answers,
            userId,
            courseId
        });

        res.json(response.data);
    } catch (error) {
        console.error('Error calling Python service:', error);
        next(error);
    }
};