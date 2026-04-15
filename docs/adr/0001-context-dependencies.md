# ADR 0001 — Allowed dependencies between bounded contexts

**Status:** Accepted
**Date:** 2026-04-15
**Refactor scope:** Phase 6 (Quality gates) of REFACTOR_PLAN.md

## Context

Phase 2 of the refactor introduced six bounded contexts under `contexts/`:

```
contexts/
├── zombie/        # AI, spawn, boss, spatial grid
├── weapons/       # bullets, collisions, damage effects
├── player/        # progression, effects, respawn, special abilities
├── wave/          # wave progression + Rogue-like room system
├── session/       # session recovery + player state factory
└── leaderboard/   # score submission + leaderboard reads
```

Without an explicit dependency policy, contexts will accrete back into a
ball-of-mud: any context could `require` anything, breaking the value of
the bounded-context split.

## Decision

We adopt the following dependency rules. They are enforced informally via
review for now and will be lifted to ESLint `no-restricted-imports` in a
follow-up step (Phase 6 ESLint task).

### Allowed cross-context dependencies

| From            | May import from                                 |
|-----------------|-------------------------------------------------|
| `zombie/`       | `wave/` (handleNewWave on boss death only)      |
| `weapons/`      | `zombie/`, `wave/`, `player/`                   |
| `player/`       | `wave/` (handleNewWave on tesla coil kill only) |
| `wave/`         | — (leaf context, no cross-context imports)      |
| `session/`      | — (leaf context)                                |
| `leaderboard/`  | — (leaf context)                                |

### Forbidden imports

- `zombie/` → `weapons/`, `player/`, `session/`, `leaderboard/`
- `wave/`  → any other context
- `session/` → any other context
- `leaderboard/` → any other context
- Any context → `server/`, `transport/`, `sockets/`, `routes/`

### Direction of dependencies

```
   transport/          (HTTP/WebSocket adapters)
       │
       ▼
   server/             (bootstrap, wiring)
       │
       ▼
   contexts/*          (domain — bounded contexts)
       │
       ▼
   infrastructure/     (Logger, MetricsCollector, DatabaseManager)
       │
       ▼
   lib/domain          (entities, value objects, errors)
```

A context may depend **down** the stack (infrastructure, lib/domain) and
**sideways** only via the table above. Never **up** (no context may import
from `server/`, `transport/`, `routes/`, etc.).

### Exposing context APIs

Each context provides a public facade in its `index.js`. Cross-context
imports SHOULD go through the facade rather than reaching into
`contexts/<other>/modules/`. Internal modules under `modules/` are
considered private.

## Consequences

- Cross-context coupling stays low — contexts can be tested and reasoned
  about independently.
- New code that needs to cross the wall must update this ADR first.
- A future ESLint rule (`no-restricted-imports`) will encode this table
  programmatically — see Phase 6 follow-up.
- Consumers that currently import private modules
  (e.g. `contexts/zombie/modules/ZombieEffects`) are tolerated until the
  ESLint rule lands; they should migrate to the facade as opportunity
  arises.

## Current known violations

(Snapshot at PR creation — to be cleaned up incrementally.)

- `weapons/modules/BulletCollisionHandler` reaches into
  `zombie/modules/ZombieEffects` (handleSplitterDeath) — needs facade
  export.
- `player/modules/TeslaCoilHandler` reaches into
  `wave/modules/WaveManager` directly — already exposed via facade
  (`wave/index.js → handleNewWave`); migrate the import to use the facade.

## References

- `REFACTOR_PLAN.md` — Phase 6 quality gates
- `docs/ARCHITECTURE.md` — overall layered architecture
