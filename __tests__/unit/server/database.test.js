/**
 * Unit tests for server/database.js
 */

const mockInstance = {
  initialize: jest.fn()
};

jest.mock('../../../infrastructure/database/DatabaseManager', () => ({
  getInstance: jest.fn(() => mockInstance)
}));

jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()
}));

const { dbManager, initializeDatabase } = require('../../../server/database');
const logger = require('../../../infrastructure/logging/Logger');

describe('dbManager', () => {
  test('is the DatabaseManager singleton', () => {
    expect(dbManager).toBe(mockInstance);
  });
});

describe('initializeDatabase', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.REQUIRE_DATABASE;
    mockInstance.initialize.mockReset();
    logger.info.mockClear();
    logger.warn.mockClear();
    logger.error.mockClear();
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.REQUIRE_DATABASE;
    } else {
      process.env.REQUIRE_DATABASE = originalEnv;
    }
  });

  test('returns true on successful init', async () => {
    mockInstance.initialize.mockReturnValue(undefined);
    const result = await initializeDatabase();
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('✅ Database connected successfully');
  });

  test('returns true when initialize() returns a resolving promise', async () => {
    mockInstance.initialize.mockReturnValue(Promise.resolve('ready'));
    const result = await initializeDatabase();
    expect(result).toBe(true);
  });

  test('returns false on init failure when REQUIRE_DATABASE unset', async () => {
    delete process.env.REQUIRE_DATABASE;
    mockInstance.initialize.mockImplementation(() => {
      throw new Error('db boom');
    });
    const result = await initializeDatabase();
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      '⚠️  Running without database - progression features disabled'
    );
  });

  test('hard-exits when REQUIRE_DATABASE=true and init fails', async () => {
    process.env.REQUIRE_DATABASE = 'true';
    mockInstance.initialize.mockImplementation(() => {
      throw new Error('fatal');
    });
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
    await initializeDatabase();
    expect(exitSpy).toHaveBeenCalledWith(1);
    exitSpy.mockRestore();
  });

  test('propagates rejected promise as caught error', async () => {
    mockInstance.initialize.mockReturnValue(Promise.reject(new Error('async boom')));
    const result = await initializeDatabase();
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      '❌ CRITICAL: Database initialization failed',
      expect.objectContaining({ error: 'async boom' })
    );
  });
});
