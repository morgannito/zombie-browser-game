# Assets pour le Jeu Zombie

## Sources d'Assets Gratuits

### Sites Recommandés
1. **OpenGameArt.org** - https://opengameart.org/
2. **Itch.io** - https://itch.io/game-assets/free
3. **Kenney.nl** - https://kenney.nl/assets
4. **CraftPix** - https://craftpix.net/freebies/
5. **Freesound** - https://freesound.org/

## Structure des Dossiers

### Images (`/assets/images/`)

#### Backgrounds (`/backgrounds/`)
- **Fichiers nécessaires** : Au moins 3-5 backgrounds différents pour varier les vagues
- **Format recommandé** : PNG avec transparence ou JPG
- **Taille recommandée** : 1920x1080 ou plus (tileable de préférence)
- **Exemples** :
  - `background_1.png` - Ville abandonnée
  - `background_2.png` - Forêt sombre
  - `background_3.png` - Laboratoire
  - `background_4.png` - Cimetière
  - `background_5.png` - Hopital désert

#### Sprites - Joueur (`/sprites/player/`)
- **Fichiers nécessaires** :
  - `player_idle.png` - Animation idle (spritesheet)
  - `player_walk.png` - Animation de marche (spritesheet)
  - `player_shoot.png` - Animation de tir (optionnel)
- **Format** : PNG avec transparence
- **Taille recommandée** : 32x32 à 64x64 pixels par frame

#### Sprites - Zombies (`/sprites/zombies/`)
- **Fichiers nécessaires** (un par type de zombie) :
  - `zombie_normal.png` - Zombie normal (vert)
  - `zombie_fast.png` - Zombie rapide (jaune)
  - `zombie_tank.png` - Zombie tank (orange)
  - `zombie_explosive.png` - Zombie explosif (magenta)
  - `zombie_healer.png` - Zombie soigneur (cyan)
  - `zombie_slower.png` - Zombie ralentisseur (violet)
  - `zombie_poison.png` - Zombie poison (vert clair)
  - `zombie_shooter.png` - Zombie tireur (orange foncé)
  - `zombie_boss.png` - Boss (rouge, plus grand)
- **Format** : PNG avec transparence
- **Taille recommandée** : 32x32 à 48x48 pixels (boss: 64x64)

#### Sprites - Items (`/sprites/items/`)
- **Fichiers nécessaires** :
  - `coin.png` - Pièce d'or
  - `health_potion.png` - Potion de soin
  - `powerup_speed.png` - Power-up de vitesse
  - `powerup_damage.png` - Power-up de dégâts
- **Format** : PNG avec transparence
- **Taille recommandée** : 24x24 à 32x32 pixels

#### Sprites - Effets (`/sprites/effects/`)
- **Fichiers nécessaires** :
  - `explosion.png` - Animation d'explosion
  - `bullet.png` - Projectile
  - `muzzle_flash.png` - Flash de tir
  - `blood_splatter.png` - Éclaboussure de sang
- **Format** : PNG avec transparence
- **Taille recommandée** : Variable selon l'effet

#### UI (`/ui/`)
- **Fichiers nécessaires** :
  - `button.png` - Boutons
  - `panel.png` - Panneaux de UI
  - `health_bar.png` - Barre de vie
  - `icons.png` - Icônes diverses
- **Format** : PNG avec transparence

### Audio (`/assets/audio/`)

#### Musique (`/music/`)
- **Fichiers nécessaires** :
  - `menu_theme.mp3` - Thème du menu
  - `combat_theme.mp3` - Musique de combat
  - `boss_theme.mp3` - Musique de boss
- **Format recommandé** : MP3 ou OGG
- **Durée** : 1-3 minutes (loop)

#### Effets Sonores (`/sfx/`)
- **Fichiers nécessaires** :
  - `shoot_pistol.mp3` - Tir de pistolet
  - `shoot_shotgun.mp3` - Tir de shotgun
  - `shoot_machinegun.mp3` - Tir de mitrailleuse
  - `zombie_death.mp3` - Mort de zombie
  - `zombie_groan.mp3` - Grognement de zombie
  - `explosion.mp3` - Explosion
  - `coin_collect.mp3` - Ramassage de pièce
  - `powerup.mp3` - Ramassage de power-up
  - `player_hurt.mp3` - Joueur blessé
  - `level_up.mp3` - Montée de niveau
- **Format recommandé** : MP3 ou OGG
- **Durée** : Courts (0.5-2 secondes)

## Notes d'Utilisation

1. **Licences** : Vérifiez toujours les licences des assets avant utilisation
2. **Attribution** : Certains assets gratuits nécessitent une attribution (voir LICENSE.txt)
3. **Performance** : Compressez les images pour optimiser les performances
4. **Cohérence** : Choisissez des assets avec un style visuel cohérent

## Alternatives si vous n'avez pas d'assets

Le système de rendu procédural actuel restera actif si aucun asset n'est chargé. Vous pouvez :
- Utiliser le jeu sans assets externes
- Ajouter progressivement les assets
- Mixer assets et rendu procédural
