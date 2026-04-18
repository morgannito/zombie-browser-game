/**
 * @fileoverview Socket rate limit store
 * @description Isolated per-socket event rate limiter utilities.
 */

const logger = require('../infrastructure/logging/Logger');
const MetricsCollector = require('../infrastructure/metrics/MetricsCollector');
const { RATE_LIMIT_CONFIG } = require('../config/constants');

const rateLimits = new Map();

// Rate limits disabled globally except for shop/upgrade events (anti double-buy)
const RATE_LIMITS_DISABLED = true;
const SHOP_RATE_LIMITED = new Set(['buyItem', 'selectUpgrade', 'shopOpened']);

function checkRateLimit(socketId, eventName) {
  if (RATE_LIMITS_DISABLED && !SHOP_RATE_LIMITED.has(eventName)) {
return true;
}
  const config = RATE_LIMIT_CONFIG[eventName];
  if (!config) {
    return true;
  }

  const now = Date.now();

  if (!rateLimits.has(socketId)) {
    rateLimits.set(socketId, {});
  }

  const socketLimits = rateLimits.get(socketId);

  if (!socketLimits[eventName] || now >= socketLimits[eventName].resetTime) {
    socketLimits[eventName] = {
      count: 1,
      resetTime: now + config.windowMs
    };
    return true;
  }

  socketLimits[eventName].count++;

  if (socketLimits[eventName].count > config.maxRequests) {
    logger.warn('Rate limit exceeded', { socketId, event: eventName, limit: config.maxRequests });
    MetricsCollector.getInstance().recordRateLimitBlock(eventName);
    return false;
  }

  return true;
}

function cleanupRateLimits(socketId) {
  rateLimits.delete(socketId);
}

module.exports = {
  checkRateLimit,
  cleanupRateLimits
};
