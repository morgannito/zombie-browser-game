/**
 * Asset Manager - Système de gestion des ressources visuelles et sonores
 *
 * Ce système gère le chargement et la mise en cache des assets du jeu.
 * Si les assets ne sont pas disponibles, le jeu utilisera le rendu procédural par défaut.
 */

class AssetManager {
  constructor() {
    this.images = new Map();
    this.loadingPromises = [];
    this.loaded = false;
    this.loadProgress = 0;
    this.totalAssets = 0;
    this.loadedAssets = 0;
  }

  /**
   * Charge une image de manière asynchrone
   */
  loadImage(path, key) {
    return new Promise((resolve, _reject) => {
      const img = new Image();
      const webpPath = path.replace(/\.png$/, '.webp');
      const useWebp = webpPath !== path;

      img.onload = () => {
        this.images.set(key, img);
        this.loadedAssets++;
        this.updateProgress();
        logger.debug(`Image chargee: ${key}`);
        resolve(img);
      };

      img.onerror = () => {
        if (useWebp && img.src.endsWith('.webp')) {
          // Fallback PNG si WebP non supporté ou absent
          img.src = path;
          return;
        }
        logger.warn(`Image non disponible: ${path} (utilisation du rendu procedural)`);
        this.loadedAssets++;
        this.updateProgress();
        resolve(null);
      };

      img.src = useWebp ? webpPath : path;
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
   * Génère un rapport sur les assets chargés
   */
  getLoadReport() {
    return {
      total: this.totalAssets,
      loaded: this.loadedAssets,
      progress: this.loadProgress,
      images: {
        total: this.images.size,
        available: Array.from(this.images.values()).filter(img => img !== null).length
      }
    };
  }
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AssetManager;
}
