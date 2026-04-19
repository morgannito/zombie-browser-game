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
const { DAMAGE_INTERVAL, ZOMBIE_MAX_SPEED } = require('../constants');
const { distance } = require('../../../game/utilityFunctions');
// Direct import — DeathProgressionHandler is a leaf module (only depends on
// ConfigManager) so no cycle is possible here. gameLoop re-exports it, which
// is what previously forced the lazy-load workaround.
const { handlePlayerDeathProgression } = require('../../player/modules/DeathProgressionHandler');

const { CONFIG, ZOMBIE_TYPES } = ConfigManager;

// AOI bounds for far-freeze optimization.
// FIX: must be >= NetworkManager's broadcast AOI (1600+400 bucket = 2000 × 900+400 = 1300)
// otherwise the server broadcasts entities to the client that it has frozen
// itself — they show up visually but never move (the bug players saw).
// Slight extra margin (2100 × 1400) absorbs player mid-tick movement between
// the AOI bucket recomputation and the zombie tick.
const AOI_HALF_WIDTH = 2100;
const AOI_HALF_HEIGHT = 1400;

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

// Per-type ability processors (healer/slower/shooter/poison) — SRP extract.
const {
  processHealerAbility: _processHealerAbility,
  processSlowerAbility: _processSlowerAbility,
  processShooterAbility: _processShooterAbility,
  processPoisonTrail: _processPoisonTrail
} = require('./updater/abilities');

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
  // PERF: for-in avoids Object.keys() allocation in a hot path called
  // for every zombie on every tick.
  for (const id in players) {
    const p = players[id];
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
 * PERF: Uses squared-distance comparison to avoid Math.sqrt on every
 * (zombie, player) pair.  sqrt is only taken once — on the winner — to store
 * the true distance for callers that need it.  With N zombies doing a target
 * eval every 10 ticks and P players this saves N*P sqrts every 10 ticks
 * (e.g. 50 zombies × 4 players = 200 sqrts avoided per eval cycle).
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

  let minDistSq = Infinity;
  let nearest = null;

  // PERF: for-in avoids Object.keys() allocation on this hot path.
  for (const id in players) {
    const p = players[id];
    if (!p || !p.alive) {
      continue;
    }
    const dx = zombie.x - p.x;
    const dy = zombie.y - p.y;
    const dSq = dx * dx + dy * dy;
    if (dSq < minDistSq) {
      minDistSq = dSq;
      nearest = p;
    }
  }

  zombie._cacheTick = tick;
  // Take sqrt only once on the winner so callers that need true dist still work.
  zombie._cachedNearestPlayerDist = minDistSq === Infinity ? Infinity : Math.sqrt(minDistSq);
  zombie._cachedNearestPlayer = nearest;
  return { player: nearest, dist: zombie._cachedNearestPlayerDist };
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
    _processHealerAbility(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager),
  slower: (zombie, _zombieId, ctx) => _processSlowerAbility(zombie, ctx.now, ctx.collisionManager),
  shooter: (zombie, zombieId, ctx) =>
    _processShooterAbility(zombie, zombieId, ctx.now, ctx.collisionManager, ctx.entityManager),
  poison: (zombie, _zombieId, ctx) =>
    _processPoisonTrail(zombie, ctx.now, ctx.gameState, ctx.entityManager),
  teleporter: (zombie, zombieId, ctx) =>
    updateTeleporterZombie(
      zombie,
      zombieId,
      ctx.now,
      ctx.collisionManager,
      ctx.entityManager,
      ctx.gameState
    ),
  summoner: (zombie, zombieId, ctx) =>
    updateSummonerZombie(
      zombie,
      zombieId,
      ctx.now,
      ctx.zombieManager,
      ctx.entityManager,
      ctx.gameState
    ),
  berserker: (zombie, zombieId, ctx) =>
    updateBerserkerZombie(
      zombie,
      zombieId,
      ctx.now,
      ctx.collisionManager,
      ctx.entityManager,
      ctx.gameState
    ),
  necromancer: (zombie, zombieId, ctx) =>
    updateNecromancerZombie(zombie, zombieId, ctx.now, ctx.entityManager, ctx.gameState),
  brute: (zombie, zombieId, ctx) =>
    updateBruteZombie(
      zombie,
      zombieId,
      ctx.now,
      ctx.collisionManager,
      ctx.entityManager,
      ctx.gameState
    ),
  mimic: (zombie, zombieId, ctx) =>
    updateMimicZombie(
      zombie,
      zombieId,
      ctx.now,
      ctx.collisionManager,
      ctx.entityManager,
      ctx.gameState
    )
};

