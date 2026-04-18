#!/usr/bin/env node
/**
 * @fileoverview Compare two bench-run.js reports and flag regressions.
 * @description Reads two JSON reports produced by scripts/bench-run.js,
 *   computes the delta on each histogram quantile, prints a table, and
 *   exits non-zero when any tracked p95/mean regressed beyond the allowed
 *   tolerance. Meant to be wired into CI nightly or PR comparison.
 *
 * Usage:
 *   node scripts/bench-compare.js baseline.json candidate.json [--tolerance 0.10]
 *   node scripts/bench-compare.js baseline.json candidate.json --fail-on-regression
 */

'use strict';

const fs = require('fs');

// Default 10% tolerance on p95/mean regressions before we flag.
const DEFAULT_TOLERANCE = 0.10;

// Metrics where higher = worse (we want LOW values).
const LOWER_IS_BETTER = new Set(['broadcast_ms', 'broadcast_bytes', 'gc_pause_ms']);
// Metrics where higher = better (we want HIGH values).
const HIGHER_IS_BETTER = new Set(['fps']);

function parseArgs() {
  const args = { baseline: null, candidate: null, tolerance: DEFAULT_TOLERANCE, failOnRegression: false };
  const positional = [];
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const next = process.argv[i + 1];
    if (a === '--tolerance') {
 args.tolerance = Number(next); i++;
} else if (a === '--fail-on-regression') {
 args.failOnRegression = true;
} else {
positional.push(a);
}
  }
  [args.baseline, args.candidate] = positional;
  if (!args.baseline || !args.candidate) {
    console.error('Usage: bench-compare.js <baseline.json> <candidate.json> [--tolerance 0.10] [--fail-on-regression]');
    process.exit(2);
  }
  return args;
}

function loadReport(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function fmt(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
return '—';
}
  if (Math.abs(n) >= 1000) {
return n.toFixed(0);
}
  if (Math.abs(n) >= 10) {
return n.toFixed(1);
}
  return n.toFixed(2);
}

function pctDelta(baseline, candidate) {
  if (baseline === null || baseline === undefined || baseline === 0) {
return null;
}
  if (candidate === null || candidate === undefined) {
return null;
}
  return (candidate - baseline) / baseline;
}

/**
 * Given a metric key + the delta, decide whether this counts as a
 * regression beyond `tolerance`. Returns {regressed, improved, neutral}.
 */
function classify(metricKey, delta, tolerance) {
  if (delta === null || Number.isNaN(delta)) {
return 'neutral';
}
  if (Math.abs(delta) < tolerance) {
return 'neutral';
}
  const isLowerBetter = LOWER_IS_BETTER.has(metricKey);
  const isHigherBetter = HIGHER_IS_BETTER.has(metricKey);
  if (isLowerBetter) {
return delta > 0 ? 'regressed' : 'improved';
}
  if (isHigherBetter) {
return delta < 0 ? 'regressed' : 'improved';
}
  return 'neutral';
}

function tagFor(cls) {
  if (cls === 'regressed') {
return 'REGRESS';
}
  if (cls === 'improved') {
return 'IMPROVE';
}
  return 'same   ';
}

function compareQuantiles(base, cand) {
  return {
    mean: { base: base?.mean, cand: cand?.mean, delta: pctDelta(base?.mean, cand?.mean) },
    p50: { base: base?.p50, cand: cand?.p50, delta: pctDelta(base?.p50, cand?.p50) },
    p95: { base: base?.p95, cand: cand?.p95, delta: pctDelta(base?.p95, cand?.p95) },
    p99: { base: base?.p99, cand: cand?.p99, delta: pctDelta(base?.p99, cand?.p99) }
  };
}

function main() {
  const opts = parseArgs();
  const baseline = loadReport(opts.baseline);
  const candidate = loadReport(opts.candidate);

  console.log('');
  console.log('Benchmark comparison');
  console.log(`  baseline:  ${opts.baseline}  (ref ${baseline.meta?.gitRef || '?'})`);
  console.log(`  candidate: ${opts.candidate} (ref ${candidate.meta?.gitRef || '?'})`);
  console.log(`  tolerance: ±${(opts.tolerance * 100).toFixed(0)}%`);
  console.log('');

  const tracked = ['broadcast_ms', 'broadcast_bytes', 'gc_pause_ms', 'fps'];
  const regressions = [];

  console.log('Metric                 Stat    Baseline     Candidate    Δ%        ');
  console.log('---------------------- ------- ------------ ------------ ----------');
  for (const key of tracked) {
    const cmp = compareQuantiles(baseline[key], candidate[key]);
    for (const stat of ['mean', 'p50', 'p95', 'p99']) {
      const c = cmp[stat];
      const cls = classify(key, c.delta, opts.tolerance);
      const delta = c.delta === null ? '—' : `${(c.delta * 100).toFixed(1)}%`;
      const tag = tagFor(cls);
      console.log(
        `${key.padEnd(22)} ${stat.padEnd(7)} ${fmt(c.base).padStart(12)} ${fmt(c.cand).padStart(12)} ${delta.padStart(8)}  ${tag}`
      );
      if (cls === 'regressed' && (stat === 'mean' || stat === 'p95')) {
        regressions.push({ key, stat, delta: c.delta });
      }
    }
    console.log('---------------------- ------- ------------ ------------ ----------');
  }

  console.log('');
  if (regressions.length === 0) {
    console.log('OK — no significant regression within tolerance.');
    process.exit(0);
  }
  console.log(`Regressions detected: ${regressions.length}`);
  for (const r of regressions) {
    console.log(`  - ${r.key} ${r.stat}: +${(r.delta * 100).toFixed(1)}%`);
  }
  process.exit(opts.failOnRegression ? 1 : 0);
}

main();
