/**
 * @fileoverview Player state factory
 * @description Builds initial player state for new socket connections.
 */

/**
 * Clamp a value between min and max (inclusive). Returns min when min > max.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  if (min > max) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

/**
 * Build initial player state for a new socket connection.
 * Skill bonuses are NOT applied here — callers must invoke applySkillBonuses separately.
 * @param {Object} config - Server CONFIG object
 * @param {string} socketId - Socket.IO socket ID (used as playerId)
 * @param {string|null} [sessionId] - Session UUID for reconnect recovery
 * @param {string|null} [accountId] - Persistent account UUID (nullable for guests)
 * @returns {import('../../types/jsdoc-types').PlayerState} Fresh player state
 */
function createPlayerState(config, socketId, sessionId = null, accountId = null) {
  const wallThickness = config.WALL_THICKNESS || 40;
  const playerSize = config.PLAYER_SIZE || 20;
  const safeMargin = wallThickness + playerSize + 20;
  const minX = wallThickness + playerSize;
  const maxX = config.ROOM_WIDTH - wallThickness - playerSize;
  const minY = wallThickness + playerSize;
  const maxY = config.ROOM_HEIGHT - wallThickness - playerSize;

  const spawnOffsetX = (Math.random() - 0.5) * 100;
  const spawnOffsetY = Math.random() * 40;
  const spawnX = clamp(config.ROOM_WIDTH / 2 + spawnOffsetX, minX, maxX);
  const spawnY = clamp(config.ROOM_HEIGHT - safeMargin - 50 - spawnOffsetY, minY, maxY);

  return {
    id: socketId,
    socketId,
    sessionId,
    accountId,
    nickname: null,
    hasNickname: false,
    spawnProtection: false,
    spawnProtectionEndTime: 0,
    invisible: false,
    invisibleEndTime: 0,
    lastActivityTime: Date.now(),
    x: spawnX,
    y: spawnY,
    health: config.PLAYER_MAX_HEALTH,
    maxHealth: config.PLAYER_MAX_HEALTH,
    level: 1,
    xp: 0,
    gold: 0,
    alive: true,
    angle: 0,
    weapon: 'pistol',
    lastShot: 0,
    speedBoost: null,
    weaponTimer: null,
    kills: 0,
    zombiesKilled: 0,
    combo: 0,
    comboTimer: 0,
    highestCombo: 0,
    totalScore: 0,
    survivalTime: Date.now(),
    upgrades: {
      maxHealth: 0,
      damage: 0,
      speed: 0,
      fireRate: 0
    },
    damageMultiplier: 1,
    speedMultiplier: 1,
    fireRateMultiplier: 1,
    regeneration: 0,
    bulletPiercing: 0,
    lifeSteal: 0,
    criticalChance: 0,
    goldMagnetRadius: 0,
    dodgeChance: 0,
    explosiveRounds: 0,
    explosionRadius: 0,
    explosionDamagePercent: 0,
    extraBullets: 0,
    thorns: 0,
    lastRegenTick: Date.now(),
    autoTurrets: 0,
    lastAutoShot: Date.now()
  };
}

module.exports = {
  createPlayerState
};
