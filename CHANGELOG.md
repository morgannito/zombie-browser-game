# Changelog

All notable changes to this project are documented here.

## [Unreleased]

### Security
- Replace unsafe-inline CSP directive from scriptSrc
- Always create fresh identity on login (prevents account takeover)
- Escape err.status in HTML error pages (reflected XSS fix)
- Redact username, nickname and IP from logs (GDPR)
- Re-enable server-side movement budget enforcement (anti-cheat)
- Remove partial JWT secret from logs
- Add secret scan (trufflehog) to CI pipeline

### Features
- Anti-cheat: shoot throttle 20/s, atomic gold deduction, auto-disconnect on violation threshold
- Accessibility: prefers-reduced-motion disables particles/animations
- Accessibility: Esc closes shop, focus-visible reinforced, aria-labels on emoji buttons
- Metrics: anti-cheat counters exposed on `/api/v1/metrics`

### Performance
- Batch particles by color in EffectsRenderer (1 beginPath/fill per color group)
- Cache getElementById refs in UIManager (eliminate 10+ DOM lookups per frame)
- AbortController 10s timeout on progression fetch calls
- Migrate NetworkManager ping to TimerManager (no dangling setInterval)
- Eliminate allocations in NetworkManager._hasGameStateChanges
- Inline queryRadius filter + reuse `now` in moveZombie hot path
- Plasma trail without object allocation or Math.sqrt
- Batch skill lookups to eliminate N+1 in getPlayerSkillBonuses
- Add indexes for leaderboard, progression, achievements, skill_tree

### Fixes
- Domain errors typed in SubmitScoreUseCase, CreatePlayerUseCase, BuyUpgradeUseCase
- Pool lightweight collision wrappers (stop leaking type/entityId to clients)
- TTL eviction for deadZombies + guard double-death processing
- Memory cleanup of NetworkManager queues on socket disconnect
- Normalize Player.getKDRatio to always return a number
- Error handling in SQLiteUpgradesRepository and SQLiteSessionRepository
- Async errors no longer kill the server; game loop tick is guarded
- Loot require hoisted; admin getNextId fixed; XSS-safe kill feed via textContent
- Remove auth requirement from `/health` endpoint (liveness probes)
- Fix Tesla Coil bulletCount assertion in tests

### Refactoring
- Extract DeathProgressionHandler, TeslaCoilHandler, PlayerUpdater, AutoTurretHandler from gameLoop
- Extract shopEvents and socketUtils from socketHandlers
- Extract respawn helpers in sockets
- Replace console.* with structured Winston logger across game modules
- Remove dead code (playerUtils, gameConstants, particleEffects, ZombieTypesExtended)
- Remove unused @msgpack/msgpack dependency

### Tests
- Unit tests: JwtService, roomFunctions, validationFunctions, ObjectPool, MathUtils
- Unit tests: RoomManager, Container, elite/elemental zombies, ProgressionIntegration, SkillEffectsApplicator, RunMutatorManager
- Edge case tests: ZombieEffects (poison, freeze, splitter), socketUtils
- Integration tests: HTTP smoke, connection lifecycle, shop TOCTOU, rate-limit shoot, upgrade guard

### CI / DevOps
- CI workflow: lint + test matrix Node 18/20/22 + audit + coverage
- Docker: multi-stage build, skip husky in production, improved .dockerignore
- PostToolUse hook: auto re-index GitNexus after git commit/merge
