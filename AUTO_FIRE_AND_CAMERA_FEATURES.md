# Nouvelles Fonctionnalités : Tir Automatique & Recentrage Caméra

**Date:** 2025-11-20
**Branch:** claude/improve-project-quality-01Fknb2fzPLXP9w1gvKijXYh

## Vue d'ensemble

Deux nouvelles fonctionnalités ont été ajoutées pour améliorer l'expérience de jeu sur desktop :

1. **Tir Automatique** - Plus besoin de spam clic, maintenez simplement le bouton de la souris
2. **Bouton de Recentrage Caméra** - Recenter instantanément la caméra en cas de bug

---

## 1. Tir Automatique (Desktop Auto-Fire) 🎯

### Comportement Avant
- Il fallait cliquer répétitivement pour tirer
- Fatiguant pour les doigts lors de longues sessions
- Difficile de maintenir une cadence de tir rapide

### Comportement Après
- **Maintenez le bouton gauche de la souris** pour tirer en continu
- Le tir s'arrête automatiquement quand vous relâchez le bouton
- Le premier tir est instantané au clic
- Le tir s'arrête aussi si vous sortez du canvas

### Paramètres
- **Intervalle de tir :** 150ms (configurable dans GameEngine.js)
- **Cadence :** ~6-7 coups par seconde
- **Précision :** Tire toujours vers la position actuelle de la souris

### Implémentation Technique

#### Fichier : `public/modules/core/GameEngine.js`

**Nouvelles propriétés :**
```javascript
this.isMouseDown = false;
this.lastAutoFireTime = 0;
this.AUTO_FIRE_INTERVAL = 150; // Adjustable fire rate
```

**Événements de souris modifiés :**
- `click` → `mousedown` + `mouseup`
- Premier tir au `mousedown`
- Tirs continus dans la boucle de jeu
- Arrêt sur `mouseup` ou `mouseleave`

**Code ajouté dans update() :**
```javascript
// Update desktop auto-fire (DESKTOP)
if (!this.mobileControls.isMobile && this.isMouseDown) {
  const currentTime = performance.now();
  if (currentTime - this.lastAutoFireTime >= this.AUTO_FIRE_INTERVAL) {
    this.playerController.shoot(window.innerWidth, window.innerHeight);
    this.lastAutoFireTime = currentTime;
  }
}
```

### Compatibilité
- ✅ Desktop uniquement (pas mobile)
- ✅ Compatible avec le système d'auto-shoot mobile existant
- ✅ Respecte les cooldowns d'armes côté serveur
- ✅ Fonctionne avec toutes les armes

---

## 2. Bouton de Recentrage Caméra 🎯

### Problème Résolu
- La caméra peut parfois se décaler ou "bugger" pendant le jeu
- Difficile de retrouver son personnage si la caméra se perd
- Aucun moyen rapide de corriger le problème

### Solution
- **Nouveau bouton** avec icône 🎯 en bas à droite
- **Raccourci clavier** : Touche `C`
- Recentre instantanément la caméra sur le joueur

