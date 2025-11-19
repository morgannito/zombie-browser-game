/**
 * @fileoverview Security middleware configuration
 * @description Provides security middleware including:
 * - Helmet.js for security headers
 * - Rate limiting for API endpoints
 * - Body parser with size limits
 * - Additional security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const express = require('express');
const { API_LIMITER_CONFIG } = require('../config/constants');

/**
 * Configure Helmet security headers
 * @returns {Function} Helmet middleware
 */
function configureHelmet() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"]
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
  return [
    express.json({ limit: '10kb' }),
    express.urlencoded({ extended: true, limit: '10kb' })
  ];
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

module.exports = {
  configureHelmet,
  configureApiLimiter,
  configureBodyParser,
  additionalSecurityHeaders
};
