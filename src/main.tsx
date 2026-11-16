import React from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import { Disha2020Provider } from './context/Disha2020Provider';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ensureCleanSlateOnStartup } from './utils/cleanSlate';
import './index.css';

// Purge all legacy test subjects, test data, and mock data immediately on boot
ensureCleanSlateOnStartup();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <Disha2020Provider>
        <App />
      </Disha2020Provider>
    </AppErrorBoundary>
  </React.StrictMode>
);
