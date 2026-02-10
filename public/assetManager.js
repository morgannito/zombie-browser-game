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
    return new Promise((resolve, _reject) => {
      const img = new Image();

      img.onload = () => {
        this.images.set(key, img);
        this.loadedAssets++;
        this.updateProgress();
        logger.debug(`Image chargee: ${key}`);
        resolve(img);
      };

      img.onerror = () => {
        logger.warn(`Image non disponible: ${path} (utilisation du rendu procedural)`);
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
    return new Promise((resolve, _reject) => {
      const audio = new Audio();

      audio.oncanplaythrough = () => {
        this.sounds.set(key, audio);
        this.loadedAssets++;
        this.updateProgress();
        logger.debug(`Son charge: ${key}`);
        resolve(audio);
      };

      audio.onerror = () => {
        logger.warn(`Son non disponible: ${path} (utilisation du son procedural)`);
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
      const response = await fetch('/assets/manifest.json');
      if (!response.ok) {
        logger.debug("Aucun manifest d'assets trouve - utilisation du rendu procedural uniquement");
        return null;
      }
      const manifest = await response.json();
      if (!manifest.enabled) {
        logger.debug('Assets desactives dans le manifest - utilisation du rendu procedural');
        return null;
      }
      return manifest;
    } catch {
      logger.debug('Erreur lors du chargement du manifest - utilisation du rendu procedural');
      return null;
    }
  }

  /**
   * Charge tous les assets du jeu
   */
  async loadAllAssets() {
    logger.debug('Chargement des assets...');

    const manifest = await this.loadManifest();
    if (!manifest || !manifest.assets) {
      logger.debug('Mode rendu procedural active (aucun asset externe)');
      this.loaded = true;
      return true;
    }

    this.loadingPromises = [];
    const a = manifest.assets;

    // Charger les assets depuis le manifest (chemins absolus)
    const imageGroups = [
      { section: a.backgrounds, prefix: 'bg' },
      { section: a.tiles, prefix: 'tile' },
      { section: a.zombies, prefix: 'zombie' },
      { section: a.players, prefix: 'player' },
      { section: a.items, prefix: 'item' },
      { section: a.effects, prefix: 'effect' }
    ];

    for (const { section, prefix } of imageGroups) {
      if (!section) {
        continue;
      }
      for (const [key, path] of Object.entries(section)) {
        this.loadingPromises.push(this.loadImage(path, `${prefix}_${key}`));
      }
    }

    // Charger les icônes SVG comme images
    if (a.icons) {
      for (const [key, path] of Object.entries(a.icons)) {
        this.loadingPromises.push(this.loadImage(path, `icon_${key}`));
      }
    }

    this.totalAssets = this.loadingPromises.length;
    logger.debug(`${this.totalAssets} assets a charger...`);

    await Promise.all(this.loadingPromises);

    this.loaded = true;
    const successCount = Array.from(this.images.values()).filter(Boolean).length;
    logger.info(`Chargement termine: ${successCount}/${this.totalAssets} assets disponibles`);

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
      .filter(key => key.startsWith('bg_'))
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
      .filter(key => key.startsWith('bg_'))
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
      logger.warn(`Erreur lecture son ${key}:`, err);
    });

    return soundClone;
  }

  /**
   * Arrête tous les sons
   */
  stopAllSounds() {
    this.sounds.forEach((sound, _key) => {
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
    return (
      (this.images.has(fullKey) && this.images.get(fullKey) !== null) ||
      (this.sounds.has(fullKey) && this.sounds.get(fullKey) !== null)
    );
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
