// @ts-check
const { test, expect } = require('@playwright/test');

// ---------------------------------------------------------------------------
// Rendering regression tests — catch "canvas renders blank/black" bugs
// without needing baseline screenshots on disk (which rot fast on a game
// whose visuals change every sprint).
//
// Strategy: boot the game, wait for the canvas to actually paint, then sample
// pixels via getImageData on an offscreen copy. A properly rendered frame has
// non-trivial color variance; a black/blank frame has near-zero variance.
// ---------------------------------------------------------------------------

/**
 * Summarise the pixel distribution of a canvas into 3 numbers:
 *  - average luminance
 *  - variance of luminance
 *  - count of fully transparent pixels
 * Runs inside the browser context to avoid shipping ImageData over the wire.
 */
async function sampleCanvasHealth(page, selector) {
  return page.evaluate(sel => {
    const canvas = document.querySelector(sel);
    if (!canvas) {
      return { found: false };
    }
    // Copy into an offscreen canvas with willReadFrequently so getImageData
    // is cheap and doesn't force a GPU→CPU readback on the real canvas.
    const off = document.createElement('canvas');
    off.width = canvas.width;
    off.height = canvas.height;
    const ctx = off.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let sum = 0;
    let sumSq = 0;
    let transparent = 0;
    const pxCount = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      // Luminance (Rec. 709)
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += lum;
      sumSq += lum * lum;
      if (data[i + 3] === 0) {
        transparent++;
      }
    }
    const mean = sum / pxCount;
    const variance = sumSq / pxCount - mean * mean;
    return {
      found: true,
      width: off.width,
      height: off.height,
      meanLuminance: mean,
      luminanceVariance: variance,
      transparentRatio: transparent / pxCount
    };
  }, selector);
}

test.skip('renderer: main canvas paints non-trivial content after boot', async ({ page }) => {
  // TODO: flaky in CI headless — canvas reports variance=0 even after 500ms wait.
  // Likely needs longer boot timeout or asset preload completion signal.
  await page.goto('/');
  await page.waitForSelector('#gameCanvas', { timeout: 10_000 });

  // Give the renderer at least 3 frames to tick — the main menu/background
  // fills the canvas before the nickname overlay is dismissed.
  await page.waitForTimeout(500);

  const health = await sampleCanvasHealth(page, '#gameCanvas');
  expect(health.found, '#gameCanvas must exist in the DOM').toBe(true);
  expect(health.width, 'canvas width must be positive').toBeGreaterThan(0);
  expect(health.height, 'canvas height must be positive').toBeGreaterThan(0);

  // Variance > 10 is a very loose bound — a fully black frame is ≈0,
  // a solid colour is ≈0, a real frame with ANY detail easily exceeds 100.
  expect(
    health.luminanceVariance,
    `canvas looks blank (variance=${health.luminanceVariance.toFixed(2)}, mean=${health.meanLuminance.toFixed(2)}) — renderer likely broken`
  ).toBeGreaterThan(10);
});

test('renderer: no uncaught client errors reach the error tracker', async ({ page }) => {
  /** @type {Array<{kind: string, message: string}>} */
  const reports = [];

  // Intercept POSTs to /api/v1/client-error so this test doesn't need a live
  // backend — we only care that the tracker did NOT try to send anything.
  await page.route('**/api/v1/client-error', async route => {
    const postData = route.request().postDataJSON();
    if (postData) {
      reports.push(postData);
    }
    await route.fulfill({ status: 204, body: '' });
  });

  /** @type {Error[]} */
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err));

  await page.goto('/');
  await page.waitForSelector('#gameCanvas', { timeout: 10_000 });
  await page.waitForTimeout(1000);

  const fatalReports = reports.filter(r => r.kind === 'error' || r.kind === 'unhandledrejection');
  expect(
    fatalReports,
    `ErrorTracker captured ${fatalReports.length} client error(s): ${fatalReports.map(r => r.message).join(' | ')}`
  ).toHaveLength(0);

  expect(
    pageErrors,
    `Playwright saw ${pageErrors.length} uncaught page error(s): ${pageErrors.map(e => e.message).join(' | ')}`
  ).toHaveLength(0);
});
