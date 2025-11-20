/**
 * @fileoverview Game constants
 * @description Centralized game-specific constants to replace magic numbers
 */

/**
 * Player constants
 */
const PLAYER_CONSTANTS = {
  // Spawn protection
  SPAWN_PROTECTION_DURATION: 3000, // 3 seconds

  // Movement and combat
  MIN_MOVEMENT_ALLOWANCE: 20, // Minimum movement allowance for anti-cheat
  MAX_SPEED_MULTIPLIER: 5, // Maximum allowed speed multiplier

  // Bullets
  MAX_TOTAL_BULLETS: 50, // Maximum bullets allowed per player (anti-cheat)

  // Shop
  SHOP_INVISIBILITY_DURATION: Infinity // Player is invisible while shop is open
};

/**
 * Session and network constants
 */
const SESSION_CONSTANTS = {
  // Session recovery
  SESSION_CLEANUP_INTERVAL: 60000, // Check every minute (60 seconds)

  // Activity tracking
  HEARTBEAT_TIMEOUT: 30000, // 30 seconds before considering player inactive
  INACTIVITY_TIMEOUT: 60000 // 60 seconds before disconnecting inactive player
};

/**
 * Validation constants
 */
const VALIDATION_CONSTANTS = {
  // Nickname
  MIN_NICKNAME_LENGTH: 2,
  MAX_NICKNAME_LENGTH: 20,

  // Gold
  MIN_GOLD_AMOUNT: 0,
  MAX_GOLD_AMOUNT: 999999,

  // Level
  MIN_LEVEL: 1,
  MAX_LEVEL: 100,

  // Wave
  MIN_WAVE: 1,
  MAX_WAVE: 1000
};

/**
 * Combat constants
 */
const COMBAT_CONSTANTS = {
  // Damage
  CRITICAL_HIT_MULTIPLIER: 2.0,
  HEADSHOT_MULTIPLIER: 1.5,

  // Effects
  POISON_TICK_INTERVAL: 1000, // 1 second
  BURN_TICK_INTERVAL: 500, // 0.5 seconds
  FREEZE_DURATION: 2000, // 2 seconds

  // Regeneration
  HEALTH_REGEN_INTERVAL: 1000, // 1 second
  HEALTH_REGEN_AMOUNT: 1
};

/**
 * Particle effect constants
 */
const PARTICLE_CONSTANTS = {
  // Death effects
  ZOMBIE_DEATH_PARTICLES: 8,
  PLAYER_DEATH_PARTICLES: 15,
  BOSS_DEATH_PARTICLES: 20,

  // Hit effects
  HIT_PARTICLES: 5,
  CRITICAL_HIT_PARTICLES: 10,

  // Explosions
  LARGE_EXPLOSION_PARTICLES: 20,
  MEDIUM_EXPLOSION_PARTICLES: 12,
  SMALL_EXPLOSION_PARTICLES: 6
};

/**
 * Economy constants
 */
const ECONOMY_CONSTANTS = {
  // Loot
  MIN_GOLD_DROP: 1,
  MAX_GOLD_DROP: 10,
  BOSS_GOLD_MULTIPLIER: 5,

  // XP
  BASE_XP_PER_KILL: 10,
  BOSS_XP_MULTIPLIER: 10
};

/**
 * Performance constants
 */
const PERFORMANCE_CONSTANTS = {
  // Frame rates
  TARGET_FPS: 60,
  MIN_FPS: 30,
  MAX_FPS: 120,

  // Tick rates
  GAME_TICK_RATE: 1000 / 60, // ~16.67ms (60 FPS)
  SLOW_TICK_RATE: 1000 / 30, // ~33.33ms (30 FPS)

  // Limits
  MAX_ENTITIES: 1000,
  MAX_PARTICLES: 500,
  MAX_ZOMBIES_PER_WAVE: 100
};

module.exports = {
  PLAYER_CONSTANTS,
  SESSION_CONSTANTS,
  VALIDATION_CONSTANTS,
  COMBAT_CONSTANTS,
  PARTICLE_CONSTANTS,
  ECONOMY_CONSTANTS,
  PERFORMANCE_CONSTANTS
};
