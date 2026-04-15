/**
 * @fileoverview Nickname handler.
 * @description Validates client nickname, rate-limits, stores it, and (if an
 * accountId is present) ensures the player row exists in the DB through the
 * Container's CreatePlayerUseCase. Eighth slice of the socketHandlers split.
 */

const { SOCKET_EVENTS } = require('../../../shared/socketEvents');
const { safeHandler } = require('../../../sockets/socketUtils');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const logger = require('../../../lib/infrastructure/Logger');

function registerSetNicknameHandler(socket, gameState, io, container) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SET_NICKNAME,
    safeHandler('setNickname', async function (data) {
      const player = gameState.players[socket.id];
      if (!player) {
        return;
      }

      // CORRECTION CRITIQUE: Vérifier si le joueur a déjà un pseudo AVANT rate limiting
      if (player.hasNickname) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Vous avez déjà choisi un pseudo'
        });
        return;
      }

      // Rate limiting
      if (!checkRateLimit(socket.id, 'setNickname')) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Trop de tentatives. Attendez quelques secondes.'
        });
        return;
      }

      player.lastActivityTime = Date.now(); // Mettre à jour l'activité

      // VALIDATION STRICTE DU PSEUDO
      const rawNick = typeof data.nickname === 'string' ? data.nickname.slice(0, 20) : '';
      let nickname = rawNick.trim();

      // Filtrer caractères non autorisés (lettres, chiffres, espaces, tirets, underscores)
      nickname = nickname.replace(/[^a-zA-Z0-9\s\-_]/g, '');

      // Limiter à 15 caractères max
      nickname = nickname.substring(0, 15);

      // Vérifier longueur minimale
      if (nickname.length < 2) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Le pseudo doit contenir au moins 2 caractères alphanumériques'
        });
        return;
      }

      // Vérifier si le pseudo n'est pas déjà pris par un autre joueur
      const isDuplicate = Object.values(gameState.players).some(
        p => p.id !== socket.id && p.nickname && p.nickname.toLowerCase() === nickname.toLowerCase()
      );

      if (isDuplicate) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Ce pseudo est déjà utilisé par un autre joueur'
        });
        return;
      }

      player.nickname = nickname;
      player.hasNickname = true;
      player.spawnProtection = true;
      player.spawnProtectionEndTime = Date.now() + 3000; // 3 secondes de protection

      logger.info('Player chose nickname', { socketId: socket.id });

      const accountId = player.accountId || socket.userId || null;
      if (container && accountId) {
        try {
          const playerRepository = container.get('playerRepository');
          const existingPlayer = await playerRepository.findById(accountId);
          if (!existingPlayer) {
            const createPlayerUseCase = container.get('createPlayerUseCase');
            await createPlayerUseCase.execute({
              id: accountId,
              username: nickname
            });
            logger.info('Player created in database', { accountId });
          }
        } catch (error) {
          // Log but don't block gameplay - player creation is optional for progression features
          logger.warn('Failed to ensure player exists in database', {
            accountId,
            error: error.message
          });
        }
      }

      // Notifier tous les joueurs
      io.emit(SOCKET_EVENTS.SERVER.PLAYER_NICKNAME_SET, {
        playerId: socket.id,
        nickname: nickname
      });
    })
  );
}

module.exports = { registerSetNicknameHandler };
