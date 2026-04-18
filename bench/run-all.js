#!/usr/bin/env node
'use strict';

/**
 * bench/run-all.js — Run all micro-benchmarks and output a comparative JSON report.
 *
 * Usage:
 *   node bench/run-all.js
 *   node bench/run-all.js --save          # writes bench/last-micro.json
 *   node bench/run-all.js --baseline      # compares against bench/baseline-micro.json
 */

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, 'baseline-micro.json');
const LAST_RUN_PATH = path.join(__dirname, 'last-micro.json');

const save = process.argv.includes('--save');
const compareBaseline = process.argv.includes('--baseline');

// Run each bench (they execute synchronously on require)
const collision = require('./collision-bench');
const spatialGrid = require('./spatial-grid-bench');
const delta = require('./delta-bench');

const timestamp = new Date().toISOString();
const report = { timestamp, benches: [collision, spatialGrid, delta] };

// ── Baseline comparison ──────────────────────────────────────────────────────
function diffPct(current, base) {
  if (!base || base === 0) {
return null;
}
  return (((current - base) / base) * 100).toFixed(1);
}

if (compareBaseline && fs.existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
  const baseMap = {};
  for (const b of baseline.benches) {
    baseMap[b.bench] = {};
    for (const s of b.sizes) {
baseMap[b.bench][s.n] = s.ops;
}
  }
  for (const bench of report.benches) {
    for (const s of bench.sizes) {
      const base = baseMap[bench.bench] && baseMap[bench.bench][s.n];
      s.baseline_ops = base || null;
      s.diff_pct = diffPct(s.ops, base);
    }
  }
}

// ── Save ──────────────────────────────────────────────────────────────────────
if (save) {
  fs.writeFileSync(LAST_RUN_PATH, JSON.stringify(report, null, 2));
}

// ── Table output ─────────────────────────────────────────────────────────────
console.log('\n=== Micro-Benchmark Results ===\n');

for (const bench of report.benches) {
  const hasBaseline = bench.sizes.some((s) => s.baseline_ops !== null && s.baseline_ops !== undefined);
  const header = hasBaseline
    ? `${'bench'.padEnd(14)} ${'n'.padStart(6)}  ${'ops/sec'.padStart(12)}  ${'baseline'.padStart(12)}  ${'diff%'.padStart(7)}`
    : `${'bench'.padEnd(14)} ${'n'.padStart(6)}  ${'ops/sec'.padStart(12)}`;
  console.log(`-- ${bench.bench} (${bench.metric}) --`);
  console.log(header);
  for (const s of bench.sizes) {
    const opsStr = s.ops.toLocaleString().padStart(12);
    if (hasBaseline) {
      const baseStr = s.baseline_ops !== null && s.baseline_ops !== undefined ? s.baseline_ops.toLocaleString().padStart(12) : '           -';
      const diffStr = s.diff_pct !== null && s.diff_pct !== undefined ? `${s.diff_pct > 0 ? '+' : ''}${s.diff_pct}%`.padStart(7) : '      -';
      console.log(`${''.padEnd(14)} ${String(s.n).padStart(6)}  ${opsStr}  ${baseStr}  ${diffStr}`);
    } else {
      console.log(`${''.padEnd(14)} ${String(s.n).padStart(6)}  ${opsStr}`);
    }
  }
  console.log('');
}

// ── JSON output (CI-friendly) ────────────────────────────────────────────────
console.log('=== JSON ===');
console.log(JSON.stringify(report, null, 2));
