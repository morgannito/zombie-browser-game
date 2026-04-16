/**
 * @fileoverview Player movement handler.
 * @description Validates every player move against a leaky-bucket move budget
 * (anti-cheat), clamps to world bounds, and honours stun / spawn protection.
 * Sixth slice of the socketHandlers.js split.
 */

const { SOCKET_EVENTS } = require('../events');
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { validateMovementData } = require('../../../game/validationFunctions');
const logger = require('../../../infrastructure/logging/Logger');
const MetricsCollector = require('../../../infrastructure/metrics/MetricsCollector');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

/**
 * Process a single validated move payload through the full anti-cheat pipeline.
 * Extracted so both playerMove and playerMoveBatch can share the same logic.
 *
 * Supports two payload formats:
 *   - Absolute: { x, y, angle }   — legacy playerMove format
 *   - Delta:    { dx, dy, angle } — compact batch format (server reconstructs x,y)
 *
 * @param {object} socket
 * @param {object} gameState
 * @param {object} roomManager
 * @param {object} data - Raw move data
 */
function _processSingleMove(socket, gameState, roomManager, data) {
  const player = gameState.players[socket.id];

  // Reconstruct absolute position from delta format (batch items use dx/dy).
  let absoluteData = data;
  if (data && typeof data.dx === 'number' && typeof data.dy === 'number' && player) {
    absoluteData = { x: player.x + data.dx, y: player.y + data.dy, angle: data.angle };
  }

  const validatedData = validateMovementData(absoluteData);
  if (!validatedData) {
    logger.warn('Invalid movement data received', { socketId: socket.id, data });
    if (player) {
      socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    }
    return;
  }

  if (!checkRateLimit(socket.id, 'playerMove')) {
    if (player) {
      socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    }
    return;
  }

  if (!player || !player.alive || !player.hasNickname) {
    if (player) {
      socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    }
    return;
  }

  const wallThickness = CONFIG.WALL_THICKNESS || 40;
  const playerSize = CONFIG.PLAYER_SIZE || 20;

  const newX = Math.max(
    wallThickness + playerSize,
    Math.min(CONFIG.ROOM_WIDTH - wallThickness - playerSize, validatedData.x)
  );
  const newY = Math.max(
    wallThickness + playerSize,
    Math.min(CONFIG.ROOM_HEIGHT - wallThickness - playerSize, validatedData.y)
  );

  const distance = Math.sqrt(Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2));

  if (player.speedMultiplier > 5) {
    logger.warn('Anti-cheat: Suspicious speedMultiplier detected', {
      player: player.nickname || socket.id,
      speedMultiplier: player.speedMultiplier
    });
    MetricsCollector.getInstance().recordCheatAttempt('speed_multiplier');
    if (MetricsCollector.getInstance().recordViolation(socket.id)) {
      MetricsCollector.getInstance().metrics.anticheat.player_disconnects_total++;
      MetricsCollector.getInstance().clearViolations(socket.id);
      socket.disconnect(true);
      return;
    }
    player.speedMultiplier = 1;
  }

  const now = Date.now();
  const lastMoveTime = player.lastMoveTime || now;
  const timeDelta = Math.min(now - lastMoveTime, 500);
  player.lastMoveTime = now;

  if (player.stunned && player.stunnedUntil > now) {
    socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    socket.emit(SOCKET_EVENTS.SERVER.STUNNED, { duration: player.stunnedUntil - now });
    return;
  } else if (player.stunned && player.stunnedUntil <= now) {
    player.stunned = false;
    delete player.stunnedUntil;
    delete player.stunnedBy;
  }

  const PIXELS_PER_MS = (CONFIG.PLAYER_SPEED * 60) / 1000;
  const MAX_BUDGET = PIXELS_PER_MS * 2000;

  if (typeof player.moveBudget === 'undefined') {
    player.moveBudget = MAX_BUDGET;
  }

  const speedMultiplier = player.speedMultiplier || 1;
  const hasSpeedBoost = player.speedBoost && Date.now() < player.speedBoost;
  const boostMultiplier = hasSpeedBoost ? 2 : 1;
  const ACCRUAL_FACTOR = 1.5;
  const accrued = timeDelta * PIXELS_PER_MS * speedMultiplier * boostMultiplier * ACCRUAL_FACTOR;

  player.moveBudget += accrued;
  if (player.moveBudget > MAX_BUDGET) {
    player.moveBudget = MAX_BUDGET;
  }

  const minAllowance = 20;

  if (distance > player.moveBudget + minAllowance) {
    logger.warn('Anti-cheat: Movement rejected - exceeded budget', {
      player: player.nickname || socket.id,
      distance: Math.round(distance),
      budget: Math.round(player.moveBudget)
    });
    MetricsCollector.getInstance().recordCheatAttempt('movement_budget');
    MetricsCollector.getInstance().recordMovementCorrection();
    if (MetricsCollector.getInstance().recordViolation(socket.id)) {
      MetricsCollector.getInstance().metrics.anticheat.player_disconnects_total++;
      MetricsCollector.getInstance().clearViolations(socket.id);
      socket.disconnect(true);
      return;
    }
    socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    return;
  }

  player.moveBudget -= distance;
  if (player.moveBudget < -100) {
    player.moveBudget = -100;
  }

  if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE)) {
    player.x = newX;
    player.y = newY;
  } else {
    let slideX = player.x;
    let slideY = player.y;

    if (!roomManager.checkWallCollision(newX, player.y, CONFIG.PLAYER_SIZE)) {
      slideX = newX;
    }
    if (!roomManager.checkWallCollision(player.x, newY, CONFIG.PLAYER_SIZE)) {
      slideY = newY;
    }

    if (slideX !== player.x || slideY !== player.y) {
      player.x = slideX;
      player.y = slideY;
      const clientDiff = Math.sqrt(
        Math.pow(validatedData.x - player.x, 2) + Math.pow(validatedData.y - player.y, 2)
      );
      if (clientDiff > 50) {
        socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
      }
    } else {
      MetricsCollector.getInstance().recordMovementCorrection();
      socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
    }
  }

  player.angle = validatedData.angle;
  player.lastActivityTime = Date.now();
}

function registerPlayerMoveHandler(socket, gameState, roomManager) {
  // Batched move event: array of up to 8 moves accumulated client-side.
  // Items may be absolute {x,y,angle} or delta {dx,dy,angle}. Replaying
  // sequentially preserves anti-cheat leaky-bucket semantics.
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH,
    safeHandler('playerMoveBatch', function (batch) {
      if (!Array.isArray(batch) || batch.length === 0 || batch.length > 8) {
        logger.warn('Invalid playerMoveBatch payload', { socketId: socket.id, len: batch?.length });
        return;
      }
      for (const move of batch) {
        _processSingleMove(socket, gameState, roomManager, move);
      }
    })
  );
}

module.exports = { registerPlayerMoveHandler };
