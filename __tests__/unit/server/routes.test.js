/**
 * Unit tests for server/routes.js
 * Focus: mount-path wiring, dbAvailable gate. /api/v1/* only since legacy
 * aliases were removed after client migration.
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const mockRequireMetricsToken = jest.fn((_req, _res, next) => next());
jest.mock('../../../middleware/security', () => ({
  requireMetricsToken: mockRequireMetricsToken
}));

jest.mock('../../../transport/http/auth', () => jest.fn(() => 'authRouter'));
jest.mock('../../../transport/http/health', () => jest.fn(() => 'healthRouter'));
jest.mock('../../../transport/http/metrics', () => jest.fn(() => 'metricsRouter'));
jest.mock('../../../transport/http/adminStats', () => jest.fn(() => 'adminRouter'));
jest.mock('../../../transport/http/leaderboard', () => jest.fn(() => 'leaderboardRouter'));
jest.mock('../../../transport/http/players', () => jest.fn(() => 'playersRouter'));
jest.mock('../../../transport/http/progression', () => jest.fn(() => 'progressionRouter'));
jest.mock('../../../transport/http/achievements', () => jest.fn(() => 'achievementsRouter'));
jest.mock('../../../transport/http/features', () => 'featuresRouter');

const {
  configureRoutes,
  mountAuthRoutes,
  mountDbRoutes,
  mountSystemRoutes
} = require('../../../server/routes');

function makeApp() {
  return { use: jest.fn() };
}

describe('mountAuthRoutes', () => {
  test('mounts auth router under /api/v1', () => {
    const app = makeApp();
    mountAuthRoutes(app, {}, 'jwt');
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/api/v1/auth');
    expect(paths).not.toContain('/api/auth');
  });
});

describe('mountDbRoutes', () => {
  test('mounts all 4 db-dependent routes under /api/v1', () => {
    const app = makeApp();
    mountDbRoutes(app, {}, () => {});
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/api/v1/leaderboard');
    expect(paths).toContain('/api/v1/players');
    expect(paths).toContain('/api/v1/progression');
    expect(paths).toContain('/api/v1/achievements');
    expect(paths).not.toContain('/api/leaderboard');
    expect(paths).not.toContain('/api/players');
  });
});

describe('mountSystemRoutes', () => {
  test('metrics route is behind requireMetricsToken middleware', () => {
    const app = makeApp();
    mountSystemRoutes(app, {
      metricsCollector: {}, memoryMonitor: {}, dbManager: {}, perfIntegration: {}
    });
    const metricsCall = app.use.mock.calls.find(c => c[0] === '/api/v1/metrics');
    expect(metricsCall).toBeDefined();
    expect(metricsCall[1]).toBe(mockRequireMetricsToken);
  });

  test('health route is unauthenticated', () => {
    const app = makeApp();
    mountSystemRoutes(app, {
      metricsCollector: {}, memoryMonitor: {}, dbManager: {}, perfIntegration: {}
    });
    const healthCall = app.use.mock.calls.find(c => c[0] === '/health');
    expect(healthCall).toBeDefined();
    expect(healthCall[1]).not.toBe(mockRequireMetricsToken);
  });

  test('features mounted under /api/v1 only', () => {
    const app = makeApp();
    mountSystemRoutes(app, {
      metricsCollector: {}, memoryMonitor: {}, dbManager: {}, perfIntegration: {}
    });
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/api/v1/features');
    expect(paths).not.toContain('/api/features');
  });
});

describe('configureRoutes', () => {
  test('mounts all routes when dbAvailable = true', () => {
    const app = makeApp();
    configureRoutes(app, {
      container: {}, jwtService: {}, requireAuth: () => {}, dbAvailable: true,
      metricsCollector: {}, memoryMonitor: {}, dbManager: {}, perfIntegration: {}
    });
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/api/v1/auth');
    expect(paths).toContain('/api/v1/leaderboard');
    expect(paths).toContain('/health');
  });

  test('skips db routes when dbAvailable = false', () => {
    const app = makeApp();
    configureRoutes(app, {
      container: {}, jwtService: {}, requireAuth: () => {}, dbAvailable: false,
      metricsCollector: {}, memoryMonitor: {}, dbManager: {}, perfIntegration: {}
    });
    const paths = app.use.mock.calls.map(c => c[0]);
    expect(paths).toContain('/api/v1/auth');
    expect(paths).not.toContain('/api/v1/leaderboard');
    expect(paths).toContain('/health');
  });
});
