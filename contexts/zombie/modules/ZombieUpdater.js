/**
 * @fileoverview Main zombie update logic
 * @description Core zombie update function and movement
 *
 * PERF OPTIMIZATIONS (perf/server-zombie-ai):
 * 1. Far-freeze   — zombies whose nearest player is outside the AOI rectangle
 *                   skip ALL AI work this tick (position/health frozen, no drift).
 * 2. Stagger      — pathfinding is re-run only every N ticks; each zombie gets a
 *                   per-id offset so recalculations are spread evenly across ticks.
 * 3. Dist cache   — nearest-player distance/reference is computed once per tick
 *                   and stored on the zombie object (_cacheTick / _cachedNearestPlayer*).
 * 4. Target lock  — once a zombie picks a target it keeps it until the target
 *                   dies/disconnects, avoiding repeated findClosestPlayer calls.
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const MathUtils = require('../../../lib/MathUtils');
const { distance } = require('../../../game/utilityFunctions');
const { createParticles } = require('../../../game/lootFunctions');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

// AOI bounds (mirror of NetworkManager constants — kept local to avoid circular dep)
const AOI_HALF_WIDTH = 1600;
const AOI_HALF_HEIGHT = 900;

// LATENCY OPTIMIZATION: Cache boss/special updaters to avoid repeated requires
const {
  updateTeleporterZombie,
  updateSummonerZombie,
  updateBerserkerZombie,
  updateNecromancerZombie,
  updateBruteZombie,
  updateMimicZombie
} = require('./SpecialZombieUpdater');

const {
  updateBossCharnier,
  updateBossInfect,
  updateBossColosse,
  updateBossRoi,
  updateBossOmega,
  updateBossInfernal,
  updateBossCryos,
  updateBossVortex,
  updateBossNexus,
  updateBossApocalypse
} = require('./BossUpdater');

// Wall-collision resolver moved to ./updater/wallCollision.js for SRP + lint compliance.
const { clampToRoomBounds, resolveWallCollisions } = require('./updater/wallCollision');

// ---------------------------------------------------------------------------
// PERF helpers
// ---------------------------------------------------------------------------

/**
 * PERF — Returns true when zombie is outside every player's AOI rectangle.
 * Uses fast axis-aligned check (no sqrt needed).
 *
 * @param {Object} zombie
 * @param {Object} players - gameState.players hash
 * @returns {boolean}
 */
function isZombieFarFromAllPlayers(zombie, players) {
  const ids = Object.keys(players);
  for (let i = 0; i < ids.length; i++) {
    const p = players[ids[i]];
    if (!p || !p.alive) {
      continue;
    }
    if (Math.abs(zombie.x - p.x) <= AOI_HALF_WIDTH && Math.abs(zombie.y - p.y) <= AOI_HALF_HEIGHT) {
      return false;
    }
  }
  return true;
}

/**
 * PERF — Get (and cache) the nearest live player to a zombie.
 * Result is stored on zombie._cachedNearestPlayer / _cachedNearestPlayerDist
 * and is valid for the duration of the current tick (_cacheTick).
 *
 * @param {Object} zombie
 * @param {Object} players - gameState.players hash
 * @param {number} tick - current perfIntegration.tickCounter
 * @returns {{ player: Object|null, dist: number }}
 */
function getNearestPlayer(zombie, players, tick) {
  if (zombie._cacheTick === tick) {
    return { player: zombie._cachedNearestPlayer, dist: zombie._cachedNearestPlayerDist };
  }

  let minDist = Infinity;
  let nearest = null;
  const ids = Object.keys(players);

  for (let i = 0; i < ids.length; i++) {
    const p = players[ids[i]];
    if (!p || !p.alive) {
      continue;
    }
    const dx = zombie.x - p.x;
    const dy = zombie.y - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < minDist) {
      minDist = d;
      nearest = p;
    }
  }

  zombie._cacheTick = tick;
  zombie._cachedNearestPlayerDist = minDist;
  zombie._cachedNearestPlayer = nearest;
  return { player: nearest, dist: minDist };
}

/**
 * PERF — Resolve target lock for a zombie.
 * Returns the locked player if still alive, otherwise clears the lock.
 *
 * @param {Object} zombie
 * @param {Object} players - gameState.players hash
 * @returns {Object|null} locked player or null
 */
