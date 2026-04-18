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
const { corsMiddleware } = require('../middleware/cors');
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
  // Cache strategy:
  //   ?v=<hash>  → immutable 1 year (fingerprinted assets)
  //   favicon.*  → 7 days
  //   everything else → no-store (safe default for unversioned files)
  // ETag is enabled globally so conditional GETs work on versioned assets.
  const setHeaders = (res, filePath) => {
    const url = res.req && res.req.url ? res.req.url : '';
    const isFavicon = /favicon\./i.test(path.basename(filePath));
    if (isFavicon) {
      res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    } else if (url.includes('?v=')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    }
  };

  app.use('/assets', express.static('assets', { fallthrough: false, setHeaders }));
  app.use(express.static('public', { setHeaders }));
}

/** Inject Link preload hint for socket.io.js on HTML responses. */
function addPreloadHints(req, res, next) {
  const _writeHead = res.writeHead.bind(res);
  res.writeHead = function (statusCode, headers) {
    const ct = res.getHeader('Content-Type') || '';
    if (String(ct).includes('text/html')) {
      res.setHeader('Link', '</socket.io/socket.io.js>; rel=preload; as=script');
    }
    return _writeHead(statusCode, headers);
  };
  next();
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
  app.use(corsMiddleware);
  app.use(compression());
  app.use(configureHelmet());
  app.use('/api/', configureApiLimiter());
  app.use(...configureBodyParser());
  app.use(additionalSecurityHeaders);
  app.use(addPreloadHints);
  // Inject msgpack meta tag before static files intercept GET /.
  mountMsgpackMetaRoute(app);
  mountStaticAssets(app);
}

module.exports = { configureMiddleware, mountStaticAssets };
