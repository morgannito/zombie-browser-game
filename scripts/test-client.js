#!/usr/bin/env node
// Test client — connects, plays scripted scenarios, logs results.
// Usage: node scripts/test-client.js [scenario]
//   scenarios: shoot | move | zombies | all (default: all)

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';

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
const scenario = process.argv[2] || 'all';

function httpLogin(username, password) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username, password });
    const req = http.request(
      BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try {
 resolve(JSON.parse(data));
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

async function run() {
  const u = 'tst' + Date.now().toString().slice(-6);
  const login = await httpLogin(u, 'testpass1234');
  if (!login.token) {
 console.error('Login failed:', login); process.exit(1);
}
  console.log('[auth] token[0..20]=', login.token.slice(0, 20), 'player=', login.player);

  const socket = io(BASE, {
    auth: { token: login.token },
    transports: ['websocket'],
    parser: msgpackParser
  });
  activeSocket = socket;

  const stats = {
    gameStateFull: 0,
    gameStateDelta: 0,
    positionCorrection: 0,
    moveAck: 0,
    lastPlayerPos: null,
    lastZombieCount: 0,
    bulletsSpawned: 0,
    killsTotal: 0,
    startHealth: 100,
    lastHealth: 100,
    damageTaken: 0
  };

  let myPlayerId = null;

  socket.on('connect', () => console.log('[socket] connect id=' + socket.id));
  socket.on('disconnect', r => console.log('[socket] disconnect:', r));
  socket.on('connect_error', e => console.log('[socket] connect_error:', e.message, e));
  socket.on('error', e => console.log('[socket] error:', e));

  socket.on('init', d => {
    myPlayerId = d.playerId;
    console.log('[init] playerId=' + myPlayerId);
    socket.emit('setNickname', { nickname: 'bot_' + Date.now().toString().slice(-5) });
  });

  socket.on('gameState', s => {
    stats.gameStateFull++;
    const p = s.players?.[myPlayerId];
    if (p) {
      stats.lastPlayerPos = { x: p.x, y: p.y };
      if (typeof p.health === 'number') {
        if (p.health < stats.lastHealth) {
stats.damageTaken += stats.lastHealth - p.health;
}
        stats.lastHealth = p.health;
      }
    }
    stats.lastZombieCount = Object.keys(s.zombies || {}).length;
  });
  socket.on('gameStateDelta', _d => {
 stats.gameStateDelta++;
});
  socket.on('positionCorrection', () => {
 stats.positionCorrection++;
});
  socket.on('moveAck', () => {
 stats.moveAck++;
});

  // Wait for init
  await new Promise(r => setTimeout(r, 1000));

  if (!myPlayerId || !stats.lastPlayerPos) {
    console.error('No init received, aborting');
    process.exit(1);
  }

  console.log('[state] spawned at', stats.lastPlayerPos, 'zombies=' + stats.lastZombieCount);

  // Scenario: shoot — tire dans 360° et regarde ce qui meurt
  if (scenario === 'shoot' || scenario === 'all') {
    console.log('\n=== SCENARIO: shoot ===');
    const before = stats.lastZombieCount;
    // Fire 120 bullets over 3s, rotating around 360°
    for (let i = 0; i < 120; i++) {
      const angle = (i / 120) * Math.PI * 2;
      socket.emit('shoot', { angle });
      stats.bulletsSpawned++;
      await new Promise(r => setTimeout(r, 25));
    }
    await new Promise(r => setTimeout(r, 2000));
    const after = stats.lastZombieCount;
    console.log(`  bullets fired: ${stats.bulletsSpawned}`);
    console.log(`  zombies before: ${before}, after: ${after}, diff: ${before - after}`);
    console.log(`  damage taken during shoot: ${stats.damageTaken}`);
  }

  // Scenario: move — envoie 60 positionMoves en ligne et verifie rollback
  if (scenario === 'move' || scenario === 'all') {
    console.log('\n=== SCENARIO: move ===');
    const start = { ...stats.lastPlayerPos };
    stats.positionCorrection = 0;
    let seq = 10000;
    for (let i = 0; i < 60; i++) {
      const target = { x: start.x + i * 5, y: start.y };
      socket.emit('playerMove', { x: target.x, y: target.y, angle: 0, seq: seq++ });
      await new Promise(r => setTimeout(r, 33));
    }
    await new Promise(r => setTimeout(r, 500));
    console.log('  moves sent: 60');
    console.log(`  final server pos: ${stats.lastPlayerPos?.x?.toFixed(0)},${stats.lastPlayerPos?.y?.toFixed(0)}`);
    console.log(`  expected: ${(start.x + 295).toFixed(0)},${start.y.toFixed(0)}`);
    console.log(`  positionCorrection received: ${stats.positionCorrection}`);
    console.log(`  moveAck received: ${stats.moveAck}`);
  }

  // Scenario: zombies — juste observer
  if (scenario === 'zombies' || scenario === 'all') {
    console.log('\n=== SCENARIO: zombies (observe 5s) ===');
    const beforeFull = stats.gameStateFull;
    const beforeDelta = stats.gameStateDelta;
    await new Promise(r => setTimeout(r, 5000));
    const fullHz = (stats.gameStateFull - beforeFull) / 5;
    const deltaHz = (stats.gameStateDelta - beforeDelta) / 5;
    console.log(`  gameState rate: ${fullHz.toFixed(1)}Hz (full) + ${deltaHz.toFixed(1)}Hz (delta)`);
    console.log(`  final zombie count: ${stats.lastZombieCount}`);
  }

  console.log('\n=== DONE ===');
  socket.disconnect();
  process.exit(0);
}

run().catch(e => {
 console.error('FATAL:', e); process.exit(1);
});
