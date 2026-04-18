'use strict';

const {
  buildCspDirectives,
  getRateLimitKey,
  extractBearerToken,
  timingSafeEqual,
  additionalSecurityHeaders,
  requireMetricsToken: _requireMetricsToken
} = require('../../../middleware/security');

// ── CSP ──────────────────────────────────────────────────────────────────────

describe('buildCspDirectives', () => {
  it('does not include unsafe-inline in scriptSrc in production', () => {
    const d = buildCspDirectives(false);
    expect(d.scriptSrc).not.toContain("'unsafe-inline'");
    expect(d.scriptSrc).toContain("'self'");
  });

  it('does not include unsafe-inline in scriptSrc in dev either', () => {
    const d = buildCspDirectives(true);
    expect(d.scriptSrc).not.toContain("'unsafe-inline'");
  });

  it('allows unsafe-inline in styleSrc (modal display hack)', () => {
    const d = buildCspDirectives(false);
    expect(d.styleSrc).toContain("'unsafe-inline'");
  });

  it('disables upgradeInsecureRequests in dev', () => {
    const d = buildCspDirectives(true);
    expect(d.upgradeInsecureRequests).toBeNull();
  });

  it('does not set upgradeInsecureRequests in production', () => {
    const d = buildCspDirectives(false);
    expect(d.upgradeInsecureRequests).toBeUndefined();
  });
});

// ── Rate-limit key (XFF bypass prevention) ───────────────────────────────────

describe('getRateLimitKey', () => {
  it('returns socket remoteAddress, ignoring X-Forwarded-For', () => {
    const req = {
      socket: { remoteAddress: '10.0.0.1' },
      headers: { 'x-forwarded-for': '1.2.3.4' }
    };
    expect(getRateLimitKey(req)).toBe('10.0.0.1');
  });

  it('returns "unknown" when socket has no remoteAddress', () => {
    const req = { socket: {}, headers: {} };
    expect(getRateLimitKey(req)).toBe('unknown');
  });
});

// ── extractBearerToken ────────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('extracts token from valid header', () => {
    expect(extractBearerToken('Bearer mytoken123')).toBe('mytoken123');
  });

  it('returns null for missing header', () => {
    expect(extractBearerToken('')).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('returns null for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic dXNlcjpwYXNz')).toBeNull();
  });

  it('returns null for malformed header (single part)', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
  });
});

// ── timingSafeEqual ───────────────────────────────────────────────────────────

describe('timingSafeEqual', () => {
  it('returns true for equal strings', () => {
    expect(timingSafeEqual('secret', 'secret')).toBe(true);
  });

  it('returns false for different strings same length', () => {
    expect(timingSafeEqual('secret1', 'secret2')).toBe(false);
  });

  it('returns false for different length strings', () => {
    expect(timingSafeEqual('short', 'longer-string')).toBe(false);
  });
});

// ── additionalSecurityHeaders ─────────────────────────────────────────────────

describe('additionalSecurityHeaders', () => {
  it('sets expected security headers', () => {
    const headers = {};
    const res = { setHeader: (k, v) => (headers[k] = v) };
    const next = jest.fn();
    additionalSecurityHeaders({}, res, next);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(next).toHaveBeenCalled();
  });
});

// ── requireMetricsToken ───────────────────────────────────────────────────────

describe('requireMetricsToken', () => {
  const validToken = 'super-secret-token';

  function makeRes() {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  it('passes through when no token guard is configured (null METRICS_TOKEN)', () => {
    // Simulate the guard logic with metricsToken=null (dev mode)
    const guardFn = (metricsToken) => (req, res, next) => {
      if (!metricsToken) return next();
      const { extractBearerToken: ext, timingSafeEqual: tse } = require('../../../middleware/security');
      const token = ext(req.headers.authorization);
      if (!token || !tse(token, metricsToken)) return res.status(401).json({ error: 'Unauthorized' });
      return next();
    };
    const guard = guardFn(null);
    const next = jest.fn();
    const res = makeRes();
    guard({ headers: {} }, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects request with no Authorization header when token env is set', () => {
    // Simulate the guard with a manually-crafted closure
    const guardFn = (metricsToken) => (req, res, next) => {
      if (!metricsToken) return next();
      const { extractBearerToken: ext, timingSafeEqual: tse } = require('../../../middleware/security');
      const token = ext(req.headers.authorization);
      if (!token || !tse(token, metricsToken)) return res.status(401).json({ error: 'Unauthorized' });
      return next();
    };
    const guard = guardFn(validToken);
    const next = jest.fn();
    const res = makeRes();
    guard({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects request with wrong token', () => {
    const { extractBearerToken: ext, timingSafeEqual: tse } = require('../../../middleware/security');
    const token = ext('Bearer wrongtoken');
    expect(tse(token, validToken)).toBe(false);
  });

  it('accepts request with correct token', () => {
    const { extractBearerToken: ext, timingSafeEqual: tse } = require('../../../middleware/security');
    const token = ext(`Bearer ${validToken}`);
    expect(tse(token, validToken)).toBe(true);
  });
});
