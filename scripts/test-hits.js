#!/usr/bin/env node
// Accurate hit-rate test: track zombie health drops to count real bullet hits
// (not just kills). Validates full shoot pipeline end-to-end.

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';

/** @type {import('socket.io-client').Socket|null} */
let activeSocket = null;
function shutdown() {
  try { activeSocket && activeSocket.disconnect(); } catch (_) { /* ignore */ }
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
  const l = await login('hit' + Date.now().toString().slice(-6));
  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });
  activeSocket = socket;

  let myId = null;
  let me = null;
  const zombies = {};
  const zombieHealth = {};
  let hitsRegistered = 0;
  let killsRegistered = 0;

  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'hit_' + Date.now().toString().slice(-4) });
  });
  socket.on('gameState', s => {
    if (s.players?.[myId]) {
me = s.players[myId];
}
    for (const id in s.zombies) {
      zombies[id] = s.zombies[id];
      if (zombieHealth[id] === undefined) {
zombieHealth[id] = s.zombies[id].health;
}
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
        zombieHealth[id] = patch.health;
      } else {
        Object.assign(zombies[id], patch);
        if (typeof patch.health === 'number') {
          const old = zombieHealth[id];
          if (typeof old === 'number' && patch.health < old) {
hitsRegistered++;
}
          zombieHealth[id] = patch.health;
        }
      }
    }
    for (const id of d.removed?.zombies || []) {
      if (zombies[id]) {
 killsRegistered++; delete zombies[id]; delete zombieHealth[id];
}
    }
  });

  await new Promise(r => setTimeout(r, 2000));
  if (!me) {
 console.error('No me'); process.exit(1);
}

  let bulletsFired = 0;
  const t0 = Date.now();

  // Fire at nearest zombie every 50ms for 10s
  const loop = setInterval(() => {
    let bestId = null, bestDist = Infinity;
    for (const id in zombies) {
      const z = zombies[id];
      if (!z || !z.x || z.health <= 0) {
continue;
}
      const d = Math.hypot(z.x - me.x, z.y - me.y);
      if (d < bestDist) {
 bestDist = d; bestId = id;
}
    }
    if (bestId && bestDist < 800) {
      const z = zombies[bestId];
      const angle = Math.atan2(z.y - me.y, z.x - me.x);
      socket.emit('shoot', { angle });
      bulletsFired++;
    }
  }, 50);

  await new Promise(r => setTimeout(r, 10000));
  clearInterval(loop);

  const elapsed = (Date.now() - t0) / 1000;
  console.log('\n=== HIT ANALYSIS ===');
  console.log(`duration: ${elapsed.toFixed(1)}s`);
  console.log(`bullets emitted (client): ${bulletsFired}`);
  console.log(`hits registered (health drops): ${hitsRegistered}`);
  console.log(`kills registered: ${killsRegistered}`);
  console.log(`hit-or-kill ratio: ${((hitsRegistered + killsRegistered) * 100 / bulletsFired).toFixed(1)}%`);
  console.log(`kill ratio: ${(killsRegistered * 100 / bulletsFired).toFixed(1)}%`);
  console.log(`zombies alive: ${Object.keys(zombies).length}`);

  socket.disconnect();
  process.exit(0);
}

run().catch(e => {
 console.error(e); process.exit(1);
});
