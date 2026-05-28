import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Register Service Worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/shooter-game-js/sw.js')
      .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  });
}

// Prevent double-finger pinch-to-zoom on mobile devices
document.addEventListener('touchstart', (e) => {
  if (e.touches.length > 1) {
    e.preventDefault();
  }
}, { passive: false });

document.addEventListener('gesturestart', (e) => {
  e.preventDefault();
});

document.addEventListener('gesturechange', (e) => {
  e.preventDefault();
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
