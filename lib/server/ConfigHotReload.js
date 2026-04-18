/**
 * ConfigHotReload - Watcher .env avec validation, EventEmitter, SIGHUP
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const ENV_SCHEMA = {
  PORT:            v => !v || (Number(v) > 0 && Number(v) < 65536),
  SESSION_TTL:     v => !v || Number(v) > 0,
  LOG_LEVEL:       v => !v || ['error','warn','info','debug'].includes(v),
  PERFORMANCE_MODE:v => !v || ['high','balanced','low-memory','minimal'].includes(v),
  NODE_ENV:        v => !v || ['development','production','test'].includes(v)
};

function validate(parsed) {
  for (const [key, fn] of Object.entries(ENV_SCHEMA)) {
    if (!fn(parsed[key])) {
throw new Error(`Config invalid: ${key}=${parsed[key]}`);
}
  }
  return true;
}

function parseEnv(content) {
  return Object.fromEntries(
    content.split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => l.split('=').map((p, i) => i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))
      .filter(([k]) => k)
  );
}

class ConfigHotReload extends EventEmitter {
  constructor(envPath) {
    super();
    this.envPath = envPath || path.resolve(process.cwd(), '.env');
    this._watcher = null;
  }

  reload() {
    try {
      const content = fs.readFileSync(this.envPath, 'utf8');
      const parsed = parseEnv(content);
      validate(parsed);
      Object.assign(process.env, parsed);
      this.emit('reload', parsed);
    } catch (err) {
      this.emit('error', err);
    }
  }

  watch() {
    if (this._watcher) {
return;
}
    this._watcher = fs.watch(this.envPath, () => this.reload());
    process.on('SIGHUP', () => this.reload());
  }

  stop() {
    if (this._watcher) {
 this._watcher.close(); this._watcher = null;
}
  }
}

module.exports = new ConfigHotReload();
module.exports.ConfigHotReload = ConfigHotReload;
module.exports.validate = validate;
module.exports.parseEnv = parseEnv;