const BOSS_HANDLERS = {
  bossCharnier: (zombie, _id, ctx) =>
    updateBossCharnier(
      zombie,
      ctx.now,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState
    ),
  bossInfect: (zombie, _id, ctx) =>
    updateBossInfect(zombie, ctx.now, ctx.entityManager, ctx.gameState),
  bossColosse: (zombie, id, ctx) =>
    updateBossColosse(zombie, id, ctx.now, ctx.io, ctx.entityManager),
  bossRoi: (zombie, id, ctx) =>
    updateBossRoi(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState,
      ctx.collisionManager
    ),
  bossOmega: (zombie, id, ctx) =>
    updateBossOmega(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState,
      ctx.collisionManager
    ),
  bossInfernal: (zombie, id, ctx) =>
    updateBossInfernal(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState
    ),
  bossCryos: (zombie, id, ctx) =>
    updateBossCryos(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState
    ),
  bossVortex: (zombie, id, ctx) =>
    updateBossVortex(zombie, id, ctx.now, ctx.io, ctx.entityManager, ctx.gameState),
  bossNexus: (zombie, id, ctx) =>
    updateBossNexus(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState,
      ctx.collisionManager
    ),
  bossApocalypse: (zombie, id, ctx) =>
    updateBossApocalypse(
      zombie,
      id,
      ctx.now,
      ctx.io,
      ctx.zombieManager,
      ctx.perfIntegration,
      ctx.entityManager,
      ctx.gameState,
      ctx.collisionManager
    )
};

function updateZombies(
  gameState,
  now,
  io,
  collisionManager,
  entityManager,
  zombieManager,
  perfIntegration
) {
  return _updateZombiesCore(
    gameState,
    now,
    io,
    collisionManager,
    entityManager,
    zombieManager,
    perfIntegration,
    {
      abilityHandlers: ABILITY_HANDLERS,
      bossHandlers: BOSS_HANDLERS,
      moveZombie,
      isZombieFarFromAllPlayers
    }
  );
}

// Ability processors extracted to ./updater/abilities — re-bind locally so
// tests keep importing them from this module (backwards-compatible surface).
const processHealerAbility = _processHealerAbility;
const processSlowerAbility = _processSlowerAbility;
const processShooterAbility = _processShooterAbility;
const processPoisonTrail = _processPoisonTrail;

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
    zombie,
    zombieId,
    collisionManager,
    gameState,
    now,
    tick,
    pathfindingRate,
    players,
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
    // PERF: recalculate facingAngle only when player moved > 8px since last update
    const dx = closestPlayer.x - (zombie._shieldPx || 0);
    const dy = closestPlayer.y - (zombie._shieldPy || 0);
    if (dx * dx + dy * dy > 64) {
      zombie.facingAngle = angle;
      zombie._shieldPx = closestPlayer.x;
      zombie._shieldPy = closestPlayer.y;
    }
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
  return Math.min(effectiveSpeed, ZOMBIE_MAX_SPEED);
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
  // DAMAGE_INTERVAL imported from constants

  if (now - lastDamage >= DAMAGE_INTERVAL) {
    let damageDealt = zombie.damage * (DAMAGE_INTERVAL / 1000);

    if (zombie.type === 'berserker' && zombie.rageDamageMultiplier) {
      damageDealt *= zombie.rageDamageMultiplier;
    }

    player.health -= damageDealt;
    player.lastDamageTime[zombieId] = now;
    player.lastKillerType = zombie.type;

    if (player.thorns > 0) {
      const thornsDamage = damageDealt * player.thorns;
      zombie.health -= thornsDamage;
    }

    if (player.health <= 0) {
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
  resolveLockedTarget,
  processHealerAbility,
  processSlowerAbility,
  processShooterAbility,
  processPoisonTrail,
  calculateEffectiveSpeed,
  calculateNewPosition,
  checkPlayerCollisions,
  applyPlayerDamage,
  moveTowardsPlayer
};
