#!/usr/bin/env node
// Load test: N concurrent bots, metrics: delta Hz, RTT, disconnects, errors, bytes

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

// --- CLI args ---
const args = Object.fromEntries(
  process.argv.slice(2).map(a => a.replace('--', '').split('='))
);
const N = parseInt(args.bots || '5');
const DURATION = parseInt((args.duration || '30s').replace('s', '')) * 1000;
const PORT = parseInt(args.port || '3001');
const BASE = `http://127.0.0.1:${PORT}`;

// --- HTTP login ---
function login(username) {
  return new Promise((res, rej) => {
    const body = JSON.stringify({ username });
    const req = http.request(BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      rs => {
 let d = ''; rs.on('data', c => d += c); rs.on('end', () => {
 try {
 res(JSON.parse(d));
} catch (e) {
 rej(e);
}
});
});
    req.on('error', rej); req.write(body); req.end();
  });
}

// --- Single bot ---
async function runBot(id) {
  const stats = { deltaCount: 0, rttSum: 0, rttCount: 0, errors: 0, disconnects: 0, bytes: 0, startTime: Date.now() };
  let token, myId, me;

  try {
    const auth = await login('bot_' + id + '_' + Date.now().toString().slice(-4));
    token = auth.token;
    if (!token) {
throw new Error('No token: ' + JSON.stringify(auth));
}
  } catch (e) {
 stats.errors++; return stats;
}

  const socket = io(BASE, { auth: { token }, transports: ['websocket'], parser: msgpackParser });

  socket.on('connect_error', () => stats.errors++);
  socket.on('disconnect', () => stats.disconnects++);

  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'bot' + id });
  });

  socket.on('gameState', s => {
    if (s.players?.[myId]) {
me = s.players[myId];
}
    stats.deltaCount++;
    stats.bytes += JSON.stringify(s).length;
  });

  socket.on('gameStateDelta', d => {
    if (d.updated?.players?.[myId]) {
      const p = d.updated.players[myId];
      if (me && typeof p.x === 'number') {
 me.x = p.x; me.y = p.y;
}
    }
    stats.deltaCount++;
    stats.bytes += JSON.stringify(d).length;
  });

  await new Promise(r => setTimeout(r, 1500));

  // Random actions loop
  const loop = setInterval(() => {
    if (!me) {
return;
}
    const dx = (Math.random() - 0.5) * 10;
    const dy = (Math.random() - 0.5) * 10;
    const x = me.x + dx;
    const y = me.y + dy;
    const angle = Math.random() * Math.PI * 2;
    socket.emit('playerMove', { x, y, angle });
    if (Math.random() < 0.4) {
socket.emit('shoot', { angle, x, y });
}

    // RTT ping
    const t0 = Date.now();
    socket.emit('ping', {}, () => {
 stats.rttSum += Date.now() - t0; stats.rttCount++;
});
  }, 100);

  await new Promise(r => setTimeout(r, DURATION));
  clearInterval(loop);
  socket.disconnect();
  stats.elapsed = Date.now() - stats.startTime;
  return stats;
}

// --- Aggregate & display ---
function printTable(allStats) {
  const total = allStats.length;
  const sum = (k) => allStats.reduce((a, s) => a + (s[k] || 0), 0);
  const elapsed = allStats.reduce((a, s) => Math.max(a, s.elapsed || DURATION), 0) / 1000;

  const avgHz = (sum('deltaCount') / total / elapsed).toFixed(2);
  const avgRtt = allStats.filter(s => s.rttCount > 0).map(s => s.rttSum / s.rttCount);
  const rttAvg = avgRtt.length ? (avgRtt.reduce((a, b) => a + b, 0) / avgRtt.length).toFixed(1) : 'n/a';
  const totalBytes = sum('bytes');
  const disconnects = sum('disconnects');
  const errors = sum('errors');

  const rows = [
    ['Bots', total],
    ['Duration (s)', (DURATION / 1000)],
    ['Avg delta rate (Hz)', avgHz],
    ['Avg RTT (ms)', rttAvg],
    ['Total bytes received', totalBytes.toLocaleString()],
    ['Disconnects', disconnects],
    ['Errors', errors]
  ];

  const colW = [22, 20];
  const line = '+' + '-'.repeat(colW[0] + 2) + '+' + '-'.repeat(colW[1] + 2) + '+';
  console.log('\n' + line);
  console.log(`| ${'Metric'.padEnd(colW[0])} | ${'Value'.padEnd(colW[1])} |`);
  console.log(line);
  for (const [k, v] of rows) {
    console.log(`| ${k.padEnd(colW[0])} | ${String(v).padEnd(colW[1])} |`);
  }
  console.log(line + '\n');
}

// --- Main ---
async function main() {
  console.log(`Load test: ${N} bots, ${DURATION / 1000}s, ${BASE}`);
  const promises = Array.from({ length: N }, (_, i) => runBot(i + 1));
  const allStats = await Promise.all(promises);
  printTable(allStats);
  process.exit(0);
}

main().catch(e => {
 console.error(e); process.exit(1);
});
