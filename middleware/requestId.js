/**
 * @fileoverview Request ID middleware
 * @description Assigns a unique trace_id to each incoming HTTP request.
 * Uses the X-Request-Id / X-Trace-Id header if provided by the client/load balancer,
 * otherwise generates a new UUID v4.
 */

const crypto = require('crypto');

/**
 * Generate or inherit a trace ID from standard tracing headers.
 * Priority: X-Trace-Id > X-Request-Id > generated UUID.
 * @param {Object} headers - Request headers
 * @returns {string}
 */
function resolveTraceId(headers) {
  return headers['x-trace-id'] || headers['x-request-id'] || crypto.randomUUID();
}

/**
 * Middleware that attaches a unique trace_id to each request.
 * The ID is returned in both X-Request-Id and X-Trace-Id response headers.
 */
function requestIdMiddleware(req, res, next) {
  const traceId = resolveTraceId(req.headers);
  req.id = traceId;
  req.traceId = traceId;
  res.locals.requestId = traceId;
  res.locals.traceId = traceId;
  res.setHeader('X-Request-Id', traceId);
  res.setHeader('X-Trace-Id', traceId);
  next();
}

module.exports = { requestIdMiddleware, resolveTraceId };
