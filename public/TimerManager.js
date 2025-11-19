/**
 * TIMER MANAGER
 * Gestion centralisée des setTimeout/setInterval pour prévenir les memory leaks
 * @version 1.0.0
 */

class TimerManager {
  constructor() {
    this.timers = new Map();
    this.intervals = new Map();
    this.timerCounter = 0;
    this.intervalCounter = 0;
  }

  /**
   * Crée un setTimeout géré
   * @param {Function} callback - La fonction à exécuter
   * @param {number} delay - Le délai en millisecondes
   * @param {...any} args - Arguments à passer au callback
   * @returns {number} L'ID du timer pour annulation ultérieure
   */
  setTimeout(callback, delay, ...args) {
    if (typeof callback !== 'function') {
      console.warn('[TimerManager] Invalid callback for setTimeout');
      return null;
    }

    const id = ++this.timerCounter;

    const wrappedCallback = () => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[TimerManager] Error in setTimeout callback:', error);
      } finally {
        // Auto-cleanup après exécution
        this.timers.delete(id);
      }
    };

    const nativeId = window.setTimeout(wrappedCallback, delay);

    this.timers.set(id, {
      nativeId,
      callback,
      delay,
      createdAt: Date.now(),
      type: 'timeout'
    });

    return id;
  }

  /**
   * Crée un setInterval géré
   * @param {Function} callback - La fonction à exécuter
   * @param {number} interval - L'intervalle en millisecondes
   * @param {...any} args - Arguments à passer au callback
   * @returns {number} L'ID de l'interval pour annulation ultérieure
   */
  setInterval(callback, interval, ...args) {
    if (typeof callback !== 'function') {
      console.warn('[TimerManager] Invalid callback for setInterval');
      return null;
    }

    const id = ++this.intervalCounter;

    const wrappedCallback = () => {
      try {
        callback(...args);
      } catch (error) {
        console.error('[TimerManager] Error in setInterval callback:', error);
      }
    };

    const nativeId = window.setInterval(wrappedCallback, interval);

    this.intervals.set(id, {
      nativeId,
      callback,
      interval,
      createdAt: Date.now(),
      type: 'interval',
      executionCount: 0
    });

    return id;
  }

  /**
   * Annule un setTimeout
   * @param {number} id - L'ID du timer
   * @returns {boolean} True si annulé avec succès
   */
  clearTimeout(id) {
    const timer = this.timers.get(id);
    if (!timer) {
      return false;
    }

    try {
      window.clearTimeout(timer.nativeId);
      this.timers.delete(id);
      return true;
    } catch (error) {
      console.error('[TimerManager] Error clearing timeout:', error);
      return false;
    }
  }

  /**
   * Annule un setInterval
   * @param {number} id - L'ID de l'interval
   * @returns {boolean} True si annulé avec succès
   */
  clearInterval(id) {
    const interval = this.intervals.get(id);
    if (!interval) {
      return false;
    }

    try {
      window.clearInterval(interval.nativeId);
      this.intervals.delete(id);
      return true;
    } catch (error) {
      console.error('[TimerManager] Error clearing interval:', error);
      return false;
    }
  }

  /**
   * Annule tous les timeouts
   * @returns {number} Nombre de timers annulés
   */
  clearAllTimeouts() {
    const count = this.timers.size;
    for (const [id] of this.timers.entries()) {
      this.clearTimeout(id);
    }
    return count;
  }

  /**
   * Annule tous les intervals
   * @returns {number} Nombre d'intervals annulés
   */
  clearAllIntervals() {
    const count = this.intervals.size;
    for (const [id] of this.intervals.entries()) {
      this.clearInterval(id);
    }
    return count;
  }

  /**
   * Annule tous les timers (timeouts + intervals)
   * @returns {Object} Nombre de timers et intervals annulés
   */
  clearAll() {
    return {
      timeouts: this.clearAllTimeouts(),
      intervals: this.clearAllIntervals()
    };
  }

  /**
   * Récupère le nombre de timers actifs
   * @returns {Object}
   */
  getActiveCount() {
    return {
      timeouts: this.timers.size,
      intervals: this.intervals.size,
      total: this.timers.size + this.intervals.size
    };
  }

  /**
   * Récupère les statistiques des timers
   * @returns {Object}
   */
  getStats() {
    const stats = {
      timeouts: {
        count: this.timers.size,
        oldest: null,
        newest: null,
        byDelay: {}
      },
      intervals: {
        count: this.intervals.size,
        oldest: null,
        newest: null,
        byInterval: {}
      }
    };

    // Stats timeouts
    let oldestTimeout = Infinity;
    let newestTimeout = 0;
    for (const timer of this.timers.values()) {
      stats.timeouts.byDelay[timer.delay] = (stats.timeouts.byDelay[timer.delay] || 0) + 1;
      if (timer.createdAt < oldestTimeout) {
        oldestTimeout = timer.createdAt;
        stats.timeouts.oldest = timer.createdAt;
      }
      if (timer.createdAt > newestTimeout) {
        newestTimeout = timer.createdAt;
        stats.timeouts.newest = timer.createdAt;
      }
    }

    // Stats intervals
    let oldestInterval = Infinity;
    let newestInterval = 0;
    for (const interval of this.intervals.values()) {
      stats.intervals.byInterval[interval.interval] = (stats.intervals.byInterval[interval.interval] || 0) + 1;
      if (interval.createdAt < oldestInterval) {
        oldestInterval = interval.createdAt;
        stats.intervals.oldest = interval.createdAt;
      }
      if (interval.createdAt > newestInterval) {
        newestInterval = interval.createdAt;
        stats.intervals.newest = interval.createdAt;
      }
    }

    return stats;
  }

  /**
   * Log les statistiques dans la console
   */
  logStats() {
    const stats = this.getStats();
    const counts = this.getActiveCount();

    console.group('[TimerManager] Statistics');
    console.log('Active timeouts:', counts.timeouts);
    console.log('Active intervals:', counts.intervals);
    console.log('Total active timers:', counts.total);

    if (stats.timeouts.count > 0) {
      console.log('Timeouts by delay:', stats.timeouts.byDelay);
      if (stats.timeouts.oldest) {
        console.log('Oldest timeout age:', Math.round((Date.now() - stats.timeouts.oldest) / 1000) + 's');
      }
    }

    if (stats.intervals.count > 0) {
      console.log('Intervals by period:', stats.intervals.byInterval);
      if (stats.intervals.oldest) {
        console.log('Oldest interval age:', Math.round((Date.now() - stats.intervals.oldest) / 1000) + 's');
      }
    }

    console.groupEnd();
  }

  /**
   * Détecte les timers qui pourraient être des leaks
   * @param {number} maxAge - Âge maximum en millisecondes (défaut: 2 minutes pour intervals)
   * @returns {Object} Liste des timers suspects
   */
  detectLeaks(maxAge = 2 * 60 * 1000) {
    const now = Date.now();
    const suspects = {
      intervals: [],
      longRunningTimeouts: []
    };

    // Les intervals qui tournent depuis longtemps sont suspects
    for (const [id, interval] of this.intervals.entries()) {
      const age = now - interval.createdAt;
      if (age > maxAge) {
        suspects.intervals.push({
          id,
          age: Math.round(age / 1000) + 's',
          interval: interval.interval + 'ms',
          executionCount: interval.executionCount
        });
      }
    }

    // Les timeouts avec des délais très longs (>1min) sont suspects
    for (const [id, timer] of this.timers.values()) {
      if (timer.delay > 60000) {
        suspects.longRunningTimeouts.push({
          id,
          delay: timer.delay + 'ms',
          age: Math.round((now - timer.createdAt) / 1000) + 's'
        });
      }
    }

    if (suspects.intervals.length > 0 || suspects.longRunningTimeouts.length > 0) {
      console.warn('[TimerManager] Potential leaks detected:', suspects);
    }

    return suspects;
  }

  /**
   * Crée un interval avec auto-stop après N exécutions
   * @param {Function} callback - La fonction à exécuter
   * @param {number} interval - L'intervalle en millisecondes
   * @param {number} maxExecutions - Nombre max d'exécutions
   * @param {...any} args - Arguments
   * @returns {number} L'ID de l'interval
   */
  setIntervalWithLimit(callback, interval, maxExecutions, ...args) {
    let executionCount = 0;

    const wrappedCallback = () => {
      executionCount++;
      callback(...args);

      if (executionCount >= maxExecutions) {
        this.clearInterval(id);
      }
    };

    const id = this.setInterval(wrappedCallback, interval);
    return id;
  }
}

// Singleton global
if (!window.timerManager) {
  window.timerManager = new TimerManager();
}

// Helper functions pour backward compatibility
window.setManagedTimeout = (callback, delay, ...args) => {
  return window.timerManager.setTimeout(callback, delay, ...args);
};

window.setManagedInterval = (callback, interval, ...args) => {
  return window.timerManager.setInterval(callback, interval, ...args);
};

window.clearManagedTimeout = (id) => {
  return window.timerManager.clearTimeout(id);
};

window.clearManagedInterval = (id) => {
  return window.timerManager.clearInterval(id);
};
