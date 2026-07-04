/**
 * PIN gate singleton — call pinGate.confirm() anywhere (inside or outside React)
 * to show the PIN modal. Resolves true when correct PIN entered, false on cancel.
 */
const pinGate = {
  _trigger: null,
  _resolver: null,

  /** Called once by PinModal on mount to wire up the show function. */
  register(triggerFn) {
    this._trigger = triggerFn;
  },

  /**
   * Show PIN modal and return a Promise<boolean>.
   * Falls back to true (no-op) if PinModal is not mounted yet.
   */
  confirm() {
    if (!this._trigger) return Promise.resolve(true);
    return new Promise(resolve => {
      this._resolver = resolve;
      this._trigger();
    });
  },

  /** Called by PinModal to resolve the pending promise. */
  resolve(result) {
    if (this._resolver) {
      const cb = this._resolver;
      this._resolver = null;
      cb(result);
    }
  },
};

export default pinGate;
