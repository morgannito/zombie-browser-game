/**
 * @fileoverview HTTPS redirect middleware
 * @description Redirects HTTP requests to HTTPS when running behind a proxy
 * (Nginx, Cloudflare, load balancer) that sets X-Forwarded-Proto.
 * Only active in production to avoid blocking local development.
 */

/**
 * Middleware that redirects plain HTTP to HTTPS.
 * Trust the X-Forwarded-Proto header set by the proxy.
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function httpsRedirect(req, res, next) {
  if (process.env.NODE_ENV !== 'production') {
    return next();
  }
  const proto = req.headers['x-forwarded-proto'];
  if (proto && proto.split(',')[0].trim() !== 'https') {
    const host = req.headers.host || '';
    return res.redirect(301, `https://${host}${req.originalUrl}`);
  }
  return next();
}

module.exports = { httpsRedirect };
