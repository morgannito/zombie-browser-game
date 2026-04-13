/**
 * Unit tests for lib/infrastructure/ConfigValidator.js
 * Verifies fail-fast startup validation for all game configs.
 */

describe('ConfigValidator — validateAllConfigs', () => {
  let originalEnv;
  let mockExit;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    mockExit.mockRestore();
  });

  test('succeeds with valid env in test mode', () => {
    process.env.NODE_ENV = 'test';
    const { validateAllConfigs } = require('../../../../lib/infrastructure/ConfigValidator');
    expect(() => validateAllConfigs()).not.toThrow();
  });

  test('returns validated env object', () => {
    process.env.NODE_ENV = 'test';
    const { validateAllConfigs } = require('../../../../lib/infrastructure/ConfigValidator');
    const env = validateAllConfigs();
    expect(env).toBeDefined();
    expect(env.NODE_ENV).toBe('test');
  });

  test('exits with code 1 when PORT is invalid', () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '99999';
    const { validateAllConfigs } = require('../../../../lib/infrastructure/ConfigValidator');
    expect(() => validateAllConfigs()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    delete process.env.PORT;
  });

  test('exits with code 1 when SESSION_TTL is below minimum', () => {
    process.env.NODE_ENV = 'test';
    process.env.SESSION_TTL = '5';
    const { validateAllConfigs } = require('../../../../lib/infrastructure/ConfigValidator');
    expect(() => validateAllConfigs()).toThrow('process.exit called');
    expect(mockExit).toHaveBeenCalledWith(1);
    delete process.env.SESSION_TTL;
  });

  test('ZombieConfig, WeaponConfig, ShopConfig load without errors', () => {
    const { ZOMBIE_TYPES } = require('../../../../lib/server/config/ZombieConfig');
    const { WEAPONS } = require('../../../../lib/server/config/WeaponConfig');
    const { SHOP_ITEMS } = require('../../../../lib/server/config/ShopConfig');
    expect(Object.keys(ZOMBIE_TYPES).length).toBeGreaterThan(0);
    expect(Object.keys(WEAPONS).length).toBeGreaterThan(0);
    expect(Object.keys(SHOP_ITEMS.permanent).length).toBeGreaterThan(0);
  });
});
