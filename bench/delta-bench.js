'use strict';
const NetworkManager = require('../lib/server/NetworkManager');

const SIZES = [10, 50, 100]; // nb zombies in state
const ITERS = 1000;

function makeState(n) {
  const zombies = {};
  for (let i = 0; i < n; i++) {
zombies[i] = { x: Math.random() * 2000, y: Math.random() * 2000, hp: 100 };
}
  return { players: {}, zombies, bullets: {}, particles: {}, poisonTrails: {}, explosions: {}, powerups: {}, loot: {} };
}

const nm = new NetworkManager({ on: () => {} }, {});

console.log('delta-bench — calculateDelta cycle');
console.log('zombies | ops/sec');
console.log('--------|--------');

for (const n of SIZES) {
  const current = makeState(n);
  const previous = makeState(n);

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < ITERS; i++) {
nm.calculateDelta(current, previous);
}
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ops = Math.round(ITERS / (ms / 1000));
  console.log(`${String(n).padStart(7)} | ${ops.toLocaleString()}`);
}
