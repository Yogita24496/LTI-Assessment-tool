// server/scripts/moodle42Diagnostic.js
const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const LTIDeployment = require('../models/LTIDeployment');
require('dotenv').config();

/**
 * Moodle 4.2 Specific LTI Diagnostic Script
 * This addresses common issues with Moodle 4.2 LTI 1.3 implementation
 */

const runMoodle42Diagnostic = async () => {
  console.log('🔍 Moodle 4.2 LTI Diagnostic Starting...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // 1. Check Moodle accessibility
    await checkMoodleAccessibility();
    
    // 2. Check LTI specific endpoints for Moodle 4.2
    await checkMoodle42Endpoints();
    
    // 3. Test OAuth2 configuration
    await testOAuth2Configuration();
    
    // 4. Verify JWT configuration
    await verifyJWTConfiguration();
    
    // 5. Test actual token request with detailed logging
    await performDetailedTokenTest();
    
    // 6. Check Moodle LTI configuration
    await checkMoodleLTIConfig();

  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
};

const checkMoodleAccessibility = async () => {
  console.log('1️⃣ Checking Moodle accessibility...');
  
  try {
    const moodleUrl = process.env.LTI_ISSUER;
    const response = await axios.get(moodleUrl, {
      timeout: 10000,
      validateStatus: () => true
    });
    
    console.log(`   Moodle URL: ${moodleUrl}`);
    console.log(`   Status: ${response.status}`);
    console.log(`   Server: ${response.headers.server || 'Unknown'}`);
    
    if (response.status === 200) {
      console.log('   ✅ Moodle is accessible');
      
      // Check if it's actually Moodle
      const html = response.data.toString().toLowerCase();
      if (html.includes('moodle')) {
        console.log('   ✅ Confirmed Moodle installation');
      } else {
        console.log('   ⚠️  Warning: May not be a Moodle installation');
      }
    } else {
      console.log('   ❌ Moodle not accessible');
    }
    
  } catch (error) {
    console.log('   ❌ Cannot reach Moodle:', error.message);
  }
};

const checkMoodle42Endpoints = async () => {
  console.log('\n2️⃣ Checking Moodle 4.2 LTI endpoints...');
  
  const baseUrl = process.env.LTI_ISSUER;
  
  // Moodle 4.2 specific endpoint patterns
  const endpoints = [
    {
      name: 'OAuth2 Token Endpoint (Primary)',
      url: `${baseUrl}/login/oauth2/token.php`,
      expected: 'POST endpoint for OAuth2 tokens'
    },
    {
      name: 'LTI Token Endpoint (Alternative)', 
      url: `${baseUrl}/mod/lti/token.php`,
      expected: 'POST endpoint for LTI tokens'
    },
    {
      name: 'JWKS Endpoint',
      url: `${baseUrl}/mod/lti/certs.php`,
      expected: 'JSON Web Key Set'
    },
    {
      name: 'LTI Auth Endpoint',
      url: `${baseUrl}/mod/lti/auth.php`,
      expected: 'LTI Authentication endpoint'
    },
    {
      name: 'OAuth2 Authorization Endpoint',
      url: `${baseUrl}/login/oauth2/authorization.php`,
      expected: 'OAuth2 authorization endpoint'
    }
  ];

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
};

const testEndpoint = async (endpoint) => {
  try {
    console.log(`\n   Testing: ${endpoint.name}`);
    console.log(`   URL: ${endpoint.url}`);
    
    const response = await axios.get(endpoint.url, {
      timeout: 10000,
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
    
    // Special handling for different endpoint types
    if (endpoint.name.includes('JWKS')) {
      if (response.status === 200 && response.data && response.data.keys) {
        console.log(`   ✅ JWKS endpoint working - Found ${response.data.keys.length} keys`);
      } else {
        console.log('   ❌ JWKS endpoint not returning valid key set');
      }
    } else if (endpoint.name.includes('Token')) {
      if (response.status === 405) {
        console.log('   ✅ Token endpoint exists (Method Not Allowed is expected for GET)');
      } else if (response.status === 400) {
        console.log('   ✅ Token endpoint exists (Bad Request is expected without params)');
      } else if (response.status === 404) {
        console.log('   ❌ Token endpoint not found');
      } else {
        console.log(`   ⚠️  Unexpected response: ${response.status}`);
      }
    } else {
      if (response.status < 400) {
        console.log('   ✅ Endpoint accessible');
      } else if (response.status === 404) {
        console.log('   ❌ Endpoint not found');
      } else {
        console.log(`   ⚠️  Status: ${response.status}`);
      }
    }
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('   ❌ Connection refused - Moodle not running?');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   ❌ Host not found - Check URL');
    } else {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
};

const testOAuth2Configuration = async () => {
  console.log('\n3️⃣ Testing OAuth2 configuration...');
  
  try {
    // Test the actual OAuth2 endpoint that Moodle 4.2 uses
    const tokenUrl = `${process.env.LTI_ISSUER}/login/oauth2/token.php`;
    
    console.log(`   Testing POST to: ${tokenUrl}`);
    
    // Create a minimal OAuth2 request to see what error we get
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', process.env.LTI_CLIENT_ID);
    params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');
    
    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 15000,
      validateStatus: () => true
    });
    
    console.log(`   Response Status: ${response.status}`);
    console.log(`   Response Headers:`, response.headers);
    console.log(`   Response Data:`, response.data);
    
    if (response.status === 400) {
      const errorData = response.data;
      if (errorData.error === 'invalid_client') {
        console.log('   ⚠️  Client ID not recognized by Moodle');
      } else if (errorData.error === 'unsupported_grant_type') {
        console.log('   ⚠️  Moodle doesn\'t support client_credentials grant');
      } else {
        console.log('   ⚠️  OAuth2 error:', errorData.error);
      }
    }
    
  } catch (error) {
    console.log('   ❌ OAuth2 test failed:', error.message);
  }
};

const verifyJWTConfiguration = async () => {
  console.log('\n4️⃣ Verifying JWT configuration...');
  
  try {
    const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
    const clientId = process.env.LTI_CLIENT_ID;
    const issuer = process.env.LTI_ISSUER;
    
    console.log(`   Client ID: ${clientId}`);
    console.log(`   Issuer: ${issuer}`);
    console.log(`   Private Key Length: ${privateKey.length} characters`);
    
    // Test JWT creation
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: clientId,
      sub: clientId,
      aud: `${issuer}/login/oauth2/token.php`,
      iat: now,
      exp: now + 300,
      jti: `test-${Date.now()}`
    };
    
    console.log('   JWT Payload:', payload);
    
    const token = jwt.sign(payload, privateKey, { 
      algorithm: 'RS256',
      keyid: process.env.LTI_KEY_ID 
    });
    
    console.log('   ✅ JWT created successfully');
    console.log(`   JWT Length: ${token.length} characters`);
    
    // Decode to verify
    const decoded = jwt.decode(token, { complete: true });
    console.log('   JWT Header:', decoded.header);
    console.log('   ✅ JWT is valid and decodable');
    
  } catch (error) {
    console.log('   ❌ JWT configuration error:', error.message);
  }
};

const performDetailedTokenTest = async () => {
  console.log('\n5️⃣ Performing detailed token test...');
  
  const endpoints = [
    `${process.env.LTI_ISSUER}/login/oauth2/token.php`,
    `${process.env.LTI_ISSUER}/mod/lti/token.php`
  ];
  
  for (const endpoint of endpoints) {
    console.log(`\n   Testing endpoint: ${endpoint}`);
    
    try {
      const privateKey = process.env.LTI_PRIVATE_KEY.replace(/\\n/g, '\n');
      const now = Math.floor(Date.now() / 1000);
      
      const jwtPayload = {
        iss: process.env.LTI_CLIENT_ID,
        sub: process.env.LTI_CLIENT_ID,
        aud: [endpoint, process.env.LTI_ISSUER],
        iat: now,
        exp: now + 300,
        jti: `detailed-test-${Date.now()}`
      };
      
      const clientAssertion = jwt.sign(jwtPayload, privateKey, { 
        algorithm: 'RS256',
        keyid: process.env.LTI_KEY_ID 
      });
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      params.append('client_assertion', clientAssertion);
      params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');
      
      console.log('   Request details:');
      console.log(`   - Grant Type: client_credentials`);
      console.log(`   - Client Assertion Type: jwt-bearer`);
      console.log(`   - Client Assertion Length: ${clientAssertion.length}`);
      console.log(`   - Scope: LTI AGS score`);
      
      const response = await axios.post(endpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'LTI-Tool/1.0'
        },
        timeout: 20000,
        validateStatus: () => true
      });
      
      console.log(`   Response Status: ${response.status} ${response.statusText}`);
      console.log(`   Response Headers:`, Object.keys(response.headers));
      
      if (response.data) {
        console.log(`   Response Data:`, response.data);
      }
      
      if (response.status === 200 && response.data.access_token) {
        console.log('   ✅ SUCCESS! Token obtained');
        return response.data.access_token;
      } else {
        console.log('   ❌ Token request failed');
      }
      
    } catch (error) {
      console.log(`   ❌ Request failed: ${error.message}`);
      if (error.response) {
        console.log(`   Error Response: ${error.response.status} - ${error.response.data}`);
      }
    }
  }
};

