/**
 * @fileoverview Request ID middleware
 * @description Assigns a unique ID to each incoming HTTP request.
 * Uses the X-Request-Id header if provided by the client/load balancer,
 * otherwise generates a new UUID v4.
 */

const crypto = require('crypto');

/**
 * Middleware that attaches a unique request ID to each request.
 * The ID is also returned in the response X-Request-Id header
 * for correlation in logs and debugging.
 */
function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestIdMiddleware };
