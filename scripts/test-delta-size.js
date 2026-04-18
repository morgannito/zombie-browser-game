#!/usr/bin/env node
// Delta inspector: sample 5 deltas and print their JSON structure + sizes.
// Identifies redundant fields / bloated payloads.

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
  const l = await login('ins' + Date.now().toString().slice(-6));
  const socket = io(BASE, { auth: { token: l.token }, transports: ['websocket'], parser: msgpackParser });
  activeSocket = socket;

  socket.on('init', _d => socket.emit('setNickname', { nickname: 'ins_' + Date.now().toString().slice(-4) }));

  await new Promise(r => setTimeout(r, 1500));

  let count = 0;
  const fieldHistogram = {};
  const fieldBytes = {};

  socket.on('gameStateDelta', d => {
    count++;
    if (count <= 1) {
      console.log(`\n--- DELTA #${count} (${JSON.stringify(d).length}B) ---`);
      console.log('top-level keys:', Object.keys(d));
      for (const k of Object.keys(d)) {
        const size = JSON.stringify(d[k]).length;
        console.log(`  ${k.padEnd(15)} ${size}B`, typeof d[k] === 'object' && d[k] !== null ? '(obj, ' + Object.keys(d[k]).length + ' keys)' : '');
      }
      if (d.updated) {
        console.log('updated sub-keys:');
        for (const k of Object.keys(d.updated)) {
          const s = JSON.stringify(d.updated[k]).length;
          const n = Array.isArray(d.updated[k]) ? d.updated[k].length : Object.keys(d.updated[k] || {}).length;
          console.log(`  updated.${k.padEnd(15)} ${s}B (${n} items)`);
        }
      }
      if (d.removed) {
        console.log('removed sub-keys:');
        for (const k of Object.keys(d.removed)) {
          const s = JSON.stringify(d.removed[k]).length;
          const n = Array.isArray(d.removed[k]) ? d.removed[k].length : Object.keys(d.removed[k] || {}).length;
          console.log(`  removed.${k.padEnd(15)} ${s}B (${n} items)`);
        }
      }
    }
    // Aggregate field histogram across all zombie patches
    if (d.updated?.zombies) {
      for (const zid in d.updated.zombies) {
        const patch = d.updated.zombies[zid];
        for (const k in patch) {
          fieldHistogram[k] = (fieldHistogram[k] || 0) + 1;
          fieldBytes[k] = (fieldBytes[k] || 0) + JSON.stringify(patch[k]).length;
        }
      }
    }
  });

  await new Promise(r => setTimeout(r, 5000));

  console.log('\n=== FIELD HISTOGRAM (across all zombie patches) ===');
  const sorted = Object.entries(fieldHistogram).sort((a,b) => b[1] - a[1]);
  for (const [k, c] of sorted) {
    console.log(`  ${k.padEnd(18)}: ${c.toString().padStart(4)} occurrences, ${fieldBytes[k]} bytes total`);
  }

  socket.disconnect();
  process.exit(0);
}

run().catch(e => {
 console.error(e); process.exit(1);
});
