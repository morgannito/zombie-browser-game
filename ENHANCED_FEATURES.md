# 🎮 Systèmes Améliorés - Zombie Survival

Ce document décrit les nouveaux systèmes d'effets visuels, audio, skins et UI intégrés au jeu.

## 📋 Table des matières

1. [Effets Visuels](#-effets-visuels)
2. [Système Audio](#-système-audio)
3. [Système de Skins](#-système-de-skins)
4. [Interface Améliorée](#-interface-améliorée)
5. [Intégration](#-intégration)

---

## 🎨 Effets Visuels

### Fichier: `visualEffects.js`

### Systèmes de Particules

Le système de particules avancé gère plusieurs types d'effets :

#### Types d'effets disponibles :

- **Explosions** : Créées lors de la mort de zombies, explosions d'ennemis, etc.
- **Sang/Impacts** : Effets de splatter lors des impacts sur les zombies
- **Traînées** : Effets de trail derrière le joueur (selon le skin)
- **Étincelles** : Pour les coups critiques
- **Texte flottant** : Affichage de gains (or, XP)
- **Effets de heal** : Particules vertes montantes

#### Utilisation :

```javascript
// Créer une explosion
window.enhancedEffects.onZombieDeath(x, y, color);

// Créer un effet de collecte
window.enhancedEffects.onGoldCollect(x, y, amount);

// Effet de level up
window.enhancedEffects.onLevelUp(x, y);
```

### Screen Shake

Système de tremblement d'écran pour feedback kinesthésique :

```javascript
// Intensité 10, durée 300ms
window.enhancedEffects.screenShake.shake(10, 300);
```

### Animations

Système d'animations pour les nombres de dégâts, heal, level up :

```javascript
// Afficher un nombre de dégâts
window.enhancedEffects.animations.createDamageNumber(x, y, damage, isCritical);
```

---

## 🎵 Système Audio

### Fichier: `audioSystem.js`

### Musique Procédurale

Le jeu génère de la musique dynamique selon le contexte :

#### Thèmes musicaux :

1. **Menu** : Progression d'accords calme (Am - F - C - G)
2. **Combat** : Riff de basse énergique (140 BPM)
3. **Boss** : Musique intense et dramatique (160 BPM)

#### Utilisation :

```javascript
// Démarrer la musique
window.advancedAudio.startMusic('menu');

// Changer de thème
window.advancedAudio.changeMusic('boss');

// Contrôle du volume
window.advancedAudio.setMusicVolume(0.5); // 0-1
```

### Effets Sonores

Tous les sons sont synthétisés avec Web Audio API :

#### Sons disponibles :

- **Tirs** : Différents sons selon l'arme (pistol, shotgun, machinegun)
- **Impacts** : Hit normal et critique
- **Mort de zombie** : Son grave descendant
- **Explosion** : Bruit blanc filtré
- **Collecte** : Sons montants (gold, powerup)
- **Level up** : Arpège ascendant (C-E-G-C)
- **Dégâts joueur** : Son d'alerte
- **Heal** : Son apaisant montant
- **Boss spawn** : Son grave menaçant
- **UI** : Click et hover

#### Utilisation :

```javascript
// Jouer un son
window.advancedAudio.playSound('shoot', 'pistol');
window.advancedAudio.playSound('hit', true); // critique
window.advancedAudio.playSound('explosion');
```

### Contrôles Audio

Deux boutons ont été ajoutés en haut à gauche :
- 🎵 : Toggle musique
- 🔊 : Toggle sons

---

## 👕 Système de Skins

### Fichier: `skinSystem.js`

### Skins de Joueur

9 skins disponibles avec différents effets :

| Skin | Prix | Effets |
|------|------|--------|
| **Classique** | Gratuit | Vert standard |
| **Néon** | 100 💰 | Cyan avec trail et glow |
| **Flammes** | 150 💰 | Orange/rouge avec trail de feu |
| **Ombre** | 200 💰 | Violet sombre avec trail |
| **Or** | 300 💰 | Doré avec particules orbitales |
| **Arc-en-ciel** | 500 💰 | Couleurs changeantes |
| **Toxique** | 150 💰 | Vert lime avec trail |
| **Glace** | 150 💰 | Bleu clair avec glow |
| **Sang** | 200 💰 | Rouge sombre |

### Skins d'Arme

6 skins de projectiles :

| Skin | Prix | Effets |
|------|------|--------|
| **Standard** | Gratuit | Blanc classique |
| **Laser** | 100 💰 | Rouge avec trail |
| **Plasma** | 150 💰 | Cyan avec glow et particules |
| **Explosif** | 200 💰 | Orange avec trail de feu |
| **Électrique** | 200 💰 | Jaune avec éclairs |
| **Arc-en-ciel** | 300 💰 | Couleurs changeantes |

### Sauvegarde

Les skins débloqués et équipés sont sauvegardés dans **localStorage** :

```javascript
// Débloquer un skin
window.skinManager.unlockPlayerSkin('neon');

// Équiper un skin
window.skinManager.equipPlayerSkin('neon');

// Vérifier les skins
console.log(window.skinManager.getAllPlayerSkins());
```

### Menu de Skins

Un bouton **🎨 SKINS** apparaît en bas à droite pour ouvrir le menu de sélection.

---

## 📱 Interface Améliorée

### Fichier: `enhancedUI.js`

### Notifications

Système de notifications élégantes en haut à droite :

```javascript
// Afficher une notification
window.enhancedUI.notifications.show('Message', 'success', 3000);

// Types disponibles
window.enhancedUI.notifications.show('Info', 'info');
window.enhancedUI.notifications.show('Succès', 'success');
window.enhancedUI.notifications.show('Attention', 'warning');
window.enhancedUI.notifications.show('Erreur', 'error');
```

### Barres de Progression Animées

Les barres de vie et XP s'animent fluidement :

- **Transition douce** vers la nouvelle valeur
- **Pulsation** quand la vie est basse (< 30%)
- **Vignette rouge** sur les bords de l'écran si vie faible

### Effets d'Écran

```javascript
// Flash de dégâts (rouge)
window.enhancedUI.screenEffects.damageFlash();

// Flash de heal (vert)
window.enhancedUI.screenEffects.healFlash();

// Flash de level up (doré)
window.enhancedUI.screenEffects.levelUpFlash();
```

### Améliorations Mobile

Pour les appareils mobiles :

- **Retour haptique** (vibrations) lors des actions
- **Animations du joystick** (glow, scale)
- **Bouton de tir amélioré** avec feedback visuel

#### Retour haptique :

```javascript
// Tir
window.enhancedUI.mobileUI.shootFeedback(); // 5ms

// Impact
window.enhancedUI.mobileUI.hitFeedback(); // 10ms

// Dégâts
window.enhancedUI.mobileUI.damageFeedback(); // Pattern [50, 30, 50]

// Level up
window.enhancedUI.mobileUI.levelUpFeedback(); // Pattern [100, 50, 100, 50, 100]
```

### Texte Flottant

Affichage de texte qui monte et disparaît :

```javascript
// Dégâts
window.enhancedUI.floatingText.createDamage(x, y, damage, isCritical);

// Heal
window.enhancedUI.floatingText.createHeal(x, y, amount);
```

---

## 🔧 Intégration

### Fichiers d'Intégration

Deux fichiers gèrent l'intégration :

1. **`gameIntegration.js`** : Initialise les systèmes et fournit les hooks
2. **`gamePatch.js`** : Modifie le jeu existant pour utiliser les nouveaux systèmes

### Hooks Disponibles

Le système fournit des hooks globaux pour les événements :

```javascript
// Appelé lors d'un tir
window.onPlayerShoot(x, y, angle, weaponType);

// Appelé lors d'un impact sur zombie
window.onZombieHit(x, y, angle, damage, isCritical, zombieColor);

// Appelé lors de la mort d'un zombie
window.onZombieDeath(x, y, zombieColor);

// Appelé lors d'une explosion
window.onExplosion(x, y, radius);

// Appelé lors de la collecte d'or
window.onGoldCollect(x, y, amount);

// Appelé lors du gain d'XP
window.onXPGain(x, y, amount);

// Appelé lors d'un level up
window.onLevelUp(x, y, level);

// Appelé lors d'un heal
window.onPlayerHeal(x, y, amount);

// Appelé lors de dégâts au joueur
window.onPlayerDamage(x, y, damage);

// Appelé lors de l'apparition d'un boss
window.onBossSpawn(x, y);

// Appelé lors du début du combat
window.onCombatStart();

// Appelé lors du retour au menu
window.onMenuReturn();
```

### Boucle de Mise à Jour

Les systèmes sont automatiquement mis à jour dans la boucle de jeu :

```javascript
function updateEnhancedSystems(deltaTime = 16) {
  if (window.enhancedEffects) {
    window.enhancedEffects.update(deltaTime);
  }
  if (window.skinManager) {
    window.skinManager.update();
  }
  if (window.enhancedUI) {
    window.enhancedUI.update();
  }
}
```

### Ordre de Chargement

L'ordre de chargement des scripts dans `index.html` est crucial :

```html
<!-- 1. Socket.IO -->
<script src="/socket.io/socket.io.js"></script>

<!-- 2. Nouveaux systèmes -->
<script src="visualEffects.js"></script>
<script src="audioSystem.js"></script>
<script src="skinSystem.js"></script>
<script src="enhancedUI.js"></script>
<script src="gameIntegration.js"></script>

<!-- 3. Jeu principal -->
<script src="game.js"></script>

<!-- 4. Patch (doit être chargé APRÈS game.js) -->
<script src="gamePatch.js"></script>
```

---

## 🎯 Exemples d'Utilisation

### Exemple 1: Ajouter un Nouveau Skin

```javascript
// Dans skinSystem.js, ajouter à PLAYER_SKINS :
cosmic: {
  id: 'cosmic',
  name: 'Cosmique',
  color: '#4a00e0',
  strokeColor: '#8e2de2',
  trail: true,
  trailColor: 'rgba(74, 0, 224, 0.6)',
  glow: true,
  glowColor: 'rgba(74, 0, 224, 0.8)',
  particles: true,
  particleColor: '#ffffff',
  unlocked: false,
  cost: 400
}
```

### Exemple 2: Créer un Effet Personnalisé

```javascript
// Créer une nouvelle fonction dans AdvancedEffectsManager
onCustomEvent(x, y) {
  this.particles.createExplosion(x, y, '#ff00ff', 40, 6);
  this.screenShake.shake(15, 400);
  this.animations.createLevelUpAnimation(x, y);
}

// Utiliser
window.enhancedEffects.onCustomEvent(100, 100);
```

### Exemple 3: Ajouter un Son Personnalisé

```javascript
// Dans EnhancedSoundEffects
playCustomSound() {
  const now = this.context.currentTime;
  const oscillator = this.context.createOscillator();
  const gainNode = this.context.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 440; // La note A4

  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

  oscillator.connect(gainNode);
  gainNode.connect(this.context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.5);
}

// Utiliser
window.advancedAudio.sounds.playCustomSound();
```

---

## 🐛 Débogage

### Console Logs

Les systèmes affichent des logs de débogage :

```
Initializing enhanced systems...
✓ Visual effects system loaded
✓ Audio system loaded
✓ Skin system loaded
✓ Enhanced UI loaded
All enhanced systems initialized!
Patching game systems...
✓ All patches applied successfully!
```

### Vérification des Systèmes

Dans la console du navigateur :

```javascript
// Vérifier que les systèmes sont chargés
console.log(window.enhancedEffects);
console.log(window.advancedAudio);
console.log(window.skinManager);
console.log(window.enhancedUI);

// Tester un effet
window.enhancedEffects.onExplosion(500, 500, 100);

// Tester un son
window.advancedAudio.playSound('explosion');

// Voir les skins disponibles
console.log(window.skinManager.getAllPlayerSkins());
```

---

## 📊 Performance

### Optimisations

- **Limite de particules** : 500 max pour éviter les ralentissements
- **Pooling implicite** : Les particules sont réutilisées
- **RequestAnimationFrame** : Synchronisation avec le rafraîchissement de l'écran
- **Canvas optimisé** : Utilisation de `save()`/`restore()` judicieuse
- **LocalStorage** : Sauvegarde asynchrone des skins

### Compatibilité

- ✅ Chrome/Edge (recommandé)
- ✅ Firefox
- ✅ Safari (iOS et macOS)
- ✅ Mobile (Android/iOS)
- ⚠️ Web Audio API requise pour le son

---

## 🚀 Améliorations Futures

Idées pour étendre les systèmes :

- [ ] Système de particules avec physique avancée
- [ ] Shaders WebGL pour effets visuels
- [ ] Musique adaptative selon l'intensité du combat
- [ ] Plus de skins avec effets uniques
- [ ] Animations de personnage (marche, tir)
- [ ] Système d'achievements avec notifications
- [ ] Effets météo (pluie, brouillard)
- [ ] Éclairage dynamique avancé
- [ ] Mode nuit avec lampe torche

---

## 📝 Licence

Ces systèmes sont intégrés au jeu Zombie Survival et suivent la même licence que le projet principal.

## 👨‍💻 Auteur

Développé par Claude Code - 2025
