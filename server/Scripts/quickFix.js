// server/scripts/quickFix.js
const mongoose = require('mongoose');
const LTIDeployment = require('../models/LTIDeployment');
require('dotenv').config();

/**
 * Quick fix script to resolve common LTI grade passback issues
 */

const quickFix = async () => {
  console.log('🚀 Running Quick Fix for LTI Grade Passback Issues...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Fix 1: Ensure LTI deployment exists with correct endpoints
    await fixLTIDeployment();
    
    // Fix 2: Validate and suggest correct token endpoints
    await validateTokenEndpoints();
    
    // Fix 3: Test environment variables
    await validateEnvironment();
    
    console.log('\n🎉 Quick fix completed! Try running your grade submission again.');
    
  } catch (error) {
    console.error('❌ Quick fix failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

const fixLTIDeployment = async () => {
  console.log('1️⃣ Fixing LTI deployment configuration...');
  
  const issuer = process.env.LTI_ISSUER;
  const clientId = process.env.LTI_CLIENT_ID;
  const deploymentId = process.env.LTI_DEPLOYMENT_ID;
  
  if (!issuer || !clientId || !deploymentId) {
    console.log('❌ Missing required environment variables for deployment');
    return;
  }
  
  // Check if deployment exists
  let deployment = await LTIDeployment.findOne({ issuer, clientId, deploymentId });
  
  if (!deployment) {
    console.log('Creating new LTI deployment...');
    deployment = new LTIDeployment({
      issuer,
      clientId,
      deploymentId,
      authenticationEndpoint: `${issuer}/mod/lti/auth.php`,
      accessTokenEndpoint: determineTokenEndpoint(issuer),
      jwksEndpoint: `${issuer}/mod/lti/certs.php`
    });
  } else {
    console.log('Updating existing LTI deployment...');
    deployment.accessTokenEndpoint = determineTokenEndpoint(issuer);
    deployment.authenticationEndpoint = `${issuer}/mod/lti/auth.php`;
    deployment.jwksEndpoint = `${issuer}/mod/lti/certs.php`;
  }
  
  await deployment.save();
  console.log('✅ LTI deployment configured:');
  console.log(`   Issuer: ${deployment.issuer}`);
  console.log(`   Client ID: ${deployment.clientId}`);
  console.log(`   Deployment ID: ${deployment.deploymentId}`);
  console.log(`   Token Endpoint: ${deployment.accessTokenEndpoint}`);
};

const determineTokenEndpoint = (issuer) => {
  // Try environment variable first
  if (process.env.LTI_TOKEN_ENDPOINT) {
    return process.env.LTI_TOKEN_ENDPOINT;
  }
  
  // Common Moodle patterns - the most likely correct one first
  return `${issuer}/login/oauth2/token.php`;
};

const validateTokenEndpoints = async () => {
  console.log('\n2️⃣ Validating token endpoints...');
  
  const deployment = await LTIDeployment.findOne({});
  if (!deployment) {
    console.log('❌ No deployment found');
    return;
  }
  
  const axios = require('axios');
  const possibleEndpoints = [
    `${deployment.issuer}/login/oauth2/token.php`,
    `${deployment.issuer}/mod/lti/token.php`,
    `${deployment.issuer}/login/token.php`,
    deployment.accessTokenEndpoint
  ];
  
  console.log('Testing possible token endpoints...');
  
  for (const endpoint of possibleEndpoints) {
    try {
      const response = await axios.post(endpoint, 'grant_type=client_credentials', {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
        validateStatus: () => true
      });
      
      console.log(`${endpoint}: Status ${response.status}`);
      
      if (response.status === 400) {
        // 400 is expected for missing credentials - means endpoint exists
        console.log(`✅ Token endpoint found: ${endpoint}`);
        
        // Update deployment with working endpoint
        if (endpoint !== deployment.accessTokenEndpoint) {
          deployment.accessTokenEndpoint = endpoint;
          await deployment.save();
          console.log('   Updated deployment with working endpoint');
        }
        break;
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`${endpoint}: Connection refused`);
      } else {
        console.log(`${endpoint}: ${error.message}`);
      }
    }
  }
};

const validateEnvironment = async () => {
  console.log('\n3️⃣ Validating environment configuration...');
  
  const issues = [];
  
  // Check required variables
  if (!process.env.LTI_PRIVATE_KEY) {
    issues.push('LTI_PRIVATE_KEY is not set');
  } else {
    try {
      const key = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
      if (!key.includes('-----BEGIN PRIVATE KEY-----')) {
        issues.push('LTI_PRIVATE_KEY does not appear to be a valid private key');
      }
    } catch (error) {
      issues.push('LTI_PRIVATE_KEY format error');
    }
  }
  
  if (!process.env.LTI_CLIENT_ID) {
    issues.push('LTI_CLIENT_ID is not set');
  }
  
  if (!process.env.LTI_ISSUER) {
    issues.push('LTI_ISSUER is not set');
  }
  
  if (!process.env.MONGODB_URI) {
    issues.push('MONGODB_URI is not set');
  }
  
  if (issues.length > 0) {
    console.log('❌ Environment issues found:');
    issues.forEach(issue => console.log(`   - ${issue}`));
  } else {
    console.log('✅ Environment configuration looks good');
  }
  
  // Provide corrected .env template
  console.log('\n📝 Recommended .env configuration:');
  console.log(`
# Database
MONGODB_URI=mongodb://localhost:27017/lti-grade-passback

# LTI Configuration
LTI_CLIENT_ID=${process.env.LTI_CLIENT_ID || 'your-client-id'}
LTI_DEPLOYMENT_ID=${process.env.LTI_DEPLOYMENT_ID || 'your-deployment-id'}
LTI_ISSUER=${process.env.LTI_ISSUER || 'http://localhost/moodle'}

# Token endpoint (most common for Moodle)
LTI_TOKEN_ENDPOINT=${process.env.LTI_ISSUER || 'http://localhost/moodle'}/login/oauth2/token.php

# JWKS endpoint
LTI_JWKS_URL=${process.env.LTI_ISSUER || 'http://localhost/moodle'}/mod/lti/certs.php

# Your private key (with \\n for newlines)
LTI_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_HERE\\n-----END PRIVATE KEY-----"

# Server configuration
PORT=3001
BASE_URL=http://localhost:3001
SESSION_SECRET=your-session-secret
  `);
};

// Helper function to create a test assessment for debugging
const createTestAssessment = async () => {
  console.log('\n4️⃣ Creating test assessment...');
  
  const Assessment = require('../models/Assessment');
  const deployment = await LTIDeployment.findOne({});
  
  if (!deployment) {
    console.log('❌ No deployment found for test assessment');
    return;
  }
  
  const testAssessment = new Assessment({
    userId: 'test-user-123',
    courseId: 'test-course-456',
    resourceLinkId: 'test-resource-789',
    lineItemUrl: 'http://localhost/moodle/mod/lti/services.php/1/lineitems/1',
    scoreGiven: 85,
    scoreMaximum: 100,
    activityProgress: 'Completed',
    gradingProgress: 'FullyGraded',
    feedback: 'Test assessment for debugging',
    issuer: deployment.issuer,
    clientId: deployment.clientId,
    deploymentId: deployment.deploymentId
  });
  
  await testAssessment.save();
  console.log(`✅ Test assessment created with ID: ${testAssessment._id}`);
  console.log('   You can now test grade submission with this assessment');
  
  return testAssessment._id;
};

// Main execution
if (require.main === module) {
  quickFix().catch(console.error);
}

module.exports = { quickFix, createTestAssessment };