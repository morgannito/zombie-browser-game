# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
- **Zombie constants module** — `contexts/zombie/constants.js` centralizes all magic numbers (speeds, HP, timers) across BossUpdater, SpecialZombieUpdater, ZombieEffects, ZombieUpdater
- **Domain Invariants** — `lib/domain/shared/Invariants.js` guards for preconditions/postconditions across use-cases
- **Deployment docs** — `docs/DEPLOYMENT.md` full production guide; `docs/WEBSOCKET.md` condensed reference
- **JSON Schema validation** — zombie entities validated against JSON Schema; fuzz + error-path test suites added (`validation-fuzz`, `error-paths`, `AdminCommands`)
- **Husky hooks** — `commit-msg` + `pre-commit` enforced; `.nvmrc` pinned
- **Ultra/Insane tick modes** — 240Hz and 1000Hz server tick rates for stress testing
- **Full client prediction + reconciliation** — input prediction with server authority rollback, adaptive tick rates, reconnect resync (`requestFullState`)
- **MessagePack encoding** — 40–60% smaller payloads via Socket.IO msgpack parser
- **esbuild bundler** — opt-in JS bundling with direct-script fallback
- **Perf measurement harness** — `bench-run`, `bench-compare`, baseline snapshot
- **Boss offscreen arrows + zombie heatmap** — minimap density overlay + directional boss indicators
- **UX polish wave** — health ghost bar, wave zoom-fade, canvas crosshair with fire spread, hit markers, damage numbers, death screen "killed by" reveal
- **Mobile UX** — joystick deadzone, portrait hint, shop tap targets
- **Session eviction** — previous socket evicted on sessionId reconnect
- **CI coverage ratchet** — per-context Jest thresholds (leaderboard 100%, server 85%, zombie 80%, weapons 70%)
- **Anti-cheat** — shoot throttle 20/s, atomic gold deduction, auto-disconnect on violation threshold
- **Accessibility** — `prefers-reduced-motion`, Esc closes shop, focus-visible, aria-labels
- **Metrics** — anti-cheat counters on `/api/v1/metrics`

### Changed
- **Domain entities async audit** — `AccountProgression`, `LeaderboardEntry`, `PermanentUpgrades`, `Player` refactored for async-safe patterns and reduced coupling
- **Input listeners passive** — all `touchstart`/`wheel` event listeners flagged `{ passive: true }` to unblock browser paint thread
- **traceId propagation** — request traceId threaded through server logs and error responses for end-to-end correlation
- **NetworkManager split (Phase 7)** — ZombieManager/BossAbilities/CollisionManager decomposed into SRP modules
- **Flat broadcast** — dropped AOI for lobbies <5 players; path scales to 20+ clients at 60Hz+
- **Input transport** — batched moves, delta-encoded, `TCP_NODELAY` enabled
- **ToastManager** — object API; legacy `/api/*` aliases removed
- **Logger + MetricsCollector** — all consumers migrated to `infrastructure/logging/`
- **Static assets** — `no-store` cache headers; bundle dropped for direct script loading
- **Refactors** — DeathProgressionHandler, TeslaCoilHandler, PlayerUpdater, AutoTurretHandler extracted from gameLoop; shopEvents and socketUtils split from socketHandlers; console.* replaced by Winston

### Fixed
- **Bullet spawn origin** — client-predicted position for long-range hits
- **Bullet lag compensation** — first-tick fast-forward + `spawnCompensationMs` through EntityManager
- **Zombie freeze far-exit** — AI freeze bounds aligned with broadcast AOI
- **Zombie stutter AOI re-entry** — hard-snap to server position
- **Delta diff / pool leak** — server-internal fields excluded; fresh allocation per socket
- **AOI bypass small rooms** — AOI skipped when <5 players (particles/bullets visible)
- **Client interpolation** — `_serverTime` stamp every tick; RTT buffer scaling; `renderTime` aligned on server epoch
- **Rubber-banding** — hard-snap on repeated `positionCorrection`; per-socket room tracking
- **Player teleport on lag** — `_serverX/Y` stamped; rollback limited to anti-cheat path
- **Crosshair alignment** — pixelRatio scaling on retina
- **Session recovery** — `pendingUpgradeChoices` preserved across reconnect
- **Memory leaks** — listeners, queues, bounded arrays, zombie death cleanup
- **Auth rate-limit** — returns JSON; `DISABLE_AUTH_RATE_LIMIT` flag for dev
- **XSS kill feed** — `textContent` instead of innerHTML
- **XP overflow** — clamp before DB write
- **Async errors** — guarded game loop tick; unhandled rejections no longer kill server
- **Circular deps** — lazy-load `handlePlayerDeathProgression`

### Security
- Replace `unsafe-inline` CSP directive
- Always create fresh identity on login (account takeover prevention)
- Escape `err.status` in HTML error pages (reflected XSS)
- Redact username, nickname, IP from logs (GDPR)
- Re-enable server-side movement budget enforcement (anti-cheat)
- Remove partial JWT secret from logs
- Add secret scan (trufflehog) to CI

### Performance
- **TCP_NODELAY** — enabled on all WebSocket connections
- **Shared delta broadcast** — single delta object + `io.emit` (no per-socket clone)
- **AOI spatial grid + bucket cache** — `publicState` shared across co-located sockets
- **GC reduction** — scratch objects, hoisted constants, flat loops in zombie/bullet hot path
- **Adaptive per-socket throttle** — broadcast rate based on RTT
- **DB hot path** — prepared statements + safe mmap + active session index
- **Render cache** — `shadowBlur` replaces per-particle gradient; cached sky/moon; DOM refs; `measureText`
- **ParticleSystem** — batch render by color, swap-and-pop update
- **Audio** — unified `AudioContext` + O(1) gain pool
- **AI pathfinding** — 30Hz on ultra/insane (was 6Hz)
- **Quadtree bullet→player** — replaces O(n²) scan; `sqrt` → sq-dist in `getNearestPlayer`
- **hrtime scheduler + delta pool** — decoupled broadcast from tick, nanosecond precision

