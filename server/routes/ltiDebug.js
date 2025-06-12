// routes/ltiDebug.js
const express = require('express');
const router = express.Router();
const LTIDeployment = require('../models/LTIDeployment');

// Route to verify that the server is running
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV || 'development',
    baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`
  });
});

// Route to show LTI configurations (only in development)
router.get('/config', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }
  
  try {
    const deployments = await LTIDeployment.find({}).select('-_id name issuer clientId');
    
    res.json({
      baseUrl: process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`,
      endpoints: {
        login: '/api/lti/login',
        launch: '/api/lti/launch'
      },
      registeredPlatforms: deployments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route that shows sample LTI parameters for testing
router.get('/sample-params', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }
  
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>LTI Sample Parameters</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2 { color: #333; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        .container { max-width: 800px; margin: 0 auto; }
        .note { background: #fffde7; padding: 10px; border-left: 4px solid #ffd600; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>LTI Integration Debug Page</h1>
        
        <div class="note">
          <strong>Note:</strong> This page is only available in development mode and should be disabled in production.
        </div>
        
        <h2>Sample LTI Login Parameters</h2>
        <p>When configuring your LMS, use these parameters:</p>
        
        <h3>LTI 1.3 Tool Configuration</h3>
        <ul>
          <li><strong>Login URL:</strong> <code>${baseUrl}/api/lti/login</code></li>
          <li><strong>Launch URL:</strong> <code>${baseUrl}/api/lti/launch</code></li>
          <li><strong>Redirect URLs:</strong> <code>${baseUrl}/api/lti/launch</code></li>
        </ul>
        
        <h3>Sample Request</h3>
        <p>A login initiation request should include:</p>
        <pre>
POST ${baseUrl}/api/lti/login
Content-Type: application/x-www-form-urlencoded

iss=https://lms.example.com
login_hint=user-123
target_link_uri=${baseUrl}/api/lti/launch
        </pre>
        
        <h2>Testing Tool</h2>
        <p>You can use this form to manually test your LTI login endpoint:</p>
        
        <form method="POST" action="/api/lti/login" style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
          <div style="margin-bottom: 15px;">
            <label for="iss" style="display: block; margin-bottom: 5px;">Platform Issuer (iss):</label>
            <input type="text" id="iss" name="iss" required style="width: 100%; padding: 8px; box-sizing: border-box;"
                   value="https://lms.example.com">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label for="login_hint" style="display: block; margin-bottom: 5px;">Login Hint:</label>
            <input type="text" id="login_hint" name="login_hint" required style="width: 100%; padding: 8px; box-sizing: border-box;"
                   value="user-123">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label for="target_link_uri" style="display: block; margin-bottom: 5px;">Target Link URI:</label>
            <input type="text" id="target_link_uri" name="target_link_uri" required style="width: 100%; padding: 8px; box-sizing: border-box;"
                   value="${baseUrl}/api/lti/launch">
          </div>
          
          <div style="margin-bottom: 15px;">
            <label for="lti_message_hint" style="display: block; margin-bottom: 5px;">LTI Message Hint (optional):</label>
            <input type="text" id="lti_message_hint" name="lti_message_hint" style="width: 100%; padding: 8px; box-sizing: border-box;"
                   value="context-123">
          </div>
          
          <button type="submit" style="padding: 10px 15px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">
            Test LTI Login
          </button>
        </form>
        
        <h2>Troubleshooting</h2>
        <ul>
          <li>Make sure your LMS is configured to use the correct URLs for login and launch</li>
          <li>Verify that your LMS is sending the required OIDC parameters</li>
          <li>Check server logs for detailed request information</li>
          <li>Ensure your MongoDB is running and contains valid LTI deployment data</li>
        </ul>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;