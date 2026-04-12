/**
 * @fileoverview Shop socket event handlers
 * @description Handles buyItem, shopOpened, shopClosed socket events.
 */

const logger = require('../lib/infrastructure/Logger');
const { SOCKET_EVENTS } = require('../shared/socketEvents');
const ConfigManager = require('../lib/server/ConfigManager');
const { validateBuyItemData } = require('../game/validationFunctions');
const { checkRateLimit } = require('./rateLimitStore');
const { safeHandler } = require('./socketUtils');

const { SHOP_ITEMS } = ConfigManager;

/**
 * Apply a permanent shop item purchase.
 * @param {Object} socket
 * @param {Object} player
 * @param {string} itemId
 */
function applyPermanentPurchase(socket, player, itemId) {
  const item = SHOP_ITEMS.permanent[itemId];
  if (!item) {
    logger.error('Item validation failed', { itemId, category: 'permanent' });
    return;
  }

  const currentLevel = player.upgrades[itemId] || 0;

  if (currentLevel >= item.maxLevel) {
    socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
      success: false,
      message: 'Niveau maximum atteint'
    });
    return;
  }

  const cost = item.baseCost + currentLevel * item.costIncrease;

  if (player.gold < cost) {
    socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
      success: false,
      message: 'Or insuffisant'
    });
    return;
  }

  player.gold -= cost;
  player.upgrades[itemId] = currentLevel + 1;
  item.effect(player);

  logger.info('Shop purchase completed', {
    socketId: socket.id,
    category: 'permanent',
    itemId,
    newLevel: player.upgrades[itemId],
    remainingGold: player.gold
  });
  socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
    success: true,
    itemId,
    category: 'permanent'
  });
}

/**
 * Apply a temporary shop item purchase.
 * @param {Object} socket
 * @param {Object} player
 * @param {string} itemId
 */
function applyTemporaryPurchase(socket, player, itemId) {
  const item = SHOP_ITEMS.temporary[itemId];
  if (!item) {
    logger.error('Temporary item validation failed', { itemId, category: 'temporary' });
    return;
  }

  if (player.gold < item.cost) {
    socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
      success: false,
      message: 'Or insuffisant'
    });
    return;
  }

  player.gold -= item.cost;
  item.effect(player);

  logger.info('Shop purchase completed', {
    socketId: socket.id,
    category: 'temporary',
    itemId,
    remainingGold: player.gold
  });
  socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
    success: true,
    itemId,
    category: 'temporary'
  });
}

/**
 * Register buyItem handler.
 * @param {Object} socket
 * @param {Object} gameState
 */
function registerBuyItemHandler(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.BUY_ITEM,
    safeHandler('buyItem', function (data) {
      logger.debug('Shop purchase request', {
        socketId: socket.id,
        itemId: data?.itemId,
        category: data?.category
      });

      const validatedData = validateBuyItemData(data);
      if (!validatedData) {
        logger.warn('Invalid buy item data received', { socketId: socket.id, data });
        socket.emit(SOCKET_EVENTS.SERVER.SHOP_UPDATE, {
          success: false,
          message: 'Item invalide'
        });
        return;
      }

      if (!checkRateLimit(socket.id, 'buyItem')) {
        logger.warn('Shop purchase rate limited', { socketId: socket.id });
        return;
      }

      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        logger.debug('Shop purchase ignored - invalid player state', {
          socketId: socket.id,
          exists: !!player,
          alive: player?.alive,
          hasNickname: player?.hasNickname
        });
        return;
      }

      player.lastActivityTime = Date.now();

      const { itemId, category } = validatedData;

      if (category === 'permanent') {
        applyPermanentPurchase(socket, player, itemId);
      } else if (category === 'temporary') {
        applyTemporaryPurchase(socket, player, itemId);
      }
    })
  );
}

/**
 * Register shopOpened and shopClosed handlers.
 * @param {Object} socket
 * @param {Object} gameState
 */
function registerShopHandlers(socket, gameState) {
  socket.on(
    SOCKET_EVENTS.CLIENT.SHOP_OPENED,
    safeHandler('shopOpened', function () {
      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now();
      player.invisible = true;
      player.invisibleEndTime = Infinity;
      logger.info('Player invisible - shop opened', { player: player.nickname || socket.id });
    })
  );

  socket.on(
    SOCKET_EVENTS.CLIENT.SHOP_CLOSED,
    safeHandler('shopClosed', function () {
      const player = gameState.players[socket.id];
      if (!player || !player.alive || !player.hasNickname) {
        return;
      }

      player.lastActivityTime = Date.now();
      player.invisible = false;
      player.invisibleEndTime = 0;
      logger.info('Player visible - shop closed', { player: player.nickname || socket.id });
    })
  );
}

module.exports = { registerBuyItemHandler, registerShopHandlers };
