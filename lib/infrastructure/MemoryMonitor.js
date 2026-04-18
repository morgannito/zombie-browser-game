/**
 * @fileoverview Memory monitoring for production health checks
 * @description Tracks heap/RSS usage, detects memory leaks via trend analysis,
 * and triggers forced GC when critical thresholds are exceeded.
 *
 * Architecture: Infrastructure layer - no domain dependencies.
 * Immutable configuration after construction.
 */

'use strict';

const logger = require('../../infrastructure/logging/Logger');

class MemoryMonitor {
  /**
   * @param {Object} options - Monitor configuration
   * @param {number} [options.interval=60000] - Sampling interval in ms
   * @param {number} [options.warningThresholdMB=256] - RSS warning threshold
   * @param {number} [options.criticalThresholdMB=512] - RSS critical threshold
   * @param {number} [options.maxHistory=60] - Max samples retained
   * @param {Function} [options.onCritical] - Called with (sample) when critical threshold exceeded
   */
  constructor(options = {}) {
    this.interval = options.interval || 60000;
    this.warningThresholdMB = options.warningThresholdMB || 256;
    this.criticalThresholdMB =
      options.criticalThresholdMB !== undefined && options.criticalThresholdMB !== null
        ? options.criticalThresholdMB
        : 512;
    this.maxHistory = options.maxHistory || 60;
    this.onCritical = typeof options.onCritical === 'function' ? options.onCritical : null;
    this.timer = null;
    this.history = [];
  }

  /**
   * Start periodic memory sampling
   */
  start() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => this.check(), this.interval);
    this.check();
  }

  /**
   * Stop periodic sampling and release timer
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Take a single memory sample, evaluate thresholds, force GC if critical
   * @returns {Object} Memory sample with heapUsed, heapTotal, rss, external (all in MB)
   */
  check() {
    const usage = process.memoryUsage();
    const heapMB = Math.round(usage.heapUsed / 1024 / 1024);
    const rssMB = Math.round(usage.rss / 1024 / 1024);

    const sample = {
      timestamp: Date.now(),
      heapUsed: heapMB,
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      rss: rssMB,
      external: Math.round(usage.external / 1024 / 1024)
    };

    this.history.push(sample);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (rssMB > this.criticalThresholdMB) {
      logger.error(
        `[MemoryMonitor] CRITICAL: RSS ${rssMB}MB exceeds ${this.criticalThresholdMB}MB`
      );
      if (global.gc) {
        global.gc();
        logger.warn('[MemoryMonitor] Forced garbage collection');
      }
      if (this.onCritical) {
        try {
          this.onCritical(sample);
        } catch (err) {
          logger.error('[MemoryMonitor] onCritical callback threw', err);
        }
      }
    } else if (rssMB > this.warningThresholdMB) {
      logger.warn(`[MemoryMonitor] WARNING: RSS ${rssMB}MB exceeds ${this.warningThresholdMB}MB`);
    }

    return sample;
  }

  /**
   * Compute aggregated stats from sample history
   * @returns {Object|null} Stats object or null if no samples
   */
  getStats() {
    if (this.history.length === 0) {
      return null;
    }

    const latest = this.history[this.history.length - 1];
    const heaps = this.history.map(h => h.heapUsed);

    return {
      current: latest,
      avg: Math.round(heaps.reduce((a, b) => a + b, 0) / heaps.length),
      peak: Math.max(...heaps),
      trend: this.history.length > 1 ? heaps[heaps.length - 1] - heaps[0] : 0,
      samples: this.history.length
    };
  }
}

module.exports = MemoryMonitor;
