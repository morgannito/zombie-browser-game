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
/**
 * Maximum combined speed multiplier (speedMultiplier × boostMultiplier) applied
 * during budget accrual. Prevents a slow-attack exploit where an idle player
 * accumulates a large budget via stacked multipliers then teleports in one move.
 */
const MAX_ACCRUAL_MULTIPLIER = 3;
/**
 * Threshold above which player.speedMultiplier is considered suspicious.
 * Worst-case legitimate stack: base(1) × milestone-lvl10(×1.20) × 12 shop ×
 * skill ≈ 8. Threshold is 10 to provide headroom and avoid false positives.
 */
const SUSPICIOUS_SPEED_THRESHOLD = 10;
// Anti-cheat leaky-bucket: disabled by default. Set ENABLE_ANTICHEAT=true to activate.
const ENABLE_ANTICHEAT = process.env.ENABLE_ANTICHEAT === 'true';

/**
 * Returns false if the player is not eligible to move (alive, nickname, rate-limit).
 * @param {object} socket
 * @param {object} player
 * @returns {boolean}
 */
function _validateAndRateLimit(socket, player) {
  if (!player || !player.alive || !player.hasNickname) {
return false;
}
  if (!checkRateLimit(socket.id, 'playerMove')) {
return false;
}
  return true;
}

/**
 * Clamps validated position to world bounds.
 * @param {object} validatedData
 * @param {object} config
 * @returns {{ newX: number, newY: number }}
 */
function _resolveMovementPosition(validatedData, config) {
  const wallThickness = config.WALL_THICKNESS || 40;
  const playerSize = config.PLAYER_SIZE || 20;
  const newX = Math.max(
    wallThickness + playerSize,
    Math.min(config.ROOM_WIDTH - wallThickness - playerSize, validatedData.x)
  );
  const newY = Math.max(
    wallThickness + playerSize,
    Math.min(config.ROOM_HEIGHT - wallThickness - playerSize, validatedData.y)
  );
  return { newX, newY };
}

/**
 * Handles stun state. Returns true if the move must be rejected due to active stun.
 * @param {object} player
 * @param {object} socket
 * @param {number} now
 * @returns {boolean}
 */
function _applyStunCheck(player, socket, now) {
  if (player.stunned && player.stunnedUntil > now) {
    socket.emit(SOCKET_EVENTS.SERVER.STUNNED, { duration: player.stunnedUntil - now });
    return true;
  }
  if (player.stunned && player.stunnedUntil <= now) {
    player.stunned = false;
    delete player.stunnedUntil;
    delete player.stunnedBy;
  }
  return false;
}

/**
 * Applies newX/newY to player with wall-slide fallback.
 * @param {object} player
 * @param {number} newX
 * @param {number} newY
 * @param {object} roomManager
 */
function _applyMovementToPlayer(player, newX, newY, roomManager) {
  // Accept client position if walkable, else slide along the walkable axis.
  // No positionCorrection emit — the broadcast stream carries x/y and the
  // client reconciles from there when drift is large.
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
}

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
  /** @type {import('../../../types/jsdoc-types').PlayerState|undefined} */
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
  if (!validatedData) {
return;
}
  if (!_validateAndRateLimit(socket, player)) {
return;
}

  const now = Date.now();
  const lastMoveTime = player.lastMoveTime || now;
  const timeDelta = Math.min(now - lastMoveTime, 500);
  player.lastMoveTime = now;

  if (_applyStunCheck(player, socket, now)) {
return;
}

  if (ENABLE_ANTICHEAT && player.speedMultiplier > SUSPICIOUS_SPEED_THRESHOLD) {
    logger.warn('Anti-cheat: Suspicious speedMultiplier detected', { player: player.nickname || socket.id, speedMultiplier: player.speedMultiplier, traceId: socket.traceId || null });
    _mc.recordCheatAttempt('speed_multiplier');
    if (_mc.recordViolation(socket.id)) {
      _mc.metrics.anticheat.player_disconnects_total++;
      _mc.clearViolations(socket.id);
      socket.disconnect(true);
      return;
    }
    player.speedMultiplier = 1;
  }

  if (typeof player.moveBudget === 'undefined') {
player.moveBudget = MAX_BUDGET;
}
  const speedMultiplier = player.speedMultiplier || 1;
  const boostMultiplier = (player.speedBoost && now < player.speedBoost) ? 2 : 1;
  player.moveBudget = Math.min(MAX_BUDGET, player.moveBudget + timeDelta * PIXELS_PER_MS * Math.min(speedMultiplier * boostMultiplier, MAX_ACCRUAL_MULTIPLIER) * ACCRUAL_FACTOR);

  const { newX, newY } = _resolveMovementPosition(validatedData, CONFIG);

  if (ENABLE_ANTICHEAT) {
    const dx = newX - player.x;
    const dy = newY - player.y;
    const distanceSq = dx * dx + dy * dy;
    const budgetPlusAllowance = player.moveBudget + MIN_ALLOWANCE;
    if (distanceSq > budgetPlusAllowance * budgetPlusAllowance) {
      const distance = Math.sqrt(distanceSq);
      logger.warn('Anti-cheat: Movement rejected - exceeded budget', { player: player.nickname || socket.id, distance: Math.round(distance), budget: Math.round(player.moveBudget), traceId: socket.traceId || null });
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
    player.moveBudget = Math.max(-100, player.moveBudget - Math.sqrt(distanceSq));
  }

  _applyMovementToPlayer(player, newX, newY, roomManager);
  player.angle = validatedData.angle;
  player.lastActivityTime = Date.now();
}

function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE,
    safeHandler('playerMove', function (data) {
      if (socket.spectator) {
return;
}
      if (!data || typeof data !== 'object') {
return;
}
      // DoS guard: reject oversized payloads before any further processing.
      if (Buffer.byteLength(JSON.stringify(data), 'utf8') > 512) {
        logger.warn('playerMove: oversized payload rejected', { socketId: socket.id, traceId: socket.traceId || null });
        return;
      }
      _processSingleMove(socket, gameState, roomManager, data);
    })
  );

  // Legacy batch entry-point kept for any old clients still buffering locally.
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE_BATCH,
    safeHandler('playerMoveBatch', function (batch) {
      if (socket.spectator) {
return;
}
      if (!Array.isArray(batch) || batch.length === 0 || batch.length > 8) {
        logger.warn('Invalid playerMoveBatch payload', { socketId: socket.id, len: batch?.length, traceId: socket.traceId || null });
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
