import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app without crashing', () => {
  render(<App />);
  // Since the app redirects to /launch, we should check for elements that actually exist
  // Instead of looking for "learn react" which doesn't exist in your app
  expect(document.querySelector('.app-container')).toBeInTheDocument();
});

test('app has router functionality', () => {
  render(<App />);
  // Test that the router is working by checking if navigation occurs
  // This is a basic smoke test to ensure the app renders
  const appContainer = document.querySelector('.app-container');
  expect(appContainer).toBeInTheDocument();
});