import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './portal-v2.css';
import './ns-luxe-visual-overrides.css';
import './os/os.css';
import './os/cream-os.css';
import './live-owner-polish.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').then(reg => reg.update()).catch(console.error));
}
