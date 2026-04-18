/**
 * @fileoverview HTTP request context helpers
 * @description Shared helpers to enrich logs with request correlation fields.
 */

/**
 * Mask IP address for RGPD compliance: keeps prefix, zeros last octet.
 * IPv4: 1.2.3.4 → 1.2.3.x  IPv6: 2001:db8::1 → 2001:db8::x
 * @param {string|undefined} ip
 * @returns {string|null}
 */
function maskIp(ip) {
  if (!ip || typeof ip !== 'string') {
    return null;
  }
  const v4 = ip.match(/^(\d+\.\d+\.\d+)\.\d+$/);
  if (v4) {
    return `${v4[1]}.x`;
  }
  const v6 = ip.lastIndexOf(':');
  if (v6 !== -1) {
    return `${ip.slice(0, v6)}:x`;
  }
  return null;
}

function buildHttpContext(req, extra = {}) {
  const traceId = req.traceId || req.id || req.headers['x-trace-id'] || req.headers['x-request-id'] || null;
  return {
    traceId,
    requestId: traceId,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: maskIp(req.ip),
    ...extra
  };
}

module.exports = {
  buildHttpContext
};
