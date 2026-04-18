'use strict';
const NetworkManager = require('../lib/server/NetworkManager');

const SIZES = [10, 50, 100];
const ITERS = 1000;

function makeState(n) {
  const zombies = {};
  for (let i = 0; i < n; i++) {
    zombies[i] = { x: Math.random() * 2000, y: Math.random() * 2000, hp: 100 };
  }
  return { players: {}, zombies, bullets: {}, particles: {}, poisonTrails: {}, explosions: {}, powerups: {}, loot: {} };
}

function measureOps(nm, current, previous) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) {
    nm.calculateDelta(current, previous);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return Math.round(ITERS / (ms / 1000));
}

const nm = new NetworkManager({ on: () => {} }, {});
const results = { bench: 'delta', metric: 'calculateDelta', unit: 'ops/sec', sizes: [] };

for (const n of SIZES) {
  const current = makeState(n);
  const previous = makeState(n);
  const ops = measureOps(nm, current, previous);
  results.sizes.push({ n, ops });
}

if (require.main === module) {
  console.log(JSON.stringify(results, null, 2));
}

module.exports = results;
