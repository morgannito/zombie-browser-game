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
  additionalSecurityHeaders,
  generateNonce
} = require('../middleware/security');

/**
 * Serve index.html for GET / and GET /index.html, injecting:
 *   - a per-request CSP nonce into every inline <script> tag
 *   - (when ENABLE_MSGPACK=true) the msgpack meta tag and parser script
 *
 * This route must be registered BEFORE express.static so it intercepts
 * direct requests to the root before the static middleware short-circuits.
 * The nonce is stored in res.locals.cspNonce by configureHelmet, which
 * runs earlier in the chain.
 */
function mountIndexRoute(app) {
  const indexPath = path.join(__dirname, '..', 'public', 'index.html');
  const msgpackEnabled = process.env.ENABLE_MSGPACK === 'true';

  app.get(['/', '/index.html'], function (req, res) {
    fs.readFile(indexPath, 'utf8', function (err, html) {
      if (err) {
        return res.status(500).send('Internal Server Error');
      }

      const nonce = res.locals.cspNonce || '';

      // Inject nonce into every inline <script> block.
      // Matches opening tags with no src attribute (inline scripts only).
      let patched = html.replace(/<script(?![^>]*\bsrc\b)/g, `<script nonce="${nonce}"`);

      // In production, replace the individual dev script tags with the bundle.
      const isProd = process.env.NODE_ENV === 'production' && process.env.DEV_MODE !== 'true';
      if (isProd) {
        const START_MARKER = '<!-- APP_SCRIPTS_START:';
        const END_MARKER = '<!-- APP_SCRIPTS_END -->';
        const startIdx = patched.indexOf(START_MARKER);
        const endIdx = patched.indexOf(END_MARKER);
        if (startIdx !== -1 && endIdx !== -1) {
          const commentEnd = patched.indexOf('-->', startIdx) + 3;
          patched =
            patched.slice(0, commentEnd) +
            '\n    <script src="app.bundle.js"></script>\n    ' +
            patched.slice(endIdx);
        }
      }

      if (msgpackEnabled) {
        // Inject meta tag + blocking parser script.
        // The parser <script> carries a src so it is governed by script-src
        // 'self', not the nonce — no nonce attribute needed here.
        patched = patched.replace(
          '<meta charset="UTF-8">',
          '<meta charset="UTF-8">\n' +
            '    <meta name="msgpack" content="1">\n' +
            '    <script src="/lib/msgpack-parser.js"></script>\n' +
            `    <script nonce="${nonce}">window.__msgpackEnabled = true;</script>`
        );
      }

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
  // Serve index.html with nonce-injected inline scripts (+ optional msgpack meta).
  mountIndexRoute(app);
  mountStaticAssets(app);
}

module.exports = { configureMiddleware, mountStaticAssets };
