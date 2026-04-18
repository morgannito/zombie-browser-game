# Testing Guide

## Stack

- **Unit / Integration**: Jest (`npm test`)
- **E2E**: Playwright (`npm run test:e2e`)
- **Coverage**: Istanbul via Jest (`coverage/`)

---

## Unit Tests

**Location**: `__tests__/unit/`

**Structure**:
```
__tests__/unit/
  domain/          # Domain entities (Player, GameSession, LeaderboardEntry…)
  application/     # Use cases & services (BuyUpgradeUseCase, AchievementService…)
  game/            # Game logic
  lib/             # Utilities
  middleware/
  server/
  sockets/
  transport/
  regression/
  error-paths.test.js
  networkManager.viewport.test.js
```

**Run**:
```bash
npm run test:unit          # jest --testPathPattern=unit
npm run test:watch         # watch mode
```

**Strategy**: Pure functions, no I/O, no server. Mock repositories via jest.fn(). Each test file maps 1-to-1 with a source module.

---

## Integration Tests

**Location**: `__tests__/integration/`

**Structure**:
```
__tests__/integration/
  database/        # DB adapters with real SQLite
  http/            # HTTP routes
  socket.connection.test.js
  socket.gameplay.test.js
  playtest.*.test.js   # Full game flows (connect, move, combat, wave…)
  chaos.multi-client.test.js
  flow.critical.test.js
  snapshot.gamestate.test.js
  longrun.gameloop.test.js
```

**Run**:
```bash
npm run test:integration   # jest --testPathPattern=integration
```

**Strategy**: Real Express + Socket.IO server spun up via `testServerFactory.js`. Tests exercise full request/response and socket event cycles. `testServerFactory.js` is excluded from the test runner (it's a helper).

---

## E2E Tests (Playwright)

**Location**: `e2e/`

```
e2e/
  smoke.spec.js
  smoke-canvas.spec.js
  gameplay.spec.js
  rendering.spec.js
```

**Run**:
```bash
npm run test:e2e           # headless Chromium
npm run test:e2e:ui        # Playwright UI mode
```

**Config**: `playwright.config.js` — baseURL `http://127.0.0.1:3050` (override with `PLAYWRIGHT_BASE_URL`). Single worker, no retries, screenshots on failure.

**Strategy**: Full browser tests against a running server. Validate UI rendering (canvas), game start/stop, and critical user flows.

---

## Coverage

```bash
npm test                   # runs jest --coverage
open coverage/lcov-report/index.html
```

Coverage is collected from: `lib/`, `game/`, `contexts/`, `server/`, `transport/`, `infrastructure/`.

**CI thresholds** (enforced when `CI=true`):

| Scope | Lines | Statements | Functions | Branches |
|---|---|---|---|---|
| Global | 10% | 10% | 10% | 7% |
| contexts/leaderboard | 95% | 95% | 100% | 95% |
| contexts/session | 93% | 93% | 100% | 75% |
| contexts/wave | 92% | 92% | 95% | 85% |
| contexts/zombie | 88% | 88% | 78% | 78% |
| contexts/weapons | 82% | 82% | 88% | 75% |
| contexts/player | 86% | 86% | 82% | 80% |
| server/ | 85% | 85% | 80% | 70% |

---

## Adding a Test

### Unit test (domain entity or use case)

1. Create `__tests__/unit/<layer>/MyModule.test.js`
2. Import the module under test directly
3. Mock dependencies with `jest.fn()` / `jest.mock()`

```js
const { MyEntity } = require('../../../lib/MyEntity');

describe('MyEntity', () => {
  it('does something', () => {
    const entity = new MyEntity({ id: '1' });
    expect(entity.isValid()).toBe(true);
  });
});
```

### Integration test (socket or HTTP)

1. Create `__tests__/integration/my-flow.test.js`
2. Use `testServerFactory.js` to boot a real server

```js
const { createTestServer } = require('./testServerFactory');

let server;
beforeAll(async () => { server = await createTestServer(); });
afterAll(async () => { await server.close(); });

it('player can connect', async () => {
  // use server.url, server.io, etc.
});
```

### E2E test (Playwright)

1. Create `e2e/my-flow.spec.js`
2. Use `page` fixture; server must be running on port 3050

```js
const { test, expect } = require('@playwright/test');

test('smoke', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
});
```
