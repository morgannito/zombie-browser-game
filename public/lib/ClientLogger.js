/**
 * CLIENT LOGGER
 * Conditional logging system to replace raw console.log calls.
 * Enabled via localStorage('debug_mode') or ?debug=true query param.
 * @version 1.0.0
 */

class ClientLogger {
  constructor() {
    this.enabled =
      localStorage.getItem('debug_mode') === 'true' ||
      window.location.search.includes('debug=true');
    this.level = this.enabled ? 'debug' : 'warn';
    this.levels = { debug: 0, info: 1, warn: 2, error: 3 };
  }

  _shouldLog(level) {
    return this.levels[level] >= this.levels[this.level];
  }

  debug(...args) {
    if (this._shouldLog('debug')) {
      console.log('[DEBUG]', ...args);
    }
  }

  info(...args) {
    if (this._shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args) {
    if (this._shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args) {
    console.error('[ERROR]', ...args);
  }

  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.level = level;
    }
  }

  enable() {
    this.enabled = true;
    this.level = 'debug';
  }

  disable() {
    this.enabled = false;
    this.level = 'warn';
  }
}

window.logger = new ClientLogger();
