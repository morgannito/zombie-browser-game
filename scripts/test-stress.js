#!/usr/bin/env node
// Stress test — simulate an active player shooting and moving continuously
// for N seconds. Reports: kills/s, hit rate, latency, bandwidth.

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';
const DURATION = parseInt(process.argv[2] || '15', 10);

/** @type {import('socket.io-client').Socket|null} */
let activeSocket = null;

function shutdown() {
  try {
 activeSocket && activeSocket.disconnect();
} catch (_) { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/**
 * Log in via HTTP.
 * @param {string} username
 * @returns {Promise<{token:string}>}
 */
function login(username) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username });
    const req = http.request(
      BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      r => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
 try {
 resolve(JSON.parse(d));
} catch (e) {
 reject(e);
}
});
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Track player state from incoming server messages.
 * @param {import('socket.io-client').Socket} socket
 * @param {string} myId
 * @param {Object} stats - mutable stats object
 * @returns {{get: () => {x:number,y:number}|null}}
 */
function trackPlayerState(socket, myId, stats) {
  let playerState = null;

  socket.on('gameState', s => {
    stats.fullCount++;
    stats.bytesIn += JSON.stringify(s).length;
    const p = s.players?.[myId];
    if (p) {
      playerState = { x: p.x, y: p.y };
      if (typeof p.health === 'number' && p.health < stats.healthMin) {
stats.healthMin = p.health;
}
    }
    stats.zombiesEnd = Object.keys(s.zombies || {}).length;
    if (stats.zombiesStart === 0) {
stats.zombiesStart = stats.zombiesEnd;
}
  });

  socket.on('gameStateDelta', d => {
    stats.deltaCount++;
    stats.bytesIn += JSON.stringify(d).length;
    const p = d.updated?.players?.[myId];
    if (p) {
      if (typeof p.x === 'number') {
playerState = { x: p.x, y: p.y };
}
      if (typeof p.health === 'number' && p.health < stats.healthMin) {
stats.healthMin = p.health;
}
    }
  });

  return { get: () => playerState };
}

/**
 * Print stress test summary.
 * @param {Object} stats
 * @param {number} elapsed - seconds
 * @param {number[]} pingTimes
 */
function printResults(stats, elapsed, pingTimes) {
  const avgPing = pingTimes.length ? pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length : 0;
  const maxPing = pingTimes.length ? Math.max(...pingTimes) : 0;

  console.log('\n=== STRESS RESULTS ===');
  console.log(`duration: ${elapsed.toFixed(1)}s`);
  console.log(`zombies: ${stats.zombiesStart} → ${stats.zombiesEnd} (Δ ${stats.zombiesStart - stats.zombiesEnd})`);
  console.log(`bullets sent: ${stats.bulletsSent} (${(stats.bulletsSent / elapsed).toFixed(0)}/s)`);
  console.log(`moves sent: ${stats.movesSent} (${(stats.movesSent / elapsed).toFixed(0)}/s)`);
  console.log(`broadcast: ${(stats.fullCount / elapsed).toFixed(1)}Hz full + ${(stats.deltaCount / elapsed).toFixed(1)}Hz delta`);
  console.log(`bandwidth: ${(stats.bytesIn / 1024 / elapsed).toFixed(1)} KB/s`);
  console.log(`correctionsReceived: ${stats.correctionsReceived}`);
  console.log(`ping avg: ${avgPing.toFixed(1)}ms, max: ${maxPing}ms, samples: ${pingTimes.length}`);
  console.log(`min health: ${stats.healthMin}`);
}

async function run() {
  const u = 'str' + Date.now().toString().slice(-6);
  const l = await login(u);

  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });
  activeSocket = socket;

  let myId = null;
  const stats = {
    bytesIn: 0, deltaCount: 0, fullCount: 0,
    kills: 0, zombiesStart: 0, zombiesEnd: 0,
    bulletsSent: 0, movesSent: 0, correctionsReceived: 0,
    healthMin: 100
  };

  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'stress_' + Date.now().toString().slice(-4) });
  });
  socket.on('positionCorrection', () => stats.correctionsReceived++);

  await new Promise(r => setTimeout(r, 1500));

  const player = trackPlayerState(socket, myId, stats);

  await new Promise(r => setTimeout(r, 500));

  const t0 = Date.now();
  let seq = 10000;
  let angle = 0;
  const pingTimes = [];

  const pingLoop = setInterval(() => {
    const s = Date.now();
    socket.emit('app:ping', { t: s }, () => pingTimes.push(Date.now() - s));
  }, 500);

  const actionLoop = setInterval(() => {
    angle += 0.3;
    socket.emit('shoot', { angle });
    stats.bulletsSent++;

    const ps = player.get();
    if (ps) {
      socket.emit('playerMove', {
        x: ps.x + Math.cos(angle * 2) * 2.5,
        y: ps.y + Math.sin(angle * 2) * 2.5,
        angle,
        seq: seq++
      });
      stats.movesSent++;
    }
  }, 50);

  await new Promise(r => setTimeout(r, DURATION * 1000));
  clearInterval(actionLoop);
  clearInterval(pingLoop);

  const elapsed = (Date.now() - t0) / 1000;
  printResults(stats, elapsed, pingTimes);

  socket.disconnect();
  activeSocket = null;
  process.exit(0);
}

run().catch(e => {
 console.error(e); process.exit(1);
});
