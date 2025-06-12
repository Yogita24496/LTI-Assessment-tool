// models/LTIDeployment.js
const mongoose = require('mongoose');

const LTIDeploymentSchema = new mongoose.Schema({
  issuer: {
    type: String,
    required: true,
    unique: true
  },
  clientId: {
    type: String,
    required: true
  },
  deploymentId: {
    type: String,
    required: true
  },
  authenticationEndpoint: {
    type: String,
    required: true
  },
  accessTokenEndpoint: {
    type: String,
    required: true
  },
  jwksEndpoint: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on every save
LTIDeploymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('LTIDeployment', mongoose.models.LTIDeployment || LTIDeploymentSchema);
