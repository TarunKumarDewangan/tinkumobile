/**
 * PIN gate singleton — call pinGate.confirm() anywhere (inside or outside React)
 * to show the PIN modal. Resolves true when correct PIN entered, false on cancel.
 *
 * The token captured here is what makes the PIN check actually enforced —
 * previously a verified PIN in the UI wasn't checked by the action endpoint
 * itself, so anyone calling the API directly could skip it. Now the server
 * issues a short-lived, one-time token on successful verification, and
 * axios.js attaches it to the next outgoing request automatically.
 */
const pinGate = {
  _trigger: null,
  _resolver: null,
  _token: null,
  _tokenExpiresAt: 0,

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
  resolve(result, token = null) {
    if (token) {
      this._token = token;
      this._tokenExpiresAt = Date.now() + 55_000; // server TTL is 60s; leave a margin
    }
    if (this._resolver) {
      const cb = this._resolver;
      this._resolver = null;
      cb(result);
    }
  },

  /** Called by the axios interceptor — one-time use, matches server behavior. */
  consumeToken() {
    if (!this._token || Date.now() > this._tokenExpiresAt) {
      this._token = null;
      return null;
    }
    const token = this._token;
    this._token = null;
    return token;
  },
};

export default pinGate;
