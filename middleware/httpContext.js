/**
 * @fileoverview HTTP request context helpers
 * @description Shared helpers to enrich logs with request correlation fields.
 */

function buildHttpContext(req, extra = {}) {
  return {
    requestId: req.id || req.headers['x-request-id'] || null,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: req.ip,
    ...extra
  };
}

module.exports = {
  buildHttpContext
};
