// server/scripts/ltiDiagnostic.js
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const LTIDeployment = require('../models/LTIDeployment');
const Assessment = require('../models/Assessment');
require('dotenv').config();

/**
 * Comprehensive LTI diagnostic script to identify and fix grade passback issues
 */

const runDiagnostic = async () => {
  console.log('🔍 Starting LTI Grade Passback Diagnostic...\n');

  try {
    // 1. Check MongoDB connection
    await checkMongoConnection();
    
    // 2. Check environment variables
    await checkEnvironmentVariables();
    
    // 3. Check LTI deployment configuration
    await checkLTIDeployments();
    
    // 4. Test Moodle endpoints
    await testMoodleEndpoints();
    
    // 5. Test JWT creation
    await testJWTCreation();
    
    // 6. Check recent assessments
    await checkRecentAssessments();
    
    // 7. Perform end-to-end token test
    await performTokenTest();
    
    console.log('\n✅ Diagnostic complete! Check the output above for any issues.');
    
  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

const checkMongoConnection = async () => {
  console.log('1️⃣ Checking MongoDB connection...');
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ MongoDB connected successfully');
    
    // Check if collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('   📦 Available collections:', collectionNames);
    
    if (!collectionNames.includes('ltideployments')) {
      console.log('   ⚠️  Warning: ltideployments collection not found');
    }
    
  } catch (error) {
    console.log('   ❌ MongoDB connection failed:', error.message);
    throw error;
  }
};

const checkEnvironmentVariables = async () => {
  console.log('\n2️⃣ Checking environment variables...');
  
  const requiredVars = [
    'MONGODB_URI',
    'LTI_CLIENT_ID', 
    'LTI_DEPLOYMENT_ID',
    'LTI_ISSUER',
    'LTI_PRIVATE_KEY',
    'BASE_URL'
  ];
  
  const optionalVars = [
    'LTI_TOKEN_ENDPOINT',
    'LTI_JWKS_URL',
    'LTI_AUTH_TOKEN_URL'
  ];
  
  requiredVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${varName === 'LTI_PRIVATE_KEY' ? '[PRESENT]' : process.env[varName]}`);
    } else {
      console.log(`   ❌ ${varName}: MISSING`);
    }
  });
  
  console.log('\n   Optional variables:');
  optionalVars.forEach(varName => {
    if (process.env[varName]) {
      console.log(`   ✅ ${varName}: ${process.env[varName]}`);
    } else {
      console.log(`   ⚠️  ${varName}: NOT SET`);
    }
  });
};

const checkLTIDeployments = async () => {
  console.log('\n3️⃣ Checking LTI deployment configuration...');
  
  try {
    const deployments = await LTIDeployment.find({});
    
    if (deployments.length === 0) {
      console.log('   ❌ No LTI deployments found in database');
      console.log('   💡 Creating default deployment...');
      
      const defaultDeployment = new LTIDeployment({
        issuer: process.env.LTI_ISSUER,
        clientId: process.env.LTI_CLIENT_ID,
        deploymentId: process.env.LTI_DEPLOYMENT_ID,
        authenticationEndpoint: `${process.env.LTI_ISSUER}/mod/lti/auth.php`,
        accessTokenEndpoint: process.env.LTI_TOKEN_ENDPOINT || `${process.env.LTI_ISSUER}/login/oauth2/token.php`,
        jwksEndpoint: process.env.LTI_JWKS_URL || `${process.env.LTI_ISSUER}/mod/lti/certs.php`
      });
      
      await defaultDeployment.save();
      console.log('   ✅ Default deployment created');
    } else {
      console.log(`   ✅ Found ${deployments.length} deployment(s):`);
      
      deployments.forEach((deployment, index) => {
        console.log(`\n   Deployment ${index + 1}:`);
        console.log(`   - Issuer: ${deployment.issuer}`);
        console.log(`   - Client ID: ${deployment.clientId}`);
        console.log(`   - Deployment ID: ${deployment.deploymentId}`);
        console.log(`   - Auth Endpoint: ${deployment.authenticationEndpoint}`);
        console.log(`   - Token Endpoint: ${deployment.accessTokenEndpoint}`);
        console.log(`   - JWKS Endpoint: ${deployment.jwksEndpoint}`);
        
        // Validate URLs
        validateURL(deployment.authenticationEndpoint, 'Auth Endpoint');
        validateURL(deployment.accessTokenEndpoint, 'Token Endpoint');
        validateURL(deployment.jwksEndpoint, 'JWKS Endpoint');
      });
    }
    
  } catch (error) {
    console.log('   ❌ Error checking deployments:', error.message);
  }
};

const validateURL = (url, name) => {
  try {
    new URL(url);
    console.log(`   ✅ ${name} URL is valid`);
  } catch (error) {
    console.log(`   ❌ ${name} URL is invalid: ${url}`);
  }
};

const testMoodleEndpoints = async () => {
  console.log('\n4️⃣ Testing Moodle endpoints...');
  
  const deployment = await LTIDeployment.findOne({});
  if (!deployment) {
    console.log('   ❌ No deployment found to test');
    return;
  }
  
  const endpoints = [
    { name: 'Token Endpoint', url: deployment.accessTokenEndpoint },
    { name: 'JWKS Endpoint', url: deployment.jwksEndpoint },
    { name: 'Auth Endpoint', url: deployment.authenticationEndpoint }
  ];
  
  for (const endpoint of endpoints) {
    try {
      console.log(`\n   Testing ${endpoint.name}: ${endpoint.url}`);
      
      const response = await axios.get(endpoint.url, {
        timeout: 10000,
        validateStatus: () => true,
        maxRedirects: 0
      });
      
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${response.headers['content-type']}`);
      
      if (response.status === 404) {
        console.log('   ❌ Endpoint not found (404)');
        
        // Suggest alternative URLs for Moodle
        if (endpoint.name === 'Token Endpoint') {
          const alternatives = [
            `${deployment.issuer}/login/oauth2/token.php`,
            `${deployment.issuer}/mod/lti/token.php`,
            `${deployment.issuer}/login/token.php`
          ];
          console.log('   💡 Try these alternative token endpoints:');
          alternatives.forEach(alt => console.log(`      - ${alt}`));
        }
      } else if (response.status < 400) {
        console.log('   ✅ Endpoint accessible');
      } else {
        console.log(`   ⚠️  Endpoint returned error status: ${response.status}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('   ❌ Connection refused - Is Moodle running?');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   ❌ Host not found - Check the URL');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
  }
};

const testJWTCreation = async () => {
  console.log('\n5️⃣ Testing JWT creation...');
  
  try {
    if (!process.env.LTI_PRIVATE_KEY) {
      console.log('   ❌ LTI_PRIVATE_KEY not set');
      return;
    }
    
    const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      iss: process.env.LTI_CLIENT_ID,
      sub: process.env.LTI_CLIENT_ID,
      aud: process.env.LTI_ISSUER,
      iat: now,
      exp: now + 300,
      jti: 'test-' + Date.now(),
    };
    
    const token = jwt.sign(payload, privateKey, { algorithm: 'RS256' });
    
    console.log('   ✅ JWT created successfully');
    console.log(`   Token length: ${token.length} characters`);
    
    // Verify the token can be decoded
    const decoded = jwt.decode(token, { complete: true });
    console.log('   ✅ JWT can be decoded');
    console.log(`   Algorithm: ${decoded.header.alg}`);
    console.log(`   Issuer: ${decoded.payload.iss}`);
    
  } catch (error) {
    console.log('   ❌ JWT creation failed:', error.message);
  }
};

const checkRecentAssessments = async () => {
  console.log('\n6️⃣ Checking recent assessments...');
  
  try {
    const assessments = await Assessment.find({})
      .sort({ submittedAt: -1 })
      .limit(5);
    
    if (assessments.length === 0) {
      console.log('   📝 No assessments found');
      return;
    }
    
    console.log(`   📝 Found ${assessments.length} recent assessment(s):`);
    
    assessments.forEach((assessment, index) => {
      console.log(`\n   Assessment ${index + 1}:`);
      console.log(`   - ID: ${assessment._id}`);
      console.log(`   - User ID: ${assessment.userId}`);
      console.log(`   - Score: ${assessment.scoreGiven}/${assessment.scoreMaximum}`);
      console.log(`   - Line Item URL: ${assessment.lineItemUrl}`);
      console.log(`   - Passback Status: ${assessment.passbackStatus || 'pending'}`);
      console.log(`   - Submitted: ${assessment.submittedAt}`);
      
      if (assessment.passbackError) {
        console.log(`   - Error: ${assessment.passbackError}`);
      }
    });
    
  } catch (error) {
    console.log('   ❌ Error checking assessments:', error.message);
  }
};

const performTokenTest = async () => {
  console.log('\n7️⃣ Performing end-to-end token test...');
  
  try {
    const deployment = await LTIDeployment.findOne({});
    if (!deployment) {
      console.log('   ❌ No deployment found for testing');
      return;
    }
    
    console.log(`   🎯 Testing with deployment: ${deployment.issuer}`);
    
    const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    
    const jwtPayload = {
      iss: deployment.clientId,
      sub: deployment.clientId,
      aud: [deployment.accessTokenEndpoint, deployment.issuer],
      iat: now,
      exp: now + 300,
      jti: 'diagnostic-' + Date.now(),
    };
    
    const clientAssertion = jwt.sign(jwtPayload, privateKey, { algorithm: 'RS256' });
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.append('client_assertion', clientAssertion);
    params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');
    
    console.log(`   🔄 Requesting token from: ${deployment.accessTokenEndpoint}`);
    
    const response = await axios.post(deployment.accessTokenEndpoint, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });
    
    console.log(`   📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`   📊 Content-Type: ${response.headers['content-type']}`);
    
    if (response.status === 200) {
      console.log('   ✅ Token request successful!');
      
      if (response.data.access_token) {
        console.log('   ✅ Access token received');
        console.log(`   Token type: ${response.data.token_type || 'Bearer'}`);
        console.log(`   Expires in: ${response.data.expires_in || 'unknown'} seconds`);
      } else {
        console.log('   ⚠️  Response successful but no access_token found');
        console.log('   Response data:', response.data);
      }
    } else {
      console.log(`   ❌ Token request failed: ${response.status}`);
      console.log('   Response data:', response.data);
      
      if (response.status === 404) {
        console.log('\n   💡 The token endpoint URL is incorrect. Common Moodle patterns:');
        console.log('      - http://your-moodle/login/oauth2/token.php');
        console.log('      - http://your-moodle/mod/lti/token.php');
      }
    }
    
  } catch (error) {
    console.log('   ❌ Token test failed:', error.message);
    
    if (error.response) {
      console.log(`   Response status: ${error.response.status}`);
      console.log('   Response data:', error.response.data);
    }
  }
};

// Helper function to fix common issues
const suggestFixes = () => {
  console.log('\n🔧 COMMON FIXES:');
  console.log('\n1. If you get 404 errors on token endpoint:');
  console.log('   - Check your Moodle URL is correct');
  console.log('   - Try: http://your-moodle/login/oauth2/token.php');
  console.log('   - Or: http://your-moodle/mod/lti/token.php');
  
  console.log('\n2. If JWT creation fails:');
  console.log('   - Ensure LTI_PRIVATE_KEY is properly formatted');
  console.log('   - Make sure newlines are properly escaped (\\n)');
  
  console.log('\n3. If no deployments found:');
  console.log('   - Run: node scripts/setupLTIDeployment.js');
  
  console.log('\n4. If Moodle endpoints are unreachable:');
  console.log('   - Ensure Moodle is running');
  console.log('   - Check firewall/network settings');
  console.log('   - Verify the URLs match your Moodle installation');
  
  console.log('\n5. If authentication fails:');
  console.log('   - Verify client ID matches Moodle configuration');
  console.log('   - Check deployment ID is correct');
  console.log('   - Ensure public key is registered in Moodle');
};

// Main execution
const main = async () => {
  await runDiagnostic();
  suggestFixes();
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { runDiagnostic, suggestFixes };