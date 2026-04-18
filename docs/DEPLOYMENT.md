# Deployment Guide

## Prerequisites

- Node.js 20+
- npm
- PM2 (`npm install -g pm2`) — for bare-metal deploys
- Docker + Docker Compose — for container deploys
- `sqlite3` CLI — required by backup scripts
- `curl` — required by healthcheck

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the required values.

### Required in production

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Server port | `3000` |
| `JWT_SECRET` | JWT signing secret (64-byte hex) | `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ALLOWED_ORIGINS` | Comma-separated allowed CORS origins | `https://yourdomain.com` |
| `SESSION_SECRET` | Session secret (docker-compose only, required) | strong random string |
| `ADMIN_TOKEN` | Admin API token (docker-compose only, required) | strong random string |

### Optional / defaults

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `./data/game.db` | SQLite database path |
| `LOG_DIR` | `./logs` | Log output directory |
| `LOG_LEVEL` | `debug` (dev) / `info` (prod) | `error\|warn\|info\|debug` |
| `PERFORMANCE_MODE` | `balanced` | `high\|balanced\|low-memory\|minimal` |
| `METRICS_TOKEN` | _(empty)_ | Bearer token for `/health` and `/api/v1/metrics` |
| `ADMIN_USER_IDS` | _(empty)_ | Comma-separated player UUIDs with in-game admin |
| `SESSION_TTL` | `300000` | Idle socket TTL in ms |
| `JWT_EXPIRES_IN` | `7d` | JWT token lifetime |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window in ms |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `REQUIRE_DATABASE` | `true` | Fail startup if DB unavailable |
| `ENABLE_MSGPACK` | `false` | Binary WebSocket protocol |
| `ENABLE_WS_COMPRESSION` | `false` | permessage-deflate compression |
| `ENABLE_REPLAY` | `false` | Game replay recording |

### Feature flags (never enable in production)

| Variable | Default |
|---|---|
| `DISABLE_AUTH_FOR_TESTS` | `false` |
| `DB_SKIP` | `false` |
| `ADMIN_DEBUG` | `false` |

---

## Pre-Deploy Checklist

- [ ] `JWT_SECRET` is a strong unique value (not `CHANGE_ME_BEFORE_RUNNING`)
- [ ] `SESSION_SECRET` and `ADMIN_TOKEN` are set (Docker Compose)
- [ ] `ALLOWED_ORIGINS` includes all production domains (http and https)
- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info`
- [ ] `DISABLE_AUTH_FOR_TESTS=false`
- [ ] `DB_SKIP=false`
- [ ] `data/` and `logs/` directories exist and are writable
- [ ] A database backup was taken before deploy (see Backup section)

---

## Deploy: PM2 (bare-metal)

```sh
# Install dependencies
npm ci --production

# Start with PM2
pm2 start ecosystem.config.js

# Or start in staging environment
pm2 start ecosystem.config.js --env staging
```

**PM2 configuration** (`ecosystem.config.js`):

| Setting | Value |
|---|---|
| App name | `zombie-game` |
| Script | `server.js` |
| Instances | `1` (fork mode) |
| Max memory restart | `500M` |
| Production port | `3000` |
| Staging port | `3001` |
| Logs | `./logs/pm2-out.log`, `./logs/pm2-error.log` |

```sh
# Common PM2 commands
pm2 status
pm2 logs zombie-game
pm2 restart zombie-game
pm2 stop zombie-game
pm2 delete zombie-game

# Save process list for startup on reboot
pm2 save
pm2 startup
```

---

## Deploy: Docker

```sh
# Build and start
docker compose up -d --build

# Logs
docker compose logs -f zombie-game

# Stop
docker compose down
```

**Volumes mounted by Docker Compose:**

| Host path | Container path |
|---|---|
| `./data` | `/app/data` |
| `./logs` | `/app/logs` |

The Docker image runs as user `node` (non-root).

---

## Auto-Deploy via GitHub Webhook

`deploy-server.js` is a webhook receiver that triggers a pull + restart on push to `main`.

**Setup:**

```sh
./setup-deploy.sh
```

This script:
1. Generates a `GITHUB_WEBHOOK_SECRET`
2. Writes `.env.deploy.local` with `DEPLOY_PORT`, `GITHUB_WEBHOOK_SECRET`, `DEPLOY_BRANCH`
3. Patches `com.zombiegame.deploy.plist` with local paths (macOS LaunchAgent)
4. Tests that `deploy-server.js` starts successfully

**Auto-deploy environment variables** (`.env.deploy` / `.env.deploy.local`):

| Variable | Default | Description |
|---|---|---|
| `DEPLOY_PORT` | `9000` | Port for the webhook receiver |
| `GITHUB_WEBHOOK_SECRET` | _(required)_ | Shared secret with GitHub webhook |
| `DEPLOY_BRANCH` | `main` | Branch that triggers deploy |

Configure the GitHub webhook:
- URL: `http://<your-server>:9000/webhook`
- Content type: `application/json`
- Secret: value of `GITHUB_WEBHOOK_SECRET`
- Event: `push`

Install as a persistent macOS service:

```sh
npm run deploy:install
```

---

## Healthcheck

The `/health` endpoint is used by both Docker and PM2 monitoring.

```sh
curl -fs http://localhost:3000/health
```

If `METRICS_TOKEN` is set, include the Authorization header:

```sh
curl -fs -H "Authorization: Bearer <METRICS_TOKEN>" http://localhost:3000/health
```

Docker built-in healthcheck: interval 30s, timeout 5s, 3 retries, 15s start period.

---

## Backup

**Manual backup:**

```sh
./scripts/backup-db.sh
```

Creates a gzip-compressed SQLite backup in `./backups/zombie-YYYY-MM-DD_HHMM.db.gz`. Keeps the 14 most recent backups. Requires `sqlite3` CLI.

**Install automatic backup (cron, every 6h):**

```sh
./scripts/install-cron.sh
```

Cron entry: `0 */6 * * * <path>/backup-db.sh >> /var/log/zombie-backup.log 2>&1`

**Uninstall cron:**

```sh
./scripts/uninstall-cron.sh
```

---

## Rollback

1. Take a backup of the current database:
   ```sh
   ./scripts/backup-db.sh
   ```

2. Stop the server:
   ```sh
   pm2 stop zombie-game
   # or: docker compose down
   ```

3. Revert the code (git or deploy previous artifact):
   ```sh
   git checkout <previous-tag-or-commit>
   npm ci --production
   ```

4. Restore a database backup if the schema changed:
   ```sh
   ./scripts/restore-db.sh ./backups/zombie-<TIMESTAMP>.db.gz
   ```
   The restore script:
   - Verifies SQLite integrity before restoring
   - Saves the current database to `game.db.before-restore.<timestamp>` as a safety copy
   - Removes WAL artefacts after restore

5. Restart the server:
   ```sh
   pm2 start ecosystem.config.js
   # or: docker compose up -d
   ```

6. Verify:
   ```sh
   curl -fs http://localhost:3000/health
   pm2 status
   ```
