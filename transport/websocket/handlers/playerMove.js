/**
 * @fileoverview Player movement handler.
 * @description Validates every player move against a leaky-bucket move budget
 * (anti-cheat), clamps to world bounds, and honours stun / spawn protection.
 * Sixth slice of the socketHandlers.js split.
 */

const { SOCKET_EVENTS } = require("../events");
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { validateMovementData } = require('../../../game/validationFunctions');
const logger = require("../../../infrastructure/logging/Logger");
const MetricsCollector = require('../../../lib/infrastructure/MetricsCollector');
const ConfigManager = require('../../../lib/server/ConfigManager');

const { CONFIG } = ConfigManager;

function registerPlayerMoveHandler(socket, gameState, roomManager) {
  socket.on(
    SOCKET_EVENTS.CLIENT.PLAYER_MOVE,
    safeHandler('playerMove', function (data) {
      // VALIDATION: Vérifier et sanitize les données d'entrée
      const validatedData = validateMovementData(data);
      if (!validatedData) {
        logger.warn('Invalid movement data received', { socketId: socket.id, data });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'playerMove')) {
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
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
      const timeDelta = now - lastMoveTime;
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
      // Allow 20% tolerance for clock drift, network jitter, and diagonal movement approximation
      const ACCRUAL_FACTOR = 1.2;
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

      // Vérifier collision avec les murs
      // BUG FIX: Utiliser 0.8x au lieu de 0.5x pour éviter que le joueur traverse les murs
      // La valeur 0.5x était trop petite et permettait au joueur de passer à travers
      // La valeur 0.8x donne une légère tolérance pour le sliding tout en empêchant le passage
      if (!roomManager.checkWallCollision(newX, newY, CONFIG.PLAYER_SIZE * 0.8)) {
        player.x = newX;
        player.y = newY;
      } else {
        // BUG FIX: Essayer le sliding (mouvement sur un seul axe) avant de rejeter
        // Cela évite que le joueur reste "collé" aux murs
        let slideX = player.x;
        let slideY = player.y;

        // Essayer de glisser sur l'axe X
        if (!roomManager.checkWallCollision(newX, player.y, CONFIG.PLAYER_SIZE * 0.8)) {
          slideX = newX;
        }
        // Essayer de glisser sur l'axe Y
        if (!roomManager.checkWallCollision(player.x, newY, CONFIG.PLAYER_SIZE * 0.8)) {
          slideY = newY;
        }

        // Appliquer le sliding si on a pu bouger
        if (slideX !== player.x || slideY !== player.y) {
          player.x = slideX;
          player.y = slideY;
        } else {
          // Collision totale - envoyer correction de position au client
          // BUG FIX: Réduire le seuil de 20px à 10px pour une meilleure synchronisation
          const clientDistance = Math.sqrt(
            Math.pow(newX - player.x, 2) + Math.pow(newY - player.y, 2)
          );
          if (clientDistance > 10) {
            MetricsCollector.getInstance().recordMovementCorrection();
            socket.emit(SOCKET_EVENTS.SERVER.POSITION_CORRECTION, { x: player.x, y: player.y });
          }
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
