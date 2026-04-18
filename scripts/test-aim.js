#!/usr/bin/env node
// Aim test — identify the nearest zombie and shoot directly at it.
// Validates the core shoot-to-hit pipeline.

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';

/** @type {import('socket.io-client').Socket|null} */
const activeSocket = null;
function shutdown() {
  try {
 activeSocket && activeSocket.disconnect();
} catch (_) { /* ignore */ }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

function login(u) {
  return new Promise((res, rej) => {
    const b = JSON.stringify({ username: u });
    const r = http.request(BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': b.length } },
      rs => {
 let d=''; rs.on('data', c => d += c); rs.on('end', () => {
 try {
 res(JSON.parse(d));
} catch (e) {
rej(e);
}
});
});
    r.on('error', rej); r.write(b); r.end();
  });
}

async function run() {
  const l = await login('aim' + Date.now().toString().slice(-6));
  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });

  let myId = null;
  let me = null;
  const zombies = {};
  let zombiesKilledTotal = 0;

  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'aim_' + Date.now().toString().slice(-4) });
  });
  socket.on('gameState', s => {
    if (s.players?.[myId]) {
me = s.players[myId];
}
    for (const id in s.zombies) {
zombies[id] = s.zombies[id];
}
  });
  socket.on('gameStateDelta', d => {
    if (d.updated?.players?.[myId]) {
      const p = d.updated.players[myId];
      if (typeof p.x === 'number') {
me.x = p.x;
}
      if (typeof p.y === 'number') {
me.y = p.y;
}
    }
    for (const id in d.updated?.zombies || {}) {
      const patch = d.updated.zombies[id];
      if (!zombies[id]) {
zombies[id] = patch;
} else {
Object.assign(zombies[id], patch);
}
    }
    for (const id of d.removed?.zombies || []) {
      if (zombies[id]) {
 zombiesKilledTotal++; delete zombies[id];
}
    }
  });

  await new Promise(r => setTimeout(r, 2000));
  if (!me) {
 console.error('No me'); process.exit(1);
}
  console.log(`[aim] me=(${me.x.toFixed(0)},${me.y.toFixed(0)}) zombies=${Object.keys(zombies).length}`);

  let bulletsFired = 0;
  const t0 = Date.now();

  // Fire at nearest zombie every 60ms for 10s
  const loop = setInterval(() => {
    let nearestId = null, nearestDist = Infinity;
    for (const id in zombies) {
      const z = zombies[id];
      if (!z || !z.x) {
continue;
}
      const d = Math.hypot(z.x - me.x, z.y - me.y);
      if (d < nearestDist) {
 nearestDist = d; nearestId = id;
}
    }
    if (nearestId && nearestDist < 800) {
      const z = zombies[nearestId];
      const angle = Math.atan2(z.y - me.y, z.x - me.x);
      socket.emit('shoot', { angle });
      bulletsFired++;
    }
  }, 60);

  await new Promise(r => setTimeout(r, 10000));
  clearInterval(loop);

  const elapsed = (Date.now() - t0) / 1000;
  console.log('\n=== AIM RESULTS ===');
  console.log(`bullets fired: ${bulletsFired} (${(bulletsFired/elapsed).toFixed(1)}/s)`);
  console.log(`zombies killed: ${zombiesKilledTotal}`);
  console.log(`hit ratio: ${(zombiesKilledTotal * 100 / bulletsFired).toFixed(1)}%`);
  console.log(`zombies alive: ${Object.keys(zombies).length}`);

  socket.disconnect();
  process.exit(0);
}

run().catch(e => {
 console.error(e); process.exit(1);
});
