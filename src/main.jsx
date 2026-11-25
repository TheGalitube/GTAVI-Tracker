import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);


// Vite's development client handles file changes. This also catches a full
// server restart, including deployments served through Vite preview.
let serverInstance;
async function checkServerInstance() {
  try {
    const response = await fetch('/api/server-instance', { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const instance = await response.json();
      if (typeof instance === 'string') {
        if (serverInstance && serverInstance !== instance) {
          window.location.reload();
          return;
        }
        serverInstance = instance;
      }
    }
  } catch {
    // Keep the current page open while the server is restarting.
  }
  window.setTimeout(checkServerInstance, 3000);
}
checkServerInstance();
