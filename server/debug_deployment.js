// debug_deployment.js - Script to check and debug LTI deployment configuration
const LTIDeployment = require('./models/LTIDeployment'); // Adjust path as needed
const mongoose = require('mongoose');

async function debugDeploymentConfig() {
  try {
    // Connect to your database (adjust connection string as needed)
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');
    
    console.log('=== LTI Deployment Configuration Debug ===\n');
    
    // Find the deployment you're trying to use
    const targetDeployment = await LTIDeployment.findOne({
      issuer: "http://localhost/moodle",
      clientId: "GmoRpk2CCSyeQHy",
      deploymentId: 11
    });
    
    if (!targetDeployment) {
      console.error('❌ Target deployment not found!');
      console.log('Looking for:');
      console.log('  - issuer: http://localhost/moodle');
      console.log('  - clientId: GmoRpk2CCSyeQHy');
      console.log('  - deploymentId: 11\n');
      
      console.log('Available deployments:');
      const allDeployments = await LTIDeployment.find({});
      allDeployments.forEach((dep, index) => {
        console.log(`  ${index + 1}. issuer: ${dep.issuer}`);
        console.log(`     clientId: ${dep.clientId}`);
        console.log(`     deploymentId: ${dep.deploymentId}`);
        console.log(`     accessTokenEndpoint: ${dep.accessTokenEndpoint || 'NOT SET'}`);
        console.log('');
      });
      
      return;
    }
    
    console.log('✅ Found target deployment:');
    console.log(`  - issuer: ${targetDeployment.issuer}`);
    console.log(`  - clientId: ${targetDeployment.clientId}`);
    console.log(`  - deploymentId: ${targetDeployment.deploymentId}`);
    console.log(`  - accessTokenEndpoint: ${targetDeployment.accessTokenEndpoint || 'NOT SET'}`);
    
    // Check if accessTokenEndpoint is properly set
    if (!targetDeployment.accessTokenEndpoint) {
      console.log('\n❌ accessTokenEndpoint is missing!');
      console.log('Common Moodle token endpoints:');
      console.log(`  - ${targetDeployment.issuer}/login/oauth2/token.php`);
      console.log(`  - ${targetDeployment.issuer}/mod/lti/token.php`);
      console.log('\nYou should update your deployment with the correct endpoint.');
      
      // Suggest an update
      console.log('\nSuggested MongoDB update command:');
      console.log(`db.ltideployments.updateOne(`);
      console.log(`  { issuer: "${targetDeployment.issuer}", clientId: "${targetDeployment.clientId}", deploymentId: ${targetDeployment.deploymentId} },`);
      console.log(`  { $set: { accessTokenEndpoint: "${targetDeployment.issuer}/login/oauth2/token.php" } }`);
      console.log(`);`);
    }
    
    // Check environment variables
    console.log('\n=== Environment Variables Check ===');
    console.log(`LTI_PRIVATE_KEY: ${process.env.LTI_PRIVATE_KEY ? 'SET (length: ' + process.env.LTI_PRIVATE_KEY.length + ')' : 'NOT SET'}`);
    console.log(`LTI_TOKEN_ENDPOINT: ${process.env.LTI_TOKEN_ENDPOINT || 'NOT SET'}`);
    
    if (!process.env.LTI_PRIVATE_KEY) {
      console.log('\n❌ LTI_PRIVATE_KEY environment variable is missing!');
      console.log('This should contain your LTI tool\'s private key in PEM format.');
    }
    
  } catch (error) {
    console.error('Debug script error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

// Run the debug script
debugDeploymentConfig();