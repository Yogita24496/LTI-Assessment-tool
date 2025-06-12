// client/src/components/Assessment.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAssessment, getUserAssessments } from '../services/api';
import GradeSubmission from './GradeSubmission';

const Assessment = () => {
  const [launchData, setLaunchData] = useState(null);
  const [questions, setQuestions] = useState([
    { id: 1, text: 'What is the primary purpose of LTI 1.3?',
      options: ['User authentication', 'Content delivery', 'Secure tool integration', 'Video streaming'],
      correctAnswer: 'Secure tool integration' },
    { id: 2, text: 'Which protocol does LTI 1.3 use for authentication?',
      options: ['Basic Auth', 'OAuth 2.0', 'SAML', 'Kerberos'],
      correctAnswer: 'OAuth 2.0' },
    { id: 3, text: 'What does AGS stand for in LTI context?',
      options: ['Automated Grading System', 'Assignment and Grade Services', 'Advanced Gradebook Solution', 'Academic Grading Standard'],
      correctAnswer: 'Assignment and Grade Services' }
  ]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [assessment, setAssessment] = useState(null);
  const [completedAssessment, setCompletedAssessment] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const launchDataParam = urlParams.get('data');

    if (launchDataParam) {
      const data = JSON.parse(decodeURIComponent(launchDataParam));
      localStorage.setItem('ltiLaunchData', JSON.stringify(data));
      setLaunchData(data);
      window.history.replaceState({}, document.title, "/assessment");
      
      // Check if assessment is already completed
      checkCompletedAssessment(data.userId, data.resourceLinkId);
    } else {
      const storedLaunchData = localStorage.getItem('ltiLaunchData');
      if (!storedLaunchData) navigate('/');
      const data = JSON.parse(storedLaunchData);
      setLaunchData(data);
      
      // Check if assessment is already completed
      checkCompletedAssessment(data.userId, data.resourceLinkId);
    }
  }, [navigate]);

  const checkCompletedAssessment = async (userId, resourceLinkId) => {
    try {
      const assessments = await getUserAssessments(userId);
      const completed = assessments.find(a => 
        a.resourceLinkId === resourceLinkId && 
        a.passbackStatus === 'success'
      );
      if (completed) {
        setCompletedAssessment(completed);
      }
    } catch (error) {
      console.error('Error checking completed assessments:', error);
    }
  };


  const handleAnswerSelect = (questionId, answer) => {
    setAnswers({ ...answers, [questionId]: answer });
  };

  const handleSubmit = async () => {
    let correctCount = 0;
    questions.forEach(question => {
      if (answers[question.id] === question.correctAnswer) {
        correctCount++;
      }
    });

    const calculatedScore = (correctCount / questions.length) * 100;
    setScore(calculatedScore);

    if (launchData && launchData.lineItemUrl) {
      try {
        const assessmentData = {
          userId: launchData.userId,
          courseId: launchData.courseId,
          resourceLinkId: launchData.resourceLinkId,
          lineItemUrl: launchData.lineItemUrl,
          scoreGiven: calculatedScore,
          scoreMaximum: 100,
          activityProgress: 'Completed',
          gradingProgress: 'FullyGraded',
          feedback: `You got ${correctCount} out of ${questions.length} questions correct.`
        };

        const result = await createAssessment(assessmentData);
        setAssessment(result.assessment);
      } catch (error) {
        console.error('Error creating assessment:', error);
      }
    }

    setSubmitted(true);
  };

  if (!launchData) {
    return <div>Loading...</div>;
  }

  if (completedAssessment) {
    return (
      <div className="assessment-container">
        <h1>Assessment Already Completed</h1>
        <GradeSubmission
          score={completedAssessment.scoreGiven}
          assessment={completedAssessment}
          totalQuestions={questions.length}
          correctAnswers={Math.round((completedAssessment.scoreGiven / 100) * questions.length)}
        />
      </div>
    );
  }

  return (
    <div className="assessment-container">
      <h1>LTI Assessment</h1>
      <div className="user-info">
        <p>Welcome, {launchData.name || launchData.userId}</p>
        <p>Course: {launchData.courseId}</p>
      </div>
      {!submitted ? (
        <>
          <div className="questions">
            {questions.map(question => (
              <div key={question.id} className="question-card">
                <h3>{question.text}</h3>
                <div className="options">
                  {question.options.map(option => (
                    <label key={option} className="option-label">
                      <input
                        type="radio"
                        name={`question-${question.id}`}
                        value={option}
                        checked={answers[question.id] === option}
                        onChange={() => handleAnswerSelect(question.id, option)}
                      />
                      {option}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            className="submit-button"
            onClick={handleSubmit}
            disabled={Object.keys(answers).length !== questions.length}
          >
            Submit Assessment
          </button>
        </>
      ) : (
        <GradeSubmission
          score={score}
          assessment={assessment}
          totalQuestions={questions.length}
          correctAnswers={Object.values(answers).filter((answer, index) => answer === questions[index].correctAnswer).length}
        />
      )}
    </div>
  );
};

export default Assessment;