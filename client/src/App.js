// client/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LTILaunch from './components/LTILaunch';
import Assessment from './components/Assessment';
import './App.css';

const App = () => {
  return (
    <Router>
      <div className="app-container">
        <Routes>
          <Route path="/launch" element={<LTILaunch />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/" element={<Navigate to="/launch" />} />
           <Route path="/assessment/:id" element={<Assessment />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;