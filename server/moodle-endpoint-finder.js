// debug-lti.js - Standalone script to debug LTI configuration
const agsService = require('./services/ags');

async function debugLTI() {
  console.log('🔧 LTI 1.3 Configuration Debugger');
  console.log('==================================\n');

  const issuer = "http://localhost/moodle";
  const clientId = "GmoRpk2CCSyeQHy";
  const deploymentId = 11;

  console.log('📋 Configuration:');
  console.log(`   Issuer: ${issuer}`);
  console.log(`   Client ID: ${clientId}`);
  console.log(`   Deployment ID: ${deploymentId}\n`);

  try {
    // Test 1: Basic Moodle connectivity
    console.log('🧪 Test 1: Basic Moodle Connectivity');
    console.log('-------------------------------------');
    const connectivityResult = await agsService.testMoodleConnectivity(issuer);
    console.log(`Result: ${connectivityResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message: ${connectivityResult.message}\n`);

    if (!connectivityResult.success) {
      console.log('🛑 Cannot proceed - Moodle is not reachable');
      return;
    }

    // Test 2: Endpoint discovery
    console.log('🧪 Test 2: LTI Endpoint Discovery');
    console.log('----------------------------------');
    const endpoints = await agsService.discoverEndpoints(issuer);
    console.log('Endpoint scan results:');
    endpoints.forEach(ep => {
      console.log(`   ${ep.endpoint}: ${ep.exists ? `Status ${ep.status}` : 'Not reachable'}`);
    });
    console.log();

    // Test 3: Token acquisition
    console.log('🧪 Test 3: Access Token Acquisition');
    console.log('------------------------------------');
    const tokenResult = await agsService.testConnection(issuer, clientId, deploymentId);
    console.log(`Result: ${tokenResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Message: ${tokenResult.message}`);
    if (tokenResult.tokenPreview) {
      console.log(`Token Preview: ${tokenResult.tokenPreview}`);
    }
    console.log();

    // Summary and recommendations
    console.log('📝 Summary and Recommendations');
    console.log('==============================');
    
    if (tokenResult.success) {
      console.log('✅ LTI configuration appears to be working correctly!');
      console.log('You should now be able to submit grades.');
    } else {
      console.log('❌ LTI configuration has issues. Common problems:');
      console.log();
      console.log('1. 🔧 LTI 1.3 not enabled in Moodle:');
      console.log('   - Go to Site administration > Plugins > Activity modules > External tool');
      console.log('   - Enable LTI 1.3 support');
      console.log();
      console.log('2. 🔧 External Tool not configured:');
      console.log('   - Create a new External Tool in Moodle admin');
      console.log('   - Use "Configure a tool manually"');
      console.log('   - Set Tool URL to your application URL');
      console.log('   - Enable "Assignment and Grade Services"');
      console.log();
      console.log('3. 🔧 Client ID mismatch:');
      console.log(`   - Verify client ID "${clientId}" matches Moodle configuration`);
      console.log();
      console.log('4. 🔧 RSA Key mismatch:');
      console.log('   - Ensure your public key is correctly configured in Moodle');
      console.log('   - Verify private key is properly loaded');
      console.log();
      console.log('5. 🔧 Deployment ID incorrect:');
      console.log(`   - Verify deployment ID "${deploymentId}" is correct`);
      console.log('   - Check Moodle\'s LTI deployment settings');
    }

  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Ensure Moodle is running and accessible');
    console.log('2. Check your network connectivity');
    console.log('3. Verify RSA keys are generated and accessible');
    console.log('4. Confirm Moodle LTI 1.3 is properly configured');
  }
}

// Run the debug script if called directly
if (require.main === module) {
  debugLTI();
}

module.exports = { debugLTI };