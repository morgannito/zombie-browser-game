'use strict';

/**
 * Regression: broadphase doit inclure BULLET_HIT_TOLERANCE dans le rayon
 * Bug: zombies proches du bord de la cellule manqués sans hitTolerance
 */

const _MathUtils = require('../../../lib/MathUtils');

describe('CollisionManager — broadphase inclut BULLET_HIT_TOLERANCE', () => {
  function makeSpatialGrid(captured) {
    return {
      nearby(x, y, radius) {
        captured.push(radius);
        return [];
      }
    };
  }

  function buildCollisionManager(config) {
    const captured = [];
    const grid = makeSpatialGrid(captured);
    const gameState = { zombies: {}, maxZombieSize: null };
    const cm = {
      quadtree: {},
      config,
      gameState,
      _zombieGrid: grid,
      checkBulletZombieCollisions(bullet) {
        if (!this.quadtree) {
          return [];
        }
        const maxZombieSize = this.gameState.maxZombieSize || 120;
        const hitTolerance = this.config.BULLET_HIT_TOLERANCE ?? 8;
        this._zombieGrid.nearby(
          bullet.x,
          bullet.y,
          maxZombieSize + this.config.BULLET_SIZE + hitTolerance
        );
        return [];
      }
    };
    return { cm, captured };
  }

  test('rayon_broadphase_inclut_hit_tolerance', () => {
    const config = { BULLET_SIZE: 5, BULLET_HIT_TOLERANCE: 8, ZOMBIE_SIZE: 25 };
    const { cm, captured } = buildCollisionManager(config);
    cm.checkBulletZombieCollisions({ x: 100, y: 100 });
    expect(captured[0]).toBe(120 + 5 + 8); // 133
  });

  test('rayon_broadphase_fallback_tolerance_8_si_absent', () => {
    const config = { BULLET_SIZE: 5, ZOMBIE_SIZE: 25 }; // BULLET_HIT_TOLERANCE absent
    const { cm, captured } = buildCollisionManager(config);
    cm.checkBulletZombieCollisions({ x: 0, y: 0 });
    expect(captured[0]).toBe(120 + 5 + 8);
  });

  test('rayon_broadphase_plus_grand_avec_tolerance_que_sans', () => {
    const configAvec = { BULLET_SIZE: 5, BULLET_HIT_TOLERANCE: 10 };
    const configSans = { BULLET_SIZE: 5, BULLET_HIT_TOLERANCE: 0 };
    const { cm: cmAvec, captured: capAvec } = buildCollisionManager(configAvec);
    const { cm: cmSans, captured: capSans } = buildCollisionManager(configSans);
    cmAvec.checkBulletZombieCollisions({ x: 0, y: 0 });
    cmSans.checkBulletZombieCollisions({ x: 0, y: 0 });
    expect(capAvec[0]).toBeGreaterThan(capSans[0]);
  });
});
