# Scripts Reference

## Dev

| Script / Commande | Description | Usage |
|---|---|---|
| `npm start` | Démarre le serveur Node.js | `npm start` |
| `npm run dev` | Démarre avec nodemon (hot-reload) | `npm run dev` |
| `npm run build` | Bundle le client via scripts/build-bundle.js | `npm run build` |
| `npm run lint` | Lint ESLint | `npm run lint` |
| `npm run lint:fix` / `fix` | Lint + Prettier auto-fix | `npm run fix` |
| `npm run format` | Formate tous les fichiers JS/JSON/MD | `npm run format` |
| `npm run typecheck` | Vérifie les types TypeScript (tsconfig.check.json) | `npm run typecheck` |
| `npm run health` | Vérifie /health et sort 0/1 | `npm run health` |

## Test

| Script / Commande | Description | Usage |
|---|---|---|
| `npm test` | Jest avec coverage | `npm test` |
| `npm run test:watch` | Jest en mode watch | `npm run test:watch` |
| `npm run test:unit` | Jest — tests unitaires uniquement | `npm run test:unit` |
| `npm run test:integration` | Jest — tests d'intégration | `npm run test:integration` |
| `npm run test:e2e` | Playwright E2E | `npm run test:e2e` |
| `npm run test:e2e:ui` | Playwright avec UI interactive | `npm run test:e2e:ui` |
| `scripts/test-client.js` | Client scripté multi-scénario (shoot/move/zombies/all) | `node scripts/test-client.js [scenario]` |
| `scripts/test-aim.js` | Valide le pipeline shoot-to-hit vers la zombie la plus proche | `node scripts/test-aim.js` |
| `scripts/test-hits.js` | Taux de hits réels (drops de HP) — pipeline tir E2E | `node scripts/test-hits.js` |
| `scripts/test-range.js` | Hits par bucket de distance (500-800px), respecte fireRate | `node scripts/test-range.js` |
| `scripts/test-multi.js` | N bots concurrents, mesure comportement serveur | `node scripts/test-multi.js` |
| `scripts/test-stress.js` | Joueur actif tir+mouvement continus N secondes — kills/s, latence | `node scripts/test-stress.js` |
| `scripts/test-observe.js` | Observe les deltas envoyés par le serveur pendant 8s | `node scripts/test-observe.js` |
| `scripts/test-delta-size.js` | Inspecte 5 deltas — structure JSON + tailles (détecte bloat) | `node scripts/test-delta-size.js` |

## Bench

| Script / Commande | Description | Usage |
|---|---|---|
| `npm run bench` | Load benchmark multi-clients (bench/loadtest.js) | `npm run bench` |
| `npm run bench:report` | Rapport lisible depuis last-run.json | `npm run bench:report` |
| `scripts/bench-run.js` | Harnais complet : boot serveur, N bots, scrape /metrics, JSON | `node scripts/bench-run.js` |
| `scripts/bench-compare.js` | Compare deux rapports bench-run, détecte régressions p95/mean | `node scripts/bench-compare.js report1.json report2.json` |
| `scripts/load-test.js` | N bots, métriques : delta Hz, RTT, déconnexions, bytes | `node scripts/load-test.js` |
| `scripts/perf-check.js` | 30 bots / 30s, vérifie budgets perf-budget.json — exit 1 si dépassé | `node scripts/perf-check.js` |
| `scripts/leak-test.js` | 5 bots, sample heapUsed toutes les 30s, alerte >50MB de croissance | `node scripts/leak-test.js` |
| `scripts/delta-inspect.js` | Inspecte les deltas temps réel via socket.io | `node scripts/delta-inspect.js` |
| `bench/run-all.js` | Lance tous les micro-benchmarks, génère rapport JSON comparatif | `node bench/run-all.js` |
| `bench/collision-bench.js` | Micro-bench CollisionManager (100/500/1000 entités, 500 iter) | `node bench/collision-bench.js` |
| `bench/delta-bench.js` | Micro-bench génération de deltas NetworkManager | `node bench/delta-bench.js` |
| `bench/spatial-grid-bench.js` | Micro-bench SpatialGrid — queries sur 100/500/1000 nœuds | `node bench/spatial-grid-bench.js` |

## Deploy

| Script / Commande | Description | Usage |
|---|---|---|
| `npm run deploy:server` | Lance deploy-server.js (serveur de déploiement) | `npm run deploy:server` |
| `npm run deploy:install` | Installe le LaunchAgent macOS com.zombiegame.deploy | `npm run deploy:install` |
| `npm run deploy:uninstall` | Désinstalle le LaunchAgent macOS | `npm run deploy:uninstall` |
| `npm run deploy:restart` | Redémarre le service via launchctl | `npm run deploy:restart` |
| `npm run deploy:logs` | Suit deploy.log en temps réel | `npm run deploy:logs` |

## DB

| Script / Commande | Description | Usage |
|---|---|---|
| `npm run db:migrate` | Applique les migrations en attente | `npm run db:migrate` |
| `npm run db:rollback` | Annule la dernière migration | `npm run db:rollback` |
| `npm run db:status` | Affiche l'état des migrations | `npm run db:status` |
| `npm run db:backup` | Sauvegarde la base via scripts/backup.js | `npm run db:backup` |
| `scripts/apply-migration.js` | Applique un fichier de migration SQL manuellement | `node scripts/apply-migration.js <migration-file>` |

## Maintenance

| Script / Commande | Description | Usage |
|---|---|---|
| `scripts/generate-icons.js` | Génère les sprites SVG des icônes du jeu | `node scripts/generate-icons.js` |
| `scripts/generate-tiles.js` | Génère les tuiles de la carte | `node scripts/generate-tiles.js` |
| `scripts/generate-zombies.js` | Génère les sprites canvas des zombies | `node scripts/generate-zombies.js` |
| `scripts/install-cron.sh` | Installe les tâches cron de maintenance | `bash scripts/install-cron.sh` |
| `scripts/uninstall-cron.sh` | Désinstalle les tâches cron | `bash scripts/uninstall-cron.sh` |
| `scripts/backup-db.sh` | Script shell de backup base de données | `bash scripts/backup-db.sh` |
| `scripts/restore-db.sh` | Restaure une sauvegarde de base de données | `bash scripts/restore-db.sh` |
| `scripts/heap-snapshot.sh` | Prend un snapshot heap Node.js pour analyse mémoire | `bash scripts/heap-snapshot.sh` |
| `scripts/profile.sh` | Lance le serveur en mode profiling V8 | `bash scripts/profile.sh` |
| `scripts/perf-budget.json` | Fichier de configuration des budgets perf (lu par perf-check.js) | — |
