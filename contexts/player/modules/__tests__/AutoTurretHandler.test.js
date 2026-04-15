/**
 * Unit tests for contexts/player/modules/AutoTurretHandler.js
 * Focus: cooldown gates, no-op guards, target selection, bullet creation side-effects.
 */

jest.mock('../../../../lib/server/ConfigManager', () => ({
  CONFIG: {
    BULLET_DAMAGE: 34,
    BULLET_SPEED: 10
  },
  GAMEPLAY_CONSTANTS: {
    AUTO_TURRET_BASE_COOLDOWN: 600,
    AUTO_TURRET_RANGE: 500
  }
}));

jest.mock('../../../../lib/MathUtils', () => ({
  fastCos: jest.fn((angle) => Math.cos(angle)),
  fastSin: jest.fn((angle) => Math.sin(angle))
}));

jest.mock('../../../../game/lootFunctions', () => ({
  createParticles: jest.fn()
}));

const { updateAutoTurrets, fireAutoTurret } = require('../AutoTurretHandler');
const { createParticles } = require('../../../../game/lootFunctions');
const MathUtils = require('../../../../lib/MathUtils');

function makeEntityManager() {
  return { createBullet: jest.fn() };
}

function makeCollisionManager(closestZombie = null) {
  return { findClosestZombie: jest.fn(() => closestZombie) };
}