function resolveLockedTarget(zombie, players) {
  if (zombie._lockedTargetId !== null && zombie._lockedTargetId !== undefined) {
    const p = players[zombie._lockedTargetId];
    if (p && p.alive && !p.spawnProtection && !p.invisible) {
      return p;
    }
    zombie._lockedTargetId = null;
    zombie._cachedNearestPlayer = null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------

/**
 * Main zombie update function
 * LATENCY OPTIMIZATION: Fast-path guards to skip boss/special updates for regular zombies
 * CRITICAL FIX: Use snapshot of zombie IDs to safely iterate while zombies may be deleted
 * PERF: Far-freeze + staggered pathfinding + distance cache + target lock applied here.
 */
function updateZombies(
  gameState,
  now,
  io,
  collisionManager,
  entityManager,
  zombieManager,
  perfIntegration
) {
  const zombies = gameState.zombies;
  // CRITICAL FIX: Create snapshot with .slice() to prevent iteration issues
  // when zombies are deleted by other systems (tesla kill, poison, etc.)
  const zombieIds = Object.keys(zombies).slice();

  // PERF: Current tick for stagger offset and distance cache.
  const tick = perfIntegration ? perfIntegration.tickCounter : 0;
  // PERF: Pathfinding rate from config (ticks between full path recalcs).
  // BUGFIX: clamp to ≥1 to avoid `% 0` → NaN, which would freeze every zombie
  // forever (shouldResolveTarget always false).
  const pathfindingRate = Math.max(
    1,
    perfIntegration && perfIntegration.perfConfig
      ? perfIntegration.perfConfig.current.zombiePathfindingRate
      : 10
  );
  const players = gameState.players;

  for (let i = 0; i < zombieIds.length; i++) {
    const zombieId = zombieIds[i];
    const zombie = zombies[zombieId];

    if (!zombie) {
      continue;
    } // Fast path: destroyed

    // PERF — Assign a per-zombie stagger offset once (based on numeric id).
    if (zombie.staggerOffset === null || zombie.staggerOffset === undefined) {
      zombie.staggerOffset = (Number(zombieId) || 0) % pathfindingRate;
    }

    // PERF — FAR FREEZE: bosses always update.
    // Non-boss zombies outside every player's AOI skip ALL AI this tick.
    // Position/health stay frozen (no drift).
    const isBoss = zombie.isBoss === true;
    if (!isBoss && isZombieFarFromAllPlayers(zombie, players)) {
      // Reset stuck tracker so the counter doesn't accumulate while frozen.
      zombie._prevX = zombie.x;
      zombie._prevY = zombie.y;
      continue;
    }

    const zombieType = zombie.type;

    // LATENCY OPTIMIZATION: Early returns for type-specific abilities
    if (zombieType === 'healer') {
      processHealerAbility(zombie, zombieId, now, collisionManager, entityManager);
    }
    if (zombieType === 'slower') {
      processSlowerAbility(zombie, now, collisionManager);
    }
    if (zombieType === 'shooter') {
      processShooterAbility(zombie, zombieId, now, collisionManager, entityManager);
    }
    if (zombieType === 'poison') {
      processPoisonTrail(zombie, now, gameState, entityManager);
    }

    // LATENCY OPTIMIZATION: Type guards prevent calling boss functions for regular zombies
    if (zombieType === 'teleporter') {
      updateTeleporterZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'summoner') {
      updateSummonerZombie(zombie, zombieId, now, zombieManager, entityManager, gameState);
    }
    if (zombieType === 'berserker') {
      updateBerserkerZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'necromancer') {
      updateNecromancerZombie(zombie, zombieId, now, entityManager, gameState);
    }
    if (zombieType === 'brute') {
      updateBruteZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }
    if (zombieType === 'mimic') {
      updateMimicZombie(zombie, zombieId, now, collisionManager, entityManager, gameState);
    }

    // Boss updates (rare, so grouped together)
    if (zombieType === 'bossCharnier') {
      updateBossCharnier(zombie, now, zombieManager, perfIntegration, entityManager, gameState);
    }
    if (zombieType === 'bossInfect') {
      updateBossInfect(zombie, now, entityManager, gameState);
    }
    if (zombieType === 'bossColosse') {
      updateBossColosse(zombie, zombieId, now, io, entityManager);
    }
    if (zombieType === 'bossRoi') {
      updateBossRoi(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState,
        collisionManager
      );
    }
    if (zombieType === 'bossOmega') {
      updateBossOmega(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState,
        collisionManager
      );
    }
    if (zombieType === 'bossInfernal') {
      updateBossInfernal(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState
      );
    }
    if (zombieType === 'bossCryos') {
      updateBossCryos(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState
      );
    }
    if (zombieType === 'bossVortex') {
      updateBossVortex(zombie, zombieId, now, io, entityManager, gameState);
    }
    if (zombieType === 'bossNexus') {
      updateBossNexus(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState,
        collisionManager
      );
    }
    if (zombieType === 'bossApocalypse') {
      updateBossApocalypse(
        zombie,
        zombieId,
        now,
        io,
        zombieManager,
        perfIntegration,
        entityManager,
        gameState,
        collisionManager
      );
    }

    // BUGFIX: boss/zombie AI handlers may delete the zombie mid-iteration
    // (e.g. boss-Roi clone despawn). Skip move for already-deleted entities
    // to avoid accumulating _stuckFrames on a ghost object.
    if (!gameState.zombies[zombieId]) {
      continue;
    }
    moveZombie(zombie, zombieId, collisionManager, gameState, now, tick, pathfindingRate, players);

    // Track stuck zombies: if position barely changed, increment counter
    const movedDist =
      Math.abs(zombie.x - (zombie._prevX || 0)) + Math.abs(zombie.y - (zombie._prevY || 0));
    zombie._prevX = zombie.x;
    zombie._prevY = zombie.y;

    if (movedDist < 0.5) {
      zombie._stuckFrames = (zombie._stuckFrames || 0) + 1;
    } else {
      zombie._stuckFrames = 0;
    }

    // Despawn zombies stuck for ~10 seconds (600 frames at 60fps)
    if (zombie._stuckFrames > 600) {
      delete zombies[zombieId];
    }
  }
}

/**
 * Process healer zombie ability
 */
function processHealerAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'healer') {
    return;
  }

  const healerType = ZOMBIE_TYPES.healer;
  if (!zombie.lastHeal || now - zombie.lastHeal >= healerType.healCooldown) {
    zombie.lastHeal = now;

    const nearbyZombies = collisionManager.findZombiesInRadius(
      zombie.x,
      zombie.y,
      healerType.healRadius,
      zombieId
    );

    for (const other of nearbyZombies) {
      if (other.health < other.maxHealth) {
        other.health = Math.min(other.health + healerType.healAmount, other.maxHealth);
        createParticles(other.x, other.y, '#00ffff', 5, entityManager);
      }
    }
  }
}

