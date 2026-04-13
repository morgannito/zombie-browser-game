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
 * scripts are needed. styleSrc keeps 'unsafe-inline' as canvas games rely on it.
 * @returns {Function} Helmet middleware
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"]
      }
    }
  });
}

/**
 * Configure API rate limiter
 * @returns {Function} Rate limiter middleware
 */
function configureApiLimiter() {
  return rateLimit(API_LIMITER_CONFIG);
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
  return rateLimit(AUTH_LIMITER_CONFIG);
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
