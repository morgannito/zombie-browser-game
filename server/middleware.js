/**
 * @fileoverview Express middleware wiring — extracted from server.js setup block.
 * @description Centralises the order-sensitive middleware chain: HTTPS redirect,
 *   request id / access log, compression, security (helmet, rate-limit, body
 *   parser, extra headers), and static asset mounts.
 */

const fs = require('fs');
const path = require('path');
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

/**
 * When ENABLE_MSGPACK=true, serve index.html with an injected
 * <meta name="msgpack" content="1"> so the client loader knows to
 * activate the binary parser before connecting to Socket.IO.
 * Must be registered BEFORE express.static to intercept GET /.
 */
function mountMsgpackMetaRoute(app) {
  if (process.env.ENABLE_MSGPACK !== 'true') return;
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  app.get(['/', '/index.html'], function (req, res) {
    fs.readFile(indexPath, 'utf8', function (err, html) {
      if (err) return res.status(500).send('Internal Server Error');
      var patched = html.replace(
        '<meta charset="UTF-8">',
        '<meta charset="UTF-8">\n    <meta name="msgpack" content="1">'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(patched);
    });
  });
}

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
  // Inject msgpack meta tag before static files intercept GET /.
  mountMsgpackMetaRoute(app);
  mountStaticAssets(app);
}

module.exports = { configureMiddleware, mountStaticAssets };
