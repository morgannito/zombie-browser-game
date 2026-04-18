# ADR-0007 — PWA HTML : stratégie network-first

## Context

Le Service Worker utilisait une stratégie cache-first pour tous les assets, y compris `index.html`. Les mises à jour du jeu n'étaient pas visibles immédiatement : les joueurs recevaient la version en cache jusqu'au prochain cycle d'activation du SW, bloquant le déploiement continu.

## Decision

Appliquer `networkFirstWithCacheFallback` sur `/` et `/index.html` dans `public/sw.js`. Les autres assets statiques (JS, CSS, images) conservent la stratégie cache-first. Le HTML frais est mis en cache après chaque requête réseau réussie ; le cache sert de fallback hors-ligne.

## Consequences

- **+** Les mises à jour HTML sont visibles dès le prochain rechargement, sans vider le cache manuellement.
- **+** La PWA reste fonctionnelle hors-ligne via le fallback cache.
- **−** Une requête réseau est systématiquement émise pour le HTML (latence légèrement supérieure au cache-first pur).
- **−** Sur connexion très dégradée, le délai de réponse HTML augmente avant le fallback cache.
