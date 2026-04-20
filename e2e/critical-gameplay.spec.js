// @ts-check
const { test, expect } = require('@playwright/test');

const START_TIMEOUT_MS = 15_000;
const CRITICAL_TEST_TIMEOUT_MS = 45_000;
const TUTORIAL_STORAGE_KEY = 'zbg:tutorial:completed';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(storageKey => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Best-effort only: localStorage can be unavailable in some contexts.
    }
  }, TUTORIAL_STORAGE_KEY);
});

function makeNickname(prefix) {
  return `${prefix}${Date.now().toString(36).slice(-6)}`;
}

function getMovementKeys(from, to) {
  const keys = [];
  if (to.x > from.x + 5) {
    keys.push('d');
  } else if (to.x < from.x - 5) {
    keys.push('a');
  }

  if (to.y < from.y - 5) {
    keys.push('w');
  } else if (to.y > from.y + 5) {
    keys.push('s');
  }

  return keys;
}

async function holdKeys(page, keys) {
  for (const key of keys) {
    await page.keyboard.down(key);
  }
}

async function releaseKeys(page, keys) {
  for (const key of [...keys].reverse()) {
    await page.keyboard.up(key);
  }
}

async function startGame(page, nickname) {
  await page.goto('/');
  await page.waitForSelector('#nickname-screen', {
    state: 'visible',
    timeout: START_TIMEOUT_MS
  });
  await page.fill('#nickname-input', nickname);
  await page.click('#start-game-btn');
  await page.waitForSelector('#nickname-screen', {
    state: 'hidden',
    timeout: START_TIMEOUT_MS
  });
  await page.waitForFunction(
    () => {
      const playerId = window.gameState?.playerId;
      const player = playerId && window.gameState?.state?.players?.[playerId];
      return Boolean(window.socket?.connected && player && player.alive === true);
    },
    { timeout: START_TIMEOUT_MS }
  );
  await page.waitForTimeout(800);
}

async function getSnapshot(page) {
  return page.evaluate(() => {
    const state = window.gameState?.state || {};
    const playerId = window.gameState?.playerId || null;
    const player = playerId && state.players ? state.players[playerId] : null;
    const zombies = Object.entries(state.zombies || {})
      .map(([id, zombie]) => ({
        id,
        x: zombie.x,
        y: zombie.y,
        health: zombie.health,
        maxHealth: zombie.maxHealth
      }))
      .filter(zombie => Number.isFinite(zombie.x) && Number.isFinite(zombie.y));

    let nearestZombie = null;
    let nearestZombieDistance = null;
    if (player) {
      for (const zombie of zombies) {
        const distance = Math.hypot(zombie.x - player.x, zombie.y - player.y);
        if (nearestZombieDistance === null || distance < nearestZombieDistance) {
          nearestZombie = zombie;
          nearestZombieDistance = distance;
        }
      }
    }

    const gameOver = document.getElementById('game-over');
    const nicknameScreen = document.getElementById('nickname-screen');

    return {
      connected: Boolean(window.socket?.connected),
      player: player
        ? {
            x: player.x,
            y: player.y,
            health: player.health,
            maxHealth: player.maxHealth,
            alive: player.alive
          }
        : null,
      zombieCount: zombies.length,
      nearestZombie,
      nearestZombieDistance,
      gameOverVisible: Boolean(gameOver && gameOver.offsetParent !== null),
      nicknameVisible: Boolean(nicknameScreen && nicknameScreen.offsetParent !== null)
    };
  });
}

