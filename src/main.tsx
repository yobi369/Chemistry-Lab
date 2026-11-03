import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Cache the static application shell and same-origin RDKit WebAssembly assets.
// Registration is best-effort: online CDN fallback remains available if SW is unsupported.
const isSecureServiceWorkerOrigin = window.location.protocol === 'https:' ||
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
if ('serviceWorker' in navigator && isSecureServiceWorkerOrigin) {
  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
    console.warn('Chemistry Lab offline cache could not be registered:', error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
