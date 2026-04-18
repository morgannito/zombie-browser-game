#!/usr/bin/env node
/**
 * @fileoverview Perf budget check — boots server, runs 30 bots for 30s,
 *   reads /health metrics and compares against scripts/perf-budget.json.
 * Exits 1 if any budget is exceeded.
 */

'use strict';

const childProcess = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const BUDGET_FILE = path.join(__dirname, 'perf-budget.json');
const SERVER_JS   = path.join(__dirname, '..', 'server.js');
const LOAD_TEST   = path.join(__dirname, 'load-test.js');
const PORT        = 3097;
const BOTS        = 30;
const DURATION_S  = 30;

const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'));

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForHealth(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`http://127.0.0.1:${port}/health`, res => {
        res.resume();
        if (res.statusCode === 200 || res.statusCode === 503) return resolve();
        if (Date.now() > deadline) return reject(new Error(`health timeout (${res.statusCode})`));
        setTimeout(tick, 300);
      }).on('error', () => {
        if (Date.now() > deadline) return reject(new Error('health timeout (connect)'));
        setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function runLoadTest() {
  return new Promise((resolve, reject) => {
    const stats = { bytes: 0, elapsed: 0 };
    const proc = childProcess.spawn(
      process.execPath,
      [LOAD_TEST, `--bots=${BOTS}`, `--duration=${DURATION_S}s`, `--port=${PORT}`],
      { stdio: ['ignore', 'pipe', 'inherit'] }
    );
    let stdout = '';
    proc.stdout.on('data', d => { stdout += d; process.stdout.write(d); });
    proc.on('exit', code => {
      // Parse "Total bytes received" and "Duration (s)" from load-test table
      // Format: | Total bytes received  | 1,234,567              |
      //         | Duration (s)          | 30                     |
      const bytesRow    = stdout.match(/Total bytes received[^|]*\|\s*([\d,]+)/i);
      const durationRow = stdout.match(/Duration \(s\)[^|]*\|\s*([\d.]+)/i);
      if (bytesRow && durationRow) {
        const bytes   = parseInt(bytesRow[1].replace(/,/g, ''), 10);
        const elapsed = parseFloat(durationRow[1]);
        if (elapsed > 0) stats.bytesPerSecMB = bytes / elapsed / (1024 * 1024);
      }
      resolve(stats);
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log(`[perf-check] Budget: ${JSON.stringify(budget)}`);
  console.log(`[perf-check] Starting server on port ${PORT}…`);

  const server = childProcess.spawn(
    process.execPath,
    [SERVER_JS],
    {
      env: { ...process.env, PORT: String(PORT), DB_SKIP: '1', NODE_ENV: 'test' },
      stdio: ['ignore', 'pipe', 'inherit']
    }
  );
  server.stdout.resume(); // drain

  let violations = [];

  try {
    await waitForHealth(PORT, 20_000);
    console.log('[perf-check] Server ready. Running load test…');

    const loadStats = runLoadTest(); // start load concurrently

    // Wait for load test to complete
    const botStats = await loadStats;

    // Fetch /health after load
    const health = await fetchJson(`http://127.0.0.1:${PORT}/health`);
    console.log('[perf-check] Health:', JSON.stringify(health, null, 2));

    // --- Check tick metrics ---
    const tick = health.tick;
    if (tick) {
      if (tick.avgDurationMs > budget.tickAvgMs) {
        violations.push(`tickAvgMs: ${tick.avgDurationMs.toFixed(2)} > budget ${budget.tickAvgMs}`);
      }
      if (tick.maxDurationMs > budget.tickMaxMs) {
        violations.push(`tickMaxMs: ${tick.maxDurationMs.toFixed(2)} > budget ${budget.tickMaxMs}`);
      }
    } else {
      console.warn('[perf-check] WARN: no tick metrics in /health (game loop not running?)');
    }

    // --- Check heap ---
    const heapMB = health.memory && health.memory.heapUsed;
    if (heapMB != null && heapMB > budget.heapMB) {
      violations.push(`heapMB: ${heapMB.toFixed(2)} > budget ${budget.heapMB}`);
    }

    // --- Check bytes/s if load-test reported it ---
    if (botStats.bytesPerSecMB != null) {
      if (botStats.bytesPerSecMB > budget.bytesPerSecMB) {
        violations.push(`bytesPerSecMB: ${botStats.bytesPerSecMB.toFixed(2)} > budget ${budget.bytesPerSecMB}`);
      }
    } else {
      console.warn('[perf-check] WARN: could not parse bytesPerSecMB from load-test output');
    }

  } finally {
    server.kill('SIGTERM');
    await sleep(500);
  }

  if (violations.length > 0) {
    console.error('\n[perf-check] BUDGET EXCEEDED:');
    for (const v of violations) console.error('  ✗', v);
    process.exit(1);
  } else {
    console.log('\n[perf-check] All budgets OK.');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('[perf-check] Fatal:', err.message);
  process.exit(1);
});
