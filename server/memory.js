/**
 * @fileoverview MemoryMonitor factory — extracted from server.js setup block.
 * @description Creates and starts the memory monitor with graceful-restart hook.
 */

const MemoryMonitor = require('../lib/infrastructure/MemoryMonitor');
const logger = require('../infrastructure/logging/Logger');

/**
 * Create and start the memory monitor.
 * @returns {MemoryMonitor} the started monitor instance
 */
function createMemoryMonitor() {
  const memoryMonitor = new MemoryMonitor({
    interval: 60000,
    warningThresholdMB: 256,
    criticalThresholdMB: 512,
    onCritical: sample => {
      logger.error('Memory critical — scheduling graceful restart', { rss: sample.rss });
      // Allow in-flight requests to drain before exiting (PM2/systemd will restart)
      setTimeout(() => process.exit(1), 5000);
    }
  });
  memoryMonitor.start();
  return memoryMonitor;
}

module.exports = { createMemoryMonitor };
