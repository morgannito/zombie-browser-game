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
const { resolveWallCollisions } = require('./updater/wallCollision');

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

// Core orchestration extracted to ./updater/core.js. This file wires the
// per-type ability + boss handlers into the dispatch maps expected by core.
const { updateZombies: _updateZombiesCore } = require('./updater/core');

const ABILITY_HANDLERS = {
  healer: (zombie, zombieId, ctx) =>
    processHealerAbility(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager),
  slower: (zombie, _zombieId, ctx) =>
    processSlowerAbility(zombie, ctx.now, ctx.collisionManager),
  shooter: (zombie, zombieId, ctx) =>
    processShooterAbility(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager),
  poison: (zombie, _zombieId, ctx) =>
    processPoisonTrail(zombie, ctx.now, ctx.gameState, ctx.entityManager),
  teleporter: (zombie, zombieId, ctx) =>
    updateTeleporterZombie(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager, ctx.gameState),
  summoner: (zombie, zombieId, ctx) =>
    updateSummonerZombie(zombie, zombieId, ctx.now, ctx.zombieManager, ctx.entityManager, ctx.gameState),
  berserker: (zombie, zombieId, ctx) =>
    updateBerserkerZombie(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager, ctx.gameState),
  necromancer: (zombie, zombieId, ctx) =>
    updateNecromancerZombie(zombie, zombieId, ctx.now, ctx.entityManager, ctx.gameState),
  brute: (zombie, zombieId, ctx) =>
    updateBruteZombie(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager, ctx.gameState),
  mimic: (zombie, zombieId, ctx) =>
    updateMimicZombie(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager, ctx.gameState)
};

const BOSS_HANDLERS = {
  bossCharnier: (zombie, _id, ctx) =>
    updateBossCharnier(zombie, ctx.now, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState),
  bossInfect: (zombie, _id, ctx) =>
    updateBossInfect(zombie, ctx.now, ctx.entityManager, ctx.gameState),
  bossColosse: (zombie, id, ctx) =>
    updateBossColosse(zombie, id, ctx.now, ctx.io, ctx.entityManager),
  bossRoi: (zombie, id, ctx) =>
    updateBossRoi(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState, ctx.collisionManager),
  bossOmega: (zombie, id, ctx) =>
    updateBossOmega(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState, ctx.collisionManager),
  bossInfernal: (zombie, id, ctx) =>
    updateBossInfernal(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState),
  bossCryos: (zombie, id, ctx) =>
    updateBossCryos(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState),
  bossVortex: (zombie, id, ctx) =>
    updateBossVortex(zombie, id, ctx.now, ctx.io, ctx.entityManager, ctx.gameState),
  bossNexus: (zombie, id, ctx) =>
    updateBossNexus(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState, ctx.collisionManager),
  bossApocalypse: (zombie, id, ctx) =>
    updateBossApocalypse(zombie, id, ctx.now, ctx.io, ctx.zombieManager, ctx.perfIntegration, ctx.entityManager, ctx.gameState, ctx.collisionManager)
};

function updateZombies(gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration) {
  return _updateZombiesCore(
    gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration,
    {
      abilityHandlers: ABILITY_HANDLERS,
      bossHandlers: BOSS_HANDLERS,
      moveZombie,
      isZombieFarFromAllPlayers
    }
  );
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
// moveZombie dispatcher extracted to ./updater/movement.js — see that file
// for the staggered-pathfinding + target-lock logic. Deps (getNearestPlayer,
// resolveLockedTarget, moveTowardsPlayer, moveRandomly) stay here for now.
const { moveZombie: _moveZombieDispatch } = require('./updater/movement');

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
  return _moveZombieDispatch(
    zombie, zombieId, collisionManager, gameState, now, tick, pathfindingRate, players,
    { getNearestPlayer, resolveLockedTarget, moveTowardsPlayer, moveRandomly }
  );
}

// applyZombieSeparation lives in ./updater/separation.js; it's consumed via
// the deps bag passed to movement.moveZombie, so no direct import here.

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

// Random-walk logic extracted to ./updater/randomWalk.js for SRP + lint compliance.
const { moveRandomly } = require('./updater/randomWalk');

module.exports = {
  updateZombies,
  moveZombie,
  // Exported for unit tests
  isZombieFarFromAllPlayers,
  getNearestPlayer,
  resolveLockedTarget
};
