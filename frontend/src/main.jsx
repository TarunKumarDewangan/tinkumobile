import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'react-toastify/dist/ReactToastify.css'
import './index.css'
import './styles/tailwind.css'
import './styles/new-ui.css'
import { applyUiMode } from './ui/uiMode'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// vite-plugin-pwa generates sw.js at build time, but never registers it on
// its own — without this call the service worker sits in dist/ unused.
//
// A new deploy must NOT reload an open tab by itself: a staff member could be
// half-way through a bill and lose the form. So the new version waits
// (registerType: 'prompt'); the old tab keeps running on its own cached files,
// and <UpdateBanner> applies the update when the user taps "Refresh" or moves
// to another page (see components/UpdateBanner.jsx).
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.__applyAppUpdate = () => updateSW(true);
    window.dispatchEvent(new Event('app-update-ready'));
  },
  onRegisteredSW(_url, registration) {
    // Tabs stay open all day in the shop — look for a new deploy every 30 min.
    if (registration) setInterval(() => registration.update().catch(() => {}), 30 * 60 * 1000);
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

// Set old/new look before the first paint (no flash of the other design).
applyUiMode();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
