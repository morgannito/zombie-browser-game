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

function makeAlivePlayer(overrides = {}) {
  return { alive: true, x: 0, y: 0, ...overrides };
}

function makeCollisionManager() {
  return { findClosestPlayer: jest.fn(() => null) };
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
    const gameState = { zombies: { z1: null }, players: { p1: makeAlivePlayer() } };
    const handlers = makeHandlers();
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
  });

  test('assigns a deterministic stagger offset within range for any id', () => {
    const zombie = makeZombie({ id: '7' });
    const gameState = { zombies: { 7: zombie }, players: { p1: makeAlivePlayer() } };
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    expect(zombie.staggerOffset).toBeGreaterThanOrEqual(0);
    expect(zombie.staggerOffset).toBeLessThan(10);
    expect(Number.isFinite(zombie.staggerOffset)).toBe(true);
  });

  // REGRESSION (bug fix audit round 2): UUID-style ids previously collapsed
  // to NaN → fallback 0, causing ALL zombies to share offset 0 and recompute
  // pathfinding on the same tick. The id must now be hashed before modulo.
  test('REGRESSION: non-numeric ids must produce a finite offset (not NaN)', () => {
    const z1 = makeZombie({ id: 'a1b2c3d4-e5f6' });
    const z2 = makeZombie({ id: 'zzzzzzzzzzzz' });
    const gameState = { zombies: { u1: z1, u2: z2 }, players: { p1: makeAlivePlayer() } };
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    expect(Number.isFinite(z1.staggerOffset)).toBe(true);
    expect(Number.isFinite(z2.staggerOffset)).toBe(true);
    expect(z1.staggerOffset).toBeGreaterThanOrEqual(0);
    expect(z1.staggerOffset).toBeLessThan(10);
    expect(z2.staggerOffset).toBeGreaterThanOrEqual(0);
    expect(z2.staggerOffset).toBeLessThan(10);
  });

  test('REGRESSION: stagger distributes offsets across many alphanumeric ids', () => {
    const gameState = { zombies: {}, players: { p1: makeAlivePlayer() } };
    const zombies = [];
    for (let i = 0; i < 200; i++) {
      const id = `zomb-${Math.random().toString(36).slice(2, 10)}-${i}`;
      const z = makeZombie({ id });
      zombies.push(z);
      gameState.zombies[id] = z;
    }
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    const distinctBuckets = new Set(zombies.map(z => z.staggerOffset));
    // With 200 items hashed into 10 buckets, we expect broad spread (>=7 buckets used).
    expect(distinctBuckets.size).toBeGreaterThanOrEqual(7);
  });

  test('far-freeze skips all AI for non-boss zombies', () => {
    const zombie = makeZombie();
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const handlers = makeHandlers({
      isZombieFarFromAllPlayers: jest.fn(() => true)
    });
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
    expect(zombie._prevX).toBe(zombie.x); // prev reset
  });

  test('far-freeze does NOT skip bosses', () => {
    const zombie = makeZombie({ isBoss: true, type: 'bossRoi' });
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const handlers = makeHandlers({
      isZombieFarFromAllPlayers: jest.fn(() => true)
    });
    updateZombies(gameState, now, io, makeCollisionManager(), entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).toHaveBeenCalled();
  });

  test('dispatches ability handler by type', () => {
    const zombie = makeZombie({ type: 'healer' });
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const healer = jest.fn();
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers({
      abilityHandlers: { healer }
    }));
    expect(healer).toHaveBeenCalled();
  });

  test('dispatches boss handler by type', () => {
    const zombie = makeZombie({ type: 'bossOmega', isBoss: true });
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const bossOmega = jest.fn();
    updateZombies(gameState, now, io, makeCollisionManager(), entityManager, zombieManager, perfIntegration, makeHandlers({
      bossHandlers: { bossOmega }
    }));
    expect(bossOmega).toHaveBeenCalled();
  });

  test('skips move if ability handler deleted the zombie', () => {
    const zombie = makeZombie({ type: 'bossRoi', isBoss: true });
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const handlers = makeHandlers({
      bossHandlers: {
        bossRoi: (_z, id, ctx) => {
 delete ctx.gameState.zombies[id];
}
      }
    });
    updateZombies(gameState, now, io, makeCollisionManager(), entityManager, zombieManager, perfIntegration, handlers);
    expect(handlers.moveZombie).not.toHaveBeenCalled();
  });

  test('tracks stuck frames and despawns after 600+ frames stationary', () => {
    const zombie = makeZombie({ _stuckFrames: 600, _prevX: 100, _prevY: 100 });
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    const handlers = makeHandlers(); // moveZombie is a mock → zombie position unchanged
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, handlers);
    expect(gameState.zombies.z1).toBeUndefined(); // despawned (600+1 > 600)
  });

  test('resets stuck counter on significant movement', () => {
    const zombie = makeZombie({ _stuckFrames: 100, _prevX: 0, _prevY: 0 });
    // zombie.x=100, _prevX=0 → movedDist=100 >> threshold
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
    updateZombies(gameState, now, io, {}, entityManager, zombieManager, perfIntegration, makeHandlers());
    expect(zombie._stuckFrames).toBe(0);
  });

  test('pathfindingRate clamped to ≥1 (guards % 0 NaN)', () => {
    const zombie = makeZombie();
    const gameState = { zombies: { z1: zombie }, players: { p1: makeAlivePlayer() } };
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
