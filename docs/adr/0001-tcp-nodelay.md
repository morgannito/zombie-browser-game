# ADR 0001 — Désactivation de l'algorithme de Nagle (TCP_NODELAY)

## Status
Accepted

## Context
Le jeu zombie est un jeu temps-réel multijoueur tournant sur Socket.IO (Node.js). Les mises à jour de position et d'état des entités sont émises à haute fréquence (~60 fps). L'algorithme de Nagle regroupe les petits paquets TCP pour réduire la congestion réseau, mais introduit une latence artificielle de 40–200 ms incompatible avec la jouabilité.

## Decision
Activer `TCP_NODELAY` sur le serveur Node.js en passant l'option `{allowHalfOpen: false, noDelay: true}` au niveau du transport Socket.IO / net.Socket. Cela désactive l'algorithme de Nagle pour toutes les connexions entrantes.

## Consequences
**Positif**
- Latence perçue réduite de ~40–200 ms à <5 ms sur LAN/fibre.
- Fluidité des mouvements et collisions nettement améliorée.

**Négatif**
- Légère augmentation du nombre de paquets TCP (overhead ~10 % sur connexions lentes).
- Aucun impact mesurable sur les tests avec simulateur réseau à 100 Mbps+.
