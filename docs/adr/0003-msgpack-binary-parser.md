# ADR 0003 — Socket.IO avec msgpack-parser (encodage binaire)

## Status
Accepted

## Context
Par défaut, Socket.IO sérialise les messages en JSON texte. Pour un jeu temps-réel émettant des dizaines de milliers de messages par seconde (positions x/y, états, santé, identifiants), la verbosité JSON génère une charge réseau et CPU significative. Le parser msgpack (`socket.io-msgpack-parser`) encode les messages en binaire compact.

## Decision
Configurer Socket.IO côté serveur et client avec `parser: require('socket.io-msgpack-parser')`. Tous les événements de jeu passent en binaire. Les messages d'API REST restent en JSON.

## Consequences
**Positif**
- Réduction de la taille des messages de 30–50 % selon le payload.
- Désérialisation plus rapide que JSON pour les types numériques.

**Négatif**
- Les messages ne sont plus lisibles dans les DevTools Network sans décodeur.
- Le client et le serveur doivent utiliser la même version du parser (contrainte de déploiement).
