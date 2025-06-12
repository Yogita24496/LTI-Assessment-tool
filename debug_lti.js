// comprehensive_lti_debug.js - Complete LTI debugging tool
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Debug configuration
const DEBUG_CONFIG = {
  issuer: "http://localhost/moodle",
  clientId: "GmoRpk2CCSyeQHy",
  deploymentId: 11,
  // Add your private key here for testing
  privateKey: process.env.LTI_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
YOUR_PRIVATE_KEY_HERE
-----END PRIVATE KEY-----`
};

// List of endpoints to test
const TOKEN_ENDPOINTS = [
  `${DEBUG_CONFIG.issuer}/login/oauth2/token.php`,
  `${DEBUG_CONFIG.issuer}/mod/lti/token.php`,
  `${DEBUG_CONFIG.issuer}/lib/oauth2/token.php`,
  `${DEBUG_CONFIG.issuer}/webservice/oauth2/token.php`,
  `${DEBUG_CONFIG.issuer}/auth/oauth2/token.php`,
  `${DEBUG_CONFIG.issuer}/oauth2/token.php`
];

async function comprehensiveDebug() {
  console.log('🔍 === LTI Comprehensive Debug Tool ===\n');
  
  // Step 1: Environment Check
  console.log('📋 Step 1: Environment Check');
  console.log('─────────────────────────────');
  checkEnvironment();
  console.log('');
  
  // Step 2: Private Key Validation
  console.log('🔐 Step 2: Private Key Validation');
  console.log('──────────────────────────────');
  await validatePrivateKey();
  console.log('');
  
  // Step 3: Test Token Endpoints
  console.log('🌐 Step 3: Token Endpoint Accessibility');
  console.log('──────────────────────────────────────');
  await testAllEndpoints();
  console.log('');
  
  // Step 4: JWT Token Creation Test
  console.log('🎫 Step 4: JWT Token Creation Test');
  console.log('──────────────────────────────────');
  await testJWTCreation();
  console.log('');
  
  // Step 5: Full OAuth2 Flow Test
  console.log('🔄 Step 5: OAuth2 Flow Test');
  console.log('───────────────────────────');
  await testOAuth2Flow();
}

function checkEnvironment() {
  console.log(`Issuer: ${DEBUG_CONFIG.issuer}`);
  console.log(`Client ID: ${DEBUG_CONFIG.clientId}`);
  console.log(`Deployment ID: ${DEBUG_CONFIG.deploymentId}`);
  console.log(`Private Key: ${DEBUG_CONFIG.privateKey ? '✅ Present' : '❌ Missing'}`);
  
  if (DEBUG_CONFIG.privateKey) {
    console.log(`Private Key Length: ${DEBUG_CONFIG.privateKey.length} characters`);
    console.log(`Starts with PEM header: ${DEBUG_CONFIG.privateKey.includes('-----BEGIN') ? '✅' : '❌'}`);
  }
}

async function validatePrivateKey() {
  if (!DEBUG_CONFIG.privateKey) {
    console.log('❌ No private key provided');
    return;
  }
  
  try {
    // Clean up the private key
    const cleanKey = DEBUG_CONFIG.privateKey.replace(/\\n/g, '\n');
    
    // Test if we can create a JWT with it
    const testPayload = { test: 'payload', iat: Math.floor(Date.now() / 1000) };
    const testToken = jwt.sign(testPayload, cleanKey, { algorithm: 'RS256' });
    
    console.log('✅ Private key is valid and can sign JWTs');
    console.log(`Sample JWT (first 50 chars): ${testToken.substring(0, 50)}...`);
    
    // Try to verify it
    const decoded = jwt.verify(testToken, extractPublicKey(cleanKey), { algorithms: ['RS256'] });
    console.log('✅ JWT verification successful');
    
  } catch (error) {
    console.log('❌ Private key validation failed:', error.message);
    
    // Common fixes
    console.log('\n💡 Common private key issues:');
    console.log('1. Key format: Should start with "-----BEGIN PRIVATE KEY-----"');
    console.log('2. Line breaks: Use actual \\n characters, not literal \\n strings');
    console.log('3. Key type: Should be RSA private key in PKCS#8 format');
    console.log('4. Encoding: Should be PEM encoded');
  }
}

function extractPublicKey(privateKey) {
  try {
    const keyObject = crypto.createPrivateKey(privateKey);
    return crypto.createPublicKey(keyObject).export({ format: 'pem', type: 'spki' });
  } catch (error) {
    throw new Error('Cannot extract public key from private key');
  }
}

async function testAllEndpoints() {
  for (let i = 0; i < TOKEN_ENDPOINTS.length; i++) {
    const endpoint = TOKEN_ENDPOINTS[i];
    console.log(`${i + 1}. Testing: ${endpoint}`);
    
    try {
      const response = await axios.get(endpoint, {
        timeout: 5000,
        validateStatus: () => true // Accept any status
      });
      
      const contentType = response.headers['content-type'] || '';
      console.log(`   Status: ${response.status} ${response.statusText}`);
      console.log(`   Content-Type: ${contentType}`);
      
      if (response.status === 200) {
        console.log('   ✅ Endpoint is accessible');
      } else if (response.status === 405) {
        console.log('   🔄 Method not allowed (expected for GET on token endpoint)');
      } else if (response.status === 404) {
        console.log('   ❌ Endpoint not found');
      } else {
        console.log(`   ⚠️  Unexpected status: ${response.status}`);
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('   ❌ Connection refused - Server not running?');
      } else if (error.code === 'ENOTFOUND') {
        console.log('   ❌ Host not found');
      } else {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    console.log('');
  }
}

async function testJWTCreation() {
  if (!DEBUG_CONFIG.privateKey) {
    console.log('❌ Cannot test JWT creation without private key');
    return;
  }
  
  try {
    const cleanKey = DEBUG_CONFIG.privateKey.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    
    const jwtPayload = {
      iss: DEBUG_CONFIG.clientId,
      sub: DEBUG_CONFIG.clientId,
      aud: [TOKEN_ENDPOINTS[0], DEBUG_CONFIG.issuer], // Use first endpoint
      iat: now,
      exp: now + 300,
      jti: Math.random().toString(36).substring(2, 15) + Date.now(),
    };
    
    console.log('JWT Payload:');
    console.log(JSON.stringify(jwtPayload, null, 2));
    
    const clientAssertion = jwt.sign(jwtPayload, cleanKey, { algorithm: 'RS256' });
    console.log(`\n✅ JWT Created successfully`);
    console.log(`JWT Length: ${clientAssertion.length} characters`);
    console.log(`JWT Header: ${clientAssertion.split('.')[0]}`);
    
    // Decode header to verify algorithm
    const decodedHeader = JSON.parse(Buffer.from(clientAssertion.split('.')[0], 'base64').toString());
    console.log('JWT Header decoded:', decodedHeader);
    
  } catch (error) {
    console.log('❌ JWT Creation failed:', error.message);
  }
}

async function testOAuth2Flow() {
  if (!DEBUG_CONFIG.privateKey) {
    console.log('❌ Cannot test OAuth2 flow without private key');
    return;
  }
  
  const cleanKey = DEBUG_CONFIG.privateKey.replace(/\\n/g, '\n');
  
  for (let i = 0; i < TOKEN_ENDPOINTS.length; i++) {
    const endpoint = TOKEN_ENDPOINTS[i];
    console.log(`\n${i + 1}. Testing OAuth2 flow with: ${endpoint}`);
    console.log('─'.repeat(50));
    
    try {
      const now = Math.floor(Date.now() / 1000);
      
      const jwtPayload = {
        iss: DEBUG_CONFIG.clientId,
        sub: DEBUG_CONFIG.clientId,
        aud: [endpoint, DEBUG_CONFIG.issuer],
        iat: now,
        exp: now + 300,
        jti: Math.random().toString(36).substring(2, 15) + Date.now(),
      };
      
      const clientAssertion = jwt.sign(jwtPayload, cleanKey, { algorithm: 'RS256' });
      
      const params = new URLSearchParams();
      params.append('grant_type', 'client_credentials');
      params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
      params.append('client_assertion', clientAssertion);
      params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');
      
      console.log('Request details:');
      console.log(`  Method: POST`);
      console.log(`  URL: ${endpoint}`);
      console.log(`  Content-Type: application/x-www-form-urlencoded`);
      console.log(`  grant_type: client_credentials`);
      console.log(`  scope: https://purl.imsglobal.org/spec/lti-ags/scope/score`);
      console.log(`  client_assertion length: ${clientAssertion.length}`);
      
      const response = await axios.post(endpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'LTI-Debug-Tool/1.0'
        },
        timeout: 15000,
        validateStatus: () => true // Accept any status
      });
      
      console.log(`\nResponse:`)
      console.log(`  Status: ${response.status} ${response.statusText}`);
      console.log(`  Content-Type: ${response.headers['content-type']}`);
      
      if (response.status === 200 && response.data.access_token) {
        console.log('  ✅ SUCCESS! Access token obtained');
        console.log(`  Token (first 20 chars): ${response.data.access_token.substring(0, 20)}...`);
        console.log(`  Token type: ${response.data.token_type || 'not specified'}`);
        console.log(`  Expires in: ${response.data.expires_in || 'not specified'} seconds`);
        
        // This endpoint works!
        console.log(`\n🎉 WORKING ENDPOINT FOUND: ${endpoint}`);
        break;
        
      } else {
        console.log('  ❌ Failed to get access token');
        
        if (response.data) {
          console.log('  Response data:', JSON.stringify(response.data, null, 2));
        }
        
        // Common error analysis
        if (response.status === 400) {
          console.log('  💡 400 Bad Request - Check JWT format or client credentials');
        } else if (response.status === 401) {
          console.log('  💡 401 Unauthorized - Check client_id and private key');
        } else if (response.status === 404) {
          console.log('  💡 404 Not Found - Wrong endpoint URL');
        } else if (response.status === 405) {
          console.log('  💡 405 Method Not Allowed - Endpoint might not support POST');
        }
      }
      
    } catch (error) {
      console.log(`  ❌ Request failed: ${error.message}`);
      
      if (error.response) {
        console.log(`  Response status: ${error.response.status}`);
        console.log(`  Response data:`, error.response.data);
      }
    }
  }
}

// Export for use in other files
module.exports = {
  comprehensiveDebug,
  DEBUG_CONFIG,
  TOKEN_ENDPOINTS
};

// Run if called directly
if (require.main === module) {
  comprehensiveDebug().catch(console.error);
}