const checkMoodleLTIConfig = async () => {
  console.log('\n6️⃣ Moodle LTI Configuration Checklist...');
  
  console.log(`
📋 MOODLE 4.2 LTI CONFIGURATION CHECKLIST:

1. External Tool Configuration:
   ✓ Go to Site Administration → Plugins → Activity modules → External tool → Manage tools
   ✓ Add a new LTI 1.3 tool with these settings:
     - Tool URL: ${process.env.BASE_URL}/api/lti/launch
     - Login URL: ${process.env.BASE_URL}/api/lti/login  
     - Redirection URI: ${process.env.BASE_URL}/api/lti/launch
     - Client ID: ${process.env.LTI_CLIENT_ID}
     - Public key type: RSA key
     - Public key: [Your public key content]
     - Initiate login URL: ${process.env.BASE_URL}/api/lti/login
     - Redirection URI(s): ${process.env.BASE_URL}/api/lti/launch

2. Services Configuration:
   ✓ Enable "Assignment and Grade Services (AGS)"
   ✓ Enable "Names and Role Provisioning Services (NRPS)" if needed
   ✓ Set appropriate privacy settings

3. Platform Identification:
   ✓ Platform ID (Issuer): ${process.env.LTI_ISSUER}
   ✓ Client ID matches: ${process.env.LTI_CLIENT_ID}
   ✓ Deployment ID: ${process.env.LTI_DEPLOYMENT_ID}

4. Key Pair:
   ✓ Your tool's private key is properly formatted
   ✓ The corresponding public key is registered in Moodle
   ✓ Key ID (kid) is set if required

5. Endpoints (Moodle 4.2):
   ✓ Token endpoint: ${process.env.LTI_ISSUER}/login/oauth2/token.php
   ✓ JWKS endpoint: ${process.env.LTI_ISSUER}/mod/lti/certs.php
   ✓ Auth endpoint: ${process.env.LTI_ISSUER}/mod/lti/auth.php
  `);
};

// Export and run
if (require.main === module) {
  runMoodle42Diagnostic().catch(console.error);
}

module.exports = { runMoodle42Diagnostic };