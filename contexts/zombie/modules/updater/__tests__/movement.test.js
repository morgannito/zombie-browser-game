/**
 * Unit tests for contexts/zombie/modules/updater/movement.js
 * Focus: dispatcher wiring — deltaTime, target pick, eval vs cached path.
 */

jest.mock('../separation', () => ({
  applyZombieSeparation: jest.fn()
}));

const { moveZombie } = require('../movement');

function makeDeps(overrides = {}) {
  return {
    getNearestPlayer: jest.fn(() => ({ player: null })),
    resolveLockedTarget: jest.fn(() => null),
    moveTowardsPlayer: jest.fn(),
    moveRandomly: jest.fn(),
    ...overrides
  };
}

function makeCollisionManager() {
  return {
    findClosestPlayerCached: jest.fn(() => null)
  };
}

describe('moveZombie dispatcher', () => {
  const gameState = { roomManager: null, zombies: {} };

  test('computes deltaTime capped at 3x frame budget', () => {
    const zombie = { x: 0, y: 0, size: 10, speed: 5, lastMoveUpdate: 1 };
    const cm = makeCollisionManager();
    const deps = makeDeps();
    // 10s gap → uncapped deltaTime would be ~600; should cap at 3
    moveZombie(zombie, 'z1', cm, gameState, 10001, 0, 10, {}, deps);
    expect(zombie.lastMoveUpdate).toBe(10001);
    const [, , , deltaTime] = deps.moveRandomly.mock.calls[0];
    expect(deltaTime).toBe(3);
  });

  test('eval tick resolves target via getNearestPlayer', () => {
    const zombie = { x: 0, y: 0, size: 10, speed: 5, staggerOffset: 0 };
    const player = { id: 'p1', x: 50, y: 0 };
    const deps = makeDeps({
      getNearestPlayer: jest.fn(() => ({ player }))
    });
    moveZombie(zombie, 'z1', makeCollisionManager(), gameState, 100, 0, 10, {}, deps);
    expect(deps.getNearestPlayer).toHaveBeenCalled();
    expect(zombie._lockedTargetId).toBe('p1');
    expect(deps.moveTowardsPlayer).toHaveBeenCalled();
  });

  test('eval tick with no player clears lock', () => {
    const zombie = { x: 0, y: 0, size: 10, speed: 5, staggerOffset: 0, _lockedTargetId: 'old' };
    const deps = makeDeps();
    moveZombie(zombie, 'z1', makeCollisionManager(), gameState, 100, 0, 10, {}, deps);
    expect(zombie._lockedTargetId).toBeNull();
    expect(deps.moveRandomly).toHaveBeenCalled();
  });

  test('non-eval tick uses locked target first', () => {
    const zombie = { x: 0, y: 0, size: 10, speed: 5, staggerOffset: 0 };
    const player = { id: 'p1', x: 50, y: 0 };
    const deps = makeDeps({
      resolveLockedTarget: jest.fn(() => player)
    });
    // tick=3, rate=10 → (3+0)%10 !== 0 → non-eval
    moveZombie(zombie, 'z1', makeCollisionManager(), gameState, 100, 3, 10, {}, deps);
    expect(deps.resolveLockedTarget).toHaveBeenCalled();
    expect(deps.getNearestPlayer).not.toHaveBeenCalled();
  });

  test('non-eval tick falls back to collision cache when lock expired', () => {
    const zombie = { x: 0, y: 0, size: 10, speed: 5, staggerOffset: 0 };
    const cached = { id: 'p2', x: 100, y: 0 };
    const cm = makeCollisionManager();
    cm.findClosestPlayerCached = jest.fn(() => cached);
    const deps = makeDeps({
      resolveLockedTarget: jest.fn(() => null)
    });
    moveZombie(zombie, 'z1', cm, gameState, 100, 3, 10, {}, deps);
    expect(cm.findClosestPlayerCached).toHaveBeenCalled();
    expect(zombie._lockedTargetId).toBe('p2');
    expect(deps.moveTowardsPlayer).toHaveBeenCalled();
  });

  test('separation is always applied before movement', () => {
    const { applyZombieSeparation } = require('../separation');
    const zombie = { x: 0, y: 0, size: 10, speed: 5 };
    moveZombie(zombie, 'z1', makeCollisionManager(), gameState, 100, 0, 10, {}, makeDeps());
    expect(applyZombieSeparation).toHaveBeenCalled();
  });
});
