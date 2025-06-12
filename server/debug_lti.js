// debug-lti-tokens.js - Complete debugging script
require('dotenv').config();
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

console.log('=== LTI TOKEN DEBUG SCRIPT ===\n');

// Step 1: Verify Environment Configuration
console.log('1. ENVIRONMENT CONFIGURATION CHECK');
console.log('=====================================');

const config = {
  issuer: process.env.LTI_ISSUER,
  clientId: process.env.LTI_CLIENT_ID,
  deploymentId: process.env.LTI_DEPLOYMENT_ID,
  privateKey: process.env.LTI_PRIVATE_KEY,
  tokenEndpoint: process.env.LTI_TOKEN_ENDPOINT,
  defaultTokenEndpoint: process.env.DEFAULT_TOKEN_ENDPOINT,
  keyId: process.env.LTI_KEY_ID
};

console.log('Environment Variables:');
Object.entries(config).forEach(([key, value]) => {
  if (key === 'privateKey') {
    console.log(`${key}: ${value ? `Present (${value.length} chars)` : 'MISSING'}`);
  } else {
    console.log(`${key}: ${value || 'NOT SET'}`);
  }
});

if (!config.issuer || !config.clientId || !config.privateKey) {
  console.log('\n❌ CRITICAL: Missing required environment variables');
  console.log('Please check: LTI_ISSUER, LTI_CLIENT_ID, LTI_PRIVATE_KEY');
  process.exit(1);
}

// Step 2: Private Key Validation
console.log('\n2. PRIVATE KEY VALIDATION');
console.log('==========================');

let cleanPrivateKey;
try {
  cleanPrivateKey = config.privateKey.replace(/\\n/g, '\n');
  
  console.log('✓ Private key cleaned');
  console.log(`Length: ${cleanPrivateKey.length} characters`);
  console.log('Starts with:', cleanPrivateKey.substring(0, 30) + '...');
  console.log('Ends with:', '...' + cleanPrivateKey.substring(cleanPrivateKey.length - 30));
  
  // Test private key validity
  const testPayload = { test: 'data', iat: Math.floor(Date.now() / 1000) };
  const testToken = jwt.sign(testPayload, cleanPrivateKey, { algorithm: 'RS256' });
  console.log('✓ Private key can create JWT tokens');
  
  // Try to decode to verify
  const decoded = jwt.decode(testToken, { complete: true });
  console.log('✓ JWT creation and parsing successful');
  console.log('JWT Header:', decoded.header);
  
} catch (error) {
  console.log('❌ Private key validation failed:', error.message);
  console.log('\nTroubleshooting:');
  console.log('- Check if private key format is correct');
  console.log('- Ensure newlines are properly escaped as \\n');
  console.log('- Verify key starts with -----BEGIN PRIVATE KEY-----');
  process.exit(1);
}

// Step 3: Generate Token Endpoints to Test
console.log('\n3. TOKEN ENDPOINTS TO TEST');
console.log('===========================');

const endpointsToTest = [
  config.tokenEndpoint,
  config.defaultTokenEndpoint,
  `${config.issuer}/login/oauth2/token.php`,
  `${config.issuer}/mod/lti/token.php`,
  `${config.issuer}/webservice/rest/server.php`,
  `${config.issuer}/local/ltiprovider/token.php`
].filter(Boolean).filter((endpoint, index, self) => self.indexOf(endpoint) === index);

console.log('Will test these endpoints:');
endpointsToTest.forEach((endpoint, index) => {
  console.log(`${index + 1}. ${endpoint}`);
});

// Step 4: Test Endpoint Accessibility
console.log('\n4. TESTING ENDPOINT ACCESSIBILITY');
console.log('==================================');

const accessibilityResults = [];

