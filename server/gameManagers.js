/**
 * @fileoverview Game managers factory — extracted from server.js startServer.
 * @description Wires the in-process game managers (entity, collision, network,
 *   room, mutator, zombie) and performs cross-wiring via gameState.
 */

const EntityManager = require('../lib/server/EntityManager');
const CollisionManager = require('../contexts/weapons/CollisionManager');
const NetworkManager = require('../lib/server/NetworkManager');
const RoomManager = require("../contexts/wave/RoomManager");
const RunMutatorManager = require('../lib/server/RunMutatorManager');
const ZombieManager = require('../contexts/zombie/ZombieManager');
const logger = require('../lib/infrastructure/Logger');

function buildZombieManager(gameState, config, zombieTypes, roomManager, io) {
  return new ZombieManager(
    gameState,
    config,
    zombieTypes,
    (x, y, size) => roomManager.checkWallCollision(x, y, size),
    io
  );
}

/**
 * Build and wire all in-process game managers.
 * @param {{gameState, config, zombieTypes, io}} deps
 */
function createGameManagers({ gameState, config, zombieTypes, io }) {
  const entityManager = new EntityManager(gameState, config);
  const collisionManager = new CollisionManager(gameState, config);
  const networkManager = new NetworkManager(io, gameState);
  const roomManager = new RoomManager(gameState, config, io);
  const mutatorManager = new RunMutatorManager(gameState, io);
  const zombieManager = buildZombieManager(gameState, config, zombieTypes, roomManager, io);

  gameState.roomManager = roomManager;
  gameState.mutatorManager = mutatorManager;
  mutatorManager.initialize();
  logger.info('Run mutators initialized');

  return { entityManager, collisionManager, networkManager, roomManager, mutatorManager, zombieManager };
}

module.exports = { createGameManagers };
