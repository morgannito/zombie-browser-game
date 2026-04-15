/**
 * @fileoverview Session recovery utilities
 * @description Shared helpers/state for disconnect recovery workflow.
 */

const { SESSION_RECOVERY_TIMEOUT } = require('../../config/constants');

const disconnectedPlayers = new Map();
const SESSION_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let sessionCleanupInterval = null;

function startSessionCleanupInterval(logger) {
  stopSessionCleanupInterval();
  sessionCleanupInterval = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, data] of disconnectedPlayers.entries()) {
      if (now - data.disconnectedAt > SESSION_RECOVERY_TIMEOUT) {
        disconnectedPlayers.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0 && logger) {
      logger.info('Session recovery cleanup', { cleanedCount, expiredSessions: cleanedCount });
    }
  }, 60000);
  if (typeof sessionCleanupInterval.unref === 'function') {
    sessionCleanupInterval.unref();
  }
}

function stopSessionCleanupInterval() {
  if (sessionCleanupInterval) {
    clearInterval(sessionCleanupInterval);
    sessionCleanupInterval = null;
  }
}

function normalizeSessionId(sessionId) {
  if (typeof sessionId !== 'string') {
    return null;
  }
  const trimmed = sessionId.trim();
  return SESSION_ID_REGEX.test(trimmed) ? trimmed : null;
}

function sanitizePlayerState(player) {
  if (!player || typeof player !== 'object') {
    return player;
  }
  const sanitized = Object.assign(Object.create(null), player);
  delete sanitized.sessionId;
  delete sanitized.socketId;
  delete sanitized.accountId;
  return sanitized;
}

function sanitizePlayersState(players) {
  const sanitized = {};
  for (const id in players) {
    sanitized[id] = sanitizePlayerState(players[id]);
  }
  return sanitized;
}

function createRecoverablePlayerState(player) {
  return {
    id: player.id,
    accountId: player.accountId || null,
    nickname: player.nickname,
    hasNickname: player.hasNickname,
    spawnProtection: player.spawnProtection,
    spawnProtectionEndTime: player.spawnProtectionEndTime,
    invisible: player.invisible,
    invisibleEndTime: player.invisibleEndTime,
    lastActivityTime: player.lastActivityTime,
    x: player.x,
    y: player.y,
    health: player.health,
    maxHealth: player.maxHealth,
    level: player.level,
    xp: player.xp,
    gold: player.gold,
    score: player.score,
    alive: player.alive,
    angle: player.angle,
    weapon: player.weapon,
    lastShot: player.lastShot,
    speedBoost: player.speedBoost,
    weaponTimer: player.weaponTimer,
    kills: player.kills,
    zombiesKilled: player.zombiesKilled,
    combo: player.combo,
    comboTimer: player.comboTimer,
    highestCombo: player.highestCombo,
    totalScore: player.totalScore,
    survivalTime: player.survivalTime,
    upgrades: { ...player.upgrades },
    damageMultiplier: player.damageMultiplier,
    speedMultiplier: player.speedMultiplier,
    fireRateMultiplier: player.fireRateMultiplier,
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
    lastRegenTick: player.lastRegenTick,
    autoTurrets: player.autoTurrets,
    lastAutoShot: player.lastAutoShot
  };
}

function restoreRecoverablePlayerState(savedState, socketId, sessionId, accountId) {
  return {
    ...savedState,
    id: socketId,
    socketId,
    sessionId,
    accountId,
    lastActivityTime: Date.now()
  };
}

function getDisconnectedSessionCount() {
  return disconnectedPlayers.size;
}

module.exports = {
  disconnectedPlayers,
  startSessionCleanupInterval,
  stopSessionCleanupInterval,
  normalizeSessionId,
  sanitizePlayersState,
  createRecoverablePlayerState,
  restoreRecoverablePlayerState,
  getDisconnectedSessionCount
};
