/**
 * @fileoverview Zombie-vs-zombie separation force — extracted from ZombieUpdater.
 * @description Prevents stacking by computing a soft push-apart force for
 *   every zombie that overlaps into its neighbours, then applying it with a
 *   wall-aware axis fallback (same as wallCollision strategy 1).
 */

const { clampToRoomBounds } = require('./wallCollision');

const SEPARATION_FORCE = 0.5;
const OVERLAP_FACTOR = 0.8;
const DIST_EPSILON_SQ = 0.01;

function accumulateSeparation(zombie, other) {
  if (!other || other.id === zombie.id) {
    return { x: 0, y: 0 };
  }
  const dx = zombie.x - other.x;
  const dy = zombie.y - other.y;
  const distSq = dx * dx + dy * dy;
  const minDist = (zombie.size + other.size) * OVERLAP_FACTOR;
  if (distSq >= minDist * minDist || distSq <= DIST_EPSILON_SQ) {
    return { x: 0, y: 0 };
  }
  const dist = Math.sqrt(distSq);
  const overlap = minDist - dist;
  return {
    x: (dx / dist) * overlap * SEPARATION_FORCE,
    y: (dy / dist) * overlap * SEPARATION_FORCE
  };
}

function computeSeparationForce(zombie, zombieId, collisionManager) {
  const radius = zombie.size * 2;
  // PERF: SpatialGrid early-out before hitting the quadtree (avoids query cost
  // when zombie is isolated in its cell neighbourhood).
  if (collisionManager._zombieGrid) {
    const gridCandidates = collisionManager._zombieGrid.nearby(zombie.x, zombie.y, radius);
    if (gridCandidates.length <= 1) {
 return null;
}
  }
  const nearby = collisionManager.findZombiesInRadius(zombie.x, zombie.y, radius, zombieId);
  if (nearby.length === 0) {
    return null;
  }
  let sx = 0;
  let sy = 0;
  for (const other of nearby) {
    const push = accumulateSeparation(zombie, other);
    sx += push.x;
    sy += push.y;
  }
  return (sx === 0 && sy === 0) ? null : { x: sx, y: sy };
}

function applyWithWallCheck(zombie, candidateX, candidateY, roomManager) {
  if (!roomManager || !roomManager.checkWallCollision(candidateX, candidateY, zombie.size)) {
    zombie.x = candidateX;
    zombie.y = candidateY;
    return;
  }
  if (!roomManager.checkWallCollision(candidateX, zombie.y, zombie.size)) {
    zombie.x = candidateX;
  }
  if (!roomManager.checkWallCollision(zombie.x, candidateY, zombie.size)) {
    zombie.y = candidateY;
  }
}

/**
 * Apply zombie-vs-zombie separation to prevent stacking.
 * Mutates `zombie.x` / `zombie.y` in place when overlap detected.
 */
function applyZombieSeparation(zombie, zombieId, collisionManager) {
  const force = computeSeparationForce(zombie, zombieId, collisionManager);
  if (!force) {
    return;
  }
  const roomManager = collisionManager.gameState?.roomManager;
  applyWithWallCheck(zombie, zombie.x + force.x, zombie.y + force.y, roomManager);
  const clamped = clampToRoomBounds(zombie, zombie.x, zombie.y);
  zombie.x = clamped.finalX;
  zombie.y = clamped.finalY;
}

module.exports = { applyZombieSeparation };
