/**
 * PRNG.js — Seeded pseudo-random number generator (xorshift32)
 *
 * Usage:
 *   import { createPRNG } from './PRNG.js';
 *   const rng = createPRNG(seed);      // seed: integer (e.g. wave number, timestamp)
 *   rng.random();                       // drop-in for Math.random() → [0, 1)
 *   rng.randInt(min, max);              // replaces MathUtils.randInt
 *   rng.randFloat(min, max);            // replaces MathUtils.randFloat
 *   rng.pick(array);                    // replaces array[Math.floor(Math.random() * array.length)]
 *   rng.chance(probability);            // replaces Math.random() < probability
 *
 * Candidates to migrate (game logic, runtime):
 *   1. ZombieFactory.js:45-46       — spawn position (x, y)
 *   2. ZombieFactory.js:77          — elite zombie roll (wave >= 5)
 *   3. ZombieFactory.js:227-228     — spawn angle + distance offset
 *   4. ZombieSpawnManager.js:124    — pick random zombie type (allTypes)
 *   5. ZombieSpawnManager.js:170-175 — elite vs normal selection
 *   6. SpecialZombieUpdater.js:55   — teleporter range
 *   7. SpecialZombieUpdater.js:379  — random type pick on split
 *   8. randomWalk.js:20,46,57       — zombie walk angle / heading variance
 *   9. SkillEffectsApplicator.js:216 — dodge chance roll
 *  10. RunMutatorManager.js:75      — mutator pool shuffle
 *
 * NOT targeted (cosmetic/ephemeral, ok as Math.random):
 *   - ParticlePool.js (visual only, server-side particles)
 *   - BossUpdaterSimple.js toxic IDs (uniqueness, not gameplay)
 *
 * Seed strategy (suggested):
 *   - Per wave: seed = baseSeed ^ (wave * 0x9e3779b9)
 *   - baseSeed: fixed per run (e.g. room ID hash or user-provided)
 */

/**
 * @param {number} seed - 32-bit unsigned integer seed
 * @returns {{ random: () => number, randInt: (min: number, max: number) => number, randFloat: (min: number, max: number) => number, pick: (arr: any[]) => any, chance: (p: number) => boolean, getSeed: () => number }}
 */
export function createPRNG(seed) {
  // xorshift32 — period 2^32-1, fast, sufficient for game logic
  let state = (seed >>> 0) || 1; // must be non-zero

  function next() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0); // unsigned 32-bit
  }

  return {
    /** Drop-in for Math.random() */
    random() {
      return next() / 0x100000000;
    },

    /** Inclusive integer in [min, max] */
    randInt(min, max) {
      return Math.floor(this.random() * (max - min + 1)) + min;
    },

    /** Float in [min, max) */
    randFloat(min, max) {
      return this.random() * (max - min) + min;
    },

    /** Pick random element from array */
    pick(arr) {
      return arr[Math.floor(this.random() * arr.length)];
    },

    /** Returns true with probability p ∈ [0, 1] */
    chance(p) {
      return this.random() < p;
    },

    /** Current internal state (for serialization/replay) */
    getSeed() {
      return state;
    }
  };
}
