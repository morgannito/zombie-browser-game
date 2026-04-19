/**
 * @fileoverview Security middleware configuration
 * @description Configures Helmet CSP, rate limiters (with X-Forwarded-For
 * spoofing protection) and bearer-token guard for monitoring endpoints.
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const express = require('express');
const { API_LIMITER_CONFIG, AUTH_LIMITER_CONFIG, METRICS_TOKEN } = require('../config/constants');

/**
 * Generate a cryptographically random nonce for CSP script-src.
 * @returns {string} Base64-encoded 16-byte nonce
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Build Content Security Policy directives.
 * scriptSrc uses a per-request nonce — inline scripts in index.html must
 * carry a matching nonce attribute. styleSrc retains 'unsafe-inline' because
 * the UI relies on inline style="display:none" to hide modals at boot;
 * removing it causes all modals to be visible until JS runs.
 * connectSrc restricts ws: to dev only — prod only needs wss: (TLS).
 * imgSrc restricts external images to data: URIs only in prod.
 * @param {boolean} isDev - True when not in production
 * @param {string} [nonce] - Per-request nonce value (without 'nonce-' prefix)
 * @returns {Object} CSP directive map
 */
function buildCspDirectives(isDev, nonce) {
  const scriptSrc = ["'self'"];
  if (nonce) {
    scriptSrc.push(`'nonce-${nonce}'`);
  }

  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc,
    styleSrc: ["'self'", "'unsafe-inline'"],
    // In prod, no plain-text WebSocket (ws:) and no arbitrary external images.
    imgSrc: isDev ? ["'self'", 'data:', 'https:'] : ["'self'", 'data:'],
    connectSrc: isDev ? ["'self'", 'ws:', 'wss:'] : ["'self'", 'wss:'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"]
  };
  if (isDev) {
    directives.upgradeInsecureRequests = null;
  }
  return directives;
}

/**
 * Configure Helmet security headers with per-request CSP nonce.
 * The nonce is stored in res.locals.cspNonce so the index route can inject
 * it into inline <script nonce="..."> tags.
 * @returns {Function} Helmet middleware
 */
function configureHelmet() {
  const isDev = process.env.NODE_ENV !== 'production';
  return (req, res, next) => {
    const nonce = generateNonce();
    res.locals.cspNonce = nonce;
    const directives = buildCspDirectives(isDev, nonce);
    helmet({
      contentSecurityPolicy: { directives },
      // HSTS instructs browsers to use HTTPS for a year — disastrous on
      // localhost because subsequent plain-HTTP loads get blocked or auto-
      // upgraded. Only enable in production where we actually serve HTTPS.
      strictTransportSecurity: isDev ? false : undefined
    })(req, res, next);
  };
}

/**
 * Return the authoritative client IP from the raw TCP socket.
 * This prevents rate-limit bypass via a spoofed X-Forwarded-For header.
 * When behind a trusted reverse proxy, req.socket.remoteAddress is always
 * the proxy's IP — which is what we want to rate-limit per-proxy, not per
 * spoofed header. For direct connections it equals the real client IP.
 * @param {Object} req - Express request
 * @returns {string} IP address used as rate-limit key
 */
function getRateLimitKey(req) {
  return req.socket.remoteAddress || 'unknown';
}

/**
 * Configure API rate limiter (100 req / 15 min per TCP socket IP).
 * keyGenerator ignores X-Forwarded-For to prevent spoofing bypass.
 * @returns {Function} Rate limiter middleware
 */
function configureApiLimiter() {
  return rateLimit({ ...API_LIMITER_CONFIG, keyGenerator: getRateLimitKey });
}

/**
 * Configure body parser with size limits
 * @returns {Array} Array of body parser middlewares
 */
function configureBodyParser() {
  return [express.json({ limit: '10kb' }), express.urlencoded({ extended: true, limit: '10kb' })];
}

/**
 * Additional security headers middleware
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function additionalSecurityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  // Referrer-Policy: don't leak full URLs to third-parties.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Permissions-Policy: explicitly deny powerful APIs the game doesn't need.
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  // X-XSS-Protection is deprecated in modern browsers (Chrome 78+, Edge) and
  // CSP supersedes it. Do not set — modern UAs ignore it, legacy UAs have
  // known XSS filter bypasses.
  next();
}

/**
 * Configure Auth rate limiter — 20 req / 15 min per TCP socket IP.
 * Brute-force protection. Bypass via DISABLE_AUTH_RATE_LIMIT=1 in CI.
 * keyGenerator ignores X-Forwarded-For to prevent spoofing bypass.
 * @returns {Function} Rate limiter middleware
 */
function configureAuthLimiter() {
  return rateLimit({ ...AUTH_LIMITER_CONFIG, keyGenerator: getRateLimitKey });
}

/**
 * Extract bearer token from Authorization header.
 * @param {string} authHeader - Raw Authorization header value
 * @returns {string|null} Token string or null if malformed
 */
function extractBearerToken(authHeader) {
  const parts = (authHeader || '').split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  return parts[1];
}

/**
 * Compare two strings in constant time to prevent timing attacks.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Compare against itself to keep constant time, then return false
      crypto.timingSafeEqual(bufA, bufA);
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Protect monitoring endpoints with a static bearer token.
 * Uses timing-safe comparison to prevent token oracle attacks.
 * In development (no METRICS_TOKEN configured), requests pass through.
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function requireMetricsToken(req, res, next) {
  if (!METRICS_TOKEN) {
    return next(); // dev mode — no token configured
  }
  const token = extractBearerToken(req.headers.authorization);
  if (!token || !timingSafeEqual(token, METRICS_TOKEN)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

module.exports = {
  configureHelmet,
  configureApiLimiter,
  configureAuthLimiter,
  configureBodyParser,
  additionalSecurityHeaders,
  requireMetricsToken,
  // exported for unit tests
  buildCspDirectives,
  generateNonce,
  getRateLimitKey,
  extractBearerToken,
  timingSafeEqual
};
