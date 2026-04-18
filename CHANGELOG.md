# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

### Added
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

## [2.0.0] — Upcoming

> Planned release tag grouping all changes above.
> Multiplayer rewrite (DDD/Clean Arch) · Full prediction/reconciliation · MessagePack network layer · Mobile support · 80%+ coverage across all contexts.

---

[Unreleased]: https://github.com/mriu/zombie-browser-game/compare/HEAD
