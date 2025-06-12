// server/services/ags.js - Fixed version with correct URL handling
const axios = require('axios');
const jwt = require('jsonwebtoken');
const LTIDeployment = require('../models/LTIDeployment');

const submitScore = async (assessment) => {
  try {
    console.log("=== Starting Score Submission ===");
    console.log("Assessment data:", {
      userId: assessment.userId,
      scoreGiven: assessment.scoreGiven,
      scoreMaximum: assessment.scoreMaximum,
      lineItemUrl: assessment.lineItemUrl,
      issuer: assessment.issuer,
      clientId: assessment.clientId,
      deploymentId: assessment.deploymentId
    });
    
    // Get LTI deployment configuration
    const deployment = await LTIDeployment.findOne({ 
      issuer: assessment.issuer,
      clientId: assessment.clientId,
      deploymentId: assessment.deploymentId
    });

    if (!deployment) {
      console.error("No deployment found for:", {
        issuer: assessment.issuer,
        clientId: assessment.clientId,
        deploymentId: assessment.deploymentId
      });
      
      // List all available deployments for debugging
      const allDeployments = await LTIDeployment.find({});
      console.log("Available deployments:", allDeployments.map(d => ({
        issuer: d.issuer,
        clientId: d.clientId,
        deploymentId: d.deploymentId
      })));
      
      throw new Error('LTI deployment configuration not found');
    }

    console.log("Found deployment:", {
      issuer: deployment.issuer,
      clientId: deployment.clientId,
      deploymentId: deployment.deploymentId,
      accessTokenEndpoint: deployment.accessTokenEndpoint
    });

    // Validate deployment configuration
    if (!deployment.accessTokenEndpoint) {
      throw new Error('LTI deployment missing accessTokenEndpoint');
    }

    // Get access token with improved error handling
    const accessToken = await getAccessToken(deployment);
    console.log('Successfully obtained access token:', accessToken.substring(0, 20) + '...');

    // Fix the score submission URL
    const scoreSubmissionUrl = buildScoreSubmissionUrl(assessment.lineItemUrl);
    console.log("Original line item URL:", assessment.lineItemUrl);
    console.log("Score submission URL:", scoreSubmissionUrl);
const endpointTest = await testTokenEndpoint('http://localhost/moodle/login/oauth2/token.php');
console.log('Token endpoint test:', endpointTest);
    // Prepare the score payload
    const scorePayload = {
      timestamp: new Date().toISOString(),
      scoreGiven: assessment.scoreGiven,
      scoreMaximum: assessment.scoreMaximum,
      comment: assessment.feedback,
      activityProgress: assessment.activityProgress || 'Completed',
      gradingProgress: assessment.gradingProgress || 'FullyGraded',
      userId: assessment.userId
    };

    console.log("Score payload:", scorePayload);

    // Submit score to LMS
    const response = await axios.post(scoreSubmissionUrl, scorePayload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/vnd.ims.lis.v1.score+json'
      },
      timeout: 3000000 // 30 second timeout
    });

    console.log("Score submission successful:", response.status);
    return response.data;

  } catch (error) {
    console.error('=== Score Submission Failed ===');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    }
    
    throw new Error(`Failed to submit score: ${error.message}`);
  }
};

// Function to build the correct score submission URL
const buildScoreSubmissionUrl = (lineItemUrl) => {
  try {
    // Parse the URL to extract components
    const url = new URL(lineItemUrl);
    
    // For Moodle LTI AGS, the pattern is typically:
    // Line item: /moodle/mod/lti/services.php/3/lineitems/27/lineitem?type_id=11
    // Scores endpoint: /moodle/mod/lti/services.php/3/lineitems/27/lineitem/scores?type_id=11
    
    // Check if this is already a line item URL
    if (url.pathname.includes('/lineitem')) {
      // Add /scores to the path before the query parameters
      const baseUrl = `${url.protocol}//${url.host}${url.pathname}/scores`;
      const queryString = url.search;
      return baseUrl + queryString;
    }
    
    // If it's a lineitems collection URL, we need to handle it differently
    if (url.pathname.includes('/lineitems') && !url.pathname.includes('/lineitem')) {
      // This might be a collection URL, we need more specific line item info
      throw new Error('Cannot determine specific line item from collection URL');
    }
    
    // Fallback: just append /scores
    return lineItemUrl + '/scores';
    
  } catch (error) {
    console.warn('URL parsing failed, using fallback method:', error.message);
    
    // Fallback method for malformed URLs
    if (lineItemUrl.includes('?')) {
      // Insert /scores before the query parameters
      const parts = lineItemUrl.split('?');
      return parts[0] + '/scores?' + parts[1];
    } else {
      // Simple append
      return lineItemUrl + '/scores';
    }
  }
};

