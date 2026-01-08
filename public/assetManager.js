/**
 * Asset Manager - Système de gestion des ressources visuelles et sonores
 *
 * Ce système gère le chargement et la mise en cache des assets du jeu.
 * Si les assets ne sont pas disponibles, le jeu utilisera le rendu procédural par défaut.
 */

class AssetManager {
  constructor() {
    this.images = new Map();
    this.sounds = new Map();
    this.loadingPromises = [];
    this.loaded = false;
    this.loadProgress = 0;
    this.totalAssets = 0;
    this.loadedAssets = 0;

    // Configuration des assets à charger
    this.assetConfig = {
      backgrounds: [
        'background_1.png',
        'background_2.png',
        'background_3.png',
        'background_4.png',
        'background_5.png'
      ],
      player: {
        idle: 'player_idle.png',
        walk: 'player_walk.png'
      },
      zombies: {
        normal: 'zombie_normal.png',
        fast: 'zombie_fast.png',
        tank: 'zombie_tank.png',
        explosive: 'zombie_explosive.png',
        healer: 'zombie_healer.png',
        slower: 'zombie_slower.png',
        poison: 'zombie_poison.png',
        shooter: 'zombie_shooter.png',
        boss: 'zombie_boss.png'
      },
      items: {
        coin: 'coin.png',
        health: 'health_potion.png',
        powerup: 'powerup.png'
      },
      effects: {
        explosion: 'explosion.png',
        bullet: 'bullet.png',
        blood: 'blood_splatter.png',
        muzzle: 'muzzle_flash.png'
      },
      sounds: {
        music: {
          menu: 'menu_theme.mp3',
          combat: 'combat_theme.mp3',
          boss: 'boss_theme.mp3'
        },
        sfx: {
          shootPistol: 'shoot_pistol.mp3',
          shootShotgun: 'shoot_shotgun.mp3',
          shootMachinegun: 'shoot_machinegun.mp3',
          zombieDeath: 'zombie_death.mp3',
          zombieGroan: 'zombie_groan.mp3',
          explosion: 'explosion.mp3',
          coinCollect: 'coin_collect.mp3',
          powerup: 'powerup.mp3',
          playerHurt: 'player_hurt.mp3',
          levelUp: 'level_up.mp3'
        }
      }
    };
  }

