/**
 * Unit tests for contexts/zombie/modules/updater/core.js
 * Focus: tick orchestration — stagger, far-freeze, dispatch, stuck tracking.
 */

const { updateZombies } = require('../core');

function makeZombie(overrides = {}) {
  return {
    id: 'z1', x: 100, y: 100, size: 20, speed: 5,
    type: 'normal', isBoss: false,
    ...overrides
  };
}

function makeHandlers(overrides = {}) {
  return {
    abilityHandlers: {},
    bossHandlers: {},
    moveZombie: jest.fn(),
    isZombieFarFromAllPlayers: jest.fn(() => false),
    ...overrides
  };
}

describe('updateZombies orchestrator', () => {
  const now = 1000;
  const io = {};
  const entityManager = {};
  const zombieManager = {};
  const perfIntegration = {
    tickCounter: 5,
    perfConfig: { current: { zombiePathfindingRate: 10 } }
  };

  test('skips destroyed zombies (null entry in hash)', () => {
    const gameState = { zombies: { z1: null }, players: {} };
    const handlers = makeHandlers();
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
  });

  test('assigns stagger offset once based on numeric id', () => {
    const zombie = makeZombie({ id: '7' });
    const gameState = { zombies: { 7: zombie }, players: {} };
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    expect(zombie.staggerOffset).toBe(7); // 7 % 10
  });

  test('far-freeze skips all AI for non-boss zombies', () => {
    const zombie = makeZombie();
    const gameState = { zombies: { z1: zombie }, players: {} };
    const handlers = makeHandlers({
      isZombieFarFromAllPlayers: jest.fn(() => true)
    });
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
    expect(zombie._prevX).toBe(zombie.x); // prev reset
  });

  test('far-freeze does NOT skip bosses', () => {
    const zombie = makeZombie({ isBoss: true, type: 'bossRoi' });
    const gameState = { zombies: { z1: zombie }, players: {} };
    const handlers = makeHandlers({
      isZombieFarFromAllPlayers: jest.fn(() => true)
    });
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).toHaveBeenCalled();
  });

  test('dispatches ability handler by type', () => {
    const zombie = makeZombie({ type: 'healer' });
    const gameState = { zombies: { z1: zombie }, players: {} };
    const healer = jest.fn();
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers({
      abilityHandlers: { healer }
    }));
    expect(healer).toHaveBeenCalled();
  });

  test('dispatches boss handler by type', () => {
    const zombie = makeZombie({ type: 'bossOmega', isBoss: true });
    const gameState = { zombies: { z1: zombie }, players: {} };
    const bossOmega = jest.fn();
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers({
      bossHandlers: { bossOmega }
    }));
    expect(bossOmega).toHaveBeenCalled();
  });

  test('skips move if ability handler deleted the zombie', () => {
    const zombie = makeZombie({ type: 'bossRoi', isBoss: true });
    const gameState = { zombies: { z1: zombie }, players: {} };
    const handlers = makeHandlers({
      bossHandlers: {
        bossRoi: (_z, id, ctx) => {
 delete ctx.gameState.zombies[id];
}
      }
    });
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
  });

  test('tracks stuck frames and despawns after 600+ frames stationary', () => {
    const zombie = makeZombie({ _stuckFrames: 600, _prevX: 100, _prevY: 100 });
    const gameState = { zombies: { z1: zombie }, players: {} };
    const handlers = makeHandlers(); // moveZombie is a mock → zombie position unchanged
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(gameState.zombies.z1).toBeUndefined(); // despawned (600+1 > 600)
  });

  test('resets stuck counter on significant movement', () => {
    const zombie = makeZombie({ _stuckFrames: 100, _prevX: 0, _prevY: 0 });
    // zombie.x=100, _prevX=0 → movedDist=100 >> threshold
    const gameState = { zombies: { z1: zombie }, players: {} };
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    expect(zombie._stuckFrames).toBe(0);
  });

  test('pathfindingRate clamped to ≥1 (guards % 0 NaN)', () => {
    const zombie = makeZombie();
    const gameState = { zombies: { z1: zombie }, players: {} };
    const broken = {
      tickCounter: 0,
      perfConfig: { current: { zombiePathfindingRate: 0 } }
    };
    const handlers = makeHandlers();
    expect(() => {
      updateZombies(gameState, now, io, {}, entityManager, zombieManager, broken, handlers);
    }).not.toThrow();
    expect(handlers.moveZombie).toHaveBeenCalled();
  });
});
