/**
 * @fileoverview Game state initialization
 * @description Initializes and exports the central game state object
 * - Players, zombies, bullets, powerups, particles
 * - Poison trails, loot, explosions
 * - Walls, rooms, wave management
 * - Permanent upgrades
 * - SSS FIX: Safe ID counter with rollover protection
 */

// MEDIUM FIX: Maximum safe integer for ID counters (prevents overflow)
const MAX_SAFE_ID = Number.MAX_SAFE_INTEGER - 1000; // Safety margin

// LOW FIX: Import logger for structured logging
const logger = require('../lib/infrastructure/Logger');

/**
 * Initialize game state with all entities and safe ID counters
 * @returns {Object} Game state object containing:
 *   - players: Map of active players {playerId: playerObject}
 *   - zombies: Map of zombies {zombieId: zombieObject}
 *   - bullets: Map of bullets {bulletId: bulletObject}
 *   - powerups: Map of powerups {powerupId: powerupObject}
 *   - particles: Map of particles {particleId: particleObject}
 *   - poisonTrails: Map of poison trails {trailId: trailObject}
 *   - loot: Map of loot drops {lootId: lootObject}
 *   - explosions: Map of explosions {explosionId: explosionObject}
 *   - walls: Array of wall collision rectangles
 *   - rooms: Array of room definitions (rogue-like system)
 *   - currentRoom: Index of current active room (0-based)
 *   - bossSpawned: Boolean flag for boss spawn state
 *   - nextZombieId: Safe ID counter for zombies (with overflow protection)
 *   - nextBulletId: Safe ID counter for bullets
 *   - nextPowerupId: Safe ID counter for powerups
 *   - nextParticleId: Safe ID counter for particles
 *   - nextPoisonTrailId: Safe ID counter for poison trails
 *   - nextLootId: Safe ID counter for loot
 *   - nextExplosionId: Safe ID counter for explosions
 *   - wave: Current wave number (starts at 1)
 *   - zombiesKilledThisWave: Kill counter for current wave
 *   - zombiesSpawnedThisWave: Spawn counter for current wave
 *   - permanentUpgrades: Object tracking permanent player upgrades
 *   - getNextId(counterName): Safe ID generator with overflow protection
 * @example
 *   const gameState = initializeGameState();
 *   const zombieId = gameState.getNextId('nextZombieId');
 */
function initializeGameState() {
  const state = {
    players: {},
    zombies: {},
    bullets: {},
    powerups: {},
    particles: {},
    poisonTrails: {},
    loot: {},
    explosions: {},
    walls: [],
    rooms: [],
    currentRoom: 0,
    bossSpawned: false,
    nextZombieId: 0,
    nextBulletId: 0,
    nextPowerupId: 0,
    nextParticleId: 0,
    nextPoisonTrailId: 0,
    nextLootId: 0,
    nextExplosionId: 0,
    wave: 1,
    zombiesKilledThisWave: 0,
    zombiesSpawnedThisWave: 0,
    activeMutators: [],
    mutatorEffects: {
      zombieHealthMultiplier: 1,
      zombieDamageMultiplier: 1,
      zombieSpeedMultiplier: 1,
      spawnCountMultiplier: 1,
      spawnIntervalMultiplier: 1,
      playerDamageMultiplier: 1,
      playerFireRateCooldownMultiplier: 1
    },
    nextMutatorWave: 0,
    permanentUpgrades: {
      maxHealthUpgrade: 0,
      damageUpgrade: 0,
      speedUpgrade: 0,
      goldMultiplier: 1
    },

    // MEDIUM FIX: Safe ID generator with rollover protection
    /**
     * Get next ID with overflow protection
     * @param {string} counterName - Name of the counter (e.g., 'nextZombieId')
     * @returns {number} Next safe ID
     */
    getNextId(counterName) {
      // Validate counter exists
      if (typeof this[counterName] !== 'number') {
        logger.error('❌ Invalid ID counter', { counterName });
        this[counterName] = 0;
      }

      // Check for overflow risk
      if (this[counterName] >= MAX_SAFE_ID) {
        logger.warn('⚠️  ID counter approaching maximum, rolling over', { counterName });
        this[counterName] = 0;
      }

      return this[counterName]++;
    }
  };

  return state;
}

module.exports = {
  initializeGameState
};
