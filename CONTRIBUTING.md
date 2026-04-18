# Contributing

## Setup local

**Node.js**: v22+ recommended (check `.nvmrc` if present).

```bash
npm install
cp .env.example .env   # fill required vars
npm run db:migrate
npm run dev            # dev server with hot reload
```

Run tests: `npm test` | Lint: `npm run lint`

## Code structure

See [docs/ARCHITECTURE.md](./ARCHITECTURE.md) for the full architecture breakdown.

Quick layout:
```
server/       Express app, routes
sockets/      Socket.io handlers
game/         Core game logic (domain)
transport/    Network layer (TCP, WebSocket)
infrastructure/ DB, persistence adapters
middleware/   Auth, rate-limit, etc.
__tests__/    Unit tests (mirrors source structure)
e2e/          Playwright end-to-end tests
```

## Conventions

- **Functions < 25 lines** — split if larger, no exceptions.
- **JSDoc on all public functions/classes**: describe params, return, throws.
- **Clean architecture**: domain (`game/`) has zero infra imports. Infra depends on domain, never the reverse.
- **No magic numbers** — named constants in `config/` or top of file.
- Formatter: `npm run format` (Prettier). Linter: `npm run lint`.

## Tests

- Write tests **before** merging. TDD preferred.
- `npm test` must be green on your branch before opening a PR.
- Unit tests in `__tests__/` mirroring the source path.
- Integration/E2E: `npm run test:integration` and `npm run test:e2e`.
- Do not disable or skip existing tests without a justification comment.

## Pull request process

**Branch naming**:
```
feat/<short-description>
fix/<short-description>
perf/<short-description>
refactor/<short-description>
chore/<short-description>
```

**Commit messages** (conventional commits):
```
feat(sockets): add reconnect backoff
fix(transport): close TCP socket on timeout
perf(game): cache zone lookup
```

**Pre-push hook** (auto-installed via `npm install`):
Runs `npm test` and `npm run lint`. Fix all failures before pushing.

**PR checklist** (from the PR template):
- `npm test` passes locally
- `npm run lint` clean
- New env vars added to `.env.example`
- `CHANGELOG.md` updated if user-facing

Assign at least one reviewer. Squash-merge preferred for features.

## Bug reports

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md). Required fields:

| Field | Example |
|---|---|
| Description | "Players get disconnected after 30s" |
| Steps to reproduce | Numbered list |
| Expected vs actual | One line each |
| Environment | Node version, browser, `PERFORMANCE_MODE` value |
| Logs | Paste relevant server output |

Open the issue before starting work on a fix — it avoids duplicate effort.
