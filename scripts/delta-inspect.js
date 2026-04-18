'use strict';

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

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
    const r = http.request('http://127.0.0.1:3000/api/v1/auth/login',
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

(async () => {
  const l = await login('ins' + Date.now().toString().slice(-6));
  const socket = io('http://127.0.0.1:3000', { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });
  activeSocket = socket;
  let count = 0;
  let hasX = 0, hasY = 0, zombieCount = 0;
  socket.on('gameStateDelta', d => {
    count++;
    for (const id in d.updated?.zombies || {}) {
      const p = d.updated.zombies[id];
      zombieCount++;
      if (typeof p.x === 'number') {
hasX++;
}
      if (typeof p.y === 'number') {
hasY++;
}
    }
    if (count === 60) {
      console.log(`after 60 deltas: ${zombieCount} zombie patches, ${hasX} with x, ${hasY} with y`);
      socket.disconnect();
      process.exit(0);
    }
  });
  socket.on('init', _d => socket.emit('setNickname', { nickname: 'ins_' + Date.now().toString().slice(-4) }));
})();