async function damageNearestZombie(page) {
  const initial = await page.evaluate(() => {
    const playerId = window.gameState?.playerId;
    const state = window.gameState?.state || {};
    const player = playerId && state.players ? state.players[playerId] : null;
    if (!player) {
      return null;
    }

    const target = Object.entries(state.zombies || {})
      .map(([id, zombie]) => ({
        id,
        x: zombie.x,
        y: zombie.y,
        health: zombie.health,
        maxHealth: zombie.maxHealth
      }))
      .filter(zombie => Number.isFinite(zombie.health))
      .sort(
        (left, right) =>
          Math.hypot(left.x - player.x, left.y - player.y) -
          Math.hypot(right.x - player.x, right.y - player.y)
      )[0];

    return target
      ? {
          player: { x: player.x, y: player.y },
          target
        }
      : null;
  });

  expect(initial, 'the game should expose at least one zombie to fight').not.toBeNull();

  const movementKeys = getMovementKeys(initial.player, initial.target);
  await holdKeys(page, movementKeys);

  try {
    for (let attempt = 0; attempt < 40; attempt++) {
      await page.evaluate(targetId => {
        const target = window.gameState?.state?.zombies?.[targetId];
        const camera = window.gameEngine?.camera?.getPosition?.() || { x: 0, y: 0 };
        if (target && window.inputManager?.updateMouse) {
          window.inputManager.updateMouse(target.x - camera.x, target.y - camera.y);
        }
      }, initial.target.id);

      await page.waitForTimeout(250);

      const outcome = await page.evaluate(
        ({ targetId, initialHealth }) => {
          const playerId = window.gameState?.playerId;
          const state = window.gameState?.state || {};
          const player = playerId && state.players ? state.players[playerId] : null;
          const target = state.zombies ? state.zombies[targetId] : null;
          const healthAfter = target ? target.health : null;
          return {
            player: player
              ? {
                  x: player.x,
                  y: player.y,
                  health: player.health,
                  alive: player.alive
                }
              : null,
            healthAfter,
            targetRemoved: !target,
            hit:
              !target ||
              (Number.isFinite(initialHealth) &&
                Number.isFinite(healthAfter) &&
                healthAfter < initialHealth)
          };
        },
        {
          targetId: initial.target.id,
          initialHealth: initial.target.health
        }
      );

      if (outcome.hit) {
        return { initial, outcome };
      }
    }
  } finally {
    await releaseKeys(page, movementKeys);
  }

  throw new Error('failed to make the nearest zombie lose health within the allowed window');
}

async function respawnViaServer(page, previousPlayer) {
  await page.evaluate(() => {
    window.networkManager?.respawn();
  });

  await page.waitForFunction(
    ({ previousX, previousY }) => {
      const playerId = window.gameState?.playerId;
      const player = playerId && window.gameState?.state?.players?.[playerId];
      if (!player) {
        return false;
      }

      const moved = Math.hypot(player.x - previousX, player.y - previousY) > 100;
      return (
        moved &&
        player.alive === true &&
        Number.isFinite(player.health) &&
        Number.isFinite(player.maxHealth) &&
        player.health === player.maxHealth
      );
    },
    {
      previousX: previousPlayer.x,
      previousY: previousPlayer.y
    },
    { timeout: 10_000 }
  );

  return getSnapshot(page);
}

test('critical gameplay: start, move, damage a zombie, and respawn safely', async ({ page }) => {
  test.setTimeout(CRITICAL_TEST_TIMEOUT_MS);

  await startGame(page, makeNickname('Critical'));

  const start = await getSnapshot(page);
  expect(start.connected).toBe(true);
  expect(start.player).not.toBeNull();
  expect(start.player.alive).toBe(true);
  expect(Number.isFinite(start.player.health)).toBe(true);
  expect(start.gameOverVisible).toBe(false);
  expect(start.nicknameVisible).toBe(false);
  expect(start.zombieCount).toBeGreaterThan(0);
  expect(start.nearestZombieDistance).toBeGreaterThan(100);

  const damage = await damageNearestZombie(page);
  const movedDistance = Math.hypot(
    damage.outcome.player.x - start.player.x,
    damage.outcome.player.y - start.player.y
  );

  expect(movedDistance).toBeGreaterThan(200);
  expect(damage.outcome.player.alive).toBe(true);
  expect(
    damage.outcome.targetRemoved || damage.outcome.healthAfter < damage.initial.target.health
  ).toBe(true);

  const afterFight = await getSnapshot(page);
  expect(afterFight.player.alive).toBe(true);
  expect(afterFight.gameOverVisible).toBe(false);

  const respawned = await respawnViaServer(page, afterFight.player);
  const respawnTravel = Math.hypot(
    respawned.player.x - afterFight.player.x,
    respawned.player.y - afterFight.player.y
  );

  expect(respawnTravel).toBeGreaterThan(100);
  expect(respawned.player.alive).toBe(true);
  expect(respawned.player.health).toBe(respawned.player.maxHealth);
  expect(respawned.gameOverVisible).toBe(false);
  expect(respawned.nearestZombieDistance).toBeGreaterThan(250);
});
