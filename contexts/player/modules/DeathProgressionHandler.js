/**
 * @fileoverview Player death progression - second chance, retry queue, and cleanup
 */

const { GAMEPLAY_CONSTANTS } = require('../../../lib/server/ConfigManager');
const { getTelemetryCollector } = require('../../../infrastructure/telemetry/TelemetryCollector');

const RETRY_INTERVAL_MS = 30000;
const MAX_RETRIES = 3;

/**
 * Handle player death with progression integration and retry mechanism.
 * @param {Object} player - Player state object
 * @param {string} playerId - Socket ID of the player
 * @param {Object} gameState - Global game state
 * @param {number} now - Current timestamp (ms)
 * @param {boolean} [isBoss=false] - Whether death was caused by a boss
 * @param {Object} [logger] - Logger instance
 * @returns {boolean} True if player was revived by second chance
 */
function handlePlayerDeathProgression(player, playerId, gameState, now, isBoss = false, logger) {
  if (!player || typeof player !== 'object') {
    if (logger) {
      logger.error('Invalid player object in handlePlayerDeathProgression', { playerId });
    }
    return false;
  }

  if (typeof player.health !== 'number') {
    if (logger) {
      logger.warn('Player has invalid health value', { playerId, health: player.health });
    }
    player.health = 0;
  }

  if (player.health > 0) {
    return false;
  }

  if (!player.alive) {
    player.health = 0;
    return false;
  }

  player.health = 0;
  const revived = gameState.progressionIntegration?.checkSecondChance(player);

  const tc = getTelemetryCollector();
  tc.record('death');
  if (isBoss) {
tc.record('boss_kill');
}

  if (!revived) {
    _markPlayerDead(player, gameState, now, isBoss, playerId, logger);
  }

  return revived;
}

/**
 * Mark player dead and trigger progression save (async, with retry on failure)
 */
function _markPlayerDead(player, gameState, now, isBoss, playerId, logger) {
  player.alive = false;

  if (!gameState.progressionIntegration || !player.accountId) {
    return;
  }

  const sessionStats = _buildSessionStats(player, gameState, now, isBoss);

  gameState.progressionIntegration
    .handlePlayerDeath(player, player.accountId, sessionStats)
    .catch(err => {
      _onDeathSaveFailed(err, player, playerId, sessionStats, now, gameState, logger);
    });
}

/**
 * Build session stats snapshot at time of death
 */
function _buildSessionStats(player, gameState, now, isBoss) {
  const startedAt = typeof player.survivalStartedAt === 'number'
    ? player.survivalStartedAt
    : (typeof player.survivalTime === 'number' && player.survivalTime > 1e12 ? player.survivalTime : now);
  const multiplier = GAMEPLAY_CONSTANTS.SURVIVAL_TIME_MULTIPLIER || 1000;
  const survivalSeconds = Math.max(0, Math.min(Math.floor((now - startedAt) / multiplier), 86_400));

  player.wave = gameState.wave;
  player.maxCombo = player.highestCombo || player.combo || 0;
  player.bossKills = isBoss ? 1 : 0;
  player.survivalStartedAt = startedAt;

  return {
    wave: Math.max(1, gameState.wave || 1),
    level: Math.max(1, player.level || 1),
    kills: Math.max(0, player.zombiesKilled || player.kills || 0),
    survivalTimeSeconds: survivalSeconds,
    comboMax: Math.max(0, player.maxCombo || 0),
    bossKills: player.bossKills
  };
}

/**
 * Handle failed death save: log and enqueue for retry
 */
function _onDeathSaveFailed(err, player, playerId, sessionStats, now, gameState, logger) {
  logger.error('CRITICAL: Failed to handle player death', {
    error: err.message,
    stack: err.stack,
    playerId: player.id || playerId,
    accountId: player.accountId,
    stats: sessionStats
  });

  if (!gameState.failedDeathQueue) {
    gameState.failedDeathQueue = [];
  }

  if (gameState.failedDeathQueue.length >= GAMEPLAY_CONSTANTS.FAILED_DEATH_QUEUE_MAX_SIZE) {
    if (logger) {
      logger.error('Failed death queue full, discarding entry', {
        playerId: player.id || playerId
      });
    }
    return;
  }

  gameState.failedDeathQueue.push({
    player: { id: player.id, accountId: player.accountId, nickname: player.nickname },
    accountId: player.accountId,
    stats: sessionStats,
    timestamp: now,
    retryCount: 0
  });

  if (logger) {
    logger.warn('Player death queued for retry', {
      queueLength: gameState.failedDeathQueue.length,
      playerId: player.id || playerId
    });
  }
}

