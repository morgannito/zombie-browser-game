'use strict';
const CollisionManager = require('../contexts/weapons/CollisionManager');
const { SpatialGrid: _SpatialGrid } = require('../contexts/zombie/SpatialGrid');

const SIZES = [100, 500, 1000];
const ITERS = 500;
const CONFIG = { BULLET_HIT_TOLERANCE: 8, BULLET_SIZE: 6, ZOMBIE_SIZE: 25 };

/**
 * Build a zombie map of size n with random positions.
 * @param {number} n
 * @returns {Object.<string, {x:number,y:number,size:number}>}
 */
function makeZombies(n) {
  const z = {};
  for (let i = 0; i < n; i++) {
    z[i] = { x: Math.random() * 2000, y: Math.random() * 2000, size: 25 };
  }
  return z;
}

/**
 * Build a CollisionManager pre-loaded with zombies in its spatial grid.
 * @param {Object} zombies
 * @returns {CollisionManager}
 */
function buildManager(zombies) {
  const gameState = { zombies, maxZombieSize: 25 };
  const cm = new CollisionManager(gameState, CONFIG);
  cm.quadtree = true;
  cm._zombieGrid.clear();
  for (const id in zombies) {
    cm._zombieGrid.insert({ x: zombies[id].x, y: zombies[id].y, entityId: id });
  }
  return cm;
}

/**
 * Measure ops/sec for checkBulletZombieCollisions over ITERS iterations.
 * @param {CollisionManager} cm
 * @param {{x:number,y:number}} bullet
 * @returns {number} ops per second
 */
function measureOps(cm, bullet) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) {
    cm.checkBulletZombieCollisions(bullet);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return Math.round(ITERS / (ms / 1000));
}

console.log('collision-bench — checkBulletZombieCollisions');
console.log('zombies | ops/sec');
console.log('--------|--------');

for (const n of SIZES) {
  const zombies = makeZombies(n);
  const cm = buildManager(zombies);
  const ops = measureOps(cm, { x: 1000, y: 1000 });
  console.log(`${String(n).padStart(7)} | ${ops.toLocaleString()}`);
}
