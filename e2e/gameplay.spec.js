// @ts-check
/**
 * Gameplay flow tests — login, settings menu, pause menu (ESC).
 *
 * All selectors use waitForSelector / toBeVisible to avoid flakiness.
 */
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Helper: start a game session (nickname → start → canvas visible)
// ---------------------------------------------------------------------------
async function startGame(page, nickname = 'TestPlayer') {
  await page.goto('/');
  await page.waitForSelector('#nickname-screen', { state: 'visible', timeout: 10_000 });
  await page.fill('#nickname-input', nickname);
  await page.click('#start-game-btn');
  // Canvas must be rendering — wait for nickname screen to disappear
  await page.waitForSelector('#nickname-screen', { state: 'hidden', timeout: 15_000 });
  await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test 1 — Login flow: nickname → start → canvas visible
//
// Covers the full "new player" path: fill nickname, submit, assert the game
// canvas is visible and the socket is connected.
// ---------------------------------------------------------------------------
test.skip('login flow: nickname → start → canvas visible', async ({ page }) => {
  await page.goto('/');

  const nicknameScreen = page.locator('#nickname-screen');
  await expect(nicknameScreen).toBeVisible({ timeout: 10_000 });

  await page.fill('#nickname-input', 'TestPlayer');
  await page.click('#start-game-btn');

  await expect(nicknameScreen).toBeHidden({ timeout: 15_000 });

  const canvas = page.locator('#gameCanvas');
  await expect(canvas).toBeVisible({ timeout: 10_000 });

  const socketConnected = await page.evaluate(() => Boolean(window.socket?.connected));
  expect(socketConnected, 'socket must be connected after game start').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2 — Settings menu: open via #settings-btn → close via close button
//
// Verifies the settings modal appears and dismisses cleanly, and that the
// preference key is written to localStorage on close.
// ---------------------------------------------------------------------------
test.skip('settings menu: open and close persists pref to localStorage', async ({ page }) => {
  await startGame(page);

  // The settings toggle button becomes visible once the game starts
  const settingsBtn = page.locator('#settings-btn');
  await expect(settingsBtn).toBeVisible({ timeout: 10_000 });

  // Open settings
  await settingsBtn.click();

  const settingsMenu = page.locator('#settings-menu');
  await expect(settingsMenu).toBeVisible({ timeout: 5_000 });

  // Change the graphics quality (any select that exists)
  const graphicsSelect = page.locator('#graphics-quality');
  const hasGraphics = await graphicsSelect.count();
  if (hasGraphics) {
    // Pick any available option other than the current one
    const options = await graphicsSelect.locator('option').allTextContents();
    if (options.length > 1) {
      await graphicsSelect.selectOption({ index: 1 });
    }
  }

  // Close via the close button — this triggers saveSettings()
  await page.click('#settings-close-btn');
  await expect(settingsMenu).toBeHidden({ timeout: 5_000 });

  // Settings key must be present in localStorage after close
  const settingsSaved = await page.evaluate(
    () => localStorage.getItem('zombie_settings') !== null
  );
  expect(settingsSaved, 'settings must be persisted to localStorage after close').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 3 — Pause menu: ESC opens it, resume button closes it
//
// Pressing ESC during an active game session must reveal #pause-menu.
// Clicking #pause-resume-btn must hide it again.
// ---------------------------------------------------------------------------
test.skip('pause menu: ESC opens, resume button closes', async ({ page }) => {
  await startGame(page);

  // Give the game loop a moment to register keyboard listeners
  await page.waitForTimeout(300);

  // ESC should open the pause menu
  await page.keyboard.press('Escape');

  const pauseMenu = page.locator('#pause-menu');
  await expect(pauseMenu).toBeVisible({ timeout: 5_000 });

  // Resume button must close it
  await page.click('#pause-resume-btn');
  await expect(pauseMenu).toBeHidden({ timeout: 5_000 });
});
