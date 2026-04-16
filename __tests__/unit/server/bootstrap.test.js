/**
 * Unit tests for server/bootstrap.js — helper functions only.
 * createBootstrap() itself is an orchestrator covered by integration tests.
 */

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const mockContainerInstance = { initialize: jest.fn() };
jest.mock('../../../lib/application/Container', () => ({
  getInstance: jest.fn(() => mockContainerInstance)
}));

const mockProgressionIntegration = jest.fn();
jest.mock('../../../lib/server/ProgressionIntegration', () => mockProgressionIntegration);

const mockAdminCommands = jest.fn();
jest.mock('../../../game/modules/admin/AdminCommands', () => mockAdminCommands);

const mockSpawnPowerup = jest.fn();
jest.mock('../../../game/lootFunctions', () => ({ spawnPowerup: mockSpawnPowerup }));

const {
  buildContainer,
  attachProgression,
  attachAdminCommands,
  startPowerupSpawner,
  makeTickFn,
  wireSocketHandlers,
  attachErrorHandlers,
  listenAndLog
} = require('../../../server/bootstrap');
const logger = require('../../../infrastructure/logging/Logger');
const Container = require('../../../lib/application/Container');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('buildContainer', () => {
  test('returns null when db unavailable', () => {
    expect(buildContainer(false)).toBeNull();
    expect(Container.getInstance).not.toHaveBeenCalled();
  });

  test('returns initialized container when db available', () => {
    const c = buildContainer(true);
    expect(c).toBe(mockContainerInstance);
    expect(mockContainerInstance.initialize).toHaveBeenCalled();
  });
});

describe('attachProgression', () => {
  test('warns and skips when db unavailable', () => {
    const gameState = {};
    attachProgression(false, null, {}, gameState);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Progression integration disabled')
    );
    expect(gameState.progressionIntegration).toBeUndefined();
  });

  test('attaches ProgressionIntegration when db available', () => {
    const gameState = {};
    const container = {}; const io = {};
    attachProgression(true, container, io, gameState);
    expect(mockProgressionIntegration).toHaveBeenCalledWith(container, io);
    expect(gameState.progressionIntegration).toBeInstanceOf(mockProgressionIntegration);
    expect(logger.info).toHaveBeenCalledWith('Progression integration initialized');
  });
});

describe('attachAdminCommands', () => {
  test('instantiates AdminCommands on gameState', () => {
    const gameState = {};
    const io = {}; const zombieManager = {};
    attachAdminCommands(io, gameState, zombieManager);
    expect(mockAdminCommands).toHaveBeenCalledWith(io, gameState, zombieManager);
    expect(gameState.adminCommands).toBeInstanceOf(mockAdminCommands);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Admin commands initialized'));
  });
});

describe('startPowerupSpawner', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('returns a timer firing at configured interval', () => {
    const gameState = {}; const roomManager = {}; const perfIntegration = {};
    const metricsCollector = {}; const config = { POWERUP_SPAWN_INTERVAL: 1000 };
    const timer = startPowerupSpawner({
      gameState, roomManager, perfIntegration, metricsCollector, config
    });
    expect(timer).toBeDefined();
    jest.advanceTimersByTime(2500);
    expect(mockSpawnPowerup).toHaveBeenCalledTimes(2);
    expect(mockSpawnPowerup).toHaveBeenCalledWith(
      gameState, roomManager, perfIntegration, metricsCollector
    );
    clearInterval(timer);
  });

  test('logs interval on start', () => {
    const timer = startPowerupSpawner({
      gameState: {}, roomManager: {}, perfIntegration: {},
      metricsCollector: {}, config: { POWERUP_SPAWN_INTERVAL: 500 }
    });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('500ms'));
    clearInterval(timer);
  });
});

describe('makeTickFn', () => {
  test('runs gameLoop every tick', () => {
    const gameLoop = jest.fn();
    const networkManager = { emitGameState: jest.fn() };
    const perfIntegration = { shouldBroadcast: jest.fn(() => false) };
    const tick = makeTickFn({
      gameLoop, gameState: {}, io: {}, metricsCollector: {}, perfIntegration,
      collisionManager: {}, entityManager: {}, zombieManager: {}, networkManager
    });
    tick();
    expect(gameLoop).toHaveBeenCalledTimes(1);
    expect(networkManager.emitGameState).not.toHaveBeenCalled();
  });

  test('emits game state when shouldBroadcast returns true', done => {
    const networkManager = { emitGameState: jest.fn() };
    const perfIntegration = { shouldBroadcast: jest.fn(() => true) };
    const tick = makeTickFn({
      gameLoop: jest.fn(), gameState: {}, io: {}, metricsCollector: {},
      perfIntegration, collisionManager: {}, entityManager: {},
      zombieManager: {}, networkManager
    });
    tick();
    // emitGameState is deferred via setImmediate — wait one turn
    setImmediate(() => {
      expect(networkManager.emitGameState).toHaveBeenCalled();
      done();
    });
  });
});

describe('wireSocketHandlers', () => {
  test('registers middleware and connection handler', () => {
    const socketHandler = jest.fn();
    const initSocketHandlers = jest.fn(() => socketHandler);
    const io = { use: jest.fn(), on: jest.fn() };
    const jwtService = { socketMiddleware: jest.fn(() => 'mw') };
    wireSocketHandlers({
      io, jwtService, initSocketHandlers, gameState: {}, entityManager: {},
      roomManager: {}, metricsCollector: {}, perfIntegration: {},
      container: { c: 1 }, dbAvailable: true, networkManager: {}
    });
    expect(io.use).toHaveBeenCalledWith('mw');
    expect(io.on).toHaveBeenCalledWith('connection', socketHandler);
    expect(initSocketHandlers.mock.calls[0][6]).toEqual({ c: 1 });
  });

  test('passes null container when db unavailable', () => {
    const initSocketHandlers = jest.fn(() => jest.fn());
    const io = { use: jest.fn(), on: jest.fn() };
    wireSocketHandlers({
      io, jwtService: { socketMiddleware: () => 'mw' },
      initSocketHandlers, gameState: {}, entityManager: {}, roomManager: {},
      metricsCollector: {}, perfIntegration: {},
      container: { c: 1 }, dbAvailable: false, networkManager: {}
    });
    expect(initSocketHandlers.mock.calls[0][6]).toBeNull();
  });
});

describe('attachErrorHandlers', () => {
  test('mounts notFound, apiError, serverError in order', () => {
    const app = { use: jest.fn() };
    const errorHandlers = {
      notFoundHandler: 'nf', apiErrorHandler: 'api', serverErrorHandler: 'srv'
    };
    attachErrorHandlers(app, errorHandlers);
    expect(app.use.mock.calls[0][0]).toBe('nf');
    expect(app.use.mock.calls[1][0]).toBe('api');
    expect(app.use.mock.calls[2][0]).toBe('srv');
  });
});

describe('listenAndLog', () => {
  test('logs startup details', () => {
    const server = { listen: jest.fn((_port, cb) => cb()) };
    listenAndLog(server, 3000, ['http://a', 'http://b'], true);
    expect(server.listen).toHaveBeenCalledWith(3000, expect.any(Function));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('port 3000'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('http://a, http://b'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Database connected'));
  });

  test('warns when running without database', () => {
    const server = { listen: jest.fn((_port, cb) => cb()) };
    listenAndLog(server, 3000, [], false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('degraded'));
  });
});
