'use strict';

const BulletPool = require('../../../lib/server/entity/BulletPool');
const ParticlePool = require('../../../lib/server/entity/ParticlePool');
const EffectPool = require('../../../lib/server/entity/EffectPool');

function makeGameState() {
  return {
    nextBulletId: 1,
    nextParticleId: 1,
    nextPoisonTrailId: 1,
    nextExplosionId: 1,
    bullets: {},
    particles: {},
    poisonTrails: {},
    explosions: {},
    players: {}
  };
}

const CONFIG = { BULLET_SIZE: 5 };

describe('BulletPool', () => {
  test('test_createBullet_registers_in_gameState', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    const bullet = pool.createBullet({ x: 1, y: 2, vx: 0, vy: 0, damage: 10 }, gs);
    expect(gs.bullets[bullet.id]).toBe(bullet);
  });

  test('test_destroyBullet_removes_from_gameState', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    const bullet = pool.createBullet({ x: 0, y: 0, vx: 0, vy: 0, damage: 5 }, gs);
    pool.destroyBullet(bullet.id, gs);
    expect(gs.bullets[bullet.id]).toBeUndefined();
  });

  test('test_destroyBullet_idempotent_double_free_safe', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    const bullet = pool.createBullet({ x: 0, y: 0, vx: 0, vy: 0, damage: 5 }, gs);
    pool.destroyBullet(bullet.id, gs);
    expect(() => pool.destroyBullet(bullet.id, gs)).not.toThrow();
  });

  test('test_reused_bullet_color_is_reset_no_stale_leak', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    const b1 = pool.createBullet({ x: 0, y: 0, vx: 0, vy: 0, damage: 5, color: '#ff0000' }, gs);
    const id1 = b1.id;
    pool.destroyBullet(id1, gs);
    // Acquire again without specifying color — should get default not stale #ff0000
    const b2 = pool.createBullet({ x: 0, y: 0, vx: 0, vy: 0, damage: 5 }, gs);
    expect(b2.color).toBe('#ffff00');
  });

  test('test_reused_bullet_spawnCompensationMs_is_reset', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    const b1 = pool.createBullet(
      { x: 0, y: 0, vx: 0, vy: 0, damage: 5, spawnCompensationMs: 999 },
      gs
    );
    pool.destroyBullet(b1.id, gs);
    const b2 = pool.createBullet({ x: 0, y: 0, vx: 0, vy: 0, damage: 5 }, gs);
    expect(b2.spawnCompensationMs).toBe(0);
  });

  test('test_destroyBullet_unknown_id_does_not_throw', () => {
    const pool = new BulletPool(CONFIG);
    const gs = makeGameState();
    expect(() => pool.destroyBullet(9999, gs)).not.toThrow();
  });
});

describe('ParticlePool', () => {
  test('test_createParticles_registers_in_gameState', () => {
    const pool = new ParticlePool();
    const gs = makeGameState();
    pool.createParticles(10, 20, '#ff0000', 3, gs);
    expect(Object.keys(gs.particles).length).toBe(3);
  });

  test('test_destroyParticle_removes_from_gameState', () => {
    const pool = new ParticlePool();
    const gs = makeGameState();
    pool.createParticles(0, 0, '#fff', 1, gs);
    const id = Object.keys(gs.particles)[0];
    pool.destroyParticle(id, gs);
    expect(gs.particles[id]).toBeUndefined();
  });

  test('test_destroyParticle_double_free_safe', () => {
    const pool = new ParticlePool();
    const gs = makeGameState();
    pool.createParticles(0, 0, '#fff', 1, gs);
    const id = Object.keys(gs.particles)[0];
    pool.destroyParticle(id, gs);
    expect(() => pool.destroyParticle(id, gs)).not.toThrow();
  });

  test('test_reused_particle_color_is_reset', () => {
    const pool = new ParticlePool();
    const gs = makeGameState();
    pool.createParticles(0, 0, '#aabbcc', 1, gs);
    const id = Object.keys(gs.particles)[0];
    pool.destroyParticle(id, gs);
    // Spawn again with different color, check no old color leaks
    pool.createParticles(0, 0, '#112233', 1, gs);
    const id2 = Object.keys(gs.particles)[0];
    expect(gs.particles[id2].color).toBe('#112233');
  });

  test('test_particleCount_stays_in_sync', () => {
    const pool = new ParticlePool();
    const gs = makeGameState();
    pool.createParticles(0, 0, '#fff', 5, gs);
    expect(pool._particleCount).toBe(5);
    const id = Object.keys(gs.particles)[0];
    pool.destroyParticle(id, gs);
    expect(pool._particleCount).toBe(4);
  });
});

describe('EffectPool', () => {
  const trailParams = { x: 0, y: 0, radius: 10, damage: 5, duration: 3000, createdAt: 0 };
  const explosionParams = { x: 0, y: 0, radius: 20, createdAt: 0, duration: 400 };

  test('test_createPoisonTrail_registers_in_gameState', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    const trail = pool.createPoisonTrail(trailParams, gs);
    expect(gs.poisonTrails[trail.id]).toBe(trail);
  });

  test('test_destroyPoisonTrail_double_free_safe', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    const trail = pool.createPoisonTrail(trailParams, gs);
    pool.destroyPoisonTrail(trail.id, gs);
    expect(() => pool.destroyPoisonTrail(trail.id, gs)).not.toThrow();
  });

  test('test_createExplosion_registers_in_gameState', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    const exp = pool.createExplosion(explosionParams, gs);
    expect(gs.explosions[exp.id]).toBe(exp);
  });

  test('test_destroyExplosion_double_free_safe', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    const exp = pool.createExplosion(explosionParams, gs);
    pool.destroyExplosion(exp.id, gs);
    expect(() => pool.destroyExplosion(exp.id, gs)).not.toThrow();
  });

  test('test_cleanupExpired_removes_expired_explosions', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    pool.createExplosion({ x: 0, y: 0, radius: 5, createdAt: 0, duration: 100 }, gs);
    pool.cleanupExpired(500, gs);
    expect(Object.keys(gs.explosions).length).toBe(0);
  });

  test('test_cleanupExpired_keeps_active_explosions', () => {
    const pool = new EffectPool();
    const gs = makeGameState();
    const now = Date.now();
    pool.createExplosion({ x: 0, y: 0, radius: 5, createdAt: now, duration: 10000 }, gs);
    pool.cleanupExpired(now + 100, gs);
    expect(Object.keys(gs.explosions).length).toBe(1);
  });
});
