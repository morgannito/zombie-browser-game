#!/usr/bin/env node
'use strict';

/**
 * bench/metrics-report.js — Human-readable report from last-run.json
 *
 * Usage:
 *   npm run bench:report
 *   node bench/metrics-report.js [path/to/run.json]
 */

const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2] || path.join(__dirname, 'last-run.json');

if (!fs.existsSync(dataPath)) {
  console.error(`No results file found at: ${dataPath}`);
  console.error('Run the benchmark first: npm run bench');
  process.exit(1);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
} catch (err) {
  console.error('Failed to parse results file:', err.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function bar(value, max, width) {
  const w = width || 30;
  const filled = Math.round((value / Math.max(max, 1)) * w);
  return '\u2588'.repeat(Math.max(0, filled)) + '\u2591'.repeat(Math.max(0, w - filled));
}

function rating(p99) {
  if (p99 < 50) {
return 'Excellent (<50ms)';
}
  if (p99 < 150) {
return 'Good (<150ms)';
}
  if (p99 < 500) {
return 'Degraded (<500ms)';
}
  return 'Critical (>=500ms)';
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const { duration_sec, clients_connected, clients_total, errors, latency_ms, throughput, server_health } = data;

const connectRate =
  clients_total > 0 ? ((clients_connected / clients_total) * 100).toFixed(1) : '0.0';

console.log('\n=== ZOMBIE GAME — BENCHMARK METRICS REPORT ===\n');
console.log(`  Run duration : ${duration_sec}s`);
console.log(`  Clients      : ${clients_connected}/${clients_total} connected (${connectRate}%)`);
console.log(`  Errors       : ${errors}`);
console.log('');

console.log('-- Ack Latency --');
const maxLat = Math.max(latency_ms.p99, 1);
console.log(`  Median  ${String(latency_ms.median).padStart(5)}ms  ${bar(latency_ms.median, maxLat)}`);
console.log(`  P95     ${String(latency_ms.p95).padStart(5)}ms  ${bar(latency_ms.p95, maxLat)}`);
console.log(`  P99     ${String(latency_ms.p99).padStart(5)}ms  ${bar(latency_ms.p99, maxLat)}`);
console.log(`  Samples : ${latency_ms.samples}`);
console.log(`  Rating  : ${rating(latency_ms.p99)}`);
console.log('');

console.log('-- Throughput --');
console.log(`  Total messages   : ${throughput.total_messages.toLocaleString()}`);
console.log(`  Messages/sec     : ${throughput.messages_per_sec} total`);
console.log(`  Messages/sec/cli : ${throughput.messages_per_sec_per_client}`);
console.log(`  Bandwidth        : ${throughput.bandwidth_kbps} KB/s total`);
console.log(`  Bandwidth/cli    : ${throughput.bandwidth_kbps_per_client} KB/s`);
console.log(`  Total bytes      : ${(throughput.total_bytes / 1024).toFixed(1)} KB`);
console.log('');

console.log('-- Server Health --');
if (server_health && !server_health.error) {
  JSON.stringify(server_health, null, 2)
    .split('\n')
    .forEach((l) => console.log('  ' + l));
} else {
  console.log('  ' + (server_health && server_health.error ? server_health.error : 'No health data'));
}
console.log('');

console.log('-- Recommendations --');
const p99 = latency_ms.p99;
const connFail = clients_total - clients_connected;

if (connFail > 0) {
  console.log(
    `  WARN: ${connFail} client(s) failed to connect — check auth/rate-limit settings`
  );
}
if (p99 > 500) {
  console.log('  WARN: P99 latency > 500ms — server may be overloaded');
} else if (p99 > 150) {
  console.log('  INFO: P99 latency > 150ms — consider profiling game loop');
}
if (errors > 0) {
  console.log(`  WARN: ${errors} error(s) recorded — check server logs`);
}
if (connFail === 0 && p99 <= 150 && errors === 0) {
  console.log('  OK: All checks passed');
}
console.log('');

process.exit(0);
