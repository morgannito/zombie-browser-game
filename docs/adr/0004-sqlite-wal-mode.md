# ADR 0004 — Better-sqlite3 avec mode WAL

## Status
Accepted

## Context
Le serveur persiste les scores, sessions et états de partie dans SQLite. Le mode journal par défaut (DELETE/ROLLBACK) verrouille la base entière en écriture, ce qui bloque les lectures concurrentes pendant les sauvegardes fréquentes de l'état de jeu (toutes les ~500 ms). Le projet utilise `better-sqlite3` (API synchrone, plus performante que `sqlite3` async pour Node.js single-threaded).

## Decision
Activer le mode WAL (Write-Ahead Logging) au démarrage : `db.pragma('journal_mode = WAL')`. Couplé à `synchronous = NORMAL` pour équilibrer durabilité et performance.

## Consequences
**Positif**
- Lectures non bloquées pendant les écritures (lecteurs et écrivain coexistent).
- Throughput d'écriture amélioré de ~3x sur les benchmarks de sauvegarde d'état.

**Négatif**
- Fichiers WAL/SHM supplémentaires à gérer lors des sauvegardes (nécessite `PRAGMA wal_checkpoint`).
- Légèrement moins durable qu'un `synchronous = FULL` en cas de crash système.
