/**
 * @fileoverview Zombie wall-collision resolver — extracted from ZombieUpdater.
 * @description 4-strategy resolver for zombie-vs-wall collisions:
 *   1. Fast path: free move.
 *   2. Axis slide: if one axis is clear, prefer that.
 *   3. Soft repulsion: normalised push away from the wall.
 *   4. Unstuck escape: emergency push toward room centre when deeply embedded.
 *   Each strategy lives in its own sub-function (<25 lines, complexity <10).
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

const REPULSION_STRENGTH = 0.5;
const UNSTUCK_MIN_SPEED = 3;
const STUCK_PENETRATION_THRESHOLD = 1;
const EPSILON = 0.001;

function clampToRoomBounds(zombie, x, y) {
  const margin = Math.max(1, (zombie.size || 0) + 1);
  return {
    finalX: Math.max(margin, Math.min(x, CONFIG.ROOM_WIDTH - margin)),
    finalY: Math.max(margin, Math.min(y, CONFIG.ROOM_HEIGHT - margin))
  };
}

function trySlideAlongWall(zombie, newX, newY, roomManager) {
  const xOnly = roomManager.checkWallCollision(newX, zombie.y, zombie.size);
  const yOnly = roomManager.checkWallCollision(zombie.x, newY, zombie.size);
  if (!xOnly && !yOnly) {
    const moveX = Math.abs(newX - zombie.x);
    const moveY = Math.abs(newY - zombie.y);
    return moveX > moveY ? { x: newX, y: zombie.y } : { x: zombie.x, y: newY };
  }
  if (!xOnly) {
 return { x: newX, y: zombie.y };
}
  if (!yOnly) {
 return { x: zombie.x, y: newY };
}
  return null;
}

function applyAxisPushFallback(zombie, pushedX, pushedY, roomManager) {
  let finalX = zombie.x;
  let finalY = zombie.y;
  if (!roomManager.checkWallCollision(pushedX, zombie.y, zombie.size)) {
    finalX = pushedX;
  }
  if (!roomManager.checkWallCollision(zombie.x, pushedY, zombie.size)) {
    finalY = pushedY;
  }
  return { x: finalX, y: finalY };
}

function applyRepulsion(zombie, collisionInfo, roomManager) {
  if (!collisionInfo.colliding || collisionInfo.penetration <= 0) {
    return { x: zombie.x, y: zombie.y };
  }
  const pushMag = Math.min(collisionInfo.penetration * REPULSION_STRENGTH, zombie.speed);
  const pushLen = Math.sqrt(
    collisionInfo.pushX * collisionInfo.pushX + collisionInfo.pushY * collisionInfo.pushY
  );
  if (pushLen <= EPSILON) {
 return { x: zombie.x, y: zombie.y };
}
  const pushedX = zombie.x + (collisionInfo.pushX / pushLen) * pushMag;
  const pushedY = zombie.y + (collisionInfo.pushY / pushLen) * pushMag;
  if (!roomManager.checkWallCollision(pushedX, pushedY, zombie.size)) {
    return { x: pushedX, y: pushedY };
  }
  return applyAxisPushFallback(zombie, pushedX, pushedY, roomManager);
}

function escapeIfStuck(zombie, finalX, finalY, roomManager) {
  const info = roomManager.getWallCollisionInfo(finalX, finalY, zombie.size);
  if (!info.colliding || info.penetration <= STUCK_PENETRATION_THRESHOLD) {
    return { x: finalX, y: finalY };
  }
  const toCenterX = CONFIG.ROOM_WIDTH / 2 - finalX;
  const toCenterY = CONFIG.ROOM_HEIGHT / 2 - finalY;
  const dist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
  if (dist <= EPSILON) {
 return { x: finalX, y: finalY };
}
  const speed = Math.max(zombie.speed, UNSTUCK_MIN_SPEED);
  return {
    x: finalX + (toCenterX / dist) * speed,
    y: finalY + (toCenterY / dist) * speed
  };
}

function resolveWallCollisions(zombie, newX, newY, roomManager) {
  if (!roomManager) {
    return clampToRoomBounds(zombie, newX, newY);
  }
  if (!roomManager.checkWallCollision(newX, newY, zombie.size)) {
    return clampToRoomBounds(zombie, newX, newY);
  }
  const collisionInfo = roomManager.getWallCollisionInfo(newX, newY, zombie.size);
  const slid = trySlideAlongWall(zombie, newX, newY, roomManager);
  const afterStrategy = slid || applyRepulsion(zombie, collisionInfo, roomManager);
  const unstuck = escapeIfStuck(zombie, afterStrategy.x, afterStrategy.y, roomManager);
  return clampToRoomBounds(zombie, unstuck.x, unstuck.y);
}

module.exports = { clampToRoomBounds, resolveWallCollisions };