### Position du Bouton
- Desktop : En bas à droite, au-dessus du bouton minimap (📍)
- Mobile : Même position, adapté aux petits écrans
- Couleur : Orange (#ffa500) pour le distinguer

### Utilisation
1. **Clic sur le bouton 🎯**
2. **OU appuyez sur la touche `C`**
3. La caméra se recentre instantanément sur le joueur
4. Feedback visuel, sonore et toast notification

### Implémentation Technique

#### Fichier : `public/modules/managers/CameraManager.js`

**Nouvelle méthode recenter() :**
```javascript
recenter(player, canvasWidth, canvasHeight) {
  this.x = player.x - canvasWidth / 2;
  this.y = player.y - canvasHeight / 2;
  this.width = canvasWidth;
  this.height = canvasHeight;
}
```

#### Fichier : `public/modules/utils/initHelpers.js`

**Nouvelle fonction d'initialisation :**
```javascript
function initCameraRecenter() {
  const cameraRecenterBtn = document.getElementById('camera-recenter-btn');

  // Show button
  cameraRecenterBtn.style.display = 'flex';

  // Click handler
  cameraRecenterBtn.addEventListener('click', () => {
    window.gameEngine.camera.recenter(player, window.innerWidth, window.innerHeight);
    // Visual + audio feedback
  });

  // Keyboard shortcut (C key)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      // Trigger if not typing in input
      cameraRecenterBtn.click();
    }
  });
}
```

#### Fichier : `public/index.html`

**HTML du bouton :**
```html
<button id="camera-recenter-btn"
        aria-label="Recenter camera"
        title="Recentrer la caméra (C)"
        style="display: none;">
    🎯
</button>
```

#### Fichier : `public/style.css`

**Style du bouton :**
```css
#camera-recenter-btn {
  position: absolute;
  bottom: calc(var(--space-lg) + var(--safe-area-bottom) + 50px);
  right: calc(var(--space-lg) + var(--safe-area-right));
  width: 40px;
  height: 40px;
  background: rgba(255, 165, 0, 0.7);
  border: 2px solid #ffa500;
  border-radius: 50%;
  /* ... autres styles */
}
```

### Feedback Utilisateur
- ✅ **Animation visuelle** : Le bouton se réduit/agrandit au clic
- ✅ **Son** : Joue un clic audio (si audioManager disponible)
- ✅ **Toast** : Affiche "Caméra recentrée" (1 seconde)

### Accessibilité
- `aria-label` : "Recenter camera"
- `title` : "Recentrer la caméra (C)" (tooltip)
- Raccourci clavier : `C`
- Fonctionne au tactile sur mobile

---

## Modifications des Fichiers

### Fichiers Modifiés

#### Client-side
1. **`public/modules/core/GameEngine.js`**
   - Ajout propriétés auto-fire
   - Modification événements souris (mousedown/mouseup)
   - Logique auto-fire dans update()
   - Exposition de la caméra (`this.camera`)

2. **`public/modules/managers/CameraManager.js`**
   - Nouvelle méthode `recenter()`

3. **`public/modules/utils/initHelpers.js`**
   - Nouvelle fonction `initCameraRecenter()`
   - Gestion du bouton et raccourci clavier

4. **`public/game.js`**
   - Appel à `initCameraRecenter()` au démarrage

5. **`public/index.html`**
   - Ajout du bouton `#camera-recenter-btn`

6. **`public/style.css`**
   - Style desktop pour `#camera-recenter-btn`
   - Style mobile adaptatif

### Nouveaux Fichiers
- `AUTO_FIRE_AND_CAMERA_FEATURES.md` (ce document)

---

## Tests

### Tir Automatique
✅ Maintenir le clic gauche tire en continu
✅ Relâcher le clic arrête le tir
✅ Premier tir instantané
✅ Tir s'arrête en sortant du canvas
✅ Fonctionne uniquement sur desktop (pas mobile)
✅ Respecte les cooldowns d'armes

### Bouton Caméra
✅ Bouton visible en bas à droite
✅ Clic recentre la caméra instantanément
✅ Touche C fonctionne
✅ Pas de déclenchement pendant la saisie
✅ Feedback visuel/sonore/toast
✅ Adapté mobile et desktop

---

## Avantages

### Tir Automatique
- 👍 **Confort** - Plus de fatigue des doigts
- 👍 **Précision** - Meilleure visée sans spam clic
- 👍 **Accessibilité** - Plus facile pour les nouveaux joueurs
- 👍 **Performance** - Cadence de tir optimale

### Recentrage Caméra
- 👍 **Fiabilité** - Solution rapide aux bugs de caméra
- 👍 **UX** - Ne plus jamais perdre son personnage
- 👍 **Accessible** - Bouton ET raccourci clavier
- 👍 **Visibilité** - Feedback clair à l'utilisateur

---

## Personnalisation Possible

### Modifier la Cadence de Tir
Dans `public/modules/core/GameEngine.js` :
```javascript
this.AUTO_FIRE_INTERVAL = 150; // Changez cette valeur
// 100ms = 10 coups/sec (rapide)
// 150ms = 6-7 coups/sec (défaut)
// 200ms = 5 coups/sec (lent)
```

### Modifier le Raccourci Clavier
Dans `public/modules/utils/initHelpers.js` :
```javascript
if (e.key === 'c' || e.key === 'C') {
  // Changez 'c' par une autre touche
```

### Changer la Position du Bouton
Dans `public/style.css` :
```css
#camera-recenter-btn {
  bottom: calc(...); /* Ajustez ici */
  right: calc(...);  /* Et ici */
}
```

---

## Compatibilité

- ✅ Compatible avec tous les navigateurs modernes
- ✅ Fonctionne sur desktop et mobile
- ✅ Compatible avec le système mobile existant
- ✅ Pas de conflit avec les contrôles tactiles
- ✅ Respecte les systèmes de permissions

---

## Prochaines Améliorations Possibles

### Tir Automatique
1. **Toggle auto-fire** - Bouton pour activer/désactiver
2. **Cadence ajustable** - Curseur dans les paramètres
3. **Indicateur visuel** - Afficher quand auto-fire est actif
4. **Mode burst** - Tir par rafales au lieu de continu

### Recentrage Caméra
1. **Animation fluide** - Transition douce au lieu d'instantané
2. **Smart recenter** - Anticiper la direction de mouvement
3. **Auto-recenter** - Option pour recentrer automatiquement
4. **Shake detection** - Détecter les bugs et recentrer auto

---

**Implémenté par:** Claude AI
**Testé :** ✅ Fonctionnalités opérationnelles
**Impact:** Amélioration majeure de l'expérience utilisateur desktop
