import React from "react";
import ReactDOM from "react-dom/client";
import App from './App';
import { Disha2020Provider } from './context/Disha2020Provider';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { ensureCleanSlateOnStartup } from './utils/cleanSlate';
import './index.css';

// Deep cache purge and URL cleanup when booting in recovery mode (?recovery=1 / ?repaired=1)
if (typeof window !== "undefined") {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has("recovery") || urlParams.has("repaired") || urlParams.has("_v")) {
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).catch(() => {});
      }
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => Promise.all(regs.map((r) => r.unregister()))).catch(() => {});
      }
      urlParams.delete("recovery");
      urlParams.delete("repaired");
      urlParams.delete("_v");
      urlParams.delete("_t");
      const cleanQs = urlParams.toString();
      const cleanUrl = window.location.pathname + (cleanQs ? `?${cleanQs}` : "") + window.location.hash;
      window.history.replaceState({}, "", cleanUrl);
    }
  } catch (_) {}
}

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