// Alternative approach: Try multiple URL patterns
const submitScoreWithFallback = async (assessment) => {
  const possibleUrls = generatePossibleScoreUrls(assessment.lineItemUrl);
  
  for (let i = 0; i < possibleUrls.length; i++) {
    try {
      console.log(`Attempting score submission with URL ${i + 1}:`, possibleUrls[i]);
      
      // Temporarily replace the lineItemUrl for this attempt
      const modifiedAssessment = { ...assessment, lineItemUrl: possibleUrls[i] };
      return await submitScore(modifiedAssessment);
      
    } catch (error) {
      console.log(`URL ${i + 1} failed:`, error.message);
      
      // If this is the last URL, throw the error
      if (i === possibleUrls.length - 1) {
        throw error;
      }
    }
  }
};

const generatePossibleScoreUrls = (originalUrl) => {
  const urls = [];
  
  try {
    const url = new URL(originalUrl);
    
    // Method 1: Proper scores endpoint
    if (url.pathname.includes('/lineitem')) {
      const baseUrl = `${url.protocol}//${url.host}${url.pathname}/scores`;
      urls.push(baseUrl + url.search);
    }
    
    // Method 2: Replace 'lineitem' with 'scores'
    if (url.pathname.includes('/lineitem')) {
      const scoresPath = url.pathname.replace('/lineitem', '/scores');
      urls.push(`${url.protocol}//${url.host}${scoresPath}${url.search}`);
    }
    
    // Method 3: Different Moodle pattern
    if (url.pathname.includes('/lineitems/')) {
      const pathParts = url.pathname.split('/');
      const contextId = pathParts.find((part, index) => pathParts[index - 1] === 'services.php');
      const lineItemId = pathParts[pathParts.length - 2]; // Get the number before 'lineitem'
      
      if (contextId && lineItemId) {
        const scoresUrl = `${url.protocol}//${url.host}/moodle/mod/lti/services.php/${contextId}/lineitems/${lineItemId}/scores${url.search}`;
        urls.push(scoresUrl);
      }
    }
    
  } catch (error) {
    console.warn('URL parsing failed in generatePossibleScoreUrls:', error.message);
  }
  
  // Always include the original attempt as fallback
  urls.push(originalUrl + '/scores');
  
  // Remove duplicates
  return [...new Set(urls)];
};

const getAccessToken = async (deployment) => {
  try {
    console.log("=== Getting Access Token ===");
    
    // Validate required environment variables
    if (!process.env.LTI_PRIVATE_KEY) {
      throw new Error('LTI_PRIVATE_KEY environment variable not set');
    }
    
    // Clean up the private key
    const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('Private key loaded, length:', privateKey.length);
    
    // Use the exact endpoint that worked in your curl command
    const tokenEndpoint = 'http://localhost/moodle/mod/lti/token.php';
    
    const now = Math.floor(Date.now() / 1000);
    
    // Create JWT assertion matching your curl request
    const jwtPayload = {
      iss: deployment.clientId, // This should be "GmoRpk2CCTyeQHy" based on your curl
      sub: deployment.clientId, // Same as iss
      aud: [tokenEndpoint, 'http://localhost/moodle'], // Match your curl aud values
      iat: now,
      exp: now + 300, // 5 minutes
      jti: 'no5w6gnuv9q' + now + Math.floor(Math.random() * 1000), // Similar pattern to your curl
    };

    console.log('JWT payload:', jwtPayload);

    const jwtOptions = { 
      algorithm: 'RS256'
    };

    const clientAssertion = jwt.sign(jwtPayload, privateKey, jwtOptions);
    console.log('Client assertion created (first 50 chars):', clientAssertion.substring(0, 50) + '...');

    // Use URLSearchParams to match curl's form encoding exactly
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.append('client_assertion', clientAssertion);
    params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        // Include the session cookie from your successful curl request
        'Cookie': 'connect.sid=s%3AfAcIdNV_JhkNsT_BqpT1TM_ZbCpwiAja.rDJUSnFJyQV5vneMJ%2FTMzrL5ekipQpxdwRVhgDXz4U4'
      },
      timeout: 15000,
      validateStatus: (status) => status < 500 // Accept 4xx responses to see error details
    };

    console.log('Making token request to:', tokenEndpoint);
    console.log('Request headers:', config.headers);
    
    // Log the exact form data being sent
    console.log('Form data being sent:');
    for (const [key, value] of params.entries()) {
      if (key === 'client_assertion') {
        console.log(`${key}: ${value.substring(0, 50)}...`);
      } else {
        console.log(`${key}: ${value}`);
      }
    }

    const response = await axios.post(tokenEndpoint, params, config);
    
    console.log('Token response status:', response.status);
    console.log('Token response headers:', response.headers);
    console.log('Token response data:', response.data);

    // Handle different response formats
    let responseData = response.data;
    if (typeof responseData === 'string') {
      try {
        responseData = JSON.parse(responseData);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', responseData);
        throw new Error('Invalid JSON response from token endpoint');
      }
    }

    // Check for error responses
    if (responseData.error) {
      console.error('OAuth error response:', responseData);
      throw new Error(`OAuth error: ${responseData.error} - ${responseData.error_description || 'No description'}`);
    }

    if (!responseData.access_token) {
      console.error('No access_token in response:', responseData);
      throw new Error('No access_token in response');
    }

    console.log('Successfully obtained access token:', responseData.access_token.substring(0, 20) + '...');
    console.log('Token type:', responseData.token_type);
    console.log('Expires in:', responseData.expires_in, 'seconds');
    console.log('Scope:', responseData.scope);

    return responseData.access_token;

  } catch (error) {
    console.error('=== Access Token Error ===');
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response status text:', error.response.statusText);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received');
      console.error('Request details:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    throw new Error(`Failed to get access token: ${error.message}`);
  }
};

