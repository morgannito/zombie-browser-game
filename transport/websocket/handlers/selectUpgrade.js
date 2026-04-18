/**
 * @fileoverview Level-up upgrade selection handler.
 * @description Validates the player's upgrade choice against the server-side
 * pendingUpgradeChoices (anti-cheat), applies the effect, and re-enables
 * visibility. Fourth slice of the socketHandlers split.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { validateUpgradeData } = require('../../../game/validationFunctions');
const ConfigManager = require('../../../lib/server/ConfigManager');
const logger = require('../../../infrastructure/logging/Logger');
const { getTelemetryCollector } = require('../../../infrastructure/telemetry/TelemetryCollector');

const { LEVEL_UP_UPGRADES } = ConfigManager;

/**
 * Register the selectUpgrade handler on a socket.
 *
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 */
function registerSelectUpgradeHandler(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SELECT_UPGRADE,
    safeHandler('selectUpgrade', function (data) {
      const validatedData = validateUpgradeData(data);
      if (!validatedData) {
        logger.warn('Invalid upgrade data received', { socketId: socket.id, data });
        socket.emit(SOCKET_EVENTS.SERVER.ERROR, {
          message: 'Upgrade invalide',
          code: 'INVALID_UPGRADE'
        });
        return;
      }

      if (!checkRateLimit(socket.id, 'selectUpgrade')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now();

      const upgrade = LEVEL_UP_UPGRADES[validatedData.upgradeId];
      if (!upgrade) {
        logger.error('Upgrade validation failed', { upgradeId: validatedData.upgradeId });
        return;
      }

      // ANTI-CHEAT: pendingUpgradeChoices is an array of batches (sub-arrays).
      const batches = player.pendingUpgradeChoices || [];
      const batchIndex = batches.findIndex(b => b.includes(validatedData.upgradeId));
      if (batchIndex === -1) {
        logger.warn('Anti-cheat: selectUpgrade not in pending choices', {
          player: player.nickname || socket.id,
          upgradeId: validatedData.upgradeId,
          pending: batches
        });
        return;
      }
      batches.splice(batchIndex, 1);
      player.pendingUpgradeChoices = batches;

      upgrade.effect(player);
      getTelemetryCollector().record('upgrade_select');

      player.invisible = false;
      player.invisibleEndTime = 0;

      socket.emit(SOCKET_EVENTS.SERVER.UPGRADE_SELECTED, {
        success: true,
        upgradeId: validatedData.upgradeId
      });
    })
  );
}

module.exports = { registerSelectUpgradeHandler };
