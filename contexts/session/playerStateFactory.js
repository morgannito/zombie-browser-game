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

function _getSpawnBounds(config) {
  const wallThickness = config.WALL_THICKNESS || 40;
  const playerSize = config.PLAYER_SIZE || 20;
  const safeMargin = wallThickness + playerSize + 20;
  return {
    wallThickness,
    playerSize,
    safeMargin,
    minX: wallThickness + playerSize,
    maxX: config.ROOM_WIDTH - wallThickness - playerSize,
    minY: wallThickness + playerSize,
    maxY: config.ROOM_HEIGHT - wallThickness - playerSize
  };
}

function _collidesWithWalls(x, y, playerSize, gameState) {
  const roomManager = gameState && gameState.roomManager;
  if (roomManager && typeof roomManager.checkWallCollision === 'function') {
    return roomManager.checkWallCollision(x, y, playerSize);
  }

  const walls = gameState && Array.isArray(gameState.walls) ? gameState.walls : [];
  for (const wall of walls) {
    if (
      x + playerSize > wall.x &&
      x - playerSize < wall.x + wall.width &&
      y + playerSize > wall.y &&
      y - playerSize < wall.y + wall.height
    ) {
      return true;
    }
  }
  return false;
}

function _nearestZombieDistanceSq(x, y, gameState) {
  const zombies = gameState && gameState.zombies ? Object.values(gameState.zombies) : [];
  let nearest = Infinity;
  for (const zombie of zombies) {
    if (!zombie || zombie.health <= 0) {
      continue;
    }
    const dx = zombie.x - x;
    const dy = zombie.y - y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearest) {
      nearest = distSq;
    }
  }
  return nearest;
}

function _candidateScore(x, y, bounds, gameState) {
  if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) {
    return -Infinity;
  }
  if (_collidesWithWalls(x, y, bounds.playerSize, gameState)) {
    return -Infinity;
  }
  return _nearestZombieDistanceSq(x, y, gameState);
}

function resolvePlayerSpawnPosition(config, gameState = null) {
  const bounds = _getSpawnBounds(config);
  const spawnOffsetX = (Math.random() - 0.5) * 100;
  const spawnOffsetY = Math.random() * 40;
  const fallback = {
    x: clamp(config.ROOM_WIDTH / 2 + spawnOffsetX, bounds.minX, bounds.maxX),
    y: clamp(config.ROOM_HEIGHT - bounds.safeMargin - 50 - spawnOffsetY, bounds.minY, bounds.maxY)
  };

  const zombies = gameState && gameState.zombies ? Object.keys(gameState.zombies) : [];
  if (!gameState || zombies.length === 0) {
    return fallback;
  }

  const inset = bounds.safeMargin + 40;
  const candidates = [
    fallback,
    {
      x: clamp(config.ROOM_WIDTH / 2, bounds.minX, bounds.maxX),
      y: clamp(inset, bounds.minY, bounds.maxY)
    },
    {
      x: clamp(config.ROOM_WIDTH / 2, bounds.minX, bounds.maxX),
      y: clamp(config.ROOM_HEIGHT - inset, bounds.minY, bounds.maxY)
    },
    {
      x: clamp(inset, bounds.minX, bounds.maxX),
      y: clamp(config.ROOM_HEIGHT / 2, bounds.minY, bounds.maxY)
    },
    {
      x: clamp(config.ROOM_WIDTH - inset, bounds.minX, bounds.maxX),
      y: clamp(config.ROOM_HEIGHT / 2, bounds.minY, bounds.maxY)
    },
    { x: clamp(inset, bounds.minX, bounds.maxX), y: clamp(inset, bounds.minY, bounds.maxY) },
    {
      x: clamp(config.ROOM_WIDTH - inset, bounds.minX, bounds.maxX),
      y: clamp(inset, bounds.minY, bounds.maxY)
    },
    {
      x: clamp(inset, bounds.minX, bounds.maxX),
      y: clamp(config.ROOM_HEIGHT - inset, bounds.minY, bounds.maxY)
    },
    {
      x: clamp(config.ROOM_WIDTH - inset, bounds.minX, bounds.maxX),
      y: clamp(config.ROOM_HEIGHT - inset, bounds.minY, bounds.maxY)
    }
  ];

  for (let i = 0; i < 8; i++) {
    candidates.push({
      x: clamp(bounds.minX + Math.random() * (bounds.maxX - bounds.minX), bounds.minX, bounds.maxX),
      y: clamp(bounds.minY + Math.random() * (bounds.maxY - bounds.minY), bounds.minY, bounds.maxY)
    });
  }

  let best = fallback;
  let bestScore = _candidateScore(fallback.x, fallback.y, bounds, gameState);

  for (const candidate of candidates) {
    const score = _candidateScore(candidate.x, candidate.y, bounds, gameState);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return bestScore === -Infinity ? fallback : best;
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
function createPlayerState(config, socketId, sessionId = null, accountId = null, gameState = null) {
  const spawn = resolvePlayerSpawnPosition(config, gameState);

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
    x: spawn.x,
    y: spawn.y,
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
  createPlayerState,
  resolvePlayerSpawnPosition
};
