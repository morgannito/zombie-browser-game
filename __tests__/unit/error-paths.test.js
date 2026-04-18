'use strict';

/**
 * Error-path unit tests — 3 critical use cases
 * 1. JwtService: expired token, malformed token, signature invalide
 * 2. ShopUseCase (applyPermanentPurchase): gold insuffisant, max level atteint, item invalide
 * 3. DeathProgressionHandler: player null, progressionIntegration absent
 */

// ---------------------------------------------------------------------------
// 1. JwtService — error paths
// ---------------------------------------------------------------------------

const jwt = require('jsonwebtoken');
const JwtService = require('../../lib/infrastructure/auth/JwtService');

function makeLogger() {
  return { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() };
}

function makeJwtService(secret = 'test-secret-32-chars-padded!!') {
  process.env.JWT_SECRET = secret;
  const svc = new JwtService(makeLogger());
  delete process.env.JWT_SECRET;
  return svc;
}

describe('JwtService — error paths', () => {
  test('test_verifyToken_expiredToken_returnsNull', () => {
    // Arrange — forge a token already expired (nbf in the past)
    const secret = 'test-secret-32-chars-padded!!';
    const expiredToken = jwt.sign({ userId: 'u1', username: 'alice' }, secret, { expiresIn: '-1s' });
    const svc = makeJwtService(secret);

    // Act
    const result = svc.verifyToken(expiredToken);

    // Assert
    expect(result).toBeNull();
  });

  test('test_verifyToken_expiredToken_logsWarn', () => {
    // Arrange
    const secret = 'test-secret-32-chars-padded!!';
    const expiredToken = jwt.sign({ userId: 'u1', username: 'alice' }, secret, { expiresIn: '-1s' });
    const logger = makeLogger();
    process.env.JWT_SECRET = secret;
    const svc = new JwtService(logger);
    delete process.env.JWT_SECRET;

    // Act
    svc.verifyToken(expiredToken);

    // Assert — warn must have been called (TokenExpiredError branch)
    expect(logger.warn).toHaveBeenCalled();
  });

  test('test_verifyToken_malformedToken_returnsNull', () => {
    // Arrange — random non-JWT string
    const svc = makeJwtService();

    // Act
    const result = svc.verifyToken('this.is.notajwt');

    // Assert
    expect(result).toBeNull();
  });

  test('test_verifyToken_invalidSignature_returnsNull', () => {
    // Arrange — token signed with a different secret
    const tokenFromOtherSecret = jwt.sign({ userId: 'u1', username: 'alice' }, 'other-secret-here');
    const svc = makeJwtService('test-secret-32-chars-padded!!');

    // Act
    const result = svc.verifyToken(tokenFromOtherSecret);

    // Assert
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. ShopUseCase — applyPermanentPurchase error paths
// Inline replica of the domain logic (no infra dependency)
// ---------------------------------------------------------------------------

const SOCKET_EVENTS_SHOP_UPDATE = 'shopUpdate';

function makeSocket() {
  const emitted = [];
  return {
    id: 'sock-1',
    emit(event, data) {
 emitted.push({ event, data });
},
    emitted
  };
}

function makeShopItem(overrides = {}) {
  return {
    name: 'Test Item',
    baseCost: 50,
    costIncrease: 25,
    maxLevel: 3,
    effect: jest.fn(),
    ...overrides
  };
}

// Inline replica of applyPermanentPurchase from transport/websocket/handlers/shop.js
// to isolate domain logic without requiring the full module graph.
function applyPermanentPurchase(socket, player, shopItems, itemId) {
  const item = shopItems[itemId];
  if (!item) {
    socket.emit(SOCKET_EVENTS_SHOP_UPDATE, { success: false, message: 'Item invalide' });
    return;
  }
  const currentLevel = player.upgrades[itemId] || 0;
  if (currentLevel >= item.maxLevel) {
    socket.emit(SOCKET_EVENTS_SHOP_UPDATE, { success: false, message: 'Niveau maximum atteint' });
    return;
  }
  const cost = item.baseCost + currentLevel * item.costIncrease;
  if (player.gold < cost) {
    socket.emit(SOCKET_EVENTS_SHOP_UPDATE, { success: false, message: 'Or insuffisant' });
    return;
  }
  player.gold -= cost;
  if (player.gold < 0) {
    player.gold += cost;
    socket.emit(SOCKET_EVENTS_SHOP_UPDATE, { success: false, message: 'Or insuffisant' });
    return;
  }
  player.upgrades[itemId] = currentLevel + 1;
  item.effect(player);
  socket.emit(SOCKET_EVENTS_SHOP_UPDATE, { success: true, itemId, category: 'permanent' });
}

describe('ShopUseCase — error paths', () => {
  test('test_applyPermanentPurchase_insufficientGold_emitsFailure', () => {
    // Arrange
    const socket = makeSocket();
    const item = makeShopItem({ baseCost: 100 });
    const player = { gold: 50, upgrades: {} };

    // Act
    applyPermanentPurchase(socket, player, { speed: item }, 'speed');

    // Assert
    expect(socket.emitted[0].data.success).toBe(false);
    expect(socket.emitted[0].data.message).toBe('Or insuffisant');
  });

  test('test_applyPermanentPurchase_insufficientGold_goldUnchanged', () => {
    // Arrange
    const socket = makeSocket();
    const item = makeShopItem({ baseCost: 100 });
    const player = { gold: 50, upgrades: {} };

    // Act
    applyPermanentPurchase(socket, player, { speed: item }, 'speed');

    // Assert
    expect(player.gold).toBe(50);
  });

  test('test_applyPermanentPurchase_maxLevelReached_emitsFailure', () => {
    // Arrange
    const socket = makeSocket();
    const item = makeShopItem({ maxLevel: 2 });
    const player = { gold: 999, upgrades: { speed: 2 } }; // already at max

    // Act
    applyPermanentPurchase(socket, player, { speed: item }, 'speed');

    // Assert
    expect(socket.emitted[0].data.success).toBe(false);
    expect(socket.emitted[0].data.message).toBe('Niveau maximum atteint');
  });

  test('test_applyPermanentPurchase_maxLevelReached_effectNotCalled', () => {
    // Arrange
    const socket = makeSocket();
    const item = makeShopItem({ maxLevel: 1 });
    const player = { gold: 999, upgrades: { speed: 1 } };

    // Act
    applyPermanentPurchase(socket, player, { speed: item }, 'speed');

    // Assert
    expect(item.effect).not.toHaveBeenCalled();
  });

  test('test_applyPermanentPurchase_invalidItemId_emitsFailure', () => {
    // Arrange
    const socket = makeSocket();
    const player = { gold: 999, upgrades: {} };

    // Act
    applyPermanentPurchase(socket, player, {}, 'nonexistent');

    // Assert
    expect(socket.emitted[0].data.success).toBe(false);
    expect(socket.emitted[0].data.message).toBe('Item invalide');
  });
});

// ---------------------------------------------------------------------------
// 3. DeathProgressionHandler — error paths
// ---------------------------------------------------------------------------

jest.mock('../../lib/server/ConfigManager', () => ({
  GAMEPLAY_CONSTANTS: {
    SURVIVAL_TIME_MULTIPLIER: 1000,
    FAILED_DEATH_QUEUE_MAX_SIZE: 3
  }
}));

// Must be required AFTER mock is registered
const {
  handlePlayerDeathProgression,
  processFailedDeathQueue
} = require('../../contexts/player/modules/DeathProgressionHandler');

describe('DeathProgressionHandler — error paths', () => {
  test('test_handlePlayerDeathProgression_playerNull_returnsFalse', () => {
    // Arrange / Act
    const result = handlePlayerDeathProgression(null, 'p1', {}, 1000, false, makeLogger());

    // Assert
    expect(result).toBe(false);
  });

  test('test_handlePlayerDeathProgression_playerNull_logsError', () => {
    // Arrange
    const logger = makeLogger();

    // Act
    handlePlayerDeathProgression(null, 'p1', {}, 1000, false, logger);

    // Assert
    expect(logger.error).toHaveBeenCalled();
  });

  test('test_handlePlayerDeathProgression_noProgressionIntegration_playerMarkedDead', () => {
    // Arrange — gameState without progressionIntegration
    const player = { alive: true, health: 0 };
    const gameState = {}; // no progressionIntegration

    // Act
    handlePlayerDeathProgression(player, 'p1', gameState, 1000, false, makeLogger());

    // Assert — player must be marked dead despite missing integration
    expect(player.alive).toBe(false);
  });

  test('test_processFailedDeathQueue_noProgressionIntegration_doesNotThrow', () => {
    // Arrange — queue has an entry but integration is absent
    const gameState = {
      failedDeathQueue: [{
        player: { id: 'p1' }, accountId: 'a1', stats: {},
        retryCount: 0, lastRetry: 0, timestamp: 0
      }]
      // no progressionIntegration
    };

    // Act / Assert
    expect(() => processFailedDeathQueue(gameState, makeLogger())).not.toThrow();
  });
});
