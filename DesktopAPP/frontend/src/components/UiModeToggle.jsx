import { useSyncExternalStore } from 'react';
import api from '../api/axios';
import { getUiMode, setUiMode, subscribeUiMode, saveUiModeToAccount } from '../ui/uiMode';

/** Topbar switch between the old and the new look (saved on the account). Look only — no behaviour changes. */
export default function UiModeToggle() {
  const mode = useSyncExternalStore(subscribeUiMode, getUiMode, () => 'old');
  const isNew = mode === 'new';

  return (
    <button
      type="button"
      onClick={() => { const next = isNew ? 'old' : 'new'; setUiMode(next); saveUiModeToAccount(next, api); }}
      title={isNew ? 'Switch back to the old design' : 'Try the new design'}
      aria-pressed={isNew}
      className="ui-mode-toggle tw:inline-flex tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:px-2.5 tw:py-1 tw:text-xs tw:font-semibold tw:whitespace-nowrap tw:cursor-pointer"
    >
      <span
        aria-hidden="true"
        className="ui-mode-toggle-track tw:relative tw:inline-block tw:h-3.5 tw:w-6 tw:rounded-full tw:transition-colors"
      >
        <span
          className="tw:absolute tw:top-0.5 tw:h-2.5 tw:w-2.5 tw:rounded-full tw:bg-white tw:transition-all"
          style={{ left: isNew ? 12 : 2 }}
        />
      </span>
      <span className="tw:hidden tw:sm:inline">New design</span>
      <span className="tw:sm:hidden">New</span>
    </button>
  );
}
