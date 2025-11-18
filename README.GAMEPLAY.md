# Jeu de Zombie Rogue-like Multijoueur

Un jeu de survie zombie en temps réel sur navigateur avec **système rogue-like**, génération procédurale, progression permanente et multijoueur coopératif !

## Mode Rogue-like

Ce jeu suit les principes du genre rogue-like :
- **Permadeath** : À chaque mort, vous recommencez depuis le début
- **Génération procédurale** : Chaque run génère des salles aléatoires avec obstacles
- **Progression permanente** : Débloquez des upgrades qui persistent entre les runs
- **Boss** : Un boss zombie apparaît à la fin de chaque salle
- **Loot** : Ramassez de l'or et de l'XP pour progresser

## Fonctionnalités

### Système de Salles (Rogue-like)
- **3 salles par run** avec génération procédurale (gameplay rapide et arcade)
- Murs extérieurs et obstacles aléatoires (piliers, caisses)
- Portes qui s'ouvrent après avoir tué le boss
- Mini-map en temps réel affichant la salle complète

### Types de Zombies

**Zombies Basiques :**
- **Zombie Normal** (Vert 🟢)
  - Vie: 65 | Vitesse: 2 | Dégâts: 8
  - Drop: 8 gold, 12 XP

- **Zombie Rapide** (Jaune 🟡)
  - Vie: 45 | Vitesse: 4 | Dégâts: 12
  - Drop: 15 gold, 18 XP

- **Zombie Tank** (Orange 🟠)
  - Vie: 170 | Vitesse: 1 | Dégâts: 20
  - Drop: 30 gold, 35 XP

**Zombies Spéciaux :**
- **Zombie Explosif** (Magenta 💣)
  - Vie: 50 | Vitesse: 2.5 | Dégâts: 10
  - Drop: 20 gold, 25 XP
  - **DANGER** : Explose à la mort dans un rayon de 100px et inflige 30 dégâts !

- **Zombie Soigneur** (Cyan +)
  - Vie: 85 | Vitesse: 1.5 | Dégâts: 5
  - Drop: 35 gold, 30 XP
  - **Capacité** : Soigne les zombies proches de 10 PV toutes les 3 secondes (rayon: 150px)

- **Zombie Ralentisseur** (Violet ⏱)
  - Vie: 75 | Vitesse: 1.8 | Dégâts: 6
  - Drop: 25 gold, 28 XP
  - **Capacité** : Ralentit les joueurs de 50% dans un rayon de 120px

**Boss :**
- **Boss Zombie** (Rouge 💀) - Fin de salle
  - Vie: 400 | Vitesse: 1.5 | Dégâts: 25
  - Drop: 150 gold, 120 XP
  - Ouvre la porte vers la salle suivante

### Système de Progression & Level-Up

#### Montée de Niveau
- **XP** : Gain d'expérience progressif (formule: 100 × 1.5^(level-1))
- **Level-up** : À chaque niveau, **le jeu se met en pause** et vous choisissez **1 amélioration parmi 3**
- **Gold** : Ramassez l'or des zombies tués pour le shop

#### Améliorations de Level-Up

**Améliorations Communes** (60% de chance) :
- **❤️ Coeur Robuste** : +30 PV max
- **⚔️ Force Brute** : +15% dégâts
- **👟 Vélocité** : +20% vitesse
- **🔫 Gâchette Rapide** : -15% cooldown armes
- **💰 Aimant à Or** : +50% rayon de collecte
- **✨ Soin Complet** : Restaure toute votre vie

**Améliorations Rares** (30% de chance) :
- **💚 Régénération** : +1 PV/sec (cumulable)
- **🎯 Balles Perforantes** : Les balles traversent +1 ennemi
- **🩸 Vol de Vie** : +5% de vol de vie sur dégâts
- **💥 Coup Critique** : +10% chance de critique (x2 dégâts, balles rouges)
- **🌀 Esquive** : +8% chance d'esquiver les attaques
- **🛡️ Épines** : Renvoie 20% des dégâts reçus

**Améliorations Légendaires** (10% de chance) :
- **💣 Munitions Explosives** : Les balles explosent (rayon 30px, 50% dégâts AOE)
- **🎆 Tir Multiple** : +1 balle supplémentaire par tir

#### Panneau de Statistiques
Appuyez sur **TAB** pour voir :
- Vos stats de base (vie, multiplicateurs, niveau, or)
- Toutes vos améliorations de level-up actives
- Vos upgrades permanents du shop
- Vos capacités spéciales (régénération, critique, esquive, etc.)

### Armes (Cadence améliorée pour un gameplay rapide)
- **Pistolet** : Arme de base, tir rapide et précis
  - Dégâts: 40 | Cadence: 180ms | 1 projectile

- **Shotgun** : 5 projectiles avec dispersion
  - Dégâts: 25/projectile | Cadence: 600ms | Dispersion: 0.3

