import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const headers = new Headers(init.headers || {});
  try {
    const raw = localStorage.getItem('hostelUser');
    const user = raw ? JSON.parse(raw) : null;
    if (user?.userId) {
      headers.set('X-User-Id', String(user.userId));
    }
    if (user?.role) {
      headers.set('X-User-Role', String(user.role));
    }
  } catch {
    // Ignore malformed local user payloads and proceed without auth headers.
  }
  return originalFetch(input, { ...init, headers });
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