/**
 * Process slower zombie ability
 */
function processSlowerAbility(zombie, now, collisionManager) {
  if (zombie.type !== 'slower') {
    return;
  }

  const slowerType = ZOMBIE_TYPES.slower;
  const nearbyPlayers = collisionManager.findPlayersInRadius(
    zombie.x,
    zombie.y,
    slowerType.slowRadius
  );

  for (const player of nearbyPlayers) {
    player.slowedUntil = now + slowerType.slowDuration;
    player.slowAmount = slowerType.slowAmount;
  }
}

/**
 * Process shooter zombie ability
 */
function processShooterAbility(zombie, zombieId, now, collisionManager, entityManager) {
  if (zombie.type !== 'shooter') {
    return;
  }

  const shooterType = ZOMBIE_TYPES.shooter;

  if (!zombie.lastShot || now - zombie.lastShot >= shooterType.shootCooldown) {
    // SSSS OPTIMIZATION: Use cached pathfinding for shooter targeting
    const targetPlayer = collisionManager.findClosestPlayerCached(
      zombieId,
      zombie.x,
      zombie.y,
      shooterType.shootRange,
      { ignoreSpawnProtection: true, ignoreInvisible: false }
    );

    if (targetPlayer) {
      shootAtPlayer(zombie, zombieId, targetPlayer, shooterType, now, entityManager);
    }
  }
}

