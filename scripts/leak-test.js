#!/usr/bin/env node
// Memory leak detection: 5 bots, samples heapUsed every 30s, flags >50MB growth

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace('--', '').split('='))
);
const N = parseInt(args.bots || '5');
const DURATION_MS = parseInt((args.duration || '300s').replace('s', '')) * 1000;
const SAMPLE_INTERVAL_MS = parseInt((args.sample || '30s').replace('s', '')) * 1000;
const LEAK_THRESHOLD_MB = parseInt(args.threshold || '50');
const PORT = parseInt(args.port || '3001');
const BASE = `http://127.0.0.1:${PORT}`;

/** Active sockets for cleanup on interrupt. @type {(import('socket.io-client').Socket|null)[]} */
let activeSockets = [];
let samplerHandle = null;

/** Disconnect all sockets and exit cleanly. */
function shutdown() {
  if (samplerHandle) clearInterval(samplerHandle);
  for (const s of activeSockets) {
    try { s && s.disconnect(); } catch (_) { /* ignore */ }
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Log in via HTTP and return the auth payload.
 * @param {string} username
 * @returns {Promise<{token:string}>}
 */
function login(username) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ username });
    const req = http.request(
      BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      rs => {
        let d = '';
        rs.on('data', c => d += c);
        rs.on('end', () => {
          try { res(JSON.parse(d)); } catch (e) { rej(e); }
        });
      }
    );
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

/**
 * Connect a bot socket (fire-and-forget).
 * @param {number} id
 * @returns {Promise<import('socket.io-client').Socket|null>}
 */
async function spawnBot(id) {
  try {
    const auth = await login('leak_bot_' + id + '_' + Date.now().toString().slice(-4));
    if (!auth.token) return null;
    const socket = io(BASE, { auth: { token: auth.token }, transports: ['websocket'], parser: msgpackParser });
    socket.on('init', () => socket.emit('setNickname', { nickname: 'leakbot' + id }));
    socket.on('connect_error', () => {});
    return socket;
  } catch (_) {
    return null;
  }
}

/**
 * Render an ASCII heap graph from samples.
 * @param {{ts:number,mb:number}[]} samples
 */
function renderGraph(samples) {
  const MB = samples.map(s => s.mb);
  const max = Math.max(...MB);
  const min = Math.min(...MB);
  const range = max - min || 1;
  const HEIGHT = 8;
  const WIDTH = MB.length;

  console.log('\nHeap usage over time (MB):\n');
  for (let row = HEIGHT; row >= 0; row--) {
    const threshold = min + (range * row) / HEIGHT;
    const label = threshold.toFixed(1).padStart(7);
    const line = MB.map(v => (v >= threshold ? '#' : ' ')).join('');
    console.log(`${label} | ${line}`);
  }
  console.log(' '.repeat(9) + '+' + '-'.repeat(WIDTH));
  const tStart = samples[0] ? new Date(samples[0].ts).toISOString().slice(11, 19) : '';
  const tEnd = samples[samples.length - 1] ? new Date(samples[samples.length - 1].ts).toISOString().slice(11, 19) : '';
  console.log(`         ${tStart}${' '.repeat(Math.max(0, WIDTH - tStart.length - tEnd.length))}${tEnd}`);
}

/**
 * Print summary and exit with appropriate code.
 * @param {{ts:number,mb:number}[]} samples
 */
function printSummaryAndExit(samples) {
  renderGraph(samples);

  const initial = samples[0].mb;
  const final = samples[samples.length - 1].mb;
  const delta = final - initial;

  console.log('\n--- Summary ---');
  console.log(`Initial heap : ${initial.toFixed(2)} MB`);
  console.log(`Final heap   : ${final.toFixed(2)} MB`);
  console.log(`Delta        : ${delta >= 0 ? '+' : ''}${delta.toFixed(2)} MB`);
  console.log(`Threshold    : ${LEAK_THRESHOLD_MB} MB`);

  if (delta > LEAK_THRESHOLD_MB) {
    console.error(`\n[LEAK DETECTED] Heap grew by ${delta.toFixed(2)} MB (> ${LEAK_THRESHOLD_MB} MB threshold)`);
    process.exit(1);
  } else {
    console.log(`\n[OK] No significant leak detected (delta ${delta.toFixed(2)} MB)`);
    process.exit(0);
  }
}

async function main() {
  console.log(`[leak-test] ${N} bots | duration=${DURATION_MS / 1000}s | sample=${SAMPLE_INTERVAL_MS / 1000}s | threshold=${LEAK_THRESHOLD_MB}MB`);

  activeSockets = await Promise.all(Array.from({ length: N }, (_, i) => spawnBot(i + 1)));
  const connected = activeSockets.filter(Boolean).length;
  console.log(`[leak-test] ${connected}/${N} bots connected`);

  const samples = [];

  const takeSample = () => {
    const { heapUsed } = process.memoryUsage();
    const mb = heapUsed / 1024 / 1024;
    const ts = Date.now();
    samples.push({ ts, mb });
    console.log(`[${new Date(ts).toISOString().slice(11, 19)}] heap=${mb.toFixed(2)} MB`);
  };

  takeSample();
  samplerHandle = setInterval(takeSample, SAMPLE_INTERVAL_MS);

  await new Promise(resolve => setTimeout(resolve, DURATION_MS));

  clearInterval(samplerHandle);
  samplerHandle = null;
  takeSample();

  activeSockets.forEach(s => s && s.disconnect());
  activeSockets = [];

  printSummaryAndExit(samples);
}

main().catch(err => { console.error(err); process.exit(2); });
