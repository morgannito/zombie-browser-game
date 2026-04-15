/**
 * @fileoverview Express middleware wiring — extracted from server.js setup block.
 * @description Centralises the order-sensitive middleware chain: HTTPS redirect,
 *   request id / access log, compression, security (helmet, rate-limit, body
 *   parser, extra headers), and static asset mounts.
 */

const express = require('express');
const compression = require('compression');
const { requestIdMiddleware } = require('../middleware/requestId');
const { httpsRedirect } = require('../middleware/httpsRedirect');
const { accessLogMiddleware } = require('../middleware/accessLog');
const {
  configureHelmet,
  configureApiLimiter,
  configureBodyParser,
  additionalSecurityHeaders
} = require('../middleware/security');

function mountStaticAssets(app) {
  const isProduction = process.env.NODE_ENV === 'production';
  // Note: /shared/socketEvents.js was server-only; events moved to
  // transport/websocket/events.js. Mount removed (no remaining shared assets).
  app.use(
    '/assets',
    express.static('assets', {
      maxAge: isProduction ? '7d' : 0,
      etag: true,
      immutable: isProduction,
      fallthrough: false
    })
  );
  app.use(
    express.static('public', {
      maxAge: isProduction ? '1d' : 0,
      etag: true,
      lastModified: true
    })
  );
}

/**
 * Wire the full middleware chain onto an Express app.
 * Order is load-bearing — do not reorder without thorough testing.
 * @param {import('express').Express} app
 */
function configureMiddleware(app) {
  app.use(httpsRedirect);
  app.use(requestIdMiddleware);
  app.use(accessLogMiddleware);
  app.use(compression());
  app.use(configureHelmet());
  app.use('/api/', configureApiLimiter());
  app.use(...configureBodyParser());
  app.use(additionalSecurityHeaders);
  mountStaticAssets(app);
}

module.exports = { configureMiddleware };