/**
 * Shoot bullet at player
 */
function shootAtPlayer(zombie, zombieId, targetPlayer, shooterType, now, entityManager) {
  zombie.lastShot = now;
  const angle = Math.atan2(targetPlayer.y - zombie.y, targetPlayer.x - zombie.x);

  entityManager.createBullet({
    x: zombie.x,
    y: zombie.y,
    vx: MathUtils.fastCos(angle) * shooterType.bulletSpeed,
    vy: MathUtils.fastSin(angle) * shooterType.bulletSpeed,
    zombieId: zombieId,
    damage: zombie.damage,
    color: shooterType.bulletColor,
    isZombieBullet: true,
    piercing: 0,
    piercedZombies: [],
    explosiveRounds: false,
    explosionRadius: 0,
    explosionDamagePercent: 0
  });

  createParticles(zombie.x, zombie.y, shooterType.bulletColor, 5, entityManager);
}

/**
 * Process poison trail for poison zombie
 */
function processPoisonTrail(zombie, now, gameState, entityManager) {
  if (zombie.type !== 'poison') {
    return;
  }

  const poisonType = ZOMBIE_TYPES.poison;

  if (!zombie.lastPoisonTrail || now - zombie.lastPoisonTrail >= poisonType.poisonTrailInterval) {
    zombie.lastPoisonTrail = now;

    const trailId = gameState.nextPoisonTrailId++;
    gameState.poisonTrails[trailId] = {
      id: trailId,
      x: zombie.x,
      y: zombie.y,
      radius: poisonType.poisonRadius,
      damage: poisonType.poisonDamage,
      createdAt: now,
      duration: poisonType.poisonDuration
    };

    createParticles(zombie.x, zombie.y, poisonType.color, 3, entityManager);
  }
}

/**
 * Move zombie towards player or randomly.
 *
 * SSSS OPTIMIZATION: Uses cached pathfinding for performance.
 * FIX: Added deltaTime for frame-rate independent movement.
 * PERF: Staggered pathfinding — target is re-evaluated only every N ticks
 *        using a per-zombie offset. Between evaluations the locked target is reused.
 *
 * @param {Object}  zombie
 * @param {string}  zombieId
 * @param {Object}  collisionManager
 * @param {Object}  gameState
 * @param {number}  now
 * @param {number}  [tick=0]           - current perfIntegration.tickCounter
 * @param {number}  [pathfindingRate=10] - ticks between full path recalcs
 * @param {Object}  [players={}]       - gameState.players hash
 */
function moveZombie(
  zombie,
  zombieId,
  collisionManager,
  gameState,
  now = Date.now(),
  tick = 0,
  pathfindingRate = 10,
  players = {}
) {
  const roomManager = gameState.roomManager;

  // FIX: Calculate deltaTime for frame-rate independent movement
  // Target is 60 FPS (16.67ms per frame)
  const lastUpdate = zombie.lastMoveUpdate || now;
  const deltaTime = Math.min((now - lastUpdate) / 16.67, 3); // Cap at 3x to prevent teleporting on lag spikes
  zombie.lastMoveUpdate = now;

  // PERF — STAGGERED PATHFINDING + TARGET LOCK
  // Determine whether this is a tick where the zombie should re-evaluate its target.
  const staggerOffset = (zombie.staggerOffset !== null && zombie.staggerOffset !== undefined) ? zombie.staggerOffset : 0;
  const shouldResolveTarget = (tick + staggerOffset) % pathfindingRate === 0;

  let closestPlayer = null;

  if (shouldResolveTarget) {
    // Full re-evaluation tick: use cached distance helper then update the lock.
    const { player } = getNearestPlayer(zombie, players, tick);
    if (player) {
      zombie._lockedTargetId = player.id;
      closestPlayer = player;
    } else {
      zombie._lockedTargetId = null;
    }
  } else {
    // Non-evaluation tick: try the locked target first (O(1)).
    closestPlayer = resolveLockedTarget(zombie, players);
    if (!closestPlayer) {
      // Lock expired (target died) — fall back to CollisionManager cache for this tick.
      closestPlayer = collisionManager.findClosestPlayerCached(zombieId, zombie.x, zombie.y, Infinity, {
        ignoreSpawnProtection: true,
        ignoreInvisible: false
      });
      if (closestPlayer) {
        zombie._lockedTargetId = closestPlayer.id;
      }
    }
  }

  // FIX: Apply zombie-zombie separation to prevent stacking
  applyZombieSeparation(zombie, zombieId, collisionManager);

  if (closestPlayer) {
    moveTowardsPlayer(
      zombie,
      zombieId,
      closestPlayer,
      roomManager,
      collisionManager,
      gameState,
      now,
      deltaTime
    );
  } else {
    moveRandomly(zombie, now, roomManager, deltaTime);
  }
}

