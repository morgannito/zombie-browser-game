/**
 * @fileoverview Zombie movement dispatcher — extracted from ZombieUpdater.
 * @description Top-level orchestrator: deltaTime compute, staggered pathfinding
 *   with target lock (perf), then delegate to moveTowardsPlayer / moveRandomly.
 *   Pure dispatch — the heavy lifting still lives in ZombieUpdater until the
 *   move-towards / random-walk extractions land.
 */

const { applyZombieSeparation } = require('./separation');

const TARGET_FRAME_MS = 16.67;
const MAX_DELTA_CAP = 3;

function computeDeltaTime(zombie, now) {
  const lastUpdate = zombie.lastMoveUpdate || now;
  const delta = Math.min((now - lastUpdate) / TARGET_FRAME_MS, MAX_DELTA_CAP);
  zombie.lastMoveUpdate = now;
  return delta;
}

function shouldResolveTarget(zombie, tick, pathfindingRate) {
  const offset = (zombie.staggerOffset !== null && zombie.staggerOffset !== undefined)
    ? zombie.staggerOffset
    : 0;
  return (tick + offset) % pathfindingRate === 0;
}

function resolveTargetOnEvalTick(zombie, players, tick, getNearestPlayer) {
  const { player } = getNearestPlayer(zombie, players, tick);
  if (player) {
    // PERF: skip write if target unchanged — avoids property churn on hot path.
    if (zombie._lockedTargetId !== player.id) {
      zombie._lockedTargetId = player.id;
    }
    return player;
  }
  zombie._lockedTargetId = null;
  return null;
}

function resolveTargetCached(zombie, zombieId, collisionManager, players, resolveLockedTarget) {
  const locked = resolveLockedTarget(zombie, players);
  if (locked) {
 return locked;
}
  const fallback = collisionManager.findClosestPlayerCached(
    zombieId, zombie.x, zombie.y, Infinity,
    { ignoreSpawnProtection: true, ignoreInvisible: false }
  );
  if (fallback) {
 zombie._lockedTargetId = fallback.id;
}
  return fallback;
}

function pickTarget(zombie, zombieId, collisionManager, players, tick, pathfindingRate, deps) {
  if (shouldResolveTarget(zombie, tick, pathfindingRate)) {
    return resolveTargetOnEvalTick(zombie, players, tick, deps.getNearestPlayer);
  }
  return resolveTargetCached(zombie, zombieId, collisionManager, players, deps.resolveLockedTarget);
}

/**
 * Dispatch zombie movement for the current tick.
 * @param {Object} zombie
 * @param {string} zombieId
 * @param {Object} collisionManager
 * @param {Object} gameState
 * @param {number} now
 * @param {number} tick
 * @param {number} pathfindingRate
 * @param {Object} players
 * @param {{getNearestPlayer, resolveLockedTarget, moveTowardsPlayer, moveRandomly}} deps
 */
function moveZombie(zombie, zombieId, collisionManager, gameState, now, tick, pathfindingRate, players, deps) {
  const deltaTime = computeDeltaTime(zombie, now);
  const target = pickTarget(zombie, zombieId, collisionManager, players, tick, pathfindingRate, deps);
  applyZombieSeparation(zombie, zombieId, collisionManager);
  if (target) {
    deps.moveTowardsPlayer(
      zombie, zombieId, target, gameState.roomManager,
      collisionManager, gameState, now, deltaTime
    );
  } else {
    deps.moveRandomly(zombie, now, gameState.roomManager, deltaTime);
  }
}

module.exports = { moveZombie };
