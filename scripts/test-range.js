#!/usr/bin/env node
// Long-range hit test: respects fireRate, tracks hits by zombie distance bucket
// Validates that bullets damage zombies at medium+ range (500-800px).

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

/**
 * Log in via HTTP.
 * @param {string} u
 * @returns {Promise<{token:string}>}
 */
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
  const l = await login('rng' + Date.now().toString().slice(-6));
  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });
  activeSocket = socket;

  let myId = null;
  let me = null;
  const zombies = {};
  const zombieHealth = {};
  const buckets = { close: { shots: 0, hits: 0 }, mid: { shots: 0, hits: 0 }, far: { shots: 0, hits: 0 } };

  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'rng_' + Date.now().toString().slice(-4) });
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
            const lastBucket = zombies[id]._lastBucket;
            if (lastBucket) {
buckets[lastBucket].hits++;
}
          }
          zombieHealth[id] = patch.health;
        }
      }
    }
    for (const id of d.removed?.zombies || []) {
      if (zombies[id]) {
        const b = zombies[id]._lastBucket;
        if (b) {
buckets[b].hits++;
}
        delete zombies[id]; delete zombieHealth[id];
      }
    }
  });

  await new Promise(r => setTimeout(r, 3000));
  if (!me) {
 console.error('No me'); process.exit(1);
}
  // Stay still — use actual server position. Emit periodic playerMove to maintain alive state.
  const posKeeper = setInterval(() => {
    socket.emit('playerMove', { x: me.x, y: me.y, angle: 0 });
  }, 200);
  await new Promise(r => setTimeout(r, 500));
  console.log(`bot position ${me.x.toFixed(0)},${me.y.toFixed(0)}, zombies seen: ${Object.keys(zombies).length}`);

  // Track which bucket each zombie was in at last shot
  const _lastShotBucket = {};

  // Fire at 180ms interval (pistol fireRate) at farthest zombie in <800px range
  let tickCount = 0;
  const loop = setInterval(() => {
    tickCount++;
    const candidates = [];
    for (const id in zombies) {
      const z = zombies[id];
      if (!z || typeof z.x !== 'number' || z.health <= 0) {
continue;
}
      const d = Math.hypot(z.x - me.x, z.y - me.y);
      if (d < 800) {
candidates.push({ id, z, d });
}
    }
    if (tickCount === 5) {
      const dists = [];
      for (const id in zombies) {
        const z = zombies[id];
        if (z && typeof z.x === 'number') {
dists.push(Math.hypot(z.x - me.x, z.y - me.y).toFixed(0));
}
      }
      console.log(`tick 5: zombies dists=[${dists.join(',')}]`);
    }
    if (!candidates.length) {
return;
}
    // Target farthest in [400,800], else closest — exercises long-range path
    const far = candidates.filter(c => c.d >= 400 && c.d < 800).sort((a, b) => b.d - a.d);
    const near = candidates.sort((a, b) => a.d - b.d);
    const target = far[0] || near[0];
    const bucket = target.d < 300 ? 'close' : (target.d < 600 ? 'mid' : 'far');
    const angle = Math.atan2(target.z.y - me.y, target.z.x - me.x);
    socket.emit('shoot', { angle, x: me.x, y: me.y });
    buckets[bucket].shots++;
    // Tag target for hit attribution
    target.z._lastBucket = bucket;
  }, 190);

  await new Promise(r => setTimeout(r, 12000));
  clearInterval(loop);
  clearInterval(posKeeper);

  console.log('\n=== RANGE ANALYSIS ===');
  for (const [name, b] of Object.entries(buckets)) {
    const hitRate = b.shots > 0 ? (b.hits * 100 / b.shots).toFixed(1) : '-';
    console.log(`${name.padEnd(6)} shots=${String(b.shots).padStart(3)} hits=${String(b.hits).padStart(3)} ratio=${hitRate}%`);
  }
  const totalShots = Object.values(buckets).reduce((a, b) => a + b.shots, 0);
  const totalHits = Object.values(buckets).reduce((a, b) => a + b.hits, 0);
  console.log(`TOTAL  shots=${totalShots} hits=${totalHits} ratio=${(totalHits * 100 / totalShots).toFixed(1)}%`);

  activeSocket = null;
  socket.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
