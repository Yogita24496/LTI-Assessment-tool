// server/controllers/assessmentController.js
const Assessment = require('../models/Assessment');
const LTIDeployment = require('../models/LTIDeployment');
const { submitScore } = require('../services/ags');

// Helper function to find LTI deployment info
const findLTIDeployment = async (courseId, resourceLinkId) => {
  // This is a simplified example - you might need different logic
  // based on how your LTI deployments are organized
  const deployment = await LTIDeployment.findOne({
    // Add your lookup criteria here
    // For example, if you store courseId in deployment:
    // courseId: courseId
  });
  return deployment;
};

// Create a new assessment record
exports.createAssessment = async (req, res, next) => {
  try {
    const {
      userId,
      courseId,
      resourceLinkId,
      lineItemUrl,
      scoreGiven,
      scoreMaximum,
      activityProgress,
      gradingProgress,
      feedback,
      // LTI deployment fields (optional)
      issuer,
      clientId,
      deploymentId
    } = req.body;
   
    console.log("Assessment creation data:", req.body);
    
    // Validate required fields
    if (!userId || !courseId || !resourceLinkId || !lineItemUrl || scoreGiven === undefined) {
      return res.status(400).json({ error: 'Missing required assessment data' });
    }

    // Try to get LTI deployment info if not provided
    let ltiDeployment = { issuer, clientId, deploymentId };
    
    if (!issuer || !clientId || !deploymentId) {
      const foundDeployment = await findLTIDeployment(courseId, resourceLinkId);
      if (foundDeployment) {
        ltiDeployment = {
          issuer: issuer || foundDeployment.issuer,
          clientId: clientId || foundDeployment.clientId,
          deploymentId: deploymentId || foundDeployment.deploymentId
        };
      }
    }
   
    // Create assessment record
    const assessment = new Assessment({
      userId,
      courseId,
      resourceLinkId,
      lineItemUrl,
      scoreGiven,
      scoreMaximum: scoreMaximum || 100,
      activityProgress: activityProgress || 'Completed',
      gradingProgress: gradingProgress || 'FullyGraded',
      feedback,
      // Add LTI deployment fields if available
      ...(ltiDeployment.issuer && { issuer: ltiDeployment.issuer }),
      ...(ltiDeployment.clientId && { clientId: ltiDeployment.clientId }),
      ...(ltiDeployment.deploymentId && { deploymentId: ltiDeployment.deploymentId })
    });
   
    await assessment.save();
   
    res.status(201).json({
      success: true,
      assessment
    });
   
  } catch (error) {
    next(error);
  }
};

// server/controllers/assessmentController.js
// ... (previous imports remain the same)

exports.submitGrade = async (req, res, next) => {
  try {
    const { assessmentId } = req.params;

    // Find the assessment
    const assessment = await Assessment.findById(assessmentId);

    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    // If grade is already submitted, return success
    if (assessment.passbackStatus === 'success') {
      return res.json({
        success: true,
        message: 'Grade already submitted to gradebook'
      });
    }

    // Submit the score using AGS
    const result = await submitScore(assessment);

    // Update the assessment status to 'success'
    assessment.passbackStatus = 'success';
    assessment.passbackAttempts += 1;
    assessment.lastPassbackAttempt = new Date();
    await assessment.save();

    res.json({
      success: true,
      result,
      message: 'Grade submitted successfully'
    });

  } catch (error) {
    console.error('Grade submission error:', error);
    
    // Update assessment with error status
    if (assessment) {
      assessment.passbackStatus = 'failed';
      assessment.passbackError = error.message;
      assessment.passbackAttempts += 1;
      assessment.lastPassbackAttempt = new Date();
      await assessment.save();
    }

    res.status(500).json({
      success: false,
      error: error.message,
      details: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      } : undefined
    });
  }
};

// ... (rest of the controller remains the same)




// Get all assessments for a user
exports.getUserAssessments = async (req, res, next) => {
  try {
    const { userId } = req.params;
   
    const assessments = await Assessment.find({ userId });
   
    res.json({
      success: true,
      assessments
    });
   
  } catch (error) {
    next(error);
  }
};

