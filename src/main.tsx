import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Cache the static application shell and same-origin RDKit WebAssembly assets.
// Registration is best-effort: online CDN fallback remains available if SW is unsupported.
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(error => {
    console.warn('Chemistry Lab offline cache could not be registered:', error);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