// Separation logic extracted to ./updater/separation.js for SRP + lint compliance.
const { applyZombieSeparation } = require('./updater/separation');

/**
 * Move zombie towards closest player
 * FIX: Added deltaTime parameter for frame-rate independent movement
 */
function moveTowardsPlayer(
  zombie,
  zombieId,
  closestPlayer,
  roomManager,
  collisionManager,
  gameState,
  now,
  deltaTime
) {
  const angle = Math.atan2(closestPlayer.y - zombie.y, closestPlayer.x - zombie.x);

  if (zombie.type === 'shielded') {
    zombie.facingAngle = angle;
  }

  const effectiveSpeed = calculateEffectiveSpeed(zombie, angle);
  const { newX, newY } = calculateNewPosition(zombie, angle, effectiveSpeed, deltaTime);
  const { finalX, finalY } = resolveWallCollisions(zombie, newX, newY, roomManager);

  zombie.x = finalX;
  zombie.y = finalY;

  checkPlayerCollisions(zombie, zombieId, collisionManager, gameState, now);
}

/**
 * Calculate zombie effective speed
 * FIX: Added speed capping to prevent teleportation on extreme multipliers
 */
function calculateEffectiveSpeed(zombie, _angle) {
  let effectiveSpeed = zombie.speed;

  if (zombie.type === 'berserker' && zombie.rageSpeedMultiplier) {
    effectiveSpeed *= zombie.rageSpeedMultiplier;
  }

  if (zombie.type === 'berserker' && zombie.isDashing) {
    const berserkerType = ZOMBIE_TYPES.berserker;
    effectiveSpeed = berserkerType.dashSpeed;
  }

  if (zombie.type === 'brute' && zombie.isCharging) {
    const bruteType = ZOMBIE_TYPES.brute;
    effectiveSpeed = bruteType.chargeSpeed;
  }

  // FIX: Cap maximum speed to prevent teleportation
  // Max speed = 15 pixels per frame at 60fps (900 pixels/sec)
  const MAX_SPEED = 15;
  return Math.min(effectiveSpeed, MAX_SPEED);
}

/**
 * Calculate new zombie position
 * FIX: Added deltaTime for frame-rate independent movement
 */
function calculateNewPosition(zombie, angle, effectiveSpeed, deltaTime = 1) {
  if (zombie.isDashing) {
    angle = zombie.dashAngle;
  }
  if (zombie.isCharging) {
    angle = zombie.chargeAngle;
  }

  // FIX: Multiply by deltaTime for consistent movement regardless of frame rate
  const frameSpeed = effectiveSpeed * deltaTime;

  return {
    newX: zombie.x + MathUtils.fastCos(angle) * frameSpeed,
    newY: zombie.y + MathUtils.fastSin(angle) * frameSpeed
  };
}


/**
 * Check and handle player collisions
 */
function checkPlayerCollisions(zombie, zombieId, collisionManager, gameState, now) {
  const nearbyPlayers = collisionManager.findPlayersInRadius(
    zombie.x,
    zombie.y,
    zombie.size + CONFIG.PLAYER_SIZE
  );

  for (const player of nearbyPlayers) {
    if (player.spawnProtection || player.invisible) {
      continue;
    }

    // BUG FIX: La collision doit utiliser zombie.size + PLAYER_SIZE, pas seulement zombie.size
    // Sinon le joueur doit etre DANS le zombie pour prendre des degats
    const collisionDistance = zombie.size + CONFIG.PLAYER_SIZE;
    if (distance(zombie.x, zombie.y, player.x, player.y) < collisionDistance) {
      if (Math.random() < (player.dodgeChance || 0)) {
        continue;
      }

      applyPlayerDamage(zombie, zombieId, player, gameState, now);
    }
  }
}

