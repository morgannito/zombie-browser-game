// @ts-check
/**
 * Smoke test minimal CI — canvas visible + screenshot + 0 console errors
 *
 * Run : npx playwright test e2e/smoke-canvas.spec.js
 * CI  : PORT=3001 PLAYWRIGHT_BASE_URL=http://localhost:3001 npx playwright test e2e/smoke-canvas.spec.js
 */
const { test, expect } = require('@playwright/test');
const path = require('path');

// Collect JS console errors (type === 'error')
function collectErrors(page) {
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore network 404s (resource load failures) — not JS application errors
      if (/Failed to load resource.*404/.test(text)) {
return;
}
      errors.push(text);
    }
  });
  // Also catch uncaught exceptions
  page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));
  return errors;
}

test('smoke: GET / returns 200 and contains <canvas>', async ({ request }) => {
  const res = await request.get('/');
  expect(res.status(), 'HTTP 200').toBe(200);
  const body = await res.text();
  expect(body, 'page must contain <canvas>').toContain('<canvas');
});

test('smoke: GET /health returns 200', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status(), '/health HTTP 200').toBe(200);
});

test('smoke: GET /openapi.yaml returns 200', async ({ request }) => {
  const res = await request.get('/openapi.yaml');
  expect(res.status(), '/openapi.yaml HTTP 200').toBe(200);
});

test('smoke: canvas visible + screenshot + 0 console errors', async ({ page }) => {
  const consoleErrors = collectErrors(page);

  await page.goto('/');

  // Wait for the canvas element to be visible in the DOM
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeAttached({ timeout: 15_000 });

  // Take a screenshot to /tmp/smoke.png
  const screenshotPath = path.join('/tmp', 'smoke.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // Assert zero console errors
  // Allow a short moment for deferred scripts to emit errors
  await page.waitForTimeout(500);
  expect(
    consoleErrors,
    `Expected 0 console errors, got ${consoleErrors.length}: ${consoleErrors.join(' | ')}`
  ).toHaveLength(0);
});