/**
 * Process failed death queue with retry mechanism (max 3 retries, 30s interval).
 * @param {Object} gameState - Global game state containing failedDeathQueue
 * @param {Object} [logger] - Logger instance
 * @returns {void}
 */
function processFailedDeathQueue(gameState, logger) {
  if (!gameState.failedDeathQueue || gameState.failedDeathQueue.length === 0) {
    return;
  }

  const now = Date.now();

  for (let i = gameState.failedDeathQueue.length - 1; i >= 0; i--) {
    const entry = gameState.failedDeathQueue[i];
    _processQueueEntry(entry, i, gameState, now, logger);
  }
}

/**
 * Process a single entry in the failed death queue
 */
function _processQueueEntry(entry, index, gameState, now, logger) {
  if (entry.lastRetry && now - entry.lastRetry < RETRY_INTERVAL_MS) {
    return;
  }

  if (entry.retryCount >= MAX_RETRIES) {
    if (logger) {
      logger.error('Failed death permanently abandoned', {
        playerId: entry.player?.id,
        accountId: entry.accountId,
        retryCount: entry.retryCount
      });
    }
    gameState.failedDeathQueue.splice(index, 1);
    return;
  }

  if (!gameState.progressionIntegration) {
    return;
  }

  if (!entry.accountId) {
    if (logger) {
      logger.warn('Failed death entry missing account ID', { playerId: entry.player?.id });
    }
    gameState.failedDeathQueue.splice(index, 1);
    return;
  }

  entry.retryCount++;
  entry.lastRetry = now;

  gameState.progressionIntegration
    .handlePlayerDeath(entry.player, entry.accountId, entry.stats)
    .then(() => {
      const idx = gameState.failedDeathQueue.indexOf(entry);
      if (idx > -1) {
        gameState.failedDeathQueue.splice(idx, 1);
      }
      if (logger) {
        logger.info('Failed death retry succeeded', {
          playerId: entry.player?.id,
          retryCount: entry.retryCount
        });
      }
    })
    .catch(() => {
      // Will retry on next processFailedDeathQueue call
    });
}

/**
 * Cleanup orphaned tracking data to prevent memory leaks.
 * Runs at most once per second.
 * @param {Object} gameState - Global game state
 * @param {number} now - Current timestamp (ms)
 * @returns {void}
 */
function cleanupOrphanedTrackingData(gameState, now) {
  if (!gameState._lastTrackingCleanup) {
    gameState._lastTrackingCleanup = now;
  }

  if (now - gameState._lastTrackingCleanup < 1000) {
    return;
  }
  gameState._lastTrackingCleanup = now;

  // PERF: build Sets without intermediate Object.keys() array allocation
  const activeZombieIds = new Set();
  for (const id in gameState.zombies) {
 activeZombieIds.add(id);
}
  const activePoisonTrailIds = new Set();
  const trails = gameState.poisonTrails || {};
  for (const id in trails) {
 activePoisonTrailIds.add(id);
}

  for (const playerId in gameState.players) {
    const player = gameState.players[playerId];
    _cleanupPlayerTracking(player, activeZombieIds, activePoisonTrailIds);
  }
}

/**
 * Cleanup stale tracking entries on a single player object
 */
function _cleanupPlayerTracking(player, activeZombieIds, activePoisonTrailIds) {
  if (player.lastDamageTime && typeof player.lastDamageTime === 'object') {
    for (const zombieId in player.lastDamageTime) {
      if (!activeZombieIds.has(zombieId)) {
        delete player.lastDamageTime[zombieId];
      }
    }
  }

  if (player.lastPoisonDamage && typeof player.lastPoisonDamage === 'object') {
    for (const trailId in player.lastPoisonDamage) {
      if (!activePoisonTrailIds.has(trailId)) {
        delete player.lastPoisonDamage[trailId];
      }
    }
  }

  if (player.lastPoisonDamageByTrail && typeof player.lastPoisonDamageByTrail === 'object') {
    for (const trailId in player.lastPoisonDamageByTrail) {
      if (!activePoisonTrailIds.has(trailId)) {
        delete player.lastPoisonDamageByTrail[trailId];
      }
    }
  }
}

module.exports = {
  handlePlayerDeathProgression,
  processFailedDeathQueue,
  cleanupOrphanedTrackingData
};
