/**
 * @fileoverview Shared utilities for boss abilities
 */

const ConfigManager = require('../../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

const AOI_HALF_WIDTH = 1600;
const AOI_HALF_HEIGHT = 900;

function emitAOI(io, event, payload, bossX, bossY, gameState) {
  const sockets = io && io.sockets && io.sockets.sockets;
  if (!sockets) {
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

function clampToRoomBounds(zombie, x, y) {
  const margin = Math.max(1, (zombie.size || CONFIG.ZOMBIE_SIZE || 20) + 1);
  return {
    x: Math.max(margin, Math.min(x, CONFIG.ROOM_WIDTH - margin)),
    y: Math.max(margin, Math.min(y, CONFIG.ROOM_HEIGHT - margin))
  };
}

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

module.exports = { emitAOI, clampToRoomBounds, moveZombieSafely };
