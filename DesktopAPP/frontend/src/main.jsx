import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'

// Safety net for a stale lazy-loaded route chunk (an old build's JS file no
// longer present after a newer build replaced it) — Vite fires this event
// when a dynamic import 404s. Reload once to pick up the current build; the
// sessionStorage guard stops a genuinely broken build from reload-looping.
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem('reloaded-after-chunk-error')) {
    sessionStorage.setItem('reloaded-after-chunk-error', '1');
    window.location.reload();
  }
});
setTimeout(() => sessionStorage.removeItem('reloaded-after-chunk-error'), 10000);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
