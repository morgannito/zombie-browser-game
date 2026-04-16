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
  if (process.env.ENABLE_MSGPACK !== 'true') {
    return;
  }
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  app.get(['/', '/index.html'], function (req, res) {
    fs.readFile(indexPath, 'utf8', function (err, html) {
      if (err) {
        return res.status(500).send('Internal Server Error');
      }
      // Inject BOTH the meta tag AND a blocking <script> reference to the
      // parser. The meta tag is what GameEngine reads; the script tag ensures
      // window.msgpackParser is set BEFORE any subsequent inline script runs
      // (previously the dynamic injection raced the bundle loader and io()
      // was called without the parser, while the server decoded every packet
      // as msgpack → garbage → instant "transport close").
      const patched = html.replace(
        '<meta charset="UTF-8">',
        '<meta charset="UTF-8">\n' +
          '    <meta name="msgpack" content="1">\n' +
          '    <script src="/lib/msgpack-parser.js"></script>\n' +
          '    <script>window.__msgpackEnabled = true;</script>'
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(patched);
    });
  });
}

function mountStaticAssets(app) {
  // Note: /shared/socketEvents.js was server-only; events moved to
  // transport/websocket/events.js. Mount removed (no remaining shared assets).
  // CACHES DESACTIVES : tous les assets sont servis avec no-store pour garantir
  // que chaque deploy soit immédiatement effectif (no stale JS/CSS/HTML).
  const noCache = (res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  };
  app.use(
    '/assets',
    express.static('assets', {
      maxAge: 0,
      etag: false,
      lastModified: false,
      fallthrough: false,
      setHeaders: noCache
    })
  );
  app.use(
    express.static('public', {
      maxAge: 0,
      etag: false,
      lastModified: false,
      setHeaders: noCache
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
