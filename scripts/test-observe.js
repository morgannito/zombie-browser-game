#!/usr/bin/env node
// Observe what the server sends to clients: snapshot cadence, zombie deltas,
// bullet deltas, position corrections. Connects, sets a nickname, does nothing,
// and reports for 8 seconds.

const { io } = require('socket.io-client');
const http = require('http');
const msgpackParser = require('socket.io-msgpack-parser');

const BASE = 'http://127.0.0.1:3000';

function httpLogin(username) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ username });
    const req = http.request(
      BASE + '/api/v1/auth/login',
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': body.length } },
      res => { let d=''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e){reject(e);} }); }
    );
    req.on('error', reject); req.write(body); req.end();
  });
}

async function run() {
  const login = await httpLogin('obs' + Date.now().toString().slice(-6));
  const socket = io(BASE, { auth: { token: login.token }, transports: ['websocket'], parser: msgpackParser });

  let myId = null;
  const stats = {
    gameStateBytes: 0, deltaBytes: 0,
    gameStateCount: 0, deltaCount: 0, emptyDeltaCount: 0,
    zombieUpdates: 0, bulletUpdates: 0, playerUpdates: 0,
    zombieRemovals: 0, bulletRemovals: 0
  };

  socket.on('connect', () => console.log('[obs] connected', socket.id));
  socket.on('disconnect', r => console.log('[obs] disconnect:', r));
  socket.on('init', d => {
    myId = d.playerId;
    socket.emit('setNickname', { nickname: 'obs_' + Date.now().toString().slice(-5) });
  });

  socket.on('gameState', s => {
    stats.gameStateCount++;
    stats.gameStateBytes += JSON.stringify(s).length;
  });

  socket.on('gameStateDelta', d => {
    stats.deltaCount++;
    stats.deltaBytes += JSON.stringify(d).length;
    const zu = Object.keys(d.updated?.zombies || {}).length;
    const bu = Object.keys(d.updated?.bullets || {}).length;
    const pu = Object.keys(d.updated?.players || {}).length;
    if (zu + bu + pu === 0) stats.emptyDeltaCount++;
    stats.zombieUpdates += zu;
    stats.bulletUpdates += bu;
    stats.playerUpdates += pu;
    stats.zombieRemovals += (d.removed?.zombies || []).length;
    stats.bulletRemovals += (d.removed?.bullets || []).length;
  });

  // Wait connected + nickname set
  await new Promise(r => setTimeout(r, 1500));
  console.log('[obs] baseline ready, observing 8s...');

  // Reset stats
  Object.keys(stats).forEach(k => stats[k] = 0);

  const t0 = Date.now();
  await new Promise(r => setTimeout(r, 8000));
  const elapsed = (Date.now() - t0) / 1000;

  console.log('\n=== OBSERVATION RESULTS ===');
  console.log(`elapsed: ${elapsed.toFixed(1)}s`);
  console.log(`gameState: ${stats.gameStateCount} (${(stats.gameStateCount/elapsed).toFixed(1)}Hz, ${(stats.gameStateBytes/1024).toFixed(1)} KB)`);
  console.log(`gameStateDelta: ${stats.deltaCount} (${(stats.deltaCount/elapsed).toFixed(1)}Hz, ${(stats.deltaBytes/1024).toFixed(1)} KB)`);
  console.log(`empty deltas: ${stats.emptyDeltaCount}`);
  console.log(`zombie updates: ${stats.zombieUpdates} (${(stats.zombieUpdates/elapsed).toFixed(0)}/s)`);
  console.log(`bullet updates: ${stats.bulletUpdates} (${(stats.bulletUpdates/elapsed).toFixed(0)}/s)`);
  console.log(`player updates: ${stats.playerUpdates} (${(stats.playerUpdates/elapsed).toFixed(0)}/s)`);
  console.log(`zombie removals: ${stats.zombieRemovals}`);
  console.log(`bullet removals: ${stats.bulletRemovals}`);
  console.log(`TOTAL bandwidth: ${((stats.gameStateBytes + stats.deltaBytes)/1024/elapsed).toFixed(1)} KB/s`);

  socket.disconnect();
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
