#!/usr/bin/env node
/**
 * @fileoverview Single-run perf benchmark harness.
 * @description Boots a local server, spawns N bot clients, runs a load for
 *   S seconds, scrapes the /api/v1/metrics Prometheus histograms, and dumps
 *   a JSON summary suitable for before/after comparison.
 *
 * Usage:
 *   node scripts/bench-run.js --clients 20 --duration 30 --out bench.json
 *   # then on a different commit:
 *   node scripts/bench-run.js --clients 20 --duration 30 --out bench-next.json
 *   node scripts/bench-compare.js bench.json bench-next.json
 *
 * Only fixed argv is passed to spawn(node, [server.js]) — no shell, no
 * user-controlled input, injection-safe.
 */

'use strict';

const childProcess = require('child_process');
const http = require('http');
const path = require('path');

function parseArgs() {
  const args = { clients: 10, duration: 20, out: null, port: 3099 };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    const next = process.argv[i + 1];
    if (a === '--clients') {
 args.clients = Number(next); i++;
} else if (a === '--duration') {
 args.duration = Number(next); i++;
} else if (a === '--out') {
 args.out = next; i++;
} else if (a === '--port') {
 args.port = Number(next); i++;
}
  }
  return args;
}

function sleep(ms) {
 return new Promise(r => setTimeout(r, ms));
}

