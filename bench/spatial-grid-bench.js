'use strict';
const { SpatialGrid } = require('../contexts/zombie/SpatialGrid');

const SIZES = [100, 500, 1000];
const QUERIES = 1000;

console.log('spatial-grid-bench — nearby() query rate');
console.log('zombies | ops/sec');
console.log('--------|--------');

for (const n of SIZES) {
  const grid = new SpatialGrid();
  for (let i = 0; i < n; i++) {
grid.insert({ x: Math.random() * 2000, y: Math.random() * 2000 });
}

  const t0 = process.hrtime.bigint();
  for (let i = 0; i < QUERIES; i++) {
grid.nearby(Math.random() * 2000, Math.random() * 2000, 150);
}
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const ops = Math.round(QUERIES / (ms / 1000));
  console.log(`${String(n).padStart(7)} | ${ops.toLocaleString()}`);
}
