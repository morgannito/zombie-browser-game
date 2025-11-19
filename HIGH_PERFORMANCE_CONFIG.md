# 🚀 Configuration Haute Performance

## Configuration Serveur Actuelle

Le serveur est maintenant configuré en **mode HIGH PERFORMANCE** pour tirer parti de votre infrastructure puissante.

### Fichier `.env` à créer

Créez un fichier `.env` à la racine du projet avec le contenu suivant :

```env
# Server Configuration
PORT=3001
NODE_ENV=production

# Security
ALLOWED_ORIGINS=http://82.65.123.20:3001,http://localhost:3001

# Performance Optimization - HIGH MODE
PERFORMANCE_MODE=high
```

### Mode HIGH Performance

- ✅ **Tick Rate Serveur** : 60 FPS (16.67ms par tick)
- ✅ **Broadcast Rate** : 60 FPS (mise à jour clients 60x/seconde)
- ✅ **Max Zombies** : 200 simultanés
- ✅ **Max Players** : 50 simultanés
- ✅ **Max Powerups** : 20 simultanés

### Optimisations Client (déjà appliquées)

- ✅ **Network Update Rate** : 60 FPS (envoi position 60x/seconde)
- ✅ **Interpolation Factor** : 0.15 (mouvement réactif)
- ✅ **Target FPS** : 60 FPS (rendu fluide)
- ✅ **Auto-ajustement** : Désactivé (performances maximales)

### Redémarrage Requis

Pour appliquer le mode HIGH, redémarrez le serveur :

```bash
# Sur le Mac mini
ssh mac-mini
cd ~/zombie-browser-game
pm2 restart all
# ou
npm start
```

### Modes Disponibles

Si vous rencontrez des problèmes de performance, vous pouvez changer le mode :

- `high` : 60 FPS, 200 zombies, 50 joueurs (serveur puissant) ⚡
- `balanced` : 45 FPS, 150 zombies, 30 joueurs (défaut)
- `low-memory` : 30 FPS, 100 zombies, 20 joueurs (VPS limité)
- `minimal` : 20 FPS, 50 zombies, 10 joueurs (ressources minimales)

## Résultat Attendu

Avec cette configuration, vous devriez avoir :
- 🎮 Mouvement ultra-fluide et réactif
- 🚀 Synchronisation quasi-instantanée
- ⚡ Aucun lag perceptible avec une bonne connexion
- 🎯 Précision maximale dans les contrôles
