// client/src/components/GradeSubmission.jsx
import React, { useState, useEffect } from 'react';
import { submitGrade, getAssessment } from '../services/api';


const GradeSubmission = ({ score, assessment, totalQuestions, correctAnswers }) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(assessment.passbackStatus || 'pending');
  const [isGradeSaved, setIsGradeSaved] = useState(assessment.passbackStatus === 'success');

  useEffect(() => {
    if (assessment.passbackStatus === 'success') {
      setIsGradeSaved(true);
    }

    const interval = setInterval(async () => {
      if (status === 'pending' && !isGradeSaved) {
        try {
          const updatedAssessment = await getAssessment(assessment._id);
          setStatus(updatedAssessment.passbackStatus);
          if (updatedAssessment.passbackStatus === 'success') {
            setIsGradeSaved(true);
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Error fetching assessment status:', err);
        }
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [status, assessment._id, isGradeSaved]);

  const handleSubmitGrade = async () => {
    if (!assessment || isGradeSaved) return;

    setSubmitting(true);

    try {
      await submitGrade(assessment._id);
      setSubmitted(true);
      setIsGradeSaved(true);
      setStatus('success');
    } catch (err) {
      setError(err.message || 'Failed to submit grade to LMS');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => {
    window.location.href = 'http://localhost/moodle';
  };

  return (
    <div className="grade-submission">
      <h2>Assessment Complete</h2>

      <div className="score-display">
        <div className="score-circle">
          <span className="score-value">{Math.round(score)}%</span>
        </div>
        <p>You got {correctAnswers} out of {totalQuestions} questions correct</p>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {!isGradeSaved ? (
        <button
          className="submit-grade-button"
          onClick={handleSubmitGrade}
          disabled={submitting || isGradeSaved}
        >
          {submitting ? 'Submitting...' : 'Send Grade to Gradebook'}
        </button>
      ) : (
        <div className="success-message">
          <p>✓ Grade successfully submitted to your LMS gradebook!</p>
          <button
            className="back-button"
            onClick={handleBack}
          >
            Back to LMS
          </button>
        </div>
      )}

      <div className="lti-info">
        <h3>LTI Grade Passback Information</h3>
        <p>Assessment ID: {assessment?._id}</p>
        <p>User ID: {assessment?.userId}</p>
        <p>Score: {Number(assessment?.scoreGiven)?.toFixed(2)} / {Number(assessment?.scoreMaximum)?.toFixed(2)}</p>
        <p>Status: {status}</p>
      </div>
    </div>
  );
};

export default GradeSubmission;
