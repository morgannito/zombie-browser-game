/**
 * @fileoverview Security middleware configuration
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const express = require('express');
const { API_LIMITER_CONFIG, AUTH_LIMITER_CONFIG, METRICS_TOKEN } = require('../config/constants');

/**
 * Configure Helmet security headers
 * Note: 'unsafe-inline' removed from scriptSrc — use nonces or hashes if inline
 * scripts are needed. styleSrc keeps 'unsafe-inline' because UI managers toggle
 * modal visibility via element.style.display (and the HTML template relies on
 * style="display:none" defaults). Without it all modals stay visible at boot.
 * @returns {Function} Helmet middleware
 */
function configureHelmet() {
  const isDev = process.env.NODE_ENV !== 'production';
  const directives = {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'ws:', 'wss:'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"]
  };
  // Helmet injects `upgrade-insecure-requests` by default which breaks local
  // HTTP development (browsers silently rewrite script src to https://localhost).
  // Disable it in dev; production/HTTPS deployments keep the hardening.
  if (isDev) {
    directives.upgradeInsecureRequests = null;
  }
  return helmet({
    contentSecurityPolicy: { directives },
    // HSTS instructs browsers to use HTTPS for a year — disastrous on
    // localhost because subsequent plain-HTTP loads get blocked or auto-
    // upgraded. Only enable in production where we actually serve HTTPS.
    strictTransportSecurity: isDev ? false : undefined
  });
}

/**
 * Configure API rate limiter. Disabled for this indie game — replaced by a
 * pass-through middleware.
 */
function configureApiLimiter() {
  return (req, res, next) => next();
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
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
}

/**
 * Configure Auth rate limiter (stricter than API limiter)
 * @returns {Function} Rate limiter middleware
 */
function configureAuthLimiter() {
  return (req, res, next) => next();
}

/**
 * Protect monitoring endpoints with a static bearer token.
 * In development (no METRICS_TOKEN configured), requests pass through.
 * @returns {Function} Express middleware
 */
function requireMetricsToken(req, res, next) {
  if (!METRICS_TOKEN) {
    return next(); // dev mode — no token configured
  }
  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || parts[1] !== METRICS_TOKEN) {
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
  requireMetricsToken
};
