// registerPlatform.js
require('dotenv').config();
const mongoose = require('mongoose');
const LTIDeployment = require('./models/LTIDeployment');

// Database connection - removed deprecated options
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch(err => {
  console.error('Failed to connect to MongoDB:', err);
  process.exit(1);
});

// Define the LTI platform details from your .env file
const platformData = {
  issuer: process.env.LTI_ISSUER,
  clientId: process.env.LTI_CLIENT_ID,
  deploymentId: process.env.LTI_DEPLOYMENT_ID,
  authenticationEndpoint: `${process.env.LTI_ISSUER}/mod/lti/auth.php`, // Moodle's standard auth endpoint
  accessTokenEndpoint: process.env.LTI_AUTH_TOKEN_URL,
  jwksEndpoint: process.env.LTI_JWKS_URL
};

async function registerPlatform() {
  try {
    // Check if platform already exists
    const existingPlatform = await LTIDeployment.findOne({ issuer: platformData.issuer });
    
    if (existingPlatform) {
      console.log('Platform already registered, updating...');
      Object.assign(existingPlatform, platformData);
      await existingPlatform.save();
      console.log('Platform updated successfully!');
    } else {
      // Create new platform registration
      const platform = new LTIDeployment(platformData);
      await platform.save();
      console.log('Platform registered successfully!');
    }
    
    // Verify by listing all registered platforms
    const platforms = await LTIDeployment.find({});
    console.log('Current registered platforms:');
    platforms.forEach(p => {
      console.log(`- Issuer: ${p.issuer}`);
      console.log(`  Client ID: ${p.clientId}`);
      console.log(`  Deployment ID: ${p.deploymentId}`);
      console.log('---');
    });
    
    mongoose.connection.close();
  } catch (error) {
    console.error('Error registering platform:', error);
    mongoose.connection.close();
    process.exit(1);
  }
}

registerPlatform();