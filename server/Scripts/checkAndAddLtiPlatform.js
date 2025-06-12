// scripts/checkAndAddLtiPlatform.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

async function checkAndAddPlatform() {
  try {
    // Connect to the database
    await connectDB();
    console.log('Connected to database');
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    // Get the LTIDeployment model
    // Note: We're requiring it after connecting to ensure the connection is established
    const LTIDeployment = require('../models/LTIDeployment');
    
    // Check if the model was loaded correctly
    console.log('LTIDeployment model loaded:', !!LTIDeployment);
    
    // Check what collection we're using
    console.log('Collection name:', LTIDeployment.collection.name);
    
    // Check for existing platforms
    const existingPlatforms = await LTIDeployment.find({});
    console.log('Existing platforms:', existingPlatforms);
    
    // Check specifically for the Moodle platform
    const moodlePlatform = await LTIDeployment.findOne({ issuer: 'http://localhost/moodle' });
    console.log('Found Moodle platform:', moodlePlatform);
    
    // If the platform doesn't exist, create it
    if (!moodlePlatform) {
      console.log('Moodle platform not found. Creating it...');
      
      const newPlatform = new LTIDeployment({
        name: 'Local Moodle',
        issuer: 'http://localhost/moodle',
        clientId: 'lti-tool-client', // Use your actual client ID
        authenticationEndpoint: 'http://localhost/moodle/mod/lti/auth.php',
        accessTokenEndpoint: 'http://localhost/moodle/mod/lti/token.php',
        jwksEndpoint: 'http://localhost/moodle/mod/lti/certs.php',
        deploymentIds: ['1'], // Use your actual deployment ID
        active: true
      });
      
      // Save the new platform
      await newPlatform.save();
      console.log('Moodle platform created successfully!');
      
      // Verify it was saved
      const verifyPlatform = await LTIDeployment.findOne({ issuer: 'http://localhost/moodle' });
      console.log('Verified platform exists:', !!verifyPlatform);
      if (verifyPlatform) {
        console.log('Platform details:', verifyPlatform);
      }
    } else {
      console.log('Moodle platform already exists:', moodlePlatform);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the database connection
    await mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the function
checkAndAddPlatform();