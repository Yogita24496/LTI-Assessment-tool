// server/models/Assessment.js
const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  courseId: {
    type: String,
    required: true
  },
  resourceLinkId: {
    type: String,
    required: true
  },
  lineItemUrl: {
    type: String,
    required: true
  },
  scoreGiven: {
    type: Number,
    required: true
  },
  scoreMaximum: {
    type: Number,
    required: true,
    default: 100
  },
  activityProgress: {
    type: String,
    enum: ['Initialized', 'Started', 'InProgress', 'Submitted', 'Completed'],
    default: 'Completed'
  },
  gradingProgress: {
    type: String,
    enum: ['NotReady', 'Failed', 'Pending', 'PendingManual', 'FullyGraded'],
    default: 'FullyGraded'
  },
  feedback: {
    type: String
  },
  // LTI deployment fields (optional)
  issuer: {
    type: String,
    required: false // Made optional
  },
  clientId: {
    type: String,
    required: false // Made optional
  },
  deploymentId: {
    type: String,
    required: false // Made optional
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  passbackStatus: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending'
  },
  passbackError: {
    type: String
  },
  passbackAttempts: {
    type: Number,
    default: 0
  },
  lastPassbackAttempt: {
    type: Date
  }, isGradeSubmitted: {
    type: Boolean,
    default: false
  },
 submissionAttempts: {
    type: Number,
    default: 0
  }
});

module.exports = mongoose.model('Assessment', AssessmentSchema);