// server/scripts/setupLTIDeployment.js
const mongoose = require('mongoose');
const LTIDeployment = require('../models/LTIDeployment');
require('dotenv').config();

/**
 * Script to set up and debug LTI deployment configuration
 * Run this script to initialize your LTI deployment in MongoDB
 */

const setupLTIDeployment = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Check if deployment already exists
    const existingDeployment = await LTIDeployment.findOne({
      issuer: process.env.LTI_ISSUER
    });

    if (existingDeployment) {
      console.log('Existing LTI Deployment found:');
      console.log(JSON.stringify(existingDeployment, null, 2));
      
      // Update existing deployment with correct URLs
      existingDeployment.accessTokenEndpoint = process.env.LTI_TOKEN_ENDPOINT || 'http://localhost/moodle/login/oauth2/token.php';
      existingDeployment.authenticationEndpoint = 'http://localhost/moodle/mod/lti/auth.php';
      existingDeployment.jwksEndpoint = process.env.LTI_JWKS_URL || 'http://localhost/moodle/mod/lti/certs.php';
      
      await existingDeployment.save();
      console.log('Updated existing deployment with correct endpoints');
    } else {
      // Create new LTI deployment
      const deployment = new LTIDeployment({
        issuer: process.env.LTI_ISSUER || 'http://localhost/moodle',
        clientId: process.env.LTI_CLIENT_ID || 'GmoRpk2CCSyeQHy',
        deploymentId: process.env.LTI_DEPLOYMENT_ID || '11',
        authenticationEndpoint: 'http://localhost/moodle/mod/lti/auth.php',
        accessTokenEndpoint: process.env.LTI_TOKEN_ENDPOINT || 'http://localhost/moodle/login/oauth2/token.php',
        jwksEndpoint: process.env.LTI_JWKS_URL || 'http://localhost/moodle/mod/lti/certs.php'
      });

      await deployment.save();
      console.log('New LTI Deployment created:');
      console.log(JSON.stringify(deployment, null, 2));
    }

    // Test the endpoints
    await testEndpoints();

  } catch (error) {
    console.error('Setup error:', error);
  } finally {
    await mongoose.disconnect();
  }
};

const testEndpoints = async () => {
  const axios = require('axios');
  
  console.log('\n=== Testing LTI Endpoints ===');
  
  const endpoints = [
    {
      name: 'Token Endpoint',
      url: process.env.LTI_TOKEN_ENDPOINT || 'http://localhost/moodle/login/oauth2/token.php'
    },
    {
      name: 'JWKS Endpoint', 
      url: process.env.LTI_JWKS_URL || 'http://localhost/moodle/mod/lti/certs.php'
    },
    {
      name: 'Auth Endpoint',
      url: 'http://localhost/moodle/mod/lti/auth.php'
    }
  ];

  for (const endpoint of endpoints) {
    try {
      console.log(`\nTesting ${endpoint.name}: ${endpoint.url}`);
      
      const response = await axios.get(endpoint.url, {
        timeout: 5000,
        validateStatus: (status) => status < 500 // Accept 4xx as valid response
      });
      
      console.log(`✓ ${endpoint.name} responded with status: ${response.status}`);
      
      if (endpoint.name === 'JWKS Endpoint' && response.status === 200) {
        console.log('JWKS keys found:', Object.keys(response.data));
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`✗ ${endpoint.name} - Connection refused. Is Moodle running?`);
      } else if (error.response) {
        console.log(`✗ ${endpoint.name} - Status: ${error.response.status}`);
      } else {
        console.log(`✗ ${endpoint.name} - Error: ${error.message}`);
      }
    }
  }
};

// Run the setup
setupLTIDeployment();

// Export for use in other files
module.exports = { setupLTIDeployment, testEndpoints };