for (let i = 0; i < endpointsToTest.length; i++) {
  const endpoint = endpointsToTest[i];
  console.log(`\nTesting ${i + 1}/${endpointsToTest.length}: ${endpoint}`);
  
  try {
    const response = await axios.get(endpoint, {
      timeout: 8000,
      validateStatus: () => true,
      maxRedirects: 0
    });
    
    const result = {
      endpoint,
      accessible: true,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type'] || 'unknown',
      server: response.headers['server'] || 'unknown'
    };
    
    console.log(`✓ Status: ${result.status} (${result.statusText})`);
    console.log(`  Content-Type: ${result.contentType}`);
    console.log(`  Server: ${result.server}`);
    
    if (response.status === 405) {
      console.log('  📝 Method Not Allowed - Normal for POST-only endpoints');
      result.note = 'POST-only endpoint (expected)';
    } else if (response.status === 404) {
      console.log('  ⚠️  Not Found - May not be the correct endpoint');
      result.note = 'Endpoint not found';
    } else if (response.status >= 500) {
      console.log('  ❌ Server Error');
      result.note = 'Server error';
    } else if (response.status === 200) {
      console.log('  ✓ OK Response');
      result.note = 'Accessible';
    }
    
    accessibilityResults.push(result);
    
  } catch (error) {
    const result = {
      endpoint,
      accessible: false,
      error: error.message,
      code: error.code
    };
    
    console.log(`❌ Failed: ${error.message}`);
    if (error.code) {
      console.log(`  Error Code: ${error.code}`);
    }
    
    accessibilityResults.push(result);
  }
}

// Step 5: Test Token Requests
console.log('\n5. TESTING TOKEN REQUESTS');
console.log('==========================');

const tokenResults = [];

for (let i = 0; i < endpointsToTest.length; i++) {
  const endpoint = endpointsToTest[i];
  console.log(`\n--- Token Request ${i + 1}/${endpointsToTest.length}: ${endpoint} ---`);
  
  try {
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: config.clientId,
      sub: config.clientId,
      aud: [endpoint, config.issuer],
      iat: now,
      exp: now + 300,
      jti: crypto.randomBytes(16).toString('hex')
    };
    
    console.log('JWT Payload:', {
      iss: jwtPayload.iss,
      sub: jwtPayload.sub,
      aud: jwtPayload.aud,
      iat: new Date(jwtPayload.iat * 1000).toISOString(),
      exp: new Date(jwtPayload.exp * 1000).toISOString(),
      jti: jwtPayload.jti
    });
    
    const jwtOptions = { 
      algorithm: 'RS256',
      ...(config.keyId && { keyid: config.keyId })
    };
    
    const clientAssertion = jwt.sign(jwtPayload, cleanPrivateKey, jwtOptions);
    console.log('✓ JWT Created, length:', clientAssertion.length);
    
    // Prepare request body
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_assertion_type', 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer');
    params.append('client_assertion', clientAssertion);
    params.append('scope', 'https://purl.imsglobal.org/spec/lti-ags/scope/score');
    
    const requestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'LTI-Debug-Tool/1.0'
      },
      timeout: 20000,
      validateStatus: () => true,
      maxRedirects: 0
    };
    
    console.log('Making token request...');
    const response = await axios.post(endpoint, params, requestConfig);
    
    console.log(`Response Status: ${response.status} (${response.statusText})`);
    console.log(`Content-Type: ${response.headers['content-type'] || 'Not specified'}`);
    
    const result = {
      endpoint,
      success: false,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type']
    };
    
    if (response.status >= 400) {
      console.log('❌ HTTP Error Response');
      result.error = `HTTP ${response.status}: ${response.statusText}`;
      
      // Log response body for debugging
      if (response.data) {
        if (typeof response.data === 'string' && response.data.length < 2000) {
          console.log('Error Response Body:');
          console.log(response.data);
          result.responseBody = response.data;
        } else if (typeof response.data === 'object') {
          console.log('Error Response JSON:');
          console.log(JSON.stringify(response.data, null, 2));
          result.responseBody = response.data;
        }
      }
    } else {
      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.log('❌ Received HTML instead of JSON');
        result.error = 'HTML response instead of JSON';
        
        if (typeof response.data === 'string') {
          const htmlSnippet = response.data.substring(0, 300);
          console.log('HTML Response (first 300 chars):');
          console.log(htmlSnippet);
          result.responseBody = htmlSnippet;
        }
      } else {
        // Try to parse JSON
        let responseData;
        try {
          responseData = typeof response.data === 'string' ? 
            JSON.parse(response.data) : response.data;
          
          console.log('Response JSON:');
          console.log(JSON.stringify(responseData, null, 2));
          
          if (responseData.access_token) {
            console.log('✅ SUCCESS! Access token received');
            result.success = true;
            result.tokenType = responseData.token_type;
            result.expiresIn = responseData.expires_in;
            result.scope = responseData.scope;
          } else {
            console.log('❌ No access token in response');
            result.error = 'No access_token in response';
            
            if (responseData.error) {
              console.log(`OAuth Error: ${responseData.error}`);
              result.oauthError = responseData.error;
              
              if (responseData.error_description) {
                console.log(`Error Description: ${responseData.error_description}`);
                result.oauthErrorDescription = responseData.error_description;
              }
            }
          }
          
          result.responseData = responseData;
          
        } catch (parseError) {
          console.log('❌ Failed to parse JSON response');
          result.error = 'Invalid JSON response';
          
          if (typeof response.data === 'string' && response.data.length < 1000) {
            console.log('Raw Response:');
            console.log(response.data);
            result.responseBody = response.data;
          }
        }
      }
    }
    
    tokenResults.push(result);
    
    // If we found a working endpoint, we can stop here
    if (result.success) {
      console.log(`\n🎉 WORKING ENDPOINT FOUND: ${endpoint}`);
      break;
    }
    
  } catch (error) {
    console.log(`❌ Request failed: ${error.message}`);
    
    const result = {
      endpoint,
      success: false,
      error: error.message,
      code: error.code
    };
    
    if (error.response) {
      result.status = error.response.status;
      result.statusText = error.response.statusText;
      
      console.log(`HTTP Error: ${error.response.status} ${error.response.statusText}`);
      
      if (error.response.data && typeof error.response.data === 'string' && error.response.data.length < 1000) {
        console.log('Error Response Body:');
        console.log(error.response.data);
        result.responseBody = error.response.data;
      }
    } else if (error.request) {
      console.log('Network Error: No response received');
      result.networkError = true;
    }
    
    tokenResults.push(result);
  }
}

