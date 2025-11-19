/**
 * @fileoverview Game state initialization
 * @description Initializes and exports the central game state object
 * - Players, zombies, bullets, powerups, particles
 * - Poison trails, loot, explosions
 * - Walls, rooms, wave management
 * - Permanent upgrades
 */

/**
 * Initialize game state
 * @returns {Object} Initial game state
 */
function initializeGameState() {
  return {
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
    permanentUpgrades: {
      maxHealthUpgrade: 0,
      damageUpgrade: 0,
      speedUpgrade: 0,
      goldMultiplier: 1
    }
  };
}

module.exports = {
  initializeGameState
};
