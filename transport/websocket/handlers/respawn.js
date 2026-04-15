/**
 * @fileoverview Respawn handler.
 * @description Resets player run state while preserving persistent progression
 * (level, upgrades). Second slice extracted from sockets/socketHandlers.js per
 * REFACTOR_PLAN.md Phase 1.
 */

const { SOCKET_EVENTS } = require('../../../shared/socketEvents');
const { safeHandler } = require('../../../sockets/socketUtils');
const { cleanupPlayerBullets } = require('../../../game/utilityFunctions');
const {
  savePlayerProgressionSnapshot,
  resetPlayerRunState,
  restorePlayerProgression
} = require('../../../game/modules/player/RespawnHelpers');
const ConfigManager = require('../../../lib/server/ConfigManager');
const { CONFIG } = ConfigManager;

/**
 * Register the respawn handler on a socket.
 * Snapshots progression, clears run state (health, position, bullets),
 * then restores progression so persistent upgrades survive death.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 * @param {Object} entityManager
 */
function registerRespawnHandler(socket, gameState, entityManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.RESPAWN,
    safeHandler('respawn', function () {
      const player = gameState.players[socket.id];
      if (!player) {
        return;
      }
      player.lastActivityTime = Date.now();

      const snapshot = savePlayerProgressionSnapshot(player);
      const totalMaxHealth =
        CONFIG.PLAYER_MAX_HEALTH + (snapshot.upgrades.maxHealth || 0) * 20;

      cleanupPlayerBullets(socket.id, gameState, entityManager);
      resetPlayerRunState(player, CONFIG, totalMaxHealth);
      restorePlayerProgression(player, snapshot);
    })
  );
}

module.exports = { registerRespawnHandler };