// Step 6: Summary and Recommendations
console.log('\n6. SUMMARY AND RECOMMENDATIONS');
console.log('===============================');

console.log('\nAccessibility Results:');
accessibilityResults.forEach((result, index) => {
  const status = result.accessible ? '✓' : '❌';
  console.log(`${index + 1}. ${status} ${result.endpoint}`);
  if (result.note) {
    console.log(`   ${result.note}`);
  }
  if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
});

console.log('\nToken Request Results:');
tokenResults.forEach((result, index) => {
  const status = result.success ? '✅' : '❌';
  console.log(`${index + 1}. ${status} ${result.endpoint}`);
  if (result.success) {
    console.log(`   Token Type: ${result.tokenType}, Expires: ${result.expiresIn}s`);
  } else if (result.oauthError) {
    console.log(`   OAuth Error: ${result.oauthError}`);
    if (result.oauthErrorDescription) {
      console.log(`   Description: ${result.oauthErrorDescription}`);
    }
  } else if (result.error) {
    console.log(`   Error: ${result.error}`);
  }
});

// Find working endpoint
const workingEndpoint = tokenResults.find(result => result.success);

if (workingEndpoint) {
  console.log(`\n🎉 SUCCESS! Working endpoint found:`);
  console.log(`${workingEndpoint.endpoint}`);
  console.log('\nUpdate your .env file:');
  console.log(`LTI_TOKEN_ENDPOINT=${workingEndpoint.endpoint}`);
} else {
  console.log('\n❌ NO WORKING ENDPOINTS FOUND');
  console.log('\nTroubleshooting Steps:');
  console.log('1. Check Moodle External Tool Configuration:');
  console.log('   - Site admin → Plugins → Activity modules → External tool');
  console.log('   - Verify Client ID matches exactly');
  console.log('   - Ensure public key corresponds to your private key');
  console.log('   - Check that LTI version is set to 1.3');
  console.log('   - Enable "Assignment and Grade Services"');
  
  console.log('\n2. Common Issues:');
  console.log('   - Private/Public key mismatch');
  console.log('   - Incorrect client_id');
  console.log('   - Wrong Moodle base URL');
  console.log('   - LTI tool not properly registered');
  console.log('   - Moodle not configured for LTI 1.3');
  
  console.log('\n3. Check Moodle Logs:');
  console.log('   - Site admin → Reports → Logs');
  console.log('   - Look for LTI-related errors');
  
  console.log('\n4. Verify Network Connectivity:');
  console.log('   - Ensure your application can reach Moodle');
  console.log('   - Check firewall settings');
  console.log('   - Test from the same network');
}

console.log('\n=== DEBUG COMPLETE ===');