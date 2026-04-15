/**
 * Unit tests for server/gameManagers.js
 */

const mockEM = jest.fn(function() {
 this._id = 'em';
});
const mockCM = jest.fn(function() {
 this._id = 'cm';
});
const mockNM = jest.fn(function() {
 this._id = 'nm';
});
const mockRM = jest.fn(function() {
  this._id = 'rm';
  this.checkWallCollision = jest.fn(() => false);
});
const mockMut = jest.fn(function() {
  this._id = 'mut';
  this.initialize = jest.fn();
});
const mockZM = jest.fn(function() {
 this._id = 'zm';
});

jest.mock('../../../lib/server/EntityManager', () => mockEM);
jest.mock('../../../contexts/weapons/CollisionManager', () => mockCM);
jest.mock('../../../lib/server/NetworkManager', () => mockNM);
jest.mock('../../../contexts/wave/RoomManager', () => mockRM);
jest.mock('../../../lib/server/RunMutatorManager', () => mockMut);
jest.mock('../../../contexts/zombie/ZombieManager', () => mockZM);
jest.mock('../../../infrastructure/logging/Logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn()
}));

const { createGameManagers } = require('../../../server/gameManagers');

describe('createGameManagers', () => {
  beforeEach(() => {
    [mockEM, mockCM, mockNM, mockRM, mockMut, mockZM].forEach(m => m.mockClear());
  });

  test('instantiates all 6 managers', () => {
    const gameState = {};
    createGameManagers({ gameState, config: {}, zombieTypes: {}, io: {} });
    expect(mockEM).toHaveBeenCalled();
    expect(mockCM).toHaveBeenCalled();
    expect(mockNM).toHaveBeenCalled();
    expect(mockRM).toHaveBeenCalled();
    expect(mockMut).toHaveBeenCalled();
    expect(mockZM).toHaveBeenCalled();
  });

  test('wires roomManager and mutatorManager onto gameState', () => {
    const gameState = {};
    const result = createGameManagers({ gameState, config: {}, zombieTypes: {}, io: {} });
    expect(gameState.roomManager).toBe(result.roomManager);
    expect(gameState.mutatorManager).toBe(result.mutatorManager);
  });

  test('calls mutatorManager.initialize()', () => {
    const gameState = {};
    const result = createGameManagers({ gameState, config: {}, zombieTypes: {}, io: {} });
    expect(result.mutatorManager.initialize).toHaveBeenCalled();
  });

  test('returns all 6 managers in the expected shape', () => {
    const gameState = {};
    const result = createGameManagers({ gameState, config: {}, zombieTypes: {}, io: {} });
    expect(result).toEqual(expect.objectContaining({
      entityManager: expect.any(Object),
      collisionManager: expect.any(Object),
      networkManager: expect.any(Object),
      roomManager: expect.any(Object),
      mutatorManager: expect.any(Object),
      zombieManager: expect.any(Object)
    }));
  });

  test('ZombieManager receives a wall-collision callback', () => {
    const gameState = {};
    createGameManagers({ gameState, config: {}, zombieTypes: {}, io: {} });
    const zmArgs = mockZM.mock.calls[0];
    const wallCb = zmArgs[3];
    expect(typeof wallCb).toBe('function');
    expect(wallCb(10, 20, 5)).toBe(false); // delegates to roomManager mock
  });
});
