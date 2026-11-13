import React from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import { QuizProProvider } from './context/QuizProProvider';
import { ensureCleanSlateOnStartup } from './utils/cleanSlate';
import './index.css';

// Purge all legacy test subjects, test data, and mock data immediately on boot
ensureCleanSlateOnStartup();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QuizProProvider>
      <App />
    </QuizProProvider>
  </React.StrictMode>
);
