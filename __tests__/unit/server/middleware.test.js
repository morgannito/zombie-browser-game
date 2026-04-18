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
jest.mock('../../../middleware/cors', () => ({
  corsMiddleware: 'corsMiddleware'
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
  return { use: jest.fn(), get: jest.fn() };
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

  // Static assets use smart cache strategy (immutable for versioned, no-store otherwise).
  test('serves /assets with setHeaders function', () => {
    mountStaticAssets(makeApp());
    const assetsOpts = mockStatic.mock.calls[0][1];
    expect(typeof assetsOpts.setHeaders).toBe('function');
  });

  test('setHeaders writes immutable Cache-Control for versioned assets', () => {
    mountStaticAssets(makeApp());
    const assetsOpts = mockStatic.mock.calls[0][1];
    const res = { req: { url: '/assets/game.js?v=abc123' }, setHeader: jest.fn() };
    assetsOpts.setHeaders(res, '/public/game.js');
    const cacheCtrl = res.setHeader.mock.calls.find(c => c[0] === 'Cache-Control');
    expect(cacheCtrl[1]).toMatch(/immutable/);
  });

  test('setHeaders writes no-store Cache-Control for unversioned assets', () => {
    mountStaticAssets(makeApp());
    const assetsOpts = mockStatic.mock.calls[0][1];
    const res = { req: { url: '/assets/game.js' }, setHeader: jest.fn() };
    assetsOpts.setHeaders(res, '/public/game.js');
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
