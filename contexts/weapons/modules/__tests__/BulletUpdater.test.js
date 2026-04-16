/**
 * Unit tests for contexts/weapons/modules/BulletUpdater.js
 * Focus: pure pos/gravity math, bounds/wall destruction, plasma trail init.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: { ROOM_WIDTH: 1000, ROOM_HEIGHT: 1000, BULLET_SIZE: 4 }
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

jest.mock('../BulletCollisionHandler', () => ({
  handleZombieBulletCollisions: jest.fn(),
  handlePlayerBulletCollisions: jest.fn()
}));

const { updateBullets, shouldDestroyBullet, updatePlasmaTrail } = require('../BulletUpdater');

const { createParticles } = require('../../../../game/lootFunctions');

describe('shouldDestroyBullet', () => {
  test('destroys after lifetime elapsed', () => {
    const bullet = { x: 0, y: 0, lifetime: 999 };
    expect(shouldDestroyBullet(bullet, 1000, null)).toBe(true);
  });

  test('keeps when lifetime not reached', () => {
    const bullet = { x: 500, y: 500, lifetime: 2000 };
    expect(shouldDestroyBullet(bullet, 1000, null)).toBe(false);
  });

  test('destroys when outside room bounds', () => {
    expect(shouldDestroyBullet({ x: -5, y: 500 }, 0, null)).toBe(true);
    expect(shouldDestroyBullet({ x: 2000, y: 500 }, 0, null)).toBe(true);
    expect(shouldDestroyBullet({ x: 500, y: -5 }, 0, null)).toBe(true);
    expect(shouldDestroyBullet({ x: 500, y: 2000 }, 0, null)).toBe(true);
  });

  test('destroys on wall collision when walls enforced', () => {
    const roomManager = { checkWallCollision: jest.fn(() => true) };
    expect(shouldDestroyBullet({ x: 500, y: 500 }, 0, roomManager)).toBe(true);
  });

  test('ignores walls when bullet.ignoresWalls is true', () => {
    const roomManager = { checkWallCollision: jest.fn(() => true) };
    expect(shouldDestroyBullet({ x: 500, y: 500, ignoresWalls: true }, 0, roomManager)).toBe(false);
    expect(roomManager.checkWallCollision).not.toHaveBeenCalled();
  });
});

describe('updatePlasmaTrail', () => {
  beforeEach(() => createParticles.mockClear());

  test('no-op when not plasma rifle', () => {
    updatePlasmaTrail({ isPlasmaRifle: false }, {});
    expect(createParticles).not.toHaveBeenCalled();
  });

  test('initializes trail anchors on first call', () => {
    const bullet = { isPlasmaRifle: true, x: 100, y: 100, color: '#0ff' };
    updatePlasmaTrail(bullet, {});
    expect(bullet._trailInitialized).toBe(true);
    expect(bullet._trailX).toBe(100);
    expect(bullet._trailY).toBe(100);
    expect(createParticles).not.toHaveBeenCalled();
  });

  test('emits particle when bullet travelled ≥ 10px since last anchor', () => {
    const bullet = {
      isPlasmaRifle: true, color: '#0ff',
      x: 200, y: 100,
      _trailX: 100, _trailY: 100,
      _trailInitialized: true
    };
    updatePlasmaTrail(bullet, {});
    expect(createParticles).toHaveBeenCalled();
    expect(bullet._trailX).toBe(200);
  });

  test('skips particle under 10px threshold', () => {
    const bullet = {
      isPlasmaRifle: true, color: '#0ff',
      x: 103, y: 100,
      _trailX: 100, _trailY: 100,
      _trailInitialized: true
    };
    updatePlasmaTrail(bullet, {});
    expect(createParticles).not.toHaveBeenCalled();
    expect(bullet._trailX).toBe(100); // anchor not moved
  });
});

describe('updateBullets integration', () => {
  test('skips null bullet entries', () => {
    const gameState = { bullets: { b1: null }, roomManager: null };
    expect(() => updateBullets(gameState, 100, {}, {}, {}, {}, {})).not.toThrow();
  });

  test('advances position for live bullet', () => {
    const bullet = {
      x: 100, y: 100, vx: 5, vy: 0,
      createdAt: 1, lastUpdateTime: 1
    };
    const gameState = { bullets: { b1: bullet }, roomManager: null };
    const entityManager = { destroyBullet: jest.fn() };
    updateBullets(gameState, 17.67, {}, {}, entityManager, {}, {});
    expect(bullet.x).toBeGreaterThan(100);
  });

  test('destroys bullet when out-of-bounds detected post-move', () => {
    const bullet = {
      x: 999, y: 500, vx: 50, vy: 0,
      createdAt: 1, lastUpdateTime: 1
    };
    const gameState = { bullets: { b1: bullet }, roomManager: null };
    const entityManager = { destroyBullet: jest.fn() };
    updateBullets(gameState, 17.67, {}, {}, entityManager, {}, {});
    expect(entityManager.destroyBullet).toHaveBeenCalledWith('b1');
  });
});
