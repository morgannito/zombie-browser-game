#!/usr/bin/env node
'use strict';

/**
 * bench/loadtest.js — Multi-client load / smoke benchmark
 *
 * Config via environment variables:
 *   BENCH_URL          Base URL of the running server (default: http://127.0.0.1:3050)
 *   BENCH_CLIENTS      Number of virtual clients     (default: 10)
 *   BENCH_DURATION_MS  Test duration in ms           (default: 30000)
 *   BENCH_MOVE_HZ      playerMove emissions per sec  (default: 30)
 */

const http = require('http');
const https = require('https');
const { io } = require('socket.io-client');

/** @typedef {import('../types/jsdoc-types').LoadTestResult} LoadTestResult */
/** @typedef {import('../types/jsdoc-types').SocketEvent} SocketEvent */

/** Active sockets for SIGINT cleanup. @type {import('socket.io-client').Socket[]} */
const _activeSockets = [];
function _shutdown() {
  for (const s of _activeSockets) {
    try {
 s.disconnect();
} catch (_) { /* ignore */ }
  }
  process.exit(0);
}
process.on('SIGINT', _shutdown);
process.on('SIGTERM', _shutdown);

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE_URL = process.env.BENCH_URL || 'http://127.0.0.1:3050';
const NUM_CLIENTS = parseInt(process.env.BENCH_CLIENTS || '10', 10);
const DURATION_MS = parseInt(process.env.BENCH_DURATION_MS || '30000', 10);
const MOVE_HZ = parseInt(process.env.BENCH_MOVE_HZ || '30', 10);
const MOVE_INTERVAL_MS = Math.max(1, Math.round(1000 / MOVE_HZ));

// ---------------------------------------------------------------------------
// Minimal HTTP helpers (no extra deps)
// ---------------------------------------------------------------------------
function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(data));
            } catch {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === 'https:' ? https : http;
    lib
      .get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      })
      .on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------
function percentile(sorted, p) {
  if (!sorted.length) {
return 0;
}
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ---------------------------------------------------------------------------
// Virtual client
// ---------------------------------------------------------------------------
async function runClient(index) {
  const nickname = `bot-${index}`;
  const stats = {
    ackLatencies: [],
    messageCount: 0,
    bytesReceived: 0,
    errors: 0,
    connected: false
  };

  // 1. Login via HTTP
  let session;
  try {
    const loginStart = Date.now();
    const res = await httpPost(`${BASE_URL}/api/auth/login`, { nickname });
    stats.ackLatencies.push(Date.now() - loginStart);
    session = res;
  } catch (err) {
    stats.errors++;
    console.error(`[bot-${index}] login failed: ${err.message}`);
    return stats;
  }

  const { sessionId, token } = session;
  if (!sessionId || !token) {
    console.error(`[bot-${index}] login response missing sessionId/token`);
    stats.errors++;
    return stats;
  }

  // 2. Connect WebSocket
  return new Promise((resolve) => {
    const socket = io(BASE_URL, {
      auth: { sessionId, token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000
    });

    let moveTimer = null;
    let targetX = Math.random() * 3000;
    let targetY = Math.random() * 3000;

    const cleanup = () => {
      if (moveTimer) {
clearInterval(moveTimer);
}
      socket.disconnect();
      resolve(stats);
    };

    socket.on('gameState', (msg) => {
      try {
        const raw = JSON.stringify(msg);
        stats.messageCount++;
        stats.bytesReceived += raw.length;

        // Update target from current position
        if (msg && msg.players) {
          const me = msg.players[socket.id] || Object.values(msg.players)[0];
          if (me) {
            targetX = (me.x || 0) + (Math.random() - 0.5) * 400;
            targetY = (me.y || 0) + (Math.random() - 0.5) * 400;
          }
        }
      } catch {
        // ignore
      }
    });

    // Count bandwidth for all events
    socket.onAny((event, ...args) => {
      try {
        const raw = JSON.stringify({ event, args });
        stats.messageCount++;
        stats.bytesReceived += raw.length;
      } catch {
        // ignore non-serialisable payloads
      }
    });

    socket.on('connect_error', (err) => {
      stats.errors++;
      console.error(`[bot-${index}] connect_error: ${err.message}`);
      cleanup();
    });

    socket.on('connect', () => {
      stats.connected = true;

      // Emit playerMove at MOVE_HZ, collect ack latency
      moveTimer = setInterval(() => {
        const t0 = Date.now();
        socket.emit('playerMoveBatch', [{ x: targetX, y: targetY, angle: 0 }], () => {
          stats.ackLatencies.push(Date.now() - t0);
        });
      }, MOVE_INTERVAL_MS);
    });

    // Stop after duration
    setTimeout(cleanup, DURATION_MS);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\nZombie Game — Load Benchmark');
  console.log(`  URL:      ${BASE_URL}`);
  console.log(`  Clients:  ${NUM_CLIENTS}`);
  console.log(`  Duration: ${DURATION_MS}ms`);
  console.log(`  Move Hz:  ${MOVE_HZ}\n`);

  const startTime = Date.now();

  const promises = Array.from({ length: NUM_CLIENTS }, (_, i) => runClient(i));
  const results = await Promise.allSettled(promises);

  const elapsedSec = (Date.now() - startTime) / 1000;

  // Aggregate stats
  const all = {
    ackLatencies: [],
    messageCount: 0,
    bytesReceived: 0,
    errors: 0,
    connected: 0
  };

  for (const r of results) {
    if (r.status === 'fulfilled') {
      const s = r.value;
      all.ackLatencies.push(...s.ackLatencies);
      all.messageCount += s.messageCount;
      all.bytesReceived += s.bytesReceived;
      all.errors += s.errors;
      if (s.connected) {
all.connected++;
}
    } else {
      all.errors++;
    }
  }

  all.ackLatencies.sort((a, b) => a - b);

  const median = percentile(all.ackLatencies, 50);
  const p95 = percentile(all.ackLatencies, 95);
  const p99 = percentile(all.ackLatencies, 99);
  const msgPerSec = all.messageCount / elapsedSec;
  const bwPerSec = all.bytesReceived / elapsedSec;

  // Server health snapshot
  let health = null;
  try {
    health = await httpGet(`${BASE_URL}/health`);
  } catch {
    health = { error: 'unreachable' };
  }

  const summary = {
    duration_sec: elapsedSec.toFixed(2),
    clients_connected: all.connected,
    clients_total: NUM_CLIENTS,
    errors: all.errors,
    latency_ms: {
      median,
      p95,
      p99,
      samples: all.ackLatencies.length
    },
    throughput: {
      total_messages: all.messageCount,
      messages_per_sec: msgPerSec.toFixed(2),
      messages_per_sec_per_client: (msgPerSec / NUM_CLIENTS).toFixed(2),
      total_bytes: all.bytesReceived,
      bandwidth_kbps: (bwPerSec / 1024).toFixed(2),
      bandwidth_kbps_per_client: (bwPerSec / NUM_CLIENTS / 1024).toFixed(2)
    },
    server_health: health
  };

  console.log('\n=== BENCHMARK RESULTS ===\n');
  console.log(JSON.stringify(summary, null, 2));

  // Persist for metrics-report.js
  const fs = require('fs');
  const path = require('path');
  const outPath = path.join(__dirname, 'last-run.json');
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));
  console.log(`\nResults saved to: ${outPath}`);

  process.exit(0);
}

main().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
