#!/usr/bin/env node
// Multi-client stress: spawn N concurrent bots, measure server behaviour
// under load.

'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';
const NB = parseInt(process.argv[2] || '5', 10);
const DURATION = parseInt(process.argv[3] || '15', 10);

/** @type {{socket:import('socket.io-client').Socket}[]} */
let allBots = [];
function shutdown() {
  for (const b of allBots) {
    try { b.socket.disconnect(); } catch (_) { /* ignore */ }
  }
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

async function makeBot(idx) {
  const l = await login('mb' + idx + '_' + Date.now().toString().slice(-5));
  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });

  const state = {
    id: idx, myId: null, me: null, zombies: {},
    bytesIn: 0, deltaCount: 0, fullCount: 0, killsObserved: 0,
    disconnected: false
  };

  socket.on('init', d => {
    state.myId = d.playerId;
    socket.emit('setNickname', { nickname: 'mb' + idx });
  });
  socket.on('disconnect', () => {
 state.disconnected = true;
});
  socket.on('gameState', s => {
    state.fullCount++;
    state.bytesIn += JSON.stringify(s).length;
    if (s.players?.[state.myId]) {
state.me = s.players[state.myId];
}
    for (const id in s.zombies) {
state.zombies[id] = s.zombies[id];
}
  });
  socket.on('gameStateDelta', d => {
    state.deltaCount++;
    state.bytesIn += JSON.stringify(d).length;
    if (d.updated?.players?.[state.myId]) {
      const p = d.updated.players[state.myId];
      if (typeof p.x === 'number') {
state.me && (state.me.x = p.x);
}
      if (typeof p.y === 'number') {
state.me && (state.me.y = p.y);
}
    }
    for (const id in d.updated?.zombies || {}) {
      const z = d.updated.zombies[id];
      if (!state.zombies[id]) {
state.zombies[id] = z;
} else {
Object.assign(state.zombies[id], z);
}
    }
    for (const id of d.removed?.zombies || []) {
      if (state.zombies[id]) {
 state.killsObserved++; delete state.zombies[id];
}
    }
  });

  return { socket, state };
}

async function run() {
  console.log(`Spawning ${NB} bots...`);
  const bots = [];
  for (let i = 0; i < NB; i++) {
    bots.push(await makeBot(i));
    await new Promise(r => setTimeout(r, 150));
  }
  allBots = bots;
  console.log(`${NB} connected, waiting 2s for nickname/init...`);
  await new Promise(r => setTimeout(r, 2000));

  const alive = bots.filter(b => !b.state.disconnected);
  console.log(`${alive.length}/${NB} alive after init`);

  // Each bot: shoot + move in a loop
  const loops = alive.map(({ socket, state }) => {
    let seq = 10000, angle = 0;
    return setInterval(() => {
      if (state.disconnected) {
return;
}
      angle += 0.3;
      socket.emit('shoot', { angle });
      if (state.me) {
        socket.emit('playerMove', {
          x: state.me.x + Math.cos(angle) * 20,
          y: state.me.y + Math.sin(angle) * 20,
          angle, seq: seq++
        });
      }
    }, 60);
  });

  const t0 = Date.now();
  await new Promise(r => setTimeout(r, DURATION * 1000));
  loops.forEach(clearInterval);
  const elapsed = (Date.now() - t0) / 1000;

  console.log(`\n=== MULTI-CLIENT RESULTS (${DURATION}s, ${alive.length} bots) ===`);
  let totalBytes = 0, totalDeltas = 0, totalKills = 0, totalDisconnects = 0;
  for (const { state } of alive) {
    if (state.disconnected) {
totalDisconnects++;
}
    totalBytes += state.bytesIn;
    totalDeltas += state.deltaCount;
    totalKills += state.killsObserved;
  }
  console.log(`per-bot avg bandwidth: ${(totalBytes / alive.length / 1024 / elapsed).toFixed(1)} KB/s`);
  console.log(`per-bot avg delta rate: ${(totalDeltas / alive.length / elapsed).toFixed(1)} Hz`);
  console.log(`total kills observed (sum across bots): ${totalKills}`);
  console.log(`disconnects during run: ${totalDisconnects}`);
  console.log(`aggregate server egress: ${(totalBytes / 1024 / elapsed).toFixed(1)} KB/s`);

  bots.forEach(b => b.socket.disconnect());
  process.exit(0);
}

run().catch(e => {
 console.error(e); process.exit(1);
});
