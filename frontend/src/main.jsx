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
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