/**
 * Apply damage to player from zombie collision
 */
function applyPlayerDamage(zombie, zombieId, player, gameState, now) {
  if (!player.lastDamageTime) {
    player.lastDamageTime = {};
  }
  const lastDamage = player.lastDamageTime[zombieId] || 0;
  const DAMAGE_INTERVAL = 100;

  if (now - lastDamage >= DAMAGE_INTERVAL) {
    let damageDealt = zombie.damage * (DAMAGE_INTERVAL / 1000);

    if (zombie.type === 'berserker' && zombie.rageDamageMultiplier) {
      damageDealt *= zombie.rageDamageMultiplier;
    }

    player.health -= damageDealt;
    player.lastDamageTime[zombieId] = now;

    if (player.thorns > 0) {
      const thornsDamage = damageDealt * player.thorns;
      zombie.health -= thornsDamage;
    }

    if (player.health <= 0) {
      const handlePlayerDeathProgression = require('../../../game/gameLoop').handlePlayerDeathProgression;
      handlePlayerDeathProgression(player, player.id, gameState, now, false);
    }
  }
}

/**
 * Move zombie randomly when no player visible
 * FIX: Added deltaTime for frame-rate independent movement
 * FIX: Improved wall collision handling with smart direction change
 */
function moveRandomly(zombie, now, roomManager, deltaTime = 1) {
  if (!zombie.randomMoveTimer || now - zombie.randomMoveTimer > 2000) {
    zombie.randomAngle = Math.random() * Math.PI * 2;
    zombie.randomMoveTimer = now;
  }

  // FIX: Apply deltaTime for consistent random movement
  const frameSpeed = zombie.speed * deltaTime;
  const newX = zombie.x + Math.cos(zombie.randomAngle) * frameSpeed;
  const newY = zombie.y + Math.sin(zombie.randomAngle) * frameSpeed;

  // FIX: Use resolveWallCollisions for consistent boundary handling
  const { finalX, finalY } = resolveWallCollisions(zombie, newX, newY, roomManager);

  // Calculate how much movement was blocked
  const intendedMoveX = newX - zombie.x;
  const intendedMovY = newY - zombie.y;
  const actualMoveX = finalX - zombie.x;
  const actualMoveY = finalY - zombie.y;

  // Check if significantly blocked (less than 50% of intended movement)
  const intendedDist = Math.sqrt(intendedMoveX * intendedMoveX + intendedMovY * intendedMovY);
  const actualDist = Math.sqrt(actualMoveX * actualMoveX + actualMoveY * actualMoveY);
  const wasBlocked = intendedDist > 0.1 && actualDist < intendedDist * 0.5;

  zombie.x = finalX;
  zombie.y = finalY;

  if (wasBlocked) {
    // Hit a wall - change direction intelligently
    // Try to pick a direction that goes away from the wall
    if (Math.abs(actualMoveX) < Math.abs(intendedMoveX) * 0.5) {
      // X was blocked - move more in Y direction
      zombie.randomAngle = actualMoveY >= 0 ? Math.PI / 2 : -Math.PI / 2;
      zombie.randomAngle += ((Math.random() - 0.5) * Math.PI) / 2; // Add some variance
    } else if (Math.abs(actualMoveY) < Math.abs(intendedMovY) * 0.5) {
      // Y was blocked - move more in X direction
      zombie.randomAngle = actualMoveX >= 0 ? 0 : Math.PI;
      zombie.randomAngle += ((Math.random() - 0.5) * Math.PI) / 2; // Add some variance
    } else {
      // Both blocked (corner) - pick random new direction
      zombie.randomAngle = Math.random() * Math.PI * 2;
    }
    zombie.randomMoveTimer = now;
  }
}

module.exports = {
  updateZombies,
  moveZombie,
  // Exported for unit tests
  isZombieFarFromAllPlayers,
  getNearestPlayer,
  resolveLockedTarget
};