function makePlayer(overrides = {}) {
  return {
    x: 100,
    y: 200,
    autoTurrets: 1,
    hasNickname: true,
    spawnProtection: false,
    lastAutoShot: 0,
    damageMultiplier: 1,
    ...overrides
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// updateAutoTurrets — guard clauses
// ---------------------------------------------------------------------------

describe('updateAutoTurrets — no-op guards', () => {
  test('returns early when player.autoTurrets is 0', () => {
    const player = makePlayer({ autoTurrets: 0 });
    const collision = makeCollisionManager({ x: 50, y: 50 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(collision.findClosestZombie).not.toHaveBeenCalled();
    expect(em.createBullet).not.toHaveBeenCalled();
  });

  test('returns early when player.autoTurrets is undefined', () => {
    const player = makePlayer({ autoTurrets: undefined });
    const collision = makeCollisionManager({ x: 50, y: 50 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });

  test('returns early when player lacks hasNickname', () => {
    const player = makePlayer({ hasNickname: false });
    const collision = makeCollisionManager({ x: 50, y: 50 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });

  test('returns early when player has spawnProtection active', () => {
    const player = makePlayer({ spawnProtection: true });
    const collision = makeCollisionManager({ x: 50, y: 50 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateAutoTurrets — cooldown gate
// ---------------------------------------------------------------------------

describe('updateAutoTurrets — cooldown gate', () => {
  test('does not fire when cooldown has not elapsed', () => {
    // BASE_COOLDOWN=600, 1 turret → cooldown=600ms; now-lastAutoShot=500 < 600
    const player = makePlayer({ lastAutoShot: 1000 });
    const collision = makeCollisionManager({ x: 50, y: 50 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 1500, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });

  test('fires when cooldown has exactly elapsed', () => {
    // lastAutoShot=0, now=600 → difference equals cooldown
    const player = makePlayer({ lastAutoShot: 0 });
    const collision = makeCollisionManager({ x: 150, y: 200 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 600, collision, em, {});

    expect(em.createBullet).toHaveBeenCalledTimes(1);
  });

  test('cooldown is halved with 2 turrets', () => {
    // BASE_COOLDOWN=600, 2 turrets → cooldown=300; now-lastAutoShot=350 > 300
    const player = makePlayer({ autoTurrets: 2, lastAutoShot: 0 });
    const collision = makeCollisionManager({ x: 150, y: 200 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 350, collision, em, {});

    expect(em.createBullet).toHaveBeenCalledTimes(1);
  });

  test('still blocked within halved cooldown window', () => {
    // 2 turrets → cooldown=300; 200ms elapsed is still under threshold
    const player = makePlayer({ autoTurrets: 2, lastAutoShot: 0 });
    const collision = makeCollisionManager({ x: 150, y: 200 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 200, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateAutoTurrets — target selection
// ---------------------------------------------------------------------------

describe('updateAutoTurrets — target selection', () => {
  test('passes player position and turret range to findClosestZombie', () => {
    const player = makePlayer({ x: 300, y: 400, lastAutoShot: 0 });
    const collision = makeCollisionManager(null);
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(collision.findClosestZombie).toHaveBeenCalledWith(300, 400, 500);
  });

  test('does not fire when no zombie in range', () => {
    const player = makePlayer({ lastAutoShot: 0 });
    const collision = makeCollisionManager(null);
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(em.createBullet).not.toHaveBeenCalled();
  });

  test('fires when zombie is found in range', () => {
    const player = makePlayer({ lastAutoShot: 0 });
    const collision = makeCollisionManager({ x: 200, y: 200 });
    const em = makeEntityManager();

    updateAutoTurrets(player, 'p1', 9999, collision, em, {});

    expect(em.createBullet).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// fireAutoTurret — bullet creation side-effects
// ---------------------------------------------------------------------------

describe('fireAutoTurret — bullet properties', () => {
  test('creates bullet with isAutoTurret flag set to true', () => {
    const player = makePlayer();
    const em = makeEntityManager();
    const zombie = { x: 200, y: 200 };

    fireAutoTurret(player, 'p1', zombie, 5000, em, {});

    expect(em.createBullet).toHaveBeenCalledWith(
      expect.objectContaining({ isAutoTurret: true })
    );
  });

  test('creates bullet with correct playerId', () => {
    const player = makePlayer();
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    expect(em.createBullet).toHaveBeenCalledWith(
      expect.objectContaining({ playerId: 'p1' })
    );
  });

  test('creates bullet with turret color #00ffaa', () => {
    const player = makePlayer();
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    expect(em.createBullet).toHaveBeenCalledWith(
      expect.objectContaining({ color: '#00ffaa' })
    );
  });

  test('damage applies 0.6 base multiplier and player damageMultiplier', () => {
    // BULLET_DAMAGE=34, base=34*0.6=20.4, player.damageMultiplier=2 → 40.8
    const player = makePlayer({ damageMultiplier: 2 });
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    const bullet = em.createBullet.mock.calls[0][0];
    expect(bullet.damage).toBeCloseTo(40.8);
  });

  test('damage applies mutatorEffects.playerDamageMultiplier when present', () => {
    // 34 * 0.6 * 1 * 3 = 61.2
    const player = makePlayer();
    const em = makeEntityManager();
    const gameState = { mutatorEffects: { playerDamageMultiplier: 3 } };

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, gameState);

    const bullet = em.createBullet.mock.calls[0][0];
    expect(bullet.damage).toBeCloseTo(61.2);
  });

  test('defaults mutator multiplier to 1 when gameState has no mutatorEffects', () => {
    // 34 * 0.6 * 1 * 1 = 20.4
    const player = makePlayer();
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    const bullet = em.createBullet.mock.calls[0][0];
    expect(bullet.damage).toBeCloseTo(20.4);
  });

  test('updates player.lastAutoShot to now', () => {
    const player = makePlayer({ lastAutoShot: 0 });
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 7777, em, {});

    expect(player.lastAutoShot).toBe(7777);
  });

  test('calls createParticles at player position with turret color', () => {
    const player = makePlayer({ x: 50, y: 75 });
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    expect(createParticles).toHaveBeenCalledWith(50, 75, '#00ffaa', 3, em);
  });

  test('bullet uses player coordinates as origin', () => {
    const player = makePlayer({ x: 77, y: 88 });
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    expect(em.createBullet).toHaveBeenCalledWith(
      expect.objectContaining({ x: 77, y: 88 })
    );
  });

  test('bullet velocity derived from angle toward zombie using MathUtils', () => {
    const player = makePlayer({ x: 0, y: 0 });
    const em = makeEntityManager();
    const zombie = { x: 10, y: 0 }; // directly right → angle=0

    fireAutoTurret(player, 'p1', zombie, 5000, em, {});

    expect(MathUtils.fastCos).toHaveBeenCalledWith(0);
    expect(MathUtils.fastSin).toHaveBeenCalledWith(0);
  });

  test('bullet has non-explosive defaults', () => {
    const player = makePlayer();
    const em = makeEntityManager();

    fireAutoTurret(player, 'p1', { x: 200, y: 200 }, 5000, em, {});

    expect(em.createBullet).toHaveBeenCalledWith(
      expect.objectContaining({
        piercing: 0,
        explosiveRounds: false,
        explosionRadius: 0,
        explosionDamagePercent: 0
      })
    );
  });
});
