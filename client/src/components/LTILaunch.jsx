// client/src/components/LTILaunch.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ltiLaunch } from '../services/api';

const LTILaunch = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleLtiLaunch = async () => {
      try {
        // Get the JWT from the URL params
        const urlParams = new URLSearchParams(window.location.search);
        const idToken = urlParams.get('id_token');
        
        if (!idToken) {
          throw new Error('Missing ID token. This page should be launched via LTI.');
        }
        
        // Validate the token with our backend
        const response = await ltiLaunch(idToken);
        
        // Store the launch data in localStorage
        localStorage.setItem('ltiLaunchData', JSON.stringify(response.launchData));
        
        // Redirect to the assessment
        navigate('/assessment');
      } catch (err) {
        console.error('LTI Launch Error:', err);
        setError(err.message || 'Failed to validate LTI launch');
      } finally {
        setLoading(false);
      }
    };
    
    handleLtiLaunch();
  }, [navigate]);

  if (loading) {
    return (
      <div className="lti-launch-container">
        <h2>Initializing Assessment Tool...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="lti-launch-container error">
        <h2>Launch Error</h2>
        <p>{error}</p>
        <p>This application must be launched from your LMS via LTI 1.3.</p>
      </div>
    );
  }

  return (
    <div className="lti-launch-container">
      <h2>Redirecting to Assessment...</h2>
    </div>
  );
};

export default LTILaunch;