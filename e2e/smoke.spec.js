// @ts-check
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: collect console messages that match a pattern during a test
// ---------------------------------------------------------------------------
function collectConsoleMatches(page, pattern) {
  const hits = [];
  page.on('console', (msg) => {
    if (pattern.test(msg.text())) {
      hits.push(msg.text());
    }
  });
  return hits;
}

// ---------------------------------------------------------------------------
// Test 1 — Boot → fill nickname → start game
//
// Regression: CSP blocked inline <style> injections, which left the nickname
// overlay visible even after clicking "Commencer la partie". The test would
// have caught this because #nickname-screen would still be visible and the
// socket would never connect.
// ---------------------------------------------------------------------------
test('boot: fill nickname and start game', async ({ page }) => {
  await page.goto('/');

  // The nickname screen must be visible at boot
  const nicknameScreen = page.locator('#nickname-screen');
  await expect(nicknameScreen).toBeVisible({ timeout: 10_000 });

  // Fill nickname and submit
  await page.fill('#nickname-input', 'TestPlayer');
  await page.click('#start-game-btn');

  // After a successful start, #nickname-screen must be hidden
  await expect(nicknameScreen).toBeHidden({ timeout: 15_000 });

  // The socket must be connected and the game session established
  const state = await page.evaluate(() => ({
    connected: Boolean(window.socket?.connected),
    nicknameHidden: document.getElementById('nickname-screen')?.style.display === 'none',
  }));

  expect(state.connected, 'socket must be connected after game start').toBe(true);
  expect(state.nicknameHidden, 'nickname screen must be hidden after game start').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2 — No blocking modal visible at boot
//
// Regression: if level-up / shop / game-over screens are accidentally left
// visible (e.g. display:block via inline style from a previous code change),
// the player cannot interact with the game at all. offsetParent === null is
// the canonical check for an element that is not rendered in the layout.
// ---------------------------------------------------------------------------
test('boot: no blocking modal visible', async ({ page }) => {
  await page.goto('/');

  // Wait for the page to fully render
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {
    // networkidle may never fire for websocket apps — fall back to domcontentloaded
  });
  await page.waitForSelector('#nickname-screen', { state: 'visible', timeout: 10_000 });

  const modalStates = await page.evaluate(() => {
    function isBlocking(id) {
      const el = document.getElementById(id);
      if (!el) return false;
      // offsetParent is null when the element (or an ancestor) has display:none
      return el.offsetParent !== null;
    }
    return {
      levelUpVisible: isBlocking('level-up-screen'),
      shopVisible: isBlocking('shop'),
      gameOverVisible: isBlocking('game-over'),
    };
  });

  expect(modalStates.levelUpVisible, '#level-up-screen must not be blocking at boot').toBe(false);
  expect(modalStates.shopVisible, '#shop must not be blocking at boot').toBe(false);
  expect(modalStates.gameOverVisible, '#game-over must not be blocking at boot').toBe(false);
});

// ---------------------------------------------------------------------------
// Test 3 — Holding 'd' must NOT spam debug mode messages
//
// Regression: key 'd' was bound to both right-movement and debug-mode toggle
// in GameEngine. Every keydown event fired "Debug mode: ENABLED / DISABLED"
// logs that flooded the console. After the fix (rebind to F3), holding 'd'
// for 300 ms must not produce more than one Debug mode message.
// ---------------------------------------------------------------------------
test('keybind: holding d does not spam debug mode logs', async ({ page }) => {
  const debugMessages = collectConsoleMatches(page, /Debug mode:/i);

  await page.goto('/');
  await page.waitForSelector('#nickname-screen', { state: 'visible', timeout: 10_000 });

  // Simulate holding the 'd' key for 300 ms (≈ 5-6 keydown repeats in most browsers)
  await page.keyboard.down('d');
  await page.waitForTimeout(300);
  await page.keyboard.up('d');

  // Allow one message at most (a fixed implementation may fire one on press;
  // the bug produced one per keydown repeat, i.e. 5-6+ messages).
  expect(
    debugMessages.length,
    `"Debug mode:" should not be spammed — got ${debugMessages.length} message(s): ${debugMessages.join(' | ')}`
  ).toBeLessThanOrEqual(1);
});
