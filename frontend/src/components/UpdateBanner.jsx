import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Shown when a new version has been deployed while this tab was open.
 * The update is never forced mid-work: it applies when the user taps
 * "Refresh", or automatically on their next page change (the current
 * page's form is being left anyway at that point).
 */
export default function UpdateBanner() {
  const [ready, setReady] = useState(() => typeof window !== 'undefined' && !!window.__applyAppUpdate);
  const location = useLocation();
  const firstPath = useRef(location.pathname);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener('app-update-ready', onReady);
    return () => window.removeEventListener('app-update-ready', onReady);
  }, []);

  // Apply on the next page change after the update arrived.
  useEffect(() => {
    if (!ready) { firstPath.current = location.pathname; return; }
    if (location.pathname !== firstPath.current) window.__applyAppUpdate?.();
  }, [location.pathname, ready]);

  if (!ready) return null;

  return (
    <div role="status" className="app-update-banner">
      <span>New version available. It will load when you open another page.</span>
      <button type="button" onClick={() => window.__applyAppUpdate?.()}>Refresh now</button>
      <style>{`
        .app-update-banner {
          position: fixed; left: 50%; transform: translateX(-50%);
          bottom: calc(16px + env(safe-area-inset-bottom, 0px)); z-index: 2000;
          display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: center;
          max-width: calc(100vw - 24px); padding: 10px 14px; border-radius: 10px;
          background: #1f2937; color: #fff; font-size: 13px; box-shadow: 0 6px 24px rgba(0,0,0,.2);
        }
        .app-update-banner button {
          border: 0; border-radius: 6px; padding: 6px 12px; font-weight: 600;
          background: #fff; color: #1f2937; cursor: pointer;
        }
        @media (max-width: 768px) { .app-update-banner { bottom: calc(76px + env(safe-area-inset-bottom, 0px)); } }
      `}</style>
    </div>
  );
}
