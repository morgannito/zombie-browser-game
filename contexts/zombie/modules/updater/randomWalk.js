/**
 * @fileoverview Zombie random-walk mover — extracted from ZombieUpdater.
 * @description When no player is visible the zombie wanders along a random
 *   heading, reroutes when blocked by walls. Pure SRP — wallCollision handles
 *   physics, this file handles only direction logic.
 */

const { resolveWallCollisions } = require('./wallCollision');

const RANDOM_HEADING_TTL_MS = 2000;
const BLOCK_RATIO_THRESHOLD = 0.5;
const AXIS_BLOCK_RATIO = 0.5;
const HEADING_VARIANCE = Math.PI / 2;

function shouldRefreshHeading(zombie, now) {
  return !zombie.randomMoveTimer || now - zombie.randomMoveTimer > RANDOM_HEADING_TTL_MS;
}

function initRandomHeading(zombie, now) {
  zombie.randomAngle = Math.random() * Math.PI * 2;
  zombie.randomMoveTimer = now;
}

function computeIntendedPosition(zombie, deltaTime) {
  const frameSpeed = zombie.speed * deltaTime;
  return {
    newX: zombie.x + Math.cos(zombie.randomAngle) * frameSpeed,
    newY: zombie.y + Math.sin(zombie.randomAngle) * frameSpeed
  };
}

function wasMovementBlocked(intendedDist, actualDist) {
  return intendedDist > 0.1 && actualDist < intendedDist * BLOCK_RATIO_THRESHOLD;
}

function pickHeadingAfterBlock(actualMoveX, actualMoveY, intendedMoveX, intendedMovY) {
  if (Math.abs(actualMoveX) < Math.abs(intendedMoveX) * AXIS_BLOCK_RATIO) {
    // X blocked → prefer Y axis
    return actualMoveY >= 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  if (Math.abs(actualMoveY) < Math.abs(intendedMovY) * AXIS_BLOCK_RATIO) {
    // Y blocked → prefer X axis
    return actualMoveX >= 0 ? 0 : Math.PI;
  }
  // Corner — pick fresh direction
  return Math.random() * Math.PI * 2;
}

function applyDeflection(zombie, intended, actual, now) {
  const intendedDist = Math.sqrt(intended.x * intended.x + intended.y * intended.y);
  const actualDist = Math.sqrt(actual.x * actual.x + actual.y * actual.y);
  if (!wasMovementBlocked(intendedDist, actualDist)) {
 return;
}
  const base = pickHeadingAfterBlock(actual.x, actual.y, intended.x, intended.y);
  const isCorner = base !== 0 && base !== Math.PI && base !== Math.PI / 2 && base !== -Math.PI / 2;
  zombie.randomAngle = isCorner ? base : base + ((Math.random() - 0.5) * HEADING_VARIANCE);
  zombie.randomMoveTimer = now;
}

function moveRandomly(zombie, now, roomManager, deltaTime = 1) {
  if (shouldRefreshHeading(zombie, now)) {
    initRandomHeading(zombie, now);
  }
  const { newX, newY } = computeIntendedPosition(zombie, deltaTime);
  const { finalX, finalY } = resolveWallCollisions(zombie, newX, newY, roomManager);
  const intended = { x: newX - zombie.x, y: newY - zombie.y };
  const actual = { x: finalX - zombie.x, y: finalY - zombie.y };
  // Velocity for client interpolation (see moveTowardsPlayer for rationale).
  const dtSafe = Math.max(deltaTime, 0.01);
  zombie.vx = (actual.x * 60) / dtSafe;
  zombie.vy = (actual.y * 60) / dtSafe;
  zombie.x = finalX;
  zombie.y = finalY;
  applyDeflection(zombie, intended, actual, now);
}

module.exports = { moveRandomly };