- **Mitraillette** : Cadence de tir extrêmement élevée
  - Dégâts: 30 | Cadence: 80ms | Légère dispersion

### Power-ups Temporaires
- **Santé** (+50 PV) : Restaure la vie
- **Vitesse** : Boost x1.5 pendant 10 secondes
- **Shotgun/Mitraillette** : Armes temporaires pendant 15 secondes

### Interface & Graphismes
- **Style rogue-like** avec salles closes et murs
- Sol en grille avec couleurs sombres (#1a1a2e)
- Murs et obstacles avec textures
- Portes colorées (rouge=fermée, vert=ouverte)
- Pièces d'or animées avec rotation
- Particules colorées selon le type de zombie
- Barres de vie dynamiques pour tous les ennemis
- Effets visuels (glow, shadows) pour armes et power-ups

### Effets Visuels
- **Particules** lors des impacts (couleur selon type de zombie)
- **Pièces d'or** qui tournent
- **Effets de lumière** sur les balles
- **Animations** de pulsation pour les power-ups
- **Boss** avec bordure épaisse et label "BOSS"
- **Level-up** avec annonce visuelle verte

## Installation

```bash
npm install
```

## Démarrage

### Méthode 1 : Node.js classique

```bash
npm start
```

Ouvrez plusieurs onglets sur `http://localhost:3000` pour tester le multijoueur !

### Méthode 2 : Docker 🐳

**Avec Docker Compose (recommandé) :**

```bash
docker-compose up --build
```

**Ou avec Docker seul :**

```bash
# Construire l'image
docker build -t zombie-game .

# Lancer le conteneur
docker run -p 3000:3000 zombie-game
```

Puis ouvrez `http://localhost:3000` dans votre navigateur !

### Méthode 3 : Image Docker pré-construite (GitHub Container Registry) 🚀

**Tester le jeu directement sans cloner le repo :**

```bash
docker pull ghcr.io/morgannito/zombie-jeu:latest
docker run -p 3000:3000 ghcr.io/morgannito/zombie-jeu:latest
```

L'image Docker est automatiquement construite et publiée sur GitHub Container Registry à chaque push !

### Méthode 4 : Déploiement Cloud (Tester en ligne) ☁️

**Déployer en un clic sur un service gratuit :**

#### Render (Recommandé - Gratuit)
1. Créez un compte sur [render.com](https://render.com)
2. Cliquez sur "New +" → "Web Service"
3. Connectez votre repo GitHub `morgannito/zombie-jeu`
4. Render détectera automatiquement le `render.yaml`
5. Cliquez sur "Create Web Service"
6. Attendez ~2 minutes, votre jeu sera accessible via une URL publique !

#### Railway (Alternative gratuite)
1. Créez un compte sur [railway.app](https://railway.app)
2. Cliquez sur "New Project" → "Deploy from GitHub repo"
3. Sélectionnez `morgannito/zombie-jeu`
4. Railway détectera le Dockerfile automatiquement
5. Générez un domaine public dans les settings
6. Votre jeu est en ligne !

#### Fly.io (Avec CLI)
```bash
# Installer flyctl
curl -L https://fly.io/install.sh | sh

# Se connecter et déployer
fly auth login
fly launch --config fly.toml
fly deploy
```

Une fois déployé, vous obtenez une URL publique pour jouer en ligne avec vos amis ! 🌐

## Contrôles

- **WASD/ZQSD** ou **Flèches** : Déplacement
- **Souris** : Viser
- **Clic gauche** : Tirer
- **TAB** : Ouvrir/Fermer le panneau de statistiques
- **Collecte automatique** : Marchez sur le loot et power-ups

## Comment Jouer (Guide Rogue-like)

1. **Survivez à chaque salle**
   - Tuez les 8 zombies qui spawn progressivement (gameplay plus rapide)
   - Affrontez le boss zombie qui apparaît ensuite
   - La porte s'ouvre après la mort du boss

2. **Ramassez le loot**
   - Pièces d'or pour acheter des upgrades dans le shop
   - XP pour monter de niveau pendant le run
   - Power-ups temporaires pour vous aider

3. **Utilisez le shop**
   - Le shop s'ouvre automatiquement après avoir tué le boss
   - Achetez des upgrades permanents (conservés après la mort)
   - Achetez des items temporaires pour la salle actuelle
   - Cliquez sur "Continuer" pour passer à la salle suivante

4. **Progressez à travers les salles**
   - Passez par la porte verte en haut
   - 3 salles par run complet (action rapide et intense)
   - Chaque salle a des obstacles différents

5. **Permadeath**
   - À la mort, vous perdez tout sauf les upgrades permanents
   - Recommencez depuis la salle 1
   - Votre niveau et votre or sont réinitialisés
   - Vos multiplicateurs d'upgrades sont conservés !

6. **Coopération multijoueur**
   - Jouez avec d'autres pour survivre plus longtemps
   - Partagez le loot et l'XP
   - Stratégie d'équipe contre les boss

## Système de Vagues par Salle (Optimisé pour un gameplay rapide)

- **8 zombies** spawns progressifs par salle (réduit pour plus de rapidité)
- **1 boss zombie** après les 8 zombies
- **Types variés** : Mélange de basiques et spéciaux
- **Spawn limité** : Maximum 15 zombies simultanés
- **Interval** : Nouveau zombie toutes les 2.5 secondes (plus rapide)
- **Drops augmentés** : +50% d'or et +20% d'XP sur tous les zombies

### Stratégies contre les Zombies Spéciaux

**🎯 Priorités de ciblage :**
1. **Zombie Soigneur** 🔴 HAUTE PRIORITÉ - Éliminez-le en premier pour éviter qu'il soigne les autres
2. **Zombie Explosif** 🟠 ATTENTION - Gardez vos distances ! Reculez avant qu'il meure
3. **Zombie Ralentisseur** 🟡 MOBILITÉ - Restez hors de portée de son aura violette

**💡 Astuces :**
- Les zombies explosifs peuvent être utilisés pour infliger des dégâts aux autres zombies
- Utilisez les obstacles pour bloquer les zombies ralentisseurs
- Focus les soigneurs avec le shotgun pour les éliminer rapidement
- Achetez l'upgrade de vitesse au shop pour échapper aux ralentisseurs

## Progression Permanente & Shop

### Système de Shop
Le shop s'ouvre automatiquement après avoir tué le boss de chaque salle. Vous pouvez y dépenser votre or pour acheter :

**Upgrades Permanents** (conservés après la mort) :
- **❤️ Vie Maximum** : +20 PV max permanents
  - Coût de base : 50 gold | +25 par niveau | Max : Niveau 10
- **⚔️ Dégâts** : +10% dégâts permanents
  - Coût de base : 75 gold | +35 par niveau | Max : Niveau 5
- **👟 Vitesse** : +15% vitesse permanente
  - Coût de base : 60 gold | +30 par niveau | Max : Niveau 5
- **🔫 Cadence de Tir** : -10% cooldown armes
  - Coût de base : 80 gold | +40 par niveau | Max : Niveau 5

**Items Temporaires** (pour la salle actuelle) :
- **💚 Soin Complet** : Restaure toute votre vie (30 gold)
- **🔫 Shotgun** : Shotgun pour la salle actuelle (40 gold)
- **🔫 Mitraillette** : Mitraillette pour la salle actuelle (50 gold)
- **⚡ Boost Vitesse** : Vitesse x2 pour la salle actuelle (35 gold)

## Architecture Technique

### Backend (Node.js + Socket.IO)
- Génération procédurale des salles au démarrage
- Game loop à 60 FPS avec synchronisation
- Détection de collisions serveur-side (murs, zombies, joueurs)
- Système de portes avec activation conditionnelle
- Gestion du loot et de l'XP

### Frontend (HTML5 Canvas)
- Rendu optimisé avec caméra centrée
- Mini-map en temps réel
- Animations fluides (rotation, pulsation)
- Effets visuels (particules, glow, shadows)
- UI responsive avec stats en direct

### Synchronisation
- WebSockets (Socket.IO) pour communication temps réel
- État du jeu envoyé à 60 FPS
- Validation serveur-side des mouvements
- Événements spéciaux (boss spawn, level-up, portes)

## Prochaines Fonctionnalités

- [x] Shop entre les salles pour dépenser l'or ✅
- [x] Upgrades permanents achetables ✅
- [x] Zombies spéciaux (explosif, soigneur, ralentisseur) ✅
- [x] Système de level-up avec choix d'améliorations ✅
- [x] Panneau de statistiques (TAB) ✅
- [x] 14 améliorations uniques avec différentes raretés ✅
- [ ] Sons et effets audio (tirs, impacts, musique)
- [ ] Plus de variété (zombies toxiques, gelés, vampires, etc.)
- [ ] Armes permanentes à débloquer
- [ ] Système de classes de personnages
- [ ] Leaderboard multijoueur
- [ ] Achievements et unlocks
- [ ] Sauvegarde des upgrades en base de données
- [ ] Mode Boss Rush
- [ ] Salles bonus avec défis spéciaux
- [ ] Synergies entre améliorations

## Technologies

- **Backend** : Node.js + Express
- **Communication** : Socket.IO (WebSockets)
- **Frontend** : HTML5 Canvas + JavaScript ES6+
- **Architecture** : Client-serveur avec autorité serveur
- **Style** : Rogue-like procédural

---

**Bon run et que la chance soit avec vous !** 🧟‍♂️💀🎮
