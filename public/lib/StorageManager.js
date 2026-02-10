/**
 * STORAGE MANAGER - Abstraction localStorage avec fallback memoire
 * @version 1.0.0
 *
 * Fournit une API unifiee pour le stockage cote client.
 * - Serialisation/deserialisation JSON automatique
 * - Fallback en memoire si localStorage indisponible ou quota depasse
 * - Prefix configurable pour isolation des cles (vide par defaut pour retro-compat)
 */

class StorageManager {
  constructor(prefix = '') {
    this.prefix = prefix;
    this.available = this._checkAvailability();
    this.memoryFallback = new Map();
  }

  _checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  get(key, defaultValue = null) {
    try {
      const prefixedKey = this.prefix + key;
      if (!this.available) {
        const memVal = this.memoryFallback.get(prefixedKey);
        if (memVal === undefined) {
          return defaultValue;
        }
        return JSON.parse(memVal);
      }
      const value = localStorage.getItem(prefixedKey);
      if (value === null) {
        return defaultValue;
      }
      return JSON.parse(value);
    } catch {
      return defaultValue;
    }
  }

  set(key, value) {
    try {
      const prefixedKey = this.prefix + key;
      const serialized = JSON.stringify(value);
      if (!this.available) {
        this.memoryFallback.set(prefixedKey, serialized);
        return true;
      }
      localStorage.setItem(prefixedKey, serialized);
      return true;
    } catch {
      this.memoryFallback.set(this.prefix + key, JSON.stringify(value));
      console.warn('[StorageManager] localStorage quota exceeded, using memory fallback');
      return false;
    }
  }

  remove(key) {
    const prefixedKey = this.prefix + key;
    this.memoryFallback.delete(prefixedKey);
    if (this.available) {
      try {
        localStorage.removeItem(prefixedKey);
      } catch {
        // silently ignore
      }
    }
  }

  getStats() {
    if (!this.available) {
      return { used: 0, keys: this.memoryFallback.size };
    }
    let used = 0;
    let keys = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(this.prefix)) {
        used += localStorage.getItem(key).length;
        keys++;
      }
    }
    return { used, keys };
  }
}

window.storageManager = new StorageManager('');
