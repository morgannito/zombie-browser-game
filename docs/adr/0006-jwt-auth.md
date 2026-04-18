# ADR-0006 — JWT Authentication

## Context

The game server needs to authenticate WebSocket connections. Sessions must be stateless to allow horizontal scaling, and tokens must carry player identity without a round-trip to the database on every message.

## Decision

Use signed JWT (HS256) issued at HTTP upgrade time. The token is validated once on WebSocket handshake; subsequent messages carry no credential overhead. Secrets are loaded from environment variables at startup.

## Consequences

- **+** Stateless: no session store required.
- **+** Standard library support (`jsonwebtoken`) — no custom crypto.
- **−** Token revocation requires a short TTL (≤15 min) or a denylist, adding complexity for forced logouts.
- **−** Secret rotation requires coordinated restart.
