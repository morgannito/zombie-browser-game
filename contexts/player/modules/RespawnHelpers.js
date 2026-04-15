/**
 * @fileoverview Pure helpers for player respawn logic
 */

/**
 * Captures upgrades, multipliers, level/xp and level-up stats from a player.
 * @param {object} player
 * @returns {{ upgrades, multipliers, progression, levelUpStats }}
 */
function savePlayerProgressionSnapshot(player) {
  return {
    upgrades: { ...player.upgrades },
    multipliers: {
      damage: player.damageMultiplier,
      speed: player.speedMultiplier,
      fireRate: player.fireRateMultiplier
    },
    progression: {
      level: player.level,
      xp: player.xp
    },
    levelUpStats: {
      regeneration: player.regeneration,
      bulletPiercing: player.bulletPiercing,
      lifeSteal: player.lifeSteal,
      criticalChance: player.criticalChance,
      goldMagnetRadius: player.goldMagnetRadius,
      dodgeChance: player.dodgeChance,
      explosiveRounds: player.explosiveRounds,
      explosionRadius: player.explosionRadius,
      explosionDamagePercent: player.explosionDamagePercent,
      extraBullets: player.extraBullets,
      thorns: player.thorns,
      autoTurrets: player.autoTurrets
    }
  };
}

/**
 * Resets run-specific state (health, position, run stats) without touching progression.
 * @param {object} player
 * @param {object} config - CONFIG object
 * @param {number} totalMaxHealth - pre-computed max health
 */
function resetPlayerRunState(player, config, totalMaxHealth) {
  const wallThickness = config.WALL_THICKNESS || 40;
  const playerSize = config.PLAYER_SIZE || 20;
  const safeMargin = wallThickness + playerSize + 20;

  player.nickname = null;
  player.hasNickname = false;
  player.spawnProtection = false;
  player.spawnProtectionEndTime = 0;
  player.invisible = false;
  player.invisibleEndTime = 0;

  const offsetX = (Math.random() - 0.5) * 100;
  const offsetY = Math.random() * 40;
  player.x = config.ROOM_WIDTH / 2 + offsetX;
  player.y = config.ROOM_HEIGHT - safeMargin - 50 - offsetY;

  player.health = totalMaxHealth;
  player.maxHealth = totalMaxHealth;
  player.alive = true;
  player.gold = 0;
  player.score = 0;
  player.weapon = 'pistol';
  player.speedBoost = null;
  player.weaponTimer = null;
  player.lastShot = 0;
  player.zombiesKilled = 0;
  player.kills = 0;
  player.combo = 0;
  player.comboTimer = 0;
  player.highestCombo = 0;
  player.totalScore = 0;
}

/**
 * Reapplies a progression snapshot onto a player after run reset.
 * @param {object} player
 * @param {{ upgrades, multipliers, progression, levelUpStats }} snapshot
 */
function restorePlayerProgression(player, snapshot) {
  player.level = snapshot.progression.level;
  player.xp = snapshot.progression.xp;
  player.upgrades = snapshot.upgrades;
  player.damageMultiplier = snapshot.multipliers.damage;
  player.speedMultiplier = snapshot.multipliers.speed;
  player.fireRateMultiplier = snapshot.multipliers.fireRate;

  Object.assign(player, snapshot.levelUpStats);

  player.lastRegenTick = Date.now();
  player.lastAutoShot = Date.now();
}

module.exports = {
  savePlayerProgressionSnapshot,
  resetPlayerRunState,
  restorePlayerProgression
};