function waitForHealth(port, timeoutMs) {
  // Accept 200 (healthy) or 503 (db down — expected under DB_SKIP=1).
  // Both mean the HTTP server is listening and the game loop is running.
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      http.get(`http://127.0.0.1:${port}/health`, res => {
        if (res.statusCode === 200 || res.statusCode === 503) {
          res.resume();
          return resolve();
        }
        res.resume();
        if (Date.now() > deadline) {
return reject(new Error(`health timeout (last=${res.statusCode})`));
}
        setTimeout(tick, 250);
      }).on('error', () => {
        if (Date.now() > deadline) {
return reject(new Error('health timeout (connect)'));
}
        setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', c => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function parseHistogram(text, name) {
  const buckets = [];
  const re = new RegExp(`^${name}_bucket\\{le="([^"]+)"\\}\\s+(\\d+(?:\\.\\d+)?)`, 'gm');
  let m;
  while ((m = re.exec(text)) !== null) {
    buckets.push({ le: m[1] === '+Inf' ? Infinity : Number(m[1]), count: Number(m[2]) });
  }
  const sumRe = new RegExp(`^${name}_sum\\s+(\\d+(?:\\.\\d+)?)`, 'm');
  const countRe = new RegExp(`^${name}_count\\s+(\\d+(?:\\.\\d+)?)`, 'm');
  const sm = sumRe.exec(text);
  const cm = countRe.exec(text);
  return {
    buckets: buckets.sort((a, b) => a.le - b.le),
    sum: sm ? Number(sm[1]) : 0,
    count: cm ? Number(cm[1]) : 0
  };
}

function quantile(hist, q) {
  if (!hist.count) {
return null;
}
  const target = hist.count * q;
  let prevCount = 0;
  let prevLe = 0;
  for (const b of hist.buckets) {
    if (target <= b.count) {
      if (b.le === Infinity) {
return prevLe;
}
      const frac = b.count === prevCount ? 0 : (target - prevCount) / (b.count - prevCount);
      return prevLe + frac * (b.le - prevLe);
    }
    prevCount = b.count;
    prevLe = b.le;
  }
  return prevLe;
}

async function scrapeMetrics(port) {
  const { body } = await fetchText(`http://127.0.0.1:${port}/api/v1/metrics`);
  const picks = ['zombie_broadcast_ms', 'zombie_broadcast_bytes', 'zombie_gc_pause_ms', 'zombie_fps'];
  const out = {};
  for (const name of picks) {
    const h = parseHistogram(body, name);
    out[name] = {
      count: h.count,
      sum: h.sum,
      mean: h.count ? h.sum / h.count : null,
      p50: quantile(h, 0.5),
      p95: quantile(h, 0.95),
      p99: quantile(h, 0.99)
    };
  }
  return out;
}

function runBots(count, durationMs, serverUrl) {
  return new Promise(resolve => {
    const { io } = require('socket.io-client');
    const bots = [];
    let connected = 0;
    let moves = 0;
    for (let i = 0; i < count; i++) {
      const s = io(serverUrl, {
        transports: ['websocket'],
        reconnection: false,
        auth: { sessionId: `bench-${Date.now()}-${i}`, token: null },
        timeout: 5000
      });
      s.on('connect', () => {
        connected++;
        s.emit('setNickname', { nickname: `bot_${i}` });
      });
      const moveTimer = setInterval(() => {
        if (!s.connected) {
return;
}
        const batch = [];
        for (let k = 0; k < 2; k++) {
          batch.push({
            x: 1500 + Math.random() * 400 - 200,
            y: 1200 + Math.random() * 400 - 200,
            angle: Math.random() * Math.PI * 2 - Math.PI
          });
        }
        s.emit('playerMoveBatch', batch);
        moves++;
      }, 50);
      bots.push({ s, moveTimer });
    }
    setTimeout(() => {
      for (const b of bots) {
        clearInterval(b.moveTimer);
        b.s.close();
      }
      resolve({ connected, moves });
    }, durationMs);
  });
}

async function main() {
  const opts = parseArgs();
  const port = opts.port;
  const rootDir = path.resolve(__dirname, '..');

  console.log(`[bench] starting server on :${port} ...`);
  const env = Object.assign({}, process.env, {
    PORT: String(port),
    // Stay in dev mode — the production security gate requires METRICS_TOKEN
    // which the bench doesn't need. We're binding to 127.0.0.1 only.
    NODE_ENV: 'development',
    DB_SKIP: '1',
    DISABLE_AUTH_FOR_TESTS: '1'
  });
  const server = childProcess.spawn('node', ['server.js'], {
    cwd: rootDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // Forward server stderr to our own so bootstrap crashes are visible.
  server.stdout.on('data', _ => {});
  server.stderr.on('data', d => process.stderr.write(d));

  let exitEarly = null;
  server.on('exit', code => {
 exitEarly = code;
});

  try {
    await waitForHealth(port, 8000);
    console.log('[bench] server healthy, launching bots');

    const startMetrics = await scrapeMetrics(port);
    const start = Date.now();

    const { connected, moves } = await runBots(opts.clients, opts.duration * 1000, `http://127.0.0.1:${port}`);

    const elapsedSec = (Date.now() - start) / 1000;
    await sleep(500);
    const endMetrics = await scrapeMetrics(port);

    const report = {
      meta: {
        gitRef: (process.env.GIT_REF || 'HEAD').slice(0, 12),
        nodeVersion: process.version,
        clients: opts.clients,
        duration: elapsedSec,
        connected,
        movesSent: moves,
        timestamp: new Date().toISOString()
      },
      broadcast_ms: endMetrics.zombie_broadcast_ms,
      broadcast_bytes: endMetrics.zombie_broadcast_bytes,
      gc_pause_ms: endMetrics.zombie_gc_pause_ms,
      fps: endMetrics.zombie_fps
    };
    for (const key of ['broadcast_ms', 'broadcast_bytes', 'gc_pause_ms', 'fps']) {
      const a = startMetrics[`zombie_${key}`];
      const b = report[key];
      if (a && b && b.count > a.count) {
        const deltaCount = b.count - a.count;
        const deltaSum = b.sum - a.sum;
        report[key].loadPhase = {
          count: deltaCount,
          mean: deltaCount ? deltaSum / deltaCount : null
        };
      }
    }

    const out = JSON.stringify(report, null, 2);
    if (opts.out) {
      require('fs').writeFileSync(opts.out, out);
      console.log(`[bench] report -> ${opts.out}`);
    } else {
      console.log(out);
    }
  } finally {
    server.kill('SIGTERM');
    await sleep(500);
    if (exitEarly === null) {
server.kill('SIGKILL');
}
  }
}

main().catch(err => {
  console.error('[bench] failed:', err);
  process.exit(1);
});
