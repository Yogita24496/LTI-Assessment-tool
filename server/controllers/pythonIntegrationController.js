const axios = require('axios');
const Assessment = require('../models/Assessment');

exports.submitGradeViaPython = async (req, res, next) => {
  try {
    const { assessmentId } = req.body;

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // Call Python service
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
    const response = await axios.post(`${pythonServiceUrl}/submit-grade`, {
      lineItemUrl: assessment.lineItemUrl,
      scoreGiven: assessment.scoreGiven,
      scoreMaximum: assessment.scoreMaximum,
      userId: assessment.userId,
      feedback: assessment.feedback,
      issuer: assessment.issuer,
      clientId: assessment.clientId,
      deploymentId: assessment.deploymentId
    });

    // Update assessment status
    assessment.passbackStatus = 'completed';
    await assessment.save();

    res.json({
      success: true,
      message: 'Grade submitted successfully via Python service',
      data: response.data
    });

  } catch (error) {
    console.error('Error submitting grade via Python:', error);
    
    // Update assessment status to failed
    if (assessment) {
      assessment.passbackStatus = 'failed';
      assessment.passbackError = error.message;
      await assessment.save();
    }

    next(error);
  }
};