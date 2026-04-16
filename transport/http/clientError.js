/**
 * @fileoverview Client error ingestion endpoint.
 * @description Receives structured error reports emitted by
 *   /public/modules/utils/ErrorTracker.js — window.onerror,
 *   unhandledrejection, longtask roll-ups. Payloads are logged through
 *   the same Winston logger as server-side errors so they surface in
 *   whichever aggregator is wired up (stdout / file / external).
 *
 *   Hard limits:
 *   - 2 KB body cap (defensive — stack traces already sliced client-side)
 *   - stricter per-IP rate limit than the generic /api limiter, since
 *     a misbehaving client loop could otherwise flood the sink.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../../infrastructure/logging/Logger');

const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many error reports' }
});

const ALLOWED_KINDS = new Set(['error', 'unhandledrejection', 'longtask-rollup']);

function sanitize(str, maxLen) {
  if (typeof str !== 'string') {
    return undefined;
  }
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function initClientErrorRoute() {
  const router = express.Router();

  router.post('/', express.json({ limit: '2kb' }), clientErrorLimiter, (req, res) => {
    const body = req.body || {};
    const kind = ALLOWED_KINDS.has(body.kind) ? body.kind : 'unknown';
    const record = {
      kind,
      message: sanitize(body.message, 300),
      source: sanitize(body.source, 200),
      line: Number.isFinite(body.line) ? body.line : undefined,
      col: Number.isFinite(body.col) ? body.col : undefined,
      stack: sanitize(body.stack, 2000),
      url: sanitize(body.url, 300),
      ua: sanitize(body.ua, 200),
      // Remote IP is useful for correlating waves of the same bug in one
      // client, but note middleware/accessLog already handles GDPR redaction.
      ip: req.ip
    };
    logger.warn('client-error', record);
    res.status(204).end();
  });

  return router;
}

module.exports = initClientErrorRoute;
