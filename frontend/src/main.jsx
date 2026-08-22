import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// vite-plugin-pwa generates sw.js at build time, but never registers it on
// its own — without this call the service worker sits in dist/ unused and
// the PWA gets none of its offline/caching benefits.
//
// onNeedRefresh fires when a new deploy is detected while a tab is already
// open. Reload right away instead of leaving the tab on stale JS forever —
// otherwise this is exactly what causes the "Failed to load module script"
// blank-page bug (an old tab trying to fetch a JS chunk that a newer deploy
// already deleted), and previously only a manual Ctrl+Shift+R fixed it.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateSW(true);
  },
});

// Safety net for the same failure mode even without the service worker in
// play (e.g. a tab opened just before a deploy) — Vite fires this event
// when a dynamically-imported chunk (any lazy-loaded page) 404s. Reload
// once to pick up the current build; the sessionStorage guard stops a
// genuinely broken deploy from reload-looping, and clears itself soon
// after a normal load so a later, unrelated deploy can still recover too.
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
