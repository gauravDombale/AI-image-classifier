/* ──────────────────────────────────────────
   src/main.jsx
   React entry point + Sentry initialization
   ────────────────────────────────────────── */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.jsx';

// Initialize Sentry only if DSN is configured
const sentryDSN = import.meta.env.VITE_SENTRY_DSN;
if (sentryDSN && sentryDSN !== 'https://xxx@xxx.ingest.sentry.io/xxx') {
  Sentry.init({
    dsn: sentryDSN,
    environment: import.meta.env.MODE,
    // Capture 20% of traces to stay within free tier
    tracesSampleRate: 0.2,
    // Ignore noisy browser extension errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
    beforeSend(event) {
      // Don't send events in development
      if (import.meta.env.DEV) return null;
      return event;
    },
  });
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#080a0f',
          color: '#eef2f7',
          fontFamily: 'DM Sans, sans-serif',
          gap: '16px',
          padding: '24px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '32px' }}>⚠</div>
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Something went wrong</h1>
          <p style={{ color: '#6b7a99', fontSize: '14px', maxWidth: '400px' }}>
            {error?.message ?? 'An unexpected error occurred. Please refresh the page.'}
          </p>
          <button
            onClick={resetError}
            style={{
              marginTop: '8px',
              padding: '10px 24px',
              background: 'rgba(0,229,255,0.1)',
              border: '1px solid #00e5ff',
              borderRadius: '999px',
              color: '#00e5ff',
              cursor: 'pointer',
              fontSize: '14px',
              fontFamily: 'inherit',
            }}
          >
            Try Again
          </button>
        </div>
      )}
    >
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
