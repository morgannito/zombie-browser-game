/**
 * @fileoverview setNickname socket handler.
 * @description Validates and applies a player's chosen nickname:
 *   strict sanitisation, rate-limit, uniqueness, and optional account
 *   creation in the player repository when an accountId is present.
 */

const logger = require('../../../infrastructure/logging/Logger');
const { SOCKET_EVENTS } = require('../events');
const { checkRateLimit } = require('../../../sockets/rateLimitStore');
const { safeHandler } = require('../../../sockets/socketUtils');

const SPAWN_PROTECTION_MS = 3000;

function rejectIfAlreadyChosen(socket, player) {
  if (!player.hasNickname) {
return false;
}
  socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
    reason: 'Vous avez déjà choisi un pseudo'
  });
  return true;
}

function rejectIfRateLimited(socket, socketId) {
  if (checkRateLimit(socketId, 'setNickname')) {
return false;
}
  socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
    reason: 'Trop de tentatives. Attendez quelques secondes.'
  });
  return true;
}

function sanitizeNickname(raw) {
  const trimmed = (typeof raw === 'string' ? raw.slice(0, 20) : '').trim();
  return trimmed.replace(/[^a-zA-Z0-9\s\-_]/g, '').substring(0, 15);
}

function rejectIfTooShort(socket, nickname) {
  if (nickname.length >= 2) {
return false;
}
  socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
    reason: 'Le pseudo doit contenir au moins 2 caractères alphanumériques'
  });
  return true;
}

function isDuplicate(players, socketId, nickname) {
  return Object.values(players).some(
    p => p.id !== socketId && p.nickname && p.nickname.toLowerCase() === nickname.toLowerCase()
  );
}

async function ensurePlayerInDb(container, accountId, nickname) {
  if (!container || !accountId) {
return;
}
  try {
    const playerRepository = container.get('playerRepository');
    const existingPlayer = await playerRepository.findById(accountId);
    if (!existingPlayer) {
      const createPlayerUseCase = container.get('createPlayerUseCase');
      await createPlayerUseCase.execute({ id: accountId, username: nickname });
      logger.info('Player created in database', { accountId });
    }
  } catch (error) {
    logger.warn('Failed to ensure player exists in database', {
      accountId, error: error.message
    });
  }
}

function applyNickname(player, nickname) {
  player.nickname = nickname;
  player.hasNickname = true;
  player.spawnProtection = true;
  player.spawnProtectionEndTime = Date.now() + SPAWN_PROTECTION_MS;
}

/**
 * Register the setNickname socket handler.
 * @param {import('socket.io').Socket} socket
 * @param {Object} gameState
 * @param {import('socket.io').Server} io
 * @param {Object|null} container - DI container for player repository access
 * @returns {void}
 */
function registerSetNicknameHandler(socket, gameState, io, container) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SET_NICKNAME,
    safeHandler('setNickname', async function (data) {
      const player = gameState.players[socket.id];
      if (!player) {
return;
}
      if (rejectIfAlreadyChosen(socket, player)) {
return;
}
      if (rejectIfRateLimited(socket, socket.id)) {
return;
}

      player.lastActivityTime = Date.now();
      const nickname = sanitizeNickname(data?.nickname);
      if (rejectIfTooShort(socket, nickname)) {
return;
}
      if (isDuplicate(gameState.players, socket.id, nickname)) {
        socket.emit(SOCKET_EVENTS.SERVER.NICKNAME_REJECTED, {
          reason: 'Ce pseudo est déjà utilisé par un autre joueur'
        });
        return;
      }

      applyNickname(player, nickname);
      logger.info('Player chose nickname', { socketId: socket.id });

      const accountId = player.accountId || socket.userId || null;
      await ensurePlayerInDb(container, accountId, nickname);

      io.emit(SOCKET_EVENTS.SERVER.PLAYER_NICKNAME_SET, {
        playerId: socket.id, nickname
      });
    })
  );
}

module.exports = { registerSetNicknameHandler };
