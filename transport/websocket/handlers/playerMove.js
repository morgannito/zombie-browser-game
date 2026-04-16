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

function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE,
    safeHandler('playerMove', function (data) {
      // Resolve player first so we can always emit a positionCorrection
      // instead of silently dropping moves (silent drops cause client prediction
      // to drift far ahead → visible teleportation when server finally syncs).
      const player = gameState.players[socket.id];

      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateMovementData(data);
      if (!validatedData) {
        logger.warn('Invalid movement data received', { socketId: socket.id, data });
        if (player) {
          socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        }
        return;
      }

      // Rate limiting — emit correction so client can snap back instead of drifting
      if (!checkRateLimit(socket.id, 'playerMove')) {
        if (player) {
          socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        }
        return;
      }

      if (!player || !player.alive || !player.hasNickname) {
        // During respawn or pre-nickname window: tell client to hold position
        if (player) {
          socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        }
        return;
      } // Pas de mouvement sans pseudo

      // Clamp position to map boundaries (must match client-side clamping exactly!)
      // Client uses: wallThickness + playerSize for min, ROOM_WIDTH/HEIGHT - wallThickness - playerSize for max
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

      // VALIDATION: Vérifier la distance parcourue pour éviter la téléportation
      const distance = Math.sqrt(Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2));

      // ANTI-CHEAT: Valider que speedMultiplier n'est pas suspect
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

      // Leaky Bucket (Token Bucket) algorithm for movement validation
      // This handles:
      // 1. Normal movement (steady stream)
      // 2. Low FPS (large time gaps, large distance jumps)
      // 3. Lag bursts (accumulated time, sudden burst of packets)
      // 4. Speed hacks (drains budget)

      const now = Date.now();
      const lastMoveTime = player.lastMoveTime || now;
      // FIX(tp): cap timeDelta to prevent budget starvation after tab-unfocus
      // or massive lag bursts. Without this cap a 10s gap would accrue 3000px
      // of budget in one frame, which the next legit move can't spend fast
      // enough — causing false rejections on the following tick.
      const timeDelta = Math.min(now - lastMoveTime, 500);
      player.lastMoveTime = now;

      // CHECK STUN: Si le joueur est stunné, bloquer le mouvement
      if (player.stunned && player.stunnedUntil > now) {
        // Le joueur ne peut pas bouger pendant le stun
        socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        socket.emit(SOCKET_EVENTS.SERVER.STUNNED, { duration: player.stunnedUntil - now }); // Notifier le client
        return;
      } else if (player.stunned && player.stunnedUntil <= now) {
        // Fin du stun
        player.stunned = false;
        delete player.stunnedUntil;
        delete player.stunnedBy;
      }

      // Initialize budget if not present (start full)
      // Base speed: 5px/frame @ 60fps = 0.3px/ms
      const PIXELS_PER_MS = (CONFIG.PLAYER_SPEED * 60) / 1000;
      const MAX_BUDGET = PIXELS_PER_MS * 2000; // 2 seconds buffer (~600px)

      if (typeof player.moveBudget === 'undefined') {
        player.moveBudget = MAX_BUDGET;
      }

      // Calculate accrual rate
      const speedMultiplier = player.speedMultiplier || 1;
      const hasSpeedBoost = player.speedBoost && Date.now() < player.speedBoost;
      const boostMultiplier = hasSpeedBoost ? 2 : 1;

      // Accrue budget
      // 50% tolerance: diagonal movement real speed is √2 ≈ 1.414× base speed.
      // 1.2 was below √2 → budget drained on sustained diagonal → false rejections → teleportation.
      const ACCRUAL_FACTOR = 1.5;
      const accrued =
        timeDelta * PIXELS_PER_MS * speedMultiplier * boostMultiplier * ACCRUAL_FACTOR;

      player.moveBudget += accrued;

      // Cap budget
      if (player.moveBudget > MAX_BUDGET) {
        player.moveBudget = MAX_BUDGET;
      }

      // Check if move is valid
      // We allow a small overdraft (minAllowance) to prevent getting stuck on tiny floating point diffs
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

      // Deduct cost from budget
      player.moveBudget -= distance;
      // Prevent budget from going too negative (optional, but good for recovery)
      if (player.moveBudget < -100) {
        player.moveBudget = -100;
      }

      // Wall collision check. Use PLAYER_SIZE (full hitbox) matching client
      // to avoid server accepting moves that client blocks, which caused the
      // player to walk through walls visually then teleport back on next sync.
      if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE)) {
        player.x = newX;
        player.y = newY;
      } else {
        // Try sliding (single-axis movement) before rejecting
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
          // Even when sliding works, tell client the corrected (slid) position
          // so it doesn't keep predicting into the wall. 50px threshold absorbs
          // sliding/rounding noise but catches real desync.
          const clientDiff = Math.sqrt(
            Math.pow(validatedData.x - player.x, 2) + Math.pow(validatedData.y - player.y, 2)
          );
          if (clientDiff > 50) {
            socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
          }
        } else {
          // Full collision: always emit correction so client can't keep predicting into wall
          MetricsCollector.getInstance().recordMovementCorrection();
          socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
        }
      }

      player.angle = validatedData.angle;

      // Mettre à jour le timestamp d'activité
      player.lastActivityTime = Date.now();

      // MODE INFINI - Pas de portes ni de changements de salle
    })
  );
}

module.exports = { registerPlayerMoveHandler };
