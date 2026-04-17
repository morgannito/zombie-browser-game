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

// PERF: hoist constants derived from CONFIG — avoids recomputing per move.
const _mc = MetricsCollector.getInstance();
const PIXELS_PER_MS = (CONFIG.PLAYER_SPEED * 60) / 1000;
const MAX_BUDGET = PIXELS_PER_MS * 2000;
const ACCRUAL_FACTOR = 1.5;
const MIN_ALLOWANCE = 100;
// Anti-cheat leaky-bucket disabled: it was causing rubber-band corrections
// fighting the client prediction. Reactivate later when the movement pipeline
// is stable by flipping this back to false (or gating on an env var).
const DISABLE_ANTICHEAT = true;

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

  // Sequence check — drop out-of-order / replayed batch items.
  if (player && data && typeof data.seq === 'number') {
    const lastSeq = player.lastMoveSeq || 0;
    if (data.seq <= lastSeq) {
      return;
    }
    player.lastMoveSeq = data.seq;
  }

  // Reconstruct absolute position from delta format (batch items use dx/dy).
  let absoluteData = data;
  if (data && typeof data.dx === 'number' && typeof data.dy === 'number' && player) {
    absoluteData = { x: player.x + data.dx, y: player.y + data.dy, angle: data.angle };
  }

  const validatedData = validateMovementData(absoluteData);
  if (!validatedData) return;
  if (!checkRateLimit(socket.id, 'playerMove')) return;
  if (!player || !player.alive || !player.hasNickname) return;

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

  // PERF: squared distance avoids Math.sqrt in ~80% of moves that pass budget.
  const dx = newX - player.x;
  const dy = newY - player.y;
  const distanceSq = dx * dx + dy * dy;

  if (!DISABLE_ANTICHEAT && player.speedMultiplier > 5) {
    logger.warn('Anti-cheat: Suspicious speedMultiplier detected', {
      player: player.nickname || socket.id,
      speedMultiplier: player.speedMultiplier
    });
    _mc.recordCheatAttempt('speed_multiplier');
    if (_mc.recordViolation(socket.id)) {
      _mc.metrics.anticheat.player_disconnects_total++;
      _mc.clearViolations(socket.id);
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
    socket.emit(SOCKET_EVENTS.SERVER.STUNNED, { duration: player.stunnedUntil - now });
    return;
  } else if (player.stunned && player.stunnedUntil <= now) {
    player.stunned = false;
    delete player.stunnedUntil;
    delete player.stunnedBy;
  }

  if (typeof player.moveBudget === 'undefined') {
    player.moveBudget = MAX_BUDGET;
  }

  const speedMultiplier = player.speedMultiplier || 1;
  const hasSpeedBoost = player.speedBoost && now < player.speedBoost;
  const boostMultiplier = hasSpeedBoost ? 2 : 1;
  const accrued = timeDelta * PIXELS_PER_MS * speedMultiplier * boostMultiplier * ACCRUAL_FACTOR;

  player.moveBudget += accrued;
  if (player.moveBudget > MAX_BUDGET) {
    player.moveBudget = MAX_BUDGET;
  }

  // Leaky-bucket movement budget disabled. Re-enable by wrapping this block
  // with `if (!DISABLE_ANTICHEAT)` once the prediction + interpolation loop
  // is stable.
  if (!DISABLE_ANTICHEAT) {
    const budgetPlusAllowance = player.moveBudget + MIN_ALLOWANCE;
    if (distanceSq > budgetPlusAllowance * budgetPlusAllowance) {
      const distance = Math.sqrt(distanceSq);
      logger.warn('Anti-cheat: Movement rejected - exceeded budget', {
        player: player.nickname || socket.id,
        distance: Math.round(distance),
        budget: Math.round(player.moveBudget)
      });
      _mc.recordCheatAttempt('movement_budget');
      _mc.recordMovementCorrection();
      if (_mc.recordViolation(socket.id)) {
        _mc.metrics.anticheat.player_disconnects_total++;
        _mc.clearViolations(socket.id);
        socket.disconnect(true);
        return;
      }
      socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
      return;
    }
    const distance = Math.sqrt(distanceSq);
    player.moveBudget -= distance;
    if (player.moveBudget < -100) {
      player.moveBudget = -100;
    }
  }

  // Wall collision: accept client position if walkable, else slide along the
  // axis that IS walkable, else keep server position. No explicit
  // positionCorrection emit — the regular broadcast stream carries x/y and
  // the client reconciles from there when the drift is large.
  if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE)) {
    player.x = newX;
    player.y = newY;
  } else {
    if (!roomManager.checkWallCollision(newX, player.y, CONFIG.PLAYER_SIZE)) {
      player.x = newX;
    }
    if (!roomManager.checkWallCollision(player.x, newY, CONFIG.PLAYER_SIZE)) {
      player.y = newY;
    }
  }

  player.angle = validatedData.angle;
  player.lastActivityTime = Date.now();
}

function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE,
    safeHandler('playerMove', function (data) {
      if (!data || typeof data !== 'object') return;
      _processSingleMove(socket, gameState, roomManager, data);
    })
  );

  // Legacy batch entry-point kept for any old clients still buffering locally.
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
      const player = gameState.players[socket.id];
      if (player && typeof player.lastMoveSeq === 'number') {
        socket.emit(SOCKET_EVENTS.SERVER.MOVE_ACK, {
          seq: player.lastMoveSeq,
          x: player.x,
          y: player.y
        });
      }
    })
  );
}

module.exports = { registerPlayerMoveHandler };