const attemptTokenRequest = async (tokenEndpoint, deployment, privateKey) => {
  const now = Math.floor(Date.now() / 1000);
  
  // Create JWT assertion for client credentials flow
  const jwtPayload = {
    iss: deployment.clientId,
    sub: deployment.clientId,
    aud: [tokenEndpoint, deployment.issuer],
    iat: now,
    exp: now + 300, // 5 minutes
    jti: Math.random().toString(36).substring(2, 15) + Date.now(),
  };

  console.log('JWT payload:', jwtPayload);

  const jwtOptions = { 
    algorithm: 'RS256'
  };

  const clientAssertion = jwt.sign(jwtPayload, privateKey, jwtOptions);
console.log('Client assertion created:', clientAssertion);
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
  params.append('client_assertion', clientAssertion);
  params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');

  const config = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'LTI-Tool/1.0'
    },
    timeout: 15000,
    validateStatus: (status) => status < 400
  };

  console.log('Token request config:', {
    endpoint: tokenEndpoint,
    headers: config.headers,
    formData: {
      grant_type: 'client_credentials',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      scope: 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
    }
  });

  try {
    const response = await axios.post(tokenEndpoint, params, config);
    
    console.log('Token response status:', response.status);
    console.log('Token response headers:', response.headers);

    // Check if response is HTML (indicates error page)
    const contentType = response.headers['content-type'] || '';
    if (contentType.includes('text/html')) {
      console.error('Received HTML response (first 200 chars):', 
        typeof response.data === 'string' ? response.data.substring(0, 200) : 'Not a string');
      throw new Error(`Token endpoint returned HTML instead of JSON`);
    }

    let responseData;
    try {
      responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    } catch (parseError) {
      console.error('Failed to parse token response:', response.data);
      throw new Error(`Invalid JSON response from token endpoint`);
    }

    if (!responseData.access_token) {
      console.error('No access token in response:', responseData);
      throw new Error(`No access_token in response`);
    }

    return responseData.access_token;

  } catch (error) {
    if (error.response) {
      console.error('Token request failed:');
      console.error('- Status:', error.response.status);
      console.error('- Status Text:', error.response.statusText);
      console.error('- Headers:', error.response.headers);
      console.error('- Data:', error.response.data?.substring?.(0, 500) || error.response.data);
    } else if (error.request) {
      console.error('No response received:', error.message);
    } else {
      console.error('Request setup error:', error.message);
    }
    
    throw error;
  }
};

// Utility function to test token endpoint accessibility
const testTokenEndpoint = async (endpoint) => {
  try {
    const response = await axios.get(endpoint, {
      timeout: 5000,
      validateStatus: () => true // Accept any status code
    });
    
    return {
      accessible: true,
      status: response.status,
      contentType: response.headers['content-type']
    };
  } catch (error) {
    return {
      accessible: false,
      error: error.message
    };
  }
};

module.exports = {
  submitScore,
  submitScoreWithFallback,
  testTokenEndpoint
};