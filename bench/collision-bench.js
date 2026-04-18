'use strict';
const CollisionManager = require('../contexts/weapons/CollisionManager');
const { SpatialGrid: _SpatialGrid } = require('../contexts/zombie/SpatialGrid');

const SIZES = [100, 500, 1000];
const ITERS = 500;
const CONFIG = { BULLET_HIT_TOLERANCE: 8, BULLET_SIZE: 6, ZOMBIE_SIZE: 25 };

function makeZombies(n) {
  const z = {};
  for (let i = 0; i < n; i++) {
    z[i] = { x: Math.random() * 2000, y: Math.random() * 2000, size: 25 };
  }
  return z;
}

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

function measureOps(cm, bullet) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) {
    cm.checkBulletZombieCollisions(bullet);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return Math.round(ITERS / (ms / 1000));
}

const results = { bench: 'collision', metric: 'checkBulletZombieCollisions', unit: 'ops/sec', sizes: [] };

for (const n of SIZES) {
  const zombies = makeZombies(n);
  const cm = buildManager(zombies);
  const ops = measureOps(cm, { x: 1000, y: 1000 });
  results.sizes.push({ n, ops });
}

if (require.main === module) {
  console.log(JSON.stringify(results, null, 2));
}

module.exports = results;
