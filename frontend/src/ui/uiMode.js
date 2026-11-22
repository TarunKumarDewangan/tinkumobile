// Old / new design switch. Only changes LOOK (a data attribute on <html> that
// new-ui.css keys off) — every page, form and calculation is the same code.
const KEY = 'tinku_ui';
const EVENT = 'ui-mode-change';

export function getUiMode() {
  try {
    return localStorage.getItem(KEY) === 'new' ? 'new' : 'old';
  } catch {
    return 'old';
  }
}

export function applyUiMode(mode = getUiMode()) {
  document.documentElement.dataset.ui = mode;
}

export function setUiMode(mode) {
  try { localStorage.setItem(KEY, mode); } catch { /* private mode: still apply for this tab */ }
  applyUiMode(mode);
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeUiMode(cb) {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

// ── Account sync: the choice also follows the user to other devices ──
// The account's saved choice (from /me or login) wins over this device's.
export function applyAccountUiMode(accountMode) {
  if ((accountMode === 'old' || accountMode === 'new') && accountMode !== getUiMode()) {
    setUiMode(accountMode);
  }
}

// Save a new choice to the account (fire-and-forget; the look already changed).
export async function saveUiModeToAccount(mode, api) {
  try {
    const raw = localStorage.getItem('tinku_user');
    if (raw) {
      const u = JSON.parse(raw);
      localStorage.setItem('tinku_user', JSON.stringify({ ...u, ui_design: mode }));
    }
  } catch { /* cache only */ }
  try { await api.put('/me/ui-design', { ui_design: mode }); } catch { /* offline: next toggle retries */ }
}
