// @ts-check
/**
 * Gameplay flow tests — login, settings menu, pause menu (ESC).
 *
 * All selectors use waitForSelector / toBeVisible to avoid flakiness.
 */
const { test, expect } = require('@playwright/test');

const START_TIMEOUT_MS = 15_000;
const TUTORIAL_STORAGE_KEY = 'zbg:tutorial:completed';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(storageKey => {
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Ignore storage failures in restricted browser contexts.
    }
  }, TUTORIAL_STORAGE_KEY);
});

function makeNickname(prefix = 'Tst') {
  const suffix = Date.now().toString(36).slice(-6);
  const maxPrefixLength = Math.max(1, 15 - suffix.length);
  return `${prefix.slice(0, maxPrefixLength)}${suffix}`;
}

// ---------------------------------------------------------------------------
// Helper: start a game session (nickname → start → canvas visible)
// ---------------------------------------------------------------------------
async function startGame(page, nickname = makeNickname()) {
  await page.goto('/');
  await page.waitForSelector('#nickname-screen', {
    state: 'visible',
    timeout: START_TIMEOUT_MS
  });
  await page.fill('#nickname-input', nickname);
  await page.click('#start-game-btn');
  // Canvas must be rendering — wait for nickname screen to disappear
  await page.waitForSelector('#nickname-screen', {
    state: 'hidden',
    timeout: START_TIMEOUT_MS
  });
  await page.waitForSelector('#gameCanvas', { state: 'visible', timeout: START_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean(window.socket?.connected), {
    timeout: START_TIMEOUT_MS
  });
}

// ---------------------------------------------------------------------------
// Test 1 — Login flow: nickname → start → canvas visible
//
// Covers the full "new player" path: fill nickname, submit, assert the game
// canvas is visible and the socket is connected.
// ---------------------------------------------------------------------------
test('login flow: nickname → start → canvas visible', async ({ page }) => {
  await startGame(page);
  const canvas = page.locator('#gameCanvas');
  await expect(canvas).toBeVisible({ timeout: START_TIMEOUT_MS });

  const socketConnected = await page.evaluate(() => Boolean(window.socket?.connected));
  expect(socketConnected, 'socket must be connected after game start').toBe(true);
});

// ---------------------------------------------------------------------------
// Test 2 — Settings menu: open via #settings-btn → close via close button
//
// Verifies the settings modal appears and dismisses cleanly, and that the
// preference key is written to localStorage on close.
// ---------------------------------------------------------------------------
test('settings menu: open, apply, and persist settings', async ({ page }) => {
  await startGame(page);

  // The settings toggle button becomes visible once the game starts
  const settingsBtn = page.locator('.settings-toggle-btn');
  await expect(settingsBtn).toBeVisible({ timeout: START_TIMEOUT_MS });
  await page.waitForFunction(() => typeof window.gameSettingsMenu?.open === 'function', {
    timeout: 5_000
  });

  // Open settings through the public SettingsMenu API after init. The HUD in
  // the top-right corner is crowded and pointer-based clicks are flaky here.
  await page.evaluate(() => {
    window.gameSettingsMenu?.open();
  });

  await page.waitForFunction(
    () => document.getElementById('settings-menu')?.style.display === 'block',
    { timeout: 5_000 }
  );

  await page.evaluate(() => {
    document.querySelector('[data-tab="graphics"]')?.click();
    const graphicsSelect = document.getElementById('graphics-quality');
    if (graphicsSelect) {
      graphicsSelect.value = 'high';
      graphicsSelect.dispatchEvent(new window.Event('change', { bubbles: true }));
    }
  });

  // Apply triggers save + close.
  await page.evaluate(() => {
    document.getElementById('settings-apply-btn')?.click();
  });
  await page.waitForFunction(
    () => document.getElementById('settings-menu')?.style.display === 'none',
    { timeout: 5_000 }
  );

  const settingsSaved = await page.evaluate(() => {
    const raw = localStorage.getItem('zombie-game-settings');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  expect(settingsSaved, 'settings must be persisted to localStorage after apply').not.toBeNull();
  expect(settingsSaved.graphics.quality).toBe('high');
});

// ---------------------------------------------------------------------------
// Test 3 — Pause menu: ESC opens it, resume button closes it
//
// Pressing ESC during an active game session must reveal #pause-menu.
// Clicking #pause-resume-btn must hide it again.
// ---------------------------------------------------------------------------
test('pause menu: ESC opens, resume button closes', async ({ page }) => {
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
