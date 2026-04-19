/**
 * @fileoverview Shared utilities for boss abilities
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

const AOI_HALF_WIDTH = 1600;
const AOI_HALF_HEIGHT = 900;

/**
 * Emit a socket event to all players within the Area of Interest around a position.
 * @param {import('socket.io').Server} io
 * @param {string} event
 * @param {object} payload
 * @param {number} bossX
 * @param {number} bossY
 * @param {object} gameState
 */
function emitAOI(io, event, payload, bossX, bossY, gameState) {
  const sockets = io && io.sockets && io.sockets.sockets;
  if (!sockets) {
    // Fallback for environments without socket map (e.g. tests): broadcast directly.
    if (io && typeof io.emit === 'function') {
      io.emit(event, payload);
    }
    return;
  }
  for (const [socketId, socket] of sockets) {
    const player = gameState.players[socketId];
    if (!player || !player.alive) {
      continue;
    }
    if (
      Math.abs(player.x - bossX) <= AOI_HALF_WIDTH &&
      Math.abs(player.y - bossY) <= AOI_HALF_HEIGHT
    ) {
      socket.emit(event, payload);
    }
  }
}

/**
 * Clamp coordinates to room bounds with a margin equal to zombie size.
 * @param {object} zombie
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, y: number }}
 */
function clampToRoomBounds(zombie, x, y) {
  const margin = Math.max(1, (zombie.size || CONFIG.ZOMBIE_SIZE || 20) + 1);
  return {
    x: Math.max(margin, Math.min(x, CONFIG.ROOM_WIDTH - margin)),
    y: Math.max(margin, Math.min(y, CONFIG.ROOM_HEIGHT - margin))
  };
}

/**
 * Move a zombie to target coordinates, clamping to room bounds and checking walls.
 * @param {object} zombie
 * @param {number} targetX
 * @param {number} targetY
 * @param {object} gameState
 * @returns {boolean} True if the move was applied.
 */
function moveZombieSafely(zombie, targetX, targetY, gameState) {
  const clamped = clampToRoomBounds(zombie, targetX, targetY);
  const roomManager = gameState?.roomManager;
  if (roomManager && roomManager.checkWallCollision(clamped.x, clamped.y, zombie.size)) {
    return false;
  }
  zombie.x = clamped.x;
  zombie.y = clamped.y;
  return true;
}

/**
 * Apply damage to a player, respecting armor if present.
 * Armor reduces incoming damage multiplicatively (0 = no armor, 1 = full immunity).
 * @param {object} player
 * @param {number} amount  Raw damage before armor reduction.
 * @returns {number} Actual damage applied.
 */
function applyDamage(player, amount) {
  const reduction = player.armor > 0 ? player.armor : 0;
  const actual = amount * (1 - reduction);
  player.health -= actual;
  return actual;
}

/**
 * Kill a player: mark as dead and increment death counter.
 * Must only be called when player.health <= 0.
 * @param {object} player
 */
function killPlayer(player) {
  player.alive = false;
  player.deaths = (player.deaths || 0) + 1;
}

/**
 * Check whether a zombie-shaped entity can be placed at (x, y).
 * Returns true if no room manager is available.
 * @param {object} zombie - must expose `size`
 * @param {number} x
 * @param {number} y
 * @param {object} gameState
 * @returns {boolean}
 */
function canPlaceZombieAt(zombie, x, y, gameState) {
  const roomManager = gameState?.roomManager;
  if (!roomManager) {
    return true;
  }
  return !roomManager.checkWallCollision(x, y, zombie.size);
}

module.exports = {
  emitAOI,
  clampToRoomBounds,
  moveZombieSafely,
  applyDamage,
  killPlayer,
  canPlaceZombieAt
};
