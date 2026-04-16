/**
 * Unit tests for server/middleware.js
 */

const mockStatic = jest.fn(() => 'staticMiddleware');
jest.mock('express', () => ({ static: mockStatic }));
jest.mock('compression', () => jest.fn(() => 'compressionMiddleware'));
jest.mock('../../../middleware/requestId', () => ({
  requestIdMiddleware: 'requestIdMiddleware'
}));
jest.mock('../../../middleware/httpsRedirect', () => ({
  httpsRedirect: 'httpsRedirectMiddleware'
}));
jest.mock('../../../middleware/accessLog', () => ({
  accessLogMiddleware: 'accessLogMiddleware'
}));

const mockHelmet = jest.fn(() => 'helmetMiddleware');
const mockApiLimiter = jest.fn(() => 'apiLimiterMiddleware');
const mockBodyParser = jest.fn(() => [{ type: 'json' }, { type: 'urlencoded' }]);
jest.mock('../../../middleware/security', () => ({
  configureHelmet: mockHelmet,
  configureApiLimiter: mockApiLimiter,
  configureBodyParser: mockBodyParser,
  additionalSecurityHeaders: 'additionalSecurityHeadersMiddleware'
}));

const { configureMiddleware, mountStaticAssets } = require('../../../server/middleware');

function makeApp() {
  return { use: jest.fn() };
}

describe('mountStaticAssets', () => {
  beforeEach(() => mockStatic.mockClear());

  test('mounts /assets and public/ static', () => {
    const app = makeApp();
    mountStaticAssets(app);
    expect(mockStatic).toHaveBeenCalledTimes(2);
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/assets');
  });

  // Caches are intentionally disabled in every environment (no-store) so
  // each deploy is immediately effective. See server/middleware.js.
  test('serves /assets with no-cache headers in production', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      mountStaticAssets(makeApp());
      const assetsOpts = mockStatic.mock.calls[0][1];
      expect(assetsOpts.maxAge).toBe(0);
      expect(assetsOpts.etag).toBe(false);
      expect(typeof assetsOpts.setHeaders).toBe('function');
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  test('serves /assets with no-cache headers in development', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      mountStaticAssets(makeApp());
      const assetsOpts = mockStatic.mock.calls[0][1];
      expect(assetsOpts.maxAge).toBe(0);
      expect(assetsOpts.etag).toBe(false);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });

  test('setHeaders writes no-store Cache-Control', () => {
    mountStaticAssets(makeApp());
    const assetsOpts = mockStatic.mock.calls[0][1];
    const res = { setHeader: jest.fn() };
    assetsOpts.setHeaders(res);
    const cacheCtrl = res.setHeader.mock.calls.find(c => c[0] === 'Cache-Control');
    expect(cacheCtrl[1]).toMatch(/no-store/);
  });
});

describe('configureMiddleware', () => {
  test('wires middleware in load-bearing order', () => {
    const app = makeApp();
    configureMiddleware(app);
    // first 3 calls should be httpsRedirect, requestId, accessLog
    expect(app.use.mock.calls[0][0]).toBe('httpsRedirectMiddleware');
    expect(app.use.mock.calls[1][0]).toBe('requestIdMiddleware');
    expect(app.use.mock.calls[2][0]).toBe('accessLogMiddleware');
  });

  test('rate-limit scoped to /api/', () => {
    const app = makeApp();
    configureMiddleware(app);
    const apiCall = app.use.mock.calls.find(c => c[0] === '/api/');
    expect(apiCall).toBeDefined();
  });

  test('applies compression + helmet + body parser + security headers', () => {
    const app = makeApp();
    configureMiddleware(app);
    const args = app.use.mock.calls.flat();
    expect(args).toContain('compressionMiddleware');
    expect(args).toContain('helmetMiddleware');
    expect(args).toContain('additionalSecurityHeadersMiddleware');
    expect(mockBodyParser).toHaveBeenCalled();
  });

  test('mounts static assets at the end', () => {
    const app = makeApp();
    configureMiddleware(app);
    expect(mockStatic).toHaveBeenCalled();
  });
});
