# Iterations — Zombie Browser Game

Résumé des 11 itérations de refactoring autonome (agents 1-100).

## État final (iter 12)

| Métrique | Valeur |
|---|---|
| Tests total | 2159 |
| Tests passés | 2135 |
| Tests échoués | 1 |
| Tests skipped | 23 |
| Vulnérabilités npm | 0 |
| ESLint restant | 0 erreur (warnings deprecated stylistic rules) |

## Table statistique par itération

| Iter | Agents | Focus | Files modifiés | +lignes | -lignes | Delta net |
|---|---|---|---|---|---|---|
| 1 | 9/10 | Bugs + docs initiaux | 47 | +2060 | -1135 | +925 |
| 2 | 10/10 | Bugs critiques + docs | 45 | +2238 | -1477 | +761 |
| 3 | 10/10 | Bugs + docs | 23 | +1159 | -470 | +689 |
| 4 | 10/10 | Bugs critiques + tests | 8 | +445 | -5 | +440 |
| 5 | 10/10 | Bugs + dead code + CI | 35 | +2113 | -1203 | +910 |
| 6 | 10/10 | Types + docs + audits | 32 | +798 | -156 | +642 |
| 7 | 10/10 | Polish + hardening | 27 | +584 | -72 | +512 |
| 8 | 10/10 | Security + prod ready | 11 | +232 | -84 | +148 |
| 9 | 10/10 | Polish final + rate limits | — | — | — | — |
| 10 | 10/10 | Input batch + TCP_NODELAY | 90 | +2043 | -642 | +1401 |
| 11 | — | Bilan + docs sync | — | — | — | — |
| 12 | — | Bilan iter 12 | — | — | — | — |

## Progression qualité

- **Iter 1-2** : stabilisation initiale, réduction bugs de régression réseau (réconciliation client/serveur, shoot origin).
- **Iter 3-4** : correction bugs critiques gameplay (collision, damage, spawn), ajout tests ciblés (+440 lignes tests iter 4).
- **Iter 5** : nettoyage dead code, intégration CI, couverture tests élargie (+2113 lignes).
- **Iter 6** : typage JSDoc complet (`types/global.d.ts`, `types/jsdoc-types.js`), audits ADR documentés (TCP_NODELAY, SQLite WAL, anti-cheat, msgpack).
- **Iter 7** : hardening (validation inputs, guards défensifs), polish API publique.
- **Iter 8** : sécurité production (rate limiting basique, disconnect robuste), réduction surface d'attaque.
- **Iter 9** : polish final, rate limits affinés, stabilité.
- **Iter 10** : optimisation batch input côté transport + TCP_NODELAY, 90 fichiers touchés, +1401 lignes nettes.
- **Iter 11** : bilan — 2146 tests (2122 pass, 1 fail, 23 skip), 1 ESLint warning résiduel (no-unused-vars middleware.js).
- **Iter 12** : bilan — 2159 tests (2135 pass, 1 fail, 23 skip, +13 vs iter 11), ESLint 0 erreur bloquante (warnings stylistic deprecated rules only). Dernier commit : `a4e292a` (iter 9 polish).
- **Iter 13** : bilan — 2169 tests (2145 pass, 1 fail, 23 skip, +10 vs iter 12), ESLint 0 erreur bloquante. 14 docs MD. Dernier commit : `a4e292a`.
- **Iter 14-16** : perf client (sprite cache, rendering), docs déploiement, traceId logging, JSDoc complet. (`a5dcb61`)
- **Iter 17-18** : constantes zombies centralisées, input passive listeners, docs README. (`d32fb53`)
- **Iter 19** : 3 vulns sécurité corrigées, refactor async Promise.all, CHANGELOG, cleanup unused. (`87178b7`)
- **Iter 20-21** : split NetworkManager, fix memory leaks canvas/listeners, tsconfig strict. (`8d03010`)
- **Iter 22** : lint 0 erreurs, docs TESTING, audit races TOCTOU identifiées. (`d7548f6`)
- **Iter 23** : fix TOCTOU UpdatePlayerStats, sprite cache resize, docs BACKUP. (`52bc274`)
- **Iter 24** : fix TOCTOU RecoverSession, docs MIGRATIONS. (`8941ffd`)
- **Iter 25** : fix TOCTOU AddAccountXP, fix test BuyUpgrade, couverture élargie. (`7ceda00`)
- **Iter 26** : logs hot paths debug, audit PWA, indexes SQLite ajoutés. (`2bbc1a7`)
- **Iter 27** : PWA network-first HTML, bilan stabilité. (`40b8100`)
- **Iter 28-29** : fix timeouts flaky Playwright, dep @eslint/js, retries E2E. (`d9e00c5`)
- **Iter 30** : tests régression API, SECURITY.md, push GitHub. (`ba4ff12`)

## ADR produits

- `0001-tcp-nodelay.md` — TCP_NODELAY activé pour réduire la latence réseau
- `0002-anti-cheat-disabled.md` — Anti-cheat désactivé (perf vs sécurité)
- `0003-msgpack-binary-parser.md` — MessagePack pour réduire le payload
- `0004-sqlite-wal-mode.md` — SQLite WAL pour concurrence lecture/écriture
- `0005-no-aoi-filtering.md` — Pas d'AOI filtering (broadcast flat < 20 clients)
