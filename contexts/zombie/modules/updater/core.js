/**
 * @fileoverview Zombie tick orchestrator — extracted from ZombieUpdater.
 * @description Decomposes the 171-line / complexity-37 updateZombies into
 *   SRP helpers + dispatch maps (zombie type → ability handler, boss type →
 *   boss updater). Consumers inject the handlers so ZombieUpdater stays the
 *   single source of truth for ability / boss functions.
 */

const DEFAULT_PATHFINDING_RATE = 10;
const STUCK_MOVE_THRESHOLD = 0.5;
const STUCK_DESPAWN_FRAMES = 600;

function resolveTickContext(perfIntegration) {
  const tick = perfIntegration ? perfIntegration.tickCounter : 0;
  const rate = Math.max(
    1,
    perfIntegration && perfIntegration.perfConfig
      ? perfIntegration.perfConfig.current.zombiePathfindingRate
      : DEFAULT_PATHFINDING_RATE
  );
  return { tick, pathfindingRate: rate };
}

function ensureStaggerOffset(zombie, zombieId, pathfindingRate) {
  if (zombie.staggerOffset !== null && zombie.staggerOffset !== undefined) {
 return;
}
  zombie.staggerOffset = (Number(zombieId) || 0) % pathfindingRate;
}

function applyFarFreeze(zombie, players, isZombieFarFromAllPlayers) {
  if (zombie.isBoss === true) {
 return false;
}
  if (!isZombieFarFromAllPlayers(zombie, players)) {
 return false;
}
  zombie._prevX = zombie.x;
  zombie._prevY = zombie.y;
  return true;
}

function dispatchAbility(zombie, zombieId, ctx, abilityHandlers) {
  const handler = abilityHandlers[zombie.type];
  if (handler) {
 handler(zombie, zombieId, ctx);
}
}

function dispatchBoss(zombie, zombieId, ctx, bossHandlers) {
  const handler = bossHandlers[zombie.type];
  if (handler) {
 handler(zombie, zombieId, ctx);
}
}

function trackStuck(zombie, zombies, zombieId) {
  const movedDist =
    Math.abs(zombie.x - (zombie._prevX || 0)) + Math.abs(zombie.y - (zombie._prevY || 0));
  zombie._prevX = zombie.x;
  zombie._prevY = zombie.y;
  zombie._stuckFrames = movedDist < STUCK_MOVE_THRESHOLD ? (zombie._stuckFrames || 0) + 1 : 0;
  if (zombie._stuckFrames > STUCK_DESPAWN_FRAMES) {
 delete zombies[zombieId];
}
}

function tickOneZombie(zombie, zombieId, tickState, handlers) {
  const { pathfindingRate, tick, players, gameState, collisionManager, now } = tickState;
  ensureStaggerOffset(zombie, zombieId, pathfindingRate);
  if (applyFarFreeze(zombie, players, handlers.isZombieFarFromAllPlayers)) {
 return;
}

  const ctx = { ...tickState };
  dispatchAbility(zombie, zombieId, ctx, handlers.abilityHandlers);
  dispatchBoss(zombie, zombieId, ctx, handlers.bossHandlers);

  if (!gameState.zombies[zombieId]) {
 return;
}
  handlers.moveZombie(zombie, zombieId, collisionManager, gameState, now, tick, pathfindingRate, players);
  trackStuck(zombie, gameState.zombies, zombieId);
}

/**
 * Main zombie update tick. `handlers` bags the inter-module deps so this
 * file stays focused on control flow.
 *
 * @param {Object} gameState
 * @param {number} now
 * @param {Object} io
 * @param {Object} collisionManager
 * @param {Object} entityManager
 * @param {Object} zombieManager
 * @param {Object} perfIntegration
 * @param {{abilityHandlers, bossHandlers, moveZombie, isZombieFarFromAllPlayers}} handlers
 */
function updateZombies(
  gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration, handlers
) {
  const zombies = gameState.zombies;
  const zombieIds = Object.keys(zombies).slice();
  const { tick, pathfindingRate } = resolveTickContext(perfIntegration);
  const players = gameState.players;

  const tickState = {
    gameState, now, io, collisionManager, entityManager, zombieManager, perfIntegration,
    players, tick, pathfindingRate
  };

  for (let i = 0; i < zombieIds.length; i++) {
    const zombieId = zombieIds[i];
    const zombie = zombies[zombieId];
    if (!zombie) {
 continue;
}
    tickOneZombie(zombie, zombieId, tickState, handlers);
  }
}

module.exports = { updateZombies };
