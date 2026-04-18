/**
 * Shared constants for zombie context modules.
 * Centralises magic numbers that appear in multiple modules.
 */

/** Milliseconds between zombie contact damage ticks. */
const DAMAGE_INTERVAL = 100;

/** Maximum zombie movement speed in pixels per frame (60fps = 900px/s). */
const ZOMBIE_MAX_SPEED = 15;

/** Milliseconds between boss aura/shield periodic effect ticks. */
const AURA_EFFECT_INTERVAL = 1000;

/** 70% multiplier — boss clone size, revived minion damage, etc. */
const MULTIPLIER_70_PCT = 0.7;

/** Damage multiplier applied to boss clones relative to original. */
const CLONE_DAMAGE_MULTIPLIER = 0.5;

/** Speed multiplier applied to boss clones relative to original. */
const CLONE_SPEED_MULTIPLIER = 1.2;

/** Minimum distance (px) from player when boss teleports. */
const BOSS_TELEPORT_DISTANCE_MIN = 150;

/** Default particle count for standard combat/ability effects. */
const PARTICLES_DEFAULT_COUNT = 15;

module.exports = {
  DAMAGE_INTERVAL,
  ZOMBIE_MAX_SPEED,
  AURA_EFFECT_INTERVAL,
  MULTIPLIER_70_PCT,
  CLONE_DAMAGE_MULTIPLIER,
  CLONE_SPEED_MULTIPLIER,
  BOSS_TELEPORT_DISTANCE_MIN,
  PARTICLES_DEFAULT_COUNT,
};
