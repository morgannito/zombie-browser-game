/**
 * runPRNG.js — Module-level singleton wrapper around PRNG for server-side run logic.
 * Exposes a stable RNG instance that is reset at the start of each run.
 *
 * Usage:
 *   const { runPRNG, resetRunPRNG } = require('./runPRNG');
 *   resetRunPRNG(Date.now());   // call once at run start
 *   runPRNG.random();           // use anywhere during the run
 */

'use strict';

// Inline xorshift32 to avoid ESM interop — mirrors lib/PRNG.js exactly.
function createPRNG(seed) {
  let state = (seed >>> 0) || 1;

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  }

  return {
    random() {
 return next() / 0x100000000;
},
    randInt(min, max) {
 return Math.floor(this.random() * (max - min + 1)) + min;
},
    randFloat(min, max) {
 return this.random() * (max - min) + min;
},
    pick(arr) {
 return arr[Math.floor(this.random() * arr.length)];
},
    chance(p) {
 return this.random() < p;
},
    getSeed() {
 return state;
}
  };
}

let _instance = createPRNG(Date.now());

/** Drop-in seeded RNG for the current run. */
const runPRNG = new Proxy({}, {
  get(_t, prop) {
 return _instance[prop].bind(_instance);
}
});

/**
 * Reset the run RNG with a new seed.
 * Call once at the start of each run (e.g. seed = Date.now()).
 * @param {number} seed
 */
function resetRunPRNG(seed) {
  _instance = createPRNG(seed);
}

module.exports = { runPRNG, resetRunPRNG };
