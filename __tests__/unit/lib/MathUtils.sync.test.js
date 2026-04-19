'use strict';

/**
 * Guard against drift between server (lib/MathUtils.js) and client
 * (public/lib/MathUtils.js). They're two distinct files because the client
 * is loaded via <script src> and the server via require, but they MUST
 * expose the same API and produce the same results.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const serverMath = require('../../../lib/MathUtils');

function loadClientMath() {
  const code = fs.readFileSync(path.join(__dirname, '../../../public/lib/MathUtils.js'), 'utf8');
  const ctx = { window: {}, module: { exports: {} } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.window.MathUtils || ctx.module.exports;
}

describe('MathUtils server/client sync', () => {
  const client = loadClientMath();

  test('both modules expose the same set of function names', () => {
    const serverKeys = Object.keys(serverMath).sort();
    const clientKeys = Object.keys(client).sort();
    expect(clientKeys).toEqual(serverKeys);
  });

  test.each([
    ['fastCos', [0]],
    ['fastCos', [Math.PI]],
    ['fastSin', [Math.PI / 2]],
    ['distance', [0, 0, 3, 4]],
    ['distanceSquared', [1, 1, 4, 5]],
    ['circleCollision', [0, 0, 10, 5, 5, 10]],
    ['lerp', [0, 100, 0.25]],
    ['clamp', [42, 0, 10]],
    ['normalizeAngle', [Math.PI * 3]],
    ['randomInt', [5, 5]], // deterministic when min===max
    ['randomFloat', [1, 1]]
  ])('%s produces identical output on server and client', (fn, args) => {
    expect(typeof serverMath[fn]).toBe('function');
    expect(typeof client[fn]).toBe('function');
    const serverOut = serverMath[fn](...args);
    const clientOut = client[fn](...args);
    if (typeof serverOut === 'number') {
      expect(clientOut).toBeCloseTo(serverOut, 6);
    } else {
      expect(clientOut).toEqual(serverOut);
    }
  });
});
