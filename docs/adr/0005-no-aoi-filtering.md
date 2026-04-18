# ADR 0005 — Broadcast non filtré (pas de filtrage AOI)

## Status
Accepted

## Context
Dans les jeux MMO, le filtrage AOI (Area of Interest) envoie à chaque joueur uniquement les mises à jour des entités proches. Implémenter un AOI nécessite une grille spatiale ou un quadtree maintenu en temps réel, avec une logique d'abonnement/désabonnement par zone. Pour le zombie-browser-game, la carte est petite (< 2000x2000 unités) et le nombre de joueurs simultanés est limité (<50 en phase initiale).

## Decision
Broadcaster toutes les mises à jour d'état à tous les joueurs connectés sans filtrage spatial. Chaque tick, le serveur émet l'état complet de toutes les entités à toutes les connexions.

## Consequences
**Positif**
- Implémentation simple, zéro bug de synchronisation lié aux zones.
- Latence de diffusion minimale (pas de calcul de distance côté serveur).

**Négatif**
- Non scalable au-delà de ~100 joueurs simultanés (charge réseau O(n²)).
- À revisiter si le projet évolue vers des cartes plus grandes ou plus de joueurs (décision de révision suggérée à 50+ joueurs concurrents).
