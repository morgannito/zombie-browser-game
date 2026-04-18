'use strict';
const { SpatialGrid } = require('../contexts/zombie/SpatialGrid');

const SIZES = [100, 500, 1000];
const QUERIES = 1000;

function buildGrid(n) {
  const grid = new SpatialGrid();
  for (let i = 0; i < n; i++) {
    grid.insert({ x: Math.random() * 2000, y: Math.random() * 2000 });
  }
  return grid;
}

function measureOps(grid) {
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < QUERIES; i++) {
    grid.nearby(Math.random() * 2000, Math.random() * 2000, 150);
  }
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return Math.round(QUERIES / (ms / 1000));
}

const results = { bench: 'spatial-grid', metric: 'nearby()', unit: 'ops/sec', sizes: [] };

for (const n of SIZES) {
  const grid = buildGrid(n);
  const ops = measureOps(grid);
  results.sizes.push({ n, ops });
}

if (require.main === module) {
  console.log(JSON.stringify(results, null, 2));
}

module.exports = results;
