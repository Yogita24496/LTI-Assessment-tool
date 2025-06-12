// scripts/addLtiDeployment.js
require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('../config/database');

// Assuming your LTIDeployment model looks something like this
const LTIDeployment = require('../models/LTIDeployment');

async function addMoodlePlatform() {
  try {
    // Connect to the database
    await connectDB();
    console.log('Connected to database');

    // Create a new LTI platform configuration for Moodle
    const moodlePlatform = new LTIDeployment({
      name: 'Local Moodle',
      issuer: 'http://localhost/moodle',
      clientId: 'YOUR_CLIENT_ID', // Replace with your actual client ID from Moodle
      authenticationEndpoint: 'http://localhost/moodle/mod/lti/auth.php',
      accessTokenEndpoint: 'http://localhost/moodle/mod/lti/token.php',
      jwksEndpoint: 'http://localhost/moodle/mod/lti/certs.php',
      deploymentIds: ['1'], // Replace with your actual deployment ID(s)
      active: true
    });

    // Save the platform to the database
    await moodlePlatform.save();
    console.log('Moodle platform added successfully');

    // Verify it was saved
    const platforms = await LTIDeployment.find({});
    console.log('All platforms:', platforms);

  } catch (error) {
    console.error('Error adding Moodle platform:', error);
  } finally {
    // Close the database connection
    mongoose.disconnect();
    console.log('Disconnected from database');
  }
}

// Run the function
addMoodlePlatform();