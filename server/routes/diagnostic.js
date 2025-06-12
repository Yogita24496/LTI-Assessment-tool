// server/routes/diagnostic.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const LTIDeployment = require('../models/LTIDeployment');

// Diagnostic endpoint to test token endpoints
router.get('/test-token-endpoints', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const baseUrl = process.env.LTI_ISSUER || 'http://localhost/moodle';
    
    // Common Moodle token endpoint patterns to test
    const endpointsToTest = [
      `${baseUrl}/mod/lti/token.php`,
      `${baseUrl}/login/oauth2/token.php`,
      `${baseUrl}/webservice/oauth2/token.php`,
      `${baseUrl}/lib/oauth2/token.php`,
      `${baseUrl}/oauth2/token.php`,
      `${baseUrl}/auth/oauth2/token.php`,
      process.env.LTI_TOKEN_ENDPOINT
    ].filter(Boolean);

    console.log('Testing token endpoints for Moodle at:', baseUrl);
    
    const results = [];
    
    for (const endpoint of endpointsToTest) {
      console.log(`\nTesting endpoint: ${endpoint}`);
      
      try {
        // First, test basic accessibility
        const accessibilityTest = await testEndpointAccessibility(endpoint);
        
        // Then test with actual token request
        const tokenTest = await testTokenRequest(endpoint);
        
        results.push({
          endpoint,
          accessible: accessibilityTest.accessible,
          accessibilityDetails: accessibilityTest,
          tokenRequestTest: tokenTest,
          recommended: tokenTest.success || (accessibilityTest.accessible && accessibilityTest.status < 500)
        });
        
      } catch (error) {
        results.push({
          endpoint,
          accessible: false,
          error: error.message,
          recommended: false
        });
      }
    }
    
    // Sort by recommended status
    results.sort((a, b) => (b.recommended ? 1 : 0) - (a.recommended ? 1 : 0));
    
    res.json({
      moodleBaseUrl: baseUrl,
      testResults: results,
      recommendations: generateRecommendations(results),
      currentConfig: {
        LTI_TOKEN_ENDPOINT: process.env.LTI_TOKEN_ENDPOINT,
        LTI_ISSUER: process.env.LTI_ISSUER,
        LTI_CLIENT_ID: process.env.LTI_CLIENT_ID
      }
    });
    
  } catch (error) {
    console.error('Diagnostic test error:', error);
    res.status(500).json({
      error: 'Failed to run diagnostic tests',
      details: error.message
    });
  }
});

// Test endpoint accessibility
async function testEndpointAccessibility(endpoint) {
  try {
    const response = await axios.get(endpoint, {
      timeout: 10000,
      validateStatus: () => true, // Accept any status code
      maxRedirects: 0 // Don't follow redirects
    });
    
    return {
      accessible: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type'] || 'unknown',
      serverHeader: response.headers['server'] || 'unknown',
      responseSize: response.data ? response.data.toString().length : 0,
      isHtml: (response.headers['content-type'] || '').includes('text/html'),
      containsMoodle: response.data ? response.data.toString().toLowerCase().includes('moodle') : false
    };
    
  } catch (error) {
    return {
      accessible: false,
      error: error.message,
      code: error.code,
      timeout: error.code === 'ECONNABORTED'
    };
  }
}

// Test actual token request
async function testTokenRequest(endpoint) {
  try {
    // Get deployment info for creating JWT
    const deployment = await LTIDeployment.findOne({});
    
    if (!deployment) {
      return {
        success: false,
        error: 'No LTI deployment found in database',
        skipped: true
      };
    }

    // Check if we have private key
    if (!process.env.LTI_PRIVATE_KEY) {
      return {
        success: false,
        error: 'LTI_PRIVATE_KEY not configured',
        skipped: true
      };
    }

    const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT assertion
    const jwtPayload = {
      iss: deployment.clientId,
      sub: deployment.clientId,
      aud: [endpoint, deployment.issuer],
      iat: now,
      exp: now + 300,
      jti: Math.random().toString(36).substring(2, 15) + Date.now(),
    };

    const clientAssertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });

    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.append('client_assertion', clientAssertion);
    params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');

    const response = await axios.post(endpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LTI-Tool-Diagnostic/1.0'
      },
      timeout: 15000,
      validateStatus: () => true
    });

    const isJson = (response.headers['content-type'] || '').includes('application/json');
    let parsedResponse;
    
    try {
      parsedResponse = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (e) {
      parsedResponse = null;
    }

    return {
      success: response.status === 200 && parsedResponse && parsedResponse.access_token,
      status: response.status,
      statusText: response.statusText,
      isJson,
      hasAccessToken: parsedResponse && !!parsedResponse.access_token,
      responseHeaders: response.headers,
      responsePreview: typeof response.data === 'string' 
        ? response.data.substring(0, 200) 
        : JSON.stringify(response.data).substring(0, 200),
      error: !parsedResponse && response.status !== 200 ? 'Non-JSON response or error status' : null
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data ? 
        error.response.data.toString().substring(0, 200) : null
    };
  }
}

// Generate recommendations based on test results
function generateRecommendations(results) {
  const recommendations = [];
  
  // Find working endpoints
  const workingEndpoints = results.filter(r => r.tokenRequestTest?.success);
  const accessibleEndpoints = results.filter(r => r.accessible && r.accessibilityDetails.status < 400);
  
  if (workingEndpoints.length > 0) {
    recommendations.push({
      type: 'success',
      message: `Found ${workingEndpoints.length} working token endpoint(s)`,
      action: `Use: ${workingEndpoints[0].endpoint}`,
      endpoints: workingEndpoints.map(e => e.endpoint)
    });
  } else if (accessibleEndpoints.length > 0) {
    recommendations.push({
      type: 'warning',
      message: 'Found accessible endpoints but token requests failed',
      action: 'Check your LTI client configuration and private key',
      possibleEndpoints: accessibleEndpoints.map(e => e.endpoint)
    });
  } else {
    recommendations.push({
      type: 'error',
      message: 'No accessible token endpoints found',
      action: 'Verify your Moodle URL and ensure LTI is properly configured'
    });
  }
  
  // Check for common issues
  const htmlResponses = results.filter(r => r.accessibilityDetails?.isHtml);
  if (htmlResponses.length > 0) {
    recommendations.push({
      type: 'info',
      message: 'Some endpoints returned HTML (likely error pages)',
      action: 'Check Moodle error logs and verify LTI plugin is enabled'
    });
  }
  
  return recommendations;
}

// Manual token endpoint tester
router.post('/test-custom-endpoint', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const { endpoint } = req.body;
    
    if (!endpoint) {
      return res.status(400).json({ error: 'endpoint parameter required' });
    }
    
    console.log(`Testing custom endpoint: ${endpoint}`);
    
    const accessibilityTest = await testEndpointAccessibility(endpoint);
    const tokenTest = await testTokenRequest(endpoint);
    
    res.json({
      endpoint,
      accessibilityTest,
      tokenTest,
      recommendation: tokenTest.success ? 
        'This endpoint works! Update your LTI_TOKEN_ENDPOINT environment variable.' :
        'This endpoint is not working. Check the error details above.'
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
});

// Get Moodle LTI configuration info
router.get('/moodle-info', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'This endpoint is disabled in production' });
  }

  try {
    const moodleUrl = process.env.LTI_ISSUER || 'http://localhost/moodle';
    
    // Try to get Moodle version and LTI info
    const infoEndpoints = [
      `${moodleUrl}/admin/tool/lti/certs.php`,
      `${moodleUrl}/mod/lti/certs.php`,
      `${moodleUrl}/lib/ltiprovider/certs.php`
    ];
    
    const results = [];
    
    for (const endpoint of infoEndpoints) {
      try {
        const response = await axios.get(endpoint, {
          timeout: 10000,
          validateStatus: () => true
        });
        
        results.push({
          endpoint,
          status: response.status,
          accessible: response.status === 200,
          contentType: response.headers['content-type'],
          size: response.data.toString().length
        });
        
      } catch (error) {
        results.push({
          endpoint,
          accessible: false,
          error: error.message
        });
      }
    }
    
    res.json({
      moodleBaseUrl: moodleUrl,
      certEndpoints: results,
      recommendedTokenEndpoints: [
        `${moodleUrl}/mod/lti/token.php`,
        `${moodleUrl}/login/oauth2/token.php`
      ],
      currentConfig: {
        LTI_ISSUER: process.env.LTI_ISSUER,
        LTI_TOKEN_ENDPOINT: process.env.LTI_TOKEN_ENDPOINT,
        LTI_JWKS_URL: process.env.LTI_JWKS_URL,
        LTI_CLIENT_ID: process.env.LTI_CLIENT_ID
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get Moodle info',
      details: error.message
    });
  }
});

module.exports = router;