#!/usr/bin/env node

/**
 * Asset Downloader - Télécharge automatiquement des assets gratuits
 *
 * Ce script télécharge des assets de haute qualité depuis :
 * - Kenney.nl (Top-down shooter, zombies, UI)
 * - OpenGameArt.org
 * - Freesound.org (sons)
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Configuration des assets à télécharger
const ASSETS_CONFIG = {
  // Kenney.nl - Assets de très haute qualité, domaine public
  kenney: {
    // Top-down shooter pack (contient des personnages, armes, effets)
    topdown: {
      url: 'https://kenney.nl/content/3-assets/8-topdown-shooter/topdown-shooter.zip',
      dest: 'temp/kenney-topdown.zip',
      type: 'zip'
    },
    // Tiny zombie pack
    zombie: {
      url: 'https://kenney.nl/content/3-assets/531-tiny-zombies/tiny-zombies.zip',
      dest: 'temp/kenney-zombie.zip',
      type: 'zip'
    },
    // UI pack
    ui: {
      url: 'https://kenney.nl/content/3-assets/9-ui-pack/ui-pack.zip',
      dest: 'temp/kenney-ui.zip',
      type: 'zip'
    }
  },

  // Assets individuels de haute qualité
  direct: {
    // Background - Tileset industriel
    background1: {
      url: 'https://opengameart.org/sites/default/files/floor_tile.png',
      dest: 'public/assets/images/backgrounds/background_1.png'
    }
    // Plus d'assets directs peuvent être ajoutés ici
  },

  // Sons - Sources gratuites
  sounds: {
    // Les sons nécessitent souvent une authentification, donc on va générer des sons procéduraux
    // ou utiliser des bibliothèques de sons libres
  }
};

class AssetDownloader {
  constructor() {
    this.downloadedFiles = [];
    this.errors = [];
    this.tempDir = path.join(__dirname, 'temp');
    this.assetsDir = path.join(__dirname, 'public', 'assets');
  }

  /**
     * Crée les dossiers nécessaires
     */
  async createDirectories() {
    const dirs = [
      this.tempDir,
      path.join(this.assetsDir, 'images', 'backgrounds'),
      path.join(this.assetsDir, 'images', 'sprites', 'player'),
      path.join(this.assetsDir, 'images', 'sprites', 'zombies'),
      path.join(this.assetsDir, 'images', 'sprites', 'items'),
      path.join(this.assetsDir, 'images', 'sprites', 'effects'),
      path.join(this.assetsDir, 'images', 'ui'),
      path.join(this.assetsDir, 'audio', 'music'),
      path.join(this.assetsDir, 'audio', 'sfx')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✓ Dossier créé: ${dir}`);
      }
    }
  }

  /**
     * Télécharge un fichier depuis une URL
     */
  downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const destDir = path.dirname(destPath);

      // Créer le dossier de destination si nécessaire
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      console.log(`📥 Téléchargement: ${url}`);
      console.log(`   Destination: ${destPath}`);

      const file = fs.createWriteStream(destPath);

      const request = protocol.get(url, (response) => {
        // Gérer les redirections
        if (response.statusCode === 301 || response.statusCode === 302) {
          console.log(`   Redirection vers: ${response.headers.location}`);
          file.close();
          fs.unlinkSync(destPath);
          this.downloadFile(response.headers.location, destPath)
            .then(resolve)
            .catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          reject(new Error(`Erreur HTTP: ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          console.log(`✅ Téléchargé: ${path.basename(destPath)}`);
          resolve(destPath);
        });
      });

      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });

      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) {
          fs.unlinkSync(destPath);
        }
        reject(err);
      });
    });
  }

  /**
     * Vérifie si unzip est disponible
     */
  async checkUnzipAvailable() {
    try {
      await execAsync('which unzip');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
     * Extrait un fichier ZIP
     */
  async extractZip(zipPath, destDir) {
    const hasUnzip = await this.checkUnzipAvailable();

    if (!hasUnzip) {
      console.log(`⚠️  'unzip' non disponible - fichier ZIP non extrait: ${zipPath}`);
      console.log('   Installez unzip avec: sudo apt-get install unzip');
      return false;
    }

    try {
      console.log(`📦 Extraction: ${path.basename(zipPath)}`);
      await execAsync(`unzip -o -q "${zipPath}" -d "${destDir}"`);
      console.log(`✅ Extrait: ${path.basename(zipPath)}`);
      return true;
    } catch (error) {
      console.error(`❌ Erreur extraction: ${error.message}`);
      return false;
    }
  }

  /**
     * Organise les fichiers Kenney dans la structure correcte
     */
  async organizeKenneyAssets() {
    const tempExtracted = path.join(this.tempDir, 'extracted');

    if (!fs.existsSync(tempExtracted)) {
      return;
    }

    console.log('📂 Organisation des assets Kenney...');

    // Fonction récursive pour trouver tous les PNG
    const findPNGFiles = (dir, fileList = []) => {
      const files = fs.readdirSync(dir);

      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
          findPNGFiles(filePath, fileList);
        } else if (file.endsWith('.png')) {
          fileList.push(filePath);
        }
      });

      return fileList;
    };

    const pngFiles = findPNGFiles(tempExtracted);
    console.log(`   Trouvé ${pngFiles.length} fichiers PNG`);

    // Copier les fichiers selon leur nom
    let zombieCount = 0;
    let playerCount = 0;
    let bgCount = 0;
    let itemCount = 0;

    pngFiles.forEach(filePath => {
      const fileName = path.basename(filePath).toLowerCase();

      // Zombies
      if (fileName.includes('zombie') || fileName.includes('zomb')) {
        const destName = `zombie_kenney_${++zombieCount}.png`;
        const destPath = path.join(this.assetsDir, 'images', 'sprites', 'zombies', destName);
        fs.copyFileSync(filePath, destPath);
        console.log(`   ✓ Zombie: ${destName}`);
      }
      // Player/Soldier/Character
      else if (fileName.includes('soldier') || fileName.includes('player') ||
                     fileName.includes('man') || fileName.includes('character')) {
        const destName = `player_kenney_${++playerCount}.png`;
        const destPath = path.join(this.assetsDir, 'images', 'sprites', 'player', destName);
        fs.copyFileSync(filePath, destPath);
        console.log(`   ✓ Player: ${destName}`);
      }
      // Items (coins, health, etc)
      else if (fileName.includes('coin') || fileName.includes('health') ||
                     fileName.includes('heart') || fileName.includes('item')) {
        const destName = `item_kenney_${++itemCount}.png`;
        const destPath = path.join(this.assetsDir, 'images', 'sprites', 'items', destName);
        fs.copyFileSync(filePath, destPath);
        console.log(`   ✓ Item: ${destName}`);
      }
      // Backgrounds/Tiles
      else if (fileName.includes('tile') || fileName.includes('floor') ||
                     fileName.includes('ground') || fileName.includes('background')) {
        const destName = `bg_kenney_${++bgCount}.png`;
        const destPath = path.join(this.assetsDir, 'images', 'backgrounds', destName);
        fs.copyFileSync(filePath, destPath);
        console.log(`   ✓ Background: ${destName}`);
      }
    });

    console.log(`✅ Assets organisés: ${zombieCount} zombies, ${playerCount} joueurs, ${bgCount} backgrounds, ${itemCount} items`);
  }

  /**
     * Télécharge tous les assets Kenney
     */
  async downloadKenneyAssets() {
    console.log('\n🎨 Téléchargement des assets Kenney.nl...');

    const kenneyPacks = ASSETS_CONFIG.kenney;
    const tempExtracted = path.join(this.tempDir, 'extracted');

    for (const [name, config] of Object.entries(kenneyPacks)) {
      try {
        const destPath = path.join(__dirname, config.dest);

        // Télécharger
        await this.downloadFile(config.url, destPath);
        this.downloadedFiles.push(destPath);

        // Extraire
        if (config.type === 'zip') {
          await this.extractZip(destPath, tempExtracted);
        }
      } catch (error) {
        console.error(`❌ Erreur pack ${name}:`, error.message);
        this.errors.push({ pack: name, error: error.message });
      }
    }

    // Organiser les assets extraits
    await this.organizeKenneyAssets();
  }

  /**
     * Télécharge les assets directs
     */
  async downloadDirectAssets() {
    console.log('\n🖼️  Téléchargement des assets directs...');

    const directAssets = ASSETS_CONFIG.direct;

    for (const [name, config] of Object.entries(directAssets)) {
      try {
        const destPath = path.join(__dirname, config.dest);
        await this.downloadFile(config.url, destPath);
        this.downloadedFiles.push(destPath);
      } catch (error) {
        console.error(`❌ Erreur asset ${name}:`, error.message);
        this.errors.push({ asset: name, error: error.message });
      }
    }
  }

  /**
     * Renomme les assets Kenney pour correspondre aux types de zombies
     */
  async mapZombiesToTypes() {
    console.log('\n🧟 Mapping des zombies aux types du jeu...');

    const zombieDir = path.join(this.assetsDir, 'images', 'sprites', 'zombies');
    const zombieFiles = fs.readdirSync(zombieDir).filter(f => f.endsWith('.png'));

    if (zombieFiles.length === 0) {
      console.log('   ⚠️  Aucun sprite de zombie trouvé');
      return;
    }

    const zombieTypes = ['normal', 'fast', 'tank', 'explosive', 'healer', 'slower', 'poison', 'shooter', 'boss'];

    // Mapper les fichiers aux types
    zombieTypes.forEach((type, index) => {
      if (index < zombieFiles.length) {
        const sourceFile = zombieFiles[index];
        const sourcePath = path.join(zombieDir, sourceFile);
        const destPath = path.join(zombieDir, `zombie_${type}.png`);

        // Copier au lieu de renommer pour garder l'original
        fs.copyFileSync(sourcePath, destPath);
        console.log(`   ✓ ${type}: ${sourceFile} → zombie_${type}.png`);
      }
    });

    console.log('✅ Zombies mappés aux types du jeu');
  }

  /**
     * Crée des backgrounds par tuiles si on a des tiles
     */
  async createTiledBackgrounds() {
    console.log('\n🎨 Création de backgrounds à partir des tuiles...');

    const bgDir = path.join(this.assetsDir, 'images', 'backgrounds');
    const bgFiles = fs.readdirSync(bgDir).filter(f => f.startsWith('bg_kenney_'));

    if (bgFiles.length === 0) {
      console.log('   ⚠️  Aucune tuile trouvée');
      return;
    }

    // Renommer pour correspondre au système
    bgFiles.forEach((file, index) => {
      const sourcePath = path.join(bgDir, file);
      const destPath = path.join(bgDir, `background_${index + 1}.png`);
      fs.copyFileSync(sourcePath, destPath);
      console.log(`   ✓ background_${index + 1}.png créé`);
    });

    console.log('✅ Backgrounds créés');
  }

  /**
     * Sélectionne le meilleur sprite de joueur
     */
  async selectPlayerSprite() {
    console.log('\n👤 Sélection du sprite joueur...');

    const playerDir = path.join(this.assetsDir, 'images', 'sprites', 'player');
    const playerFiles = fs.readdirSync(playerDir).filter(f => f.endsWith('.png'));

    if (playerFiles.length === 0) {
      console.log('   ⚠️  Aucun sprite de joueur trouvé');
      return;
    }

    // Copier le premier fichier comme sprites de base
    const sourceFile = playerFiles[0];
    const sourcePath = path.join(playerDir, sourceFile);

    fs.copyFileSync(sourcePath, path.join(playerDir, 'player_idle.png'));
    fs.copyFileSync(sourcePath, path.join(playerDir, 'player_walk.png'));

    console.log(`   ✓ player_idle.png et player_walk.png créés depuis ${sourceFile}`);
    console.log('✅ Sprite joueur configuré');
  }

  /**
     * Nettoie les fichiers temporaires
     */
  async cleanup() {
    console.log('\n🧹 Nettoyage des fichiers temporaires...');

    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      console.log('✅ Fichiers temporaires supprimés');
    }
  }

  /**
     * Génère un rapport
     */
  generateReport() {
    console.log('\n📊 RAPPORT DE TÉLÉCHARGEMENT');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Fichiers téléchargés: ${this.downloadedFiles.length}`);
    console.log(`❌ Erreurs: ${this.errors.length}`);

    if (this.errors.length > 0) {
      console.log('\nErreurs détaillées:');
      this.errors.forEach(err => {
        console.log(`   - ${err.pack || err.asset}: ${err.error}`);
      });
    }

    // Compter les assets finaux
    const zombieDir = path.join(this.assetsDir, 'images', 'sprites', 'zombies');
    const playerDir = path.join(this.assetsDir, 'images', 'sprites', 'player');
    const bgDir = path.join(this.assetsDir, 'images', 'backgrounds');

    const zombieCount = fs.existsSync(zombieDir) ?
      fs.readdirSync(zombieDir).filter(f => f.startsWith('zombie_') && f.endsWith('.png')).length : 0;
    const playerCount = fs.existsSync(playerDir) ?
      fs.readdirSync(playerDir).filter(f => f.startsWith('player_') && f.endsWith('.png')).length : 0;
    const bgCount = fs.existsSync(bgDir) ?
      fs.readdirSync(bgDir).filter(f => f.startsWith('background_') && f.endsWith('.png')).length : 0;

    console.log('\nAssets disponibles:');
    console.log(`   🧟 Zombies: ${zombieCount}/9 types`);
    console.log(`   👤 Joueur: ${playerCount} sprites`);
    console.log(`   🎨 Backgrounds: ${bgCount} images`);

    console.log('\n═══════════════════════════════════════');

    if (zombieCount > 0 || playerCount > 0 || bgCount > 0) {
      console.log('✅ Téléchargement réussi !');
      console.log('\n💡 Lancez le serveur pour voir les nouveaux assets:');
      console.log('   node server.js');
    } else {
      console.log('⚠️  Aucun asset n\'a pu être téléchargé');
      console.log('\n💡 Vérifiez votre connexion internet et réessayez');
    }
  }

  /**
     * Exécute le téléchargement complet
     */
  async run() {
    console.log('🚀 TÉLÉCHARGEMENT AUTOMATIQUE DES ASSETS');
    console.log('═══════════════════════════════════════\n');

    try {
      // Créer la structure
      await this.createDirectories();

      // Télécharger les assets Kenney
      await this.downloadKenneyAssets();

      // Télécharger les assets directs
      await this.downloadDirectAssets();

      // Organiser et mapper les assets
      await this.mapZombiesToTypes();
      await this.createTiledBackgrounds();
      await this.selectPlayerSprite();

      // Nettoyer
      await this.cleanup();

      // Rapport final
      this.generateReport();

    } catch (error) {
      console.error('\n❌ ERREUR CRITIQUE:', error);
      process.exit(1);
    }
  }
}

// Exécuter le script
if (require.main === module) {
  const downloader = new AssetDownloader();
  downloader.run().catch(error => {
    console.error('Erreur fatale:', error);
    process.exit(1);
  });
}

module.exports = AssetDownloader;