  /**
     * Charge une image de manière asynchrone
     */
  loadImage(path, key) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        this.images.set(key, img);
        this.loadedAssets++;
        this.updateProgress();
        console.log(`✓ Image chargée: ${key}`);
        resolve(img);
      };

      img.onerror = () => {
        console.warn(`⚠ Image non disponible: ${path} (utilisation du rendu procédural)`);
        this.loadedAssets++;
        this.updateProgress();
        resolve(null);
      };

      img.src = path;
    });
  }

  /**
     * Charge un fichier audio de manière asynchrone
     */
  loadSound(path, key) {
    return new Promise((resolve, reject) => {
      const audio = new Audio();

      audio.oncanplaythrough = () => {
        this.sounds.set(key, audio);
        this.loadedAssets++;
        this.updateProgress();
        console.log(`✓ Son chargé: ${key}`);
        resolve(audio);
      };

      audio.onerror = () => {
        console.warn(`⚠ Son non disponible: ${path} (utilisation du son procédural)`);
        this.loadedAssets++;
        this.updateProgress();
        resolve(null);
      };

      audio.src = path;
    });
  }

  /**
     * Met à jour la progression du chargement
     */
  updateProgress() {
    this.loadProgress = (this.loadedAssets / this.totalAssets) * 100;
  }

  /**
     * Charge le manifest des assets disponibles
     */
  async loadManifest() {
    try {
      const response = await fetch('assets/manifest.json');
      if (!response.ok) {
        console.log('ℹ️ Aucun manifest d\'assets trouvé - utilisation du rendu procédural uniquement');
        return null;
      }
      const manifest = await response.json();
      if (!manifest.enabled) {
        console.log('ℹ️ Assets désactivés dans le manifest - utilisation du rendu procédural');
        return null;
      }
      return manifest;
    } catch (err) {
      console.log('ℹ️ Erreur lors du chargement du manifest - utilisation du rendu procédural');
      return null;
    }
  }

  /**
     * Charge tous les assets du jeu
     */
  async loadAllAssets() {
    console.log('🎮 Chargement des assets...');

    // Charger d'abord le manifest pour savoir quels assets sont disponibles
    const manifest = await this.loadManifest();
    if (!manifest || !manifest.assets) {
      console.log('✅ Mode rendu procédural activé (aucun asset externe)');
      this.loaded = true;
      return true;
    }

    this.loadingPromises = [];

    // Charger les backgrounds
    this.assetConfig.backgrounds.forEach((filename, index) => {
      const promise = this.loadImage(
        `assets/images/backgrounds/${filename}`,
        `background_${index + 1}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger les sprites du joueur
    Object.entries(this.assetConfig.player).forEach(([key, filename]) => {
      const promise = this.loadImage(
        `assets/images/sprites/player/${filename}`,
        `player_${key}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger les sprites des zombies
    Object.entries(this.assetConfig.zombies).forEach(([type, filename]) => {
      const promise = this.loadImage(
        `assets/images/sprites/zombies/${filename}`,
        `zombie_${type}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger les sprites des items
    Object.entries(this.assetConfig.items).forEach(([key, filename]) => {
      const promise = this.loadImage(
        `assets/images/sprites/items/${filename}`,
        `item_${key}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger les effets
    Object.entries(this.assetConfig.effects).forEach(([key, filename]) => {
      const promise = this.loadImage(
        `assets/images/sprites/effects/${filename}`,
        `effect_${key}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger la musique
    Object.entries(this.assetConfig.sounds.music).forEach(([key, filename]) => {
      const promise = this.loadSound(
        `assets/audio/music/${filename}`,
        `music_${key}`
      );
      this.loadingPromises.push(promise);
    });

    // Charger les effets sonores
    Object.entries(this.assetConfig.sounds.sfx).forEach(([key, filename]) => {
      const promise = this.loadSound(
        `assets/audio/sfx/${filename}`,
        `sfx_${key}`
      );
      this.loadingPromises.push(promise);
    });

    this.totalAssets = this.loadingPromises.length;
    console.log(`📦 ${this.totalAssets} assets à charger...`);

    // Attendre que tous les assets soient chargés (ou échouent gracieusement)
    await Promise.all(this.loadingPromises);

    this.loaded = true;
    const successCount = Array.from(this.images.values()).filter(img => img !== null).length +
                           Array.from(this.sounds.values()).filter(snd => snd !== null).length;

    console.log(`✅ Chargement terminé: ${successCount}/${this.totalAssets} assets disponibles`);

    return this.loaded;
  }

  /**
     * Récupère une image par sa clé
     */
  getImage(key) {
    return this.images.get(key) || null;
  }

  /**
     * Récupère un son par sa clé
     */
  getSound(key) {
    return this.sounds.get(key) || null;
  }

  /**
     * Récupère un background aléatoire
     */
  getRandomBackground() {
    const backgrounds = Array.from(this.images.keys())
      .filter(key => key.startsWith('background_'))
      .map(key => this.images.get(key))
      .filter(img => img !== null);

    if (backgrounds.length === 0) {
      return null;
    }
    return backgrounds[Math.floor(Math.random() * backgrounds.length)];
  }

  /**
     * Récupère un background spécifique par index (pour les vagues)
     */
  getBackgroundByWave(waveNumber) {
    // Cycle à travers les backgrounds disponibles
    const backgroundKeys = Array.from(this.images.keys())
      .filter(key => key.startsWith('background_'))
      .sort();

    if (backgroundKeys.length === 0) {
      return null;
    }

    const index = (waveNumber - 1) % backgroundKeys.length;
    return this.images.get(backgroundKeys[index]);
  }

  /**
     * Joue un son
     */
  playSound(key, volume = 1.0, loop = false) {
    const sound = this.sounds.get(key);
    if (!sound) {
      return null;
    }

    // Cloner le son pour permettre plusieurs instances simultanées
    const soundClone = sound.cloneNode();
    soundClone.volume = Math.max(0, Math.min(1, volume));
    soundClone.loop = loop;

    soundClone.play().catch(err => {
      console.warn(`Erreur lecture son ${key}:`, err);
    });

    return soundClone;
  }

  /**
     * Arrête tous les sons
     */
  stopAllSounds() {
    this.sounds.forEach((sound, key) => {
      if (sound) {
        sound.pause();
        sound.currentTime = 0;
      }
    });
  }

  /**
     * Vérifie si un asset spécifique est disponible
     */
  hasAsset(type, key) {
    const fullKey = `${type}_${key}`;
    return (this.images.has(fullKey) && this.images.get(fullKey) !== null) ||
               (this.sounds.has(fullKey) && this.sounds.get(fullKey) !== null);
  }

  /**
     * Génère un rapport sur les assets chargés
     */
  getLoadReport() {
    const report = {
      total: this.totalAssets,
      loaded: this.loadedAssets,
      progress: this.loadProgress,
      images: {
        total: this.images.size,
        available: Array.from(this.images.values()).filter(img => img !== null).length
      },
      sounds: {
        total: this.sounds.size,
        available: Array.from(this.sounds.values()).filter(snd => snd !== null).length
      }
    };

    return report;
  }
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetManager;
}