### Tests
- Unit tests: ZombieManager, BossAbilities, ZombieUpdater, BossUpdaterSimple, ZombieEffects, SpecialZombieUpdater
- Unit tests: BulletEffects, BulletUpdater, BulletCollisionHandler, CollisionManager
- Unit tests: PlayerUpdater, PlayerEffects, DeathProgressionHandler, TeslaCoilHandler
- Unit tests: WaveManager, RoomManager, Container, RunMutatorManager
- Unit tests: JwtService, validationFunctions, ObjectPool, MathUtils, Quadtree
- Integration: HTTP smoke, connection lifecycle, shop TOCTOU, rate-limit shoot, MigrationRunner

### CI / DevOps
- CI workflow: lint + test matrix Node 18/20/22 + audit + coverage
- Docker: multi-stage build, skip husky in production
- PostToolUse hook: auto re-index GitNexus after `git commit`/`merge`

---

## [2.1.0] — 2026-04-18

> 8 refactor iterations (iter 1–8), ~100 bugs fixed, security hardening, production readiness.

### Security
- **CSP nonces** — `unsafe-inline` replaced by per-request nonces on all inline scripts/styles
- **JWT timing-safe comparison** — replaced string equality with `crypto.timingSafeEqual` to prevent timing attacks
- **X-Forwarded-For guard** — only trust `X-Forwarded-For` from whitelisted reverse proxies; prevents IP spoofing
- **XSS fix LeaderboardSystem** — leaderboard entries sanitized via `textContent` instead of `innerHTML`
- **Account takeover prevention** — always create fresh identity on login (no session fixation)
- **Reflected XSS** — `err.status` escaped in HTML error pages
- **Log redaction** — username, nickname, IP removed from logs (GDPR)
- **JWT secret leak** — partial JWT secret removed from error logs
- **Secret scan** — TruffleHog integrated in CI pipeline

### Fixed
- **Top 20 bugs**
  1. Delta pool leak — server-internal fields excluded; fresh allocation per socket
  2. Zombie freeze on far-exit — AI freeze bounds aligned with broadcast AOI
  3. Zombie stutter on AOI re-entry — hard-snap to server position on re-entry
  4. Rubber-banding — hard-snap on repeated `positionCorrection`; per-socket room tracking
  5. Player teleport on lag — `_serverX/Y` stamped; rollback limited to anti-cheat path
  6. Bullet spawn origin — client-predicted position used for long-range hit registration
  7. Bullet lag compensation — first-tick fast-forward + `spawnCompensationMs` through EntityManager
  8. AOI bypass in small rooms — AOI skipped when <5 players (particles/bullets now visible)
  9. Client interpolation drift — `_serverTime` stamp every tick; RTT buffer scaling; `renderTime` aligned on server epoch
  10. Session recovery — `pendingUpgradeChoices` preserved across reconnect
  11. XP overflow — clamp before DB write prevents silent data corruption
  12. Async errors in game loop — guarded tick; unhandled rejections no longer kill server
  13. Circular dependency — lazy-load `handlePlayerDeathProgression` breaks import cycle
  14. Memory leaks — event listeners, queues, bounded arrays, zombie death cleanup
  15. Auth rate-limit response — returns JSON instead of HTML; `DISABLE_AUTH_RATE_LIMIT` dev flag
  16. XSS kill feed — `textContent` replaces `innerHTML` in kill feed renderer
  17. Crosshair misalignment on retina — `pixelRatio` scaling applied
  18. Movement budget not enforced — server-side anti-cheat re-enabled after accidental disable
  19. TOCTOU gold deduction — atomic gold deduction prevents double-spend in shop
  20. `positionCorrection` hard-snap regression — snap only triggers after N consecutive corrections

### Changed
- **ObjectPool DI** — pools injected via Container; no more module-level singletons
- **Event handler decomposition** — `DeathProgressionHandler`, `TeslaCoilHandler`, `PlayerUpdater`, `AutoTurretHandler` extracted from monolithic game loop
- **Socket handler split** — `shopEvents` and `socketUtils` extracted from `socketHandlers`
- **Logger migration** — all `console.*` replaced by Winston; consumers migrated to `infrastructure/logging/`
- **NetworkManager refactor (Phase 7)** — `ZombieManager`/`BossAbilities`/`CollisionManager` decomposed into SRP modules
- **ToastManager** — object-based API; legacy `/api/*` aliases removed
- **Static asset caching** — `no-store` headers; esbuild bundle dropped in favour of direct script loading

### Added
- **`/health/ready`** — readiness probe endpoint for container orchestration
- **Backup documentation** — runbook for DB backup/restore procedures
- **JSDoc types** — key domain models and services annotated with `@typedef`/`@param`/`@returns`
- **Secret scan CI step** — TruffleHog runs on every push
- **`DISABLE_AUTH_RATE_LIMIT`** — dev convenience flag

---

## [2.0.0] — Upcoming

> Planned release tag grouping all changes above.
> Multiplayer rewrite (DDD/Clean Arch) · Full prediction/reconciliation · MessagePack network layer · Mobile support · 80%+ coverage across all contexts.

---

[Unreleased]: https://github.com/mriu/zombie-browser-game/compare/HEAD
