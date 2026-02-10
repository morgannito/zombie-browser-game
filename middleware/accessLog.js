/**
 * @fileoverview HTTP access log middleware
 * @description Logs request/response metadata with request-id correlation.
 */

const logger = require('../lib/infrastructure/Logger');
const { buildHttpContext } = require('./httpContext');

const SKIPPED_PATH_PREFIXES = ['/health', '/api/metrics', '/api/v1/metrics'];

function shouldSkipRequest(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }
  return SKIPPED_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}?`));
}

function accessLogMiddleware(req, res, next) {
  const startNs = process.hrtime.bigint();

  res.on('finish', () => {
    // Skip noisy operational endpoints by default.
    const requestPath = req.originalUrl || req.url || req.path || '';
    if (shouldSkipRequest(requestPath)) {
      return;
    }

    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;
    const responseBytes = Number(res.getHeader('content-length')) || null;
    logger.info(
      'HTTP request',
      buildHttpContext(req, {
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        responseBytes,
        userAgent: req.get('user-agent') || 'unknown'
      })
    );
  });

  next();
}

module.exports = {
  accessLogMiddleware,
  shouldSkipRequest
};
