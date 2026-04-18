# ADR 0002 — Anti-cheat désactivé par défaut (env var ENABLE_ANTICHEAT)

## Status
Accepted

## Context
Un module anti-cheat côté serveur (validation des déplacements, détection de téléportation, rate-limiting des actions) a été prototypé. En développement et lors des benchmarks de performance, ce module introduit une latence de traitement supplémentaire (~2–8 ms par tick) et génère des faux-positifs gênants lors des tests avec lag réseau simulé.

## Decision
Le module anti-cheat est désactivé par défaut. Il s'active uniquement si la variable d'environnement `ENABLE_ANTICHEAT=true` est définie au démarrage du serveur. Aucune logique de validation n'est chargée si la variable est absente ou vaut `false`.

## Consequences
**Positif**
- Boucle de développement plus rapide, zéro faux-positif en local.
- Performances serveur optimales pour les benchmarks et démonstrations.

**Négatif**
- En production sans la variable, les joueurs peuvent tricher librement.
- Responsabilité opérationnelle : le déploiement prod doit explicitement setter `ENABLE_ANTICHEAT=true`.
