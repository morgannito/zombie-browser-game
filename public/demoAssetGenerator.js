/**
 * Demo Asset Generator - Génère des assets de démonstration procéduraux
 *
 * Ce script génère des assets visuels de base pour démonstration
 * quand les vrais assets ne sont pas encore disponibles.
 */

class DemoAssetGenerator {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
  }

  /**
     * Génère un background procédural
     */
  generateBackground(theme = 'city') {
    this.canvas.width = 512;
    this.canvas.height = 512;

    const themes = {
      city: {
        base: '#2a2a3a',
        accent: '#3a3a4a',
        detail: '#4a4a5a'
      },
      forest: {
        base: '#1a3a1a',
        accent: '#2a4a2a',
        detail: '#0a2a0a'
      },
      lab: {
        base: '#2a2a2a',
        accent: '#3a3a3a',
        detail: '#ffffff'
      },
      cemetery: {
        base: '#1a1a2a',
        accent: '#2a2a3a',
        detail: '#8888aa'
      },
      hospital: {
        base: '#e8e8f0',
        accent: '#d0d0e0',
        detail: '#00aa00'
      }
    };

    const colors = themes[theme] || themes.city;

    // Base
    this.ctx.fillStyle = colors.base;
    this.ctx.fillRect(0, 0, 512, 512);

    // Pattern de tuiles
    this.ctx.strokeStyle = colors.accent;
    this.ctx.lineWidth = 2;

    for (let x = 0; x < 512; x += 64) {
      for (let y = 0; y < 512; y += 64) {
        this.ctx.strokeRect(x, y, 64, 64);

        // Détails aléatoires
        if (Math.random() > 0.7) {
          this.ctx.fillStyle = colors.detail;
          this.ctx.fillRect(x + 10, y + 10, 44, 44);
        }
      }
    }

    // Grunge overlay
    for (let i = 0; i < 100; i++) {
      this.ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.3})`;
      const size = Math.random() * 20 + 5;
      this.ctx.fillRect(
        Math.random() * 512,
        Math.random() * 512,
        size,
        size
      );
    }

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de zombie
     */
  generateZombieSprite(type = 'normal') {
    this.canvas.width = 64;
    this.canvas.height = 64;

    this.ctx.clearRect(0, 0, 64, 64);

    const typeColors = {
      normal: '#00ff00',
      fast: '#ffff00',
      tank: '#ff6600',
      explosive: '#ff00ff',
      healer: '#00ffff',
      slower: '#8800ff',
      poison: '#22ff22',
      shooter: '#ff9900',
      boss: '#ff0000'
    };

    const color = typeColors[type] || '#00ff00';
    const centerX = 32;
    const centerY = 32;

    // Tête
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY - 10, 12, 0, Math.PI * 2);
    this.ctx.fill();

    // Yeux
    this.ctx.fillStyle = '#ff0000';
    this.ctx.beginPath();
    this.ctx.arc(centerX - 4, centerY - 12, 2, 0, Math.PI * 2);
    this.ctx.arc(centerX + 4, centerY - 12, 2, 0, Math.PI * 2);
    this.ctx.fill();

    // Corps
    this.ctx.fillStyle = color;
    this.ctx.fillRect(centerX - 8, centerY, 16, 20);

    // Bras
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 8, centerY + 5);
    this.ctx.lineTo(centerX - 15, centerY + 15);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(centerX + 8, centerY + 5);
    this.ctx.lineTo(centerX + 15, centerY + 15);
    this.ctx.stroke();

    // Jambes
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 4, centerY + 20);
    this.ctx.lineTo(centerX - 6, centerY + 32);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(centerX + 4, centerY + 20);
    this.ctx.lineTo(centerX + 6, centerY + 32);
    this.ctx.stroke();

    // Bordure pour le boss
    if (type === 'boss') {
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(centerX - 10, centerY - 2, 20, 24);
    }

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de joueur
     */
  generatePlayerSprite() {
    this.canvas.width = 64;
    this.canvas.height = 64;

    this.ctx.clearRect(0, 0, 64, 64);

    const centerX = 32;
    const centerY = 32;
    const color = '#0088ff';

    // Corps
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, 10, 15, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Tête
    this.ctx.beginPath();
    this.ctx.arc(centerX, centerY - 18, 10, 0, Math.PI * 2);
    this.ctx.fill();

    // Visière
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(centerX - 8, centerY - 20, 16, 4);

    // Bras
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 10, centerY - 5);
    this.ctx.lineTo(centerX - 18, centerY + 5);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(centerX + 10, centerY - 5);
    this.ctx.lineTo(centerX + 18, centerY + 5);
    this.ctx.stroke();

    // Jambes
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - 5, centerY + 15);
    this.ctx.lineTo(centerX - 7, centerY + 28);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(centerX + 5, centerY + 15);
    this.ctx.lineTo(centerX + 7, centerY + 28);
    this.ctx.stroke();

    // Arme
    this.ctx.fillStyle = '#555555';
    this.ctx.fillRect(centerX + 10, centerY - 2, 12, 4);

    return this.canvas.toDataURL();
  }

  /**
     * Génère un sprite de pièce
     */
  generateCoinSprite() {
    this.canvas.width = 32;
    this.canvas.height = 32;

    this.ctx.clearRect(0, 0, 32, 32);

    const centerX = 16;
    const centerY = 16;

    // Pièce dorée
    this.ctx.fillStyle = '#ffd700';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX, centerY, 12, 10, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Bordure
    this.ctx.strokeStyle = '#ff8c00';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    // Symbole dollar
    this.ctx.fillStyle = '#ff8c00';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('$', centerX, centerY);

    // Reflet
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    this.ctx.beginPath();
    this.ctx.ellipse(centerX - 3, centerY - 3, 4, 3, 0, 0, Math.PI * 2);
    this.ctx.fill();

    return this.canvas.toDataURL();
  }

  /**
     * Génère tous les assets de démonstration
     */
  async generateAllDemoAssets() {
    console.log('🎨 Génération des assets de démonstration...');

    const assets = {
      backgrounds: [],
      zombies: {},
      player: null,
      coin: null
    };

    // Générer 5 backgrounds
    const themes = ['city', 'forest', 'lab', 'cemetery', 'hospital'];
    for (let i = 0; i < 5; i++) {
      assets.backgrounds.push(this.generateBackground(themes[i]));
    }

    // Générer les sprites de zombies
    const zombieTypes = ['normal', 'fast', 'tank', 'explosive', 'healer', 'slower', 'poison', 'shooter', 'boss'];
    zombieTypes.forEach(type => {
      assets.zombies[type] = this.generateZombieSprite(type);
    });

    // Générer le sprite du joueur
    assets.player = this.generatePlayerSprite();

    // Générer la pièce
    assets.coin = this.generateCoinSprite();

    console.log('✅ Assets de démonstration générés');
    return assets;
  }

  /**
     * Convertit un data URL en Image
     */
  dataURLToImage(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataURL;
    });
  }

  /**
     * Charge les assets de démonstration dans l'AssetManager
     */
  async loadDemoAssetsIntoManager(assetManager) {
    console.log('📦 Chargement des assets de démonstration dans l\'AssetManager...');

    const demoAssets = await this.generateAllDemoAssets();

    // Charger les backgrounds
    for (let i = 0; i < demoAssets.backgrounds.length; i++) {
      const img = await this.dataURLToImage(demoAssets.backgrounds[i]);
      assetManager.images.set(`background_${i + 1}`, img);
    }

    // Charger les zombies
    for (const [type, dataURL] of Object.entries(demoAssets.zombies)) {
      const img = await this.dataURLToImage(dataURL);
      assetManager.images.set(`zombie_${type}`, img);
    }

    // Charger le joueur
    const playerImg = await this.dataURLToImage(demoAssets.player);
    assetManager.images.set('player_walk', playerImg);
    assetManager.images.set('player_idle', playerImg);

    // Charger la pièce
    const coinImg = await this.dataURLToImage(demoAssets.coin);
    assetManager.images.set('item_coin', coinImg);

    console.log('✅ Assets de démonstration chargés dans l\'AssetManager');
  }
}

// Export pour utilisation dans d'autres fichiers
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DemoAssetGenerator;
}
