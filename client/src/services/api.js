// client/src/services/api.js
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// LTI launch
export const ltiLaunch = async (idToken) => {
  try {
    const response = await api.post('/lti/launch', { id_token: idToken });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Create assessment
export const createAssessment = async (assessmentData) => {
  try {
    const response = await api.post('/assessment', assessmentData);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Submit grade to LMS
export const submitGrade = async (assessmentId) => {
  try {
    const response = await api.post(`/assessment/${assessmentId}/submit`);
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

// Get user assessments
export const getUserAssessments = async (userId) => {
  try {
    const response = await api.get(`/assessment/user/${userId}`);
    return response.data.assessments; // Make sure to return assessments array
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

export const getAssessment = async (assessmentId) => {
  try {
    const response = await api.get(`/assessment/${assessmentId}`);
    return response.data.assessment;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};
