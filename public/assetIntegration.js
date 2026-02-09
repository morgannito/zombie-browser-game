/**
 * Asset Integration - Intègre l'AssetManager avec le système de rendu du jeu
 *
 * Ce fichier patch les fonctions de rendu pour utiliser les assets chargés
 * tout en gardant le rendu procédural comme fallback.
 */

(function () {
  'use strict';

  // Vérifier que l'AssetManager est disponible
  if (typeof AssetManager === 'undefined') {
    logger.warn('AssetManager non disponible - utilisation du rendu procedural uniquement');
    return;
  }

  // Instance globale de l'AssetManager
  window.assetManager = new AssetManager();

  // Variable pour stocker le background actuel
  let currentBackgroundImage = null;
  let currentWave = 0;

  /**
   * Initialise et charge tous les assets
   */
  async function initializeAssets() {
    logger.debug("Initialisation du systeme d'assets...");

    try {
      await window.assetManager.loadAllAssets();
      const report = window.assetManager.getLoadReport();
      logger.debug('Rapport de chargement:', report);

      // Si aucun asset externe n'est disponible, charger les assets professionnels
      if (report.images.available === 0) {
        logger.debug(
          'Aucun asset externe trouve - chargement des assets professionnels proceduraux'
        );
        logger.debug('Consultez /assets/README.md pour ajouter vos propres assets');

        // Essayer d'utiliser le générateur professionnel en priorité
        if (typeof ProfessionalAssetGenerator !== 'undefined') {
          const generator = new ProfessionalAssetGenerator();
          await generator.loadProfessionalAssetsIntoManager(window.assetManager);
          logger.debug('Assets professionnels charges avec succes');
        } else if (typeof DemoAssetGenerator !== 'undefined') {
          // Fallback vers le générateur de démo basique
          const generator = new DemoAssetGenerator();
          await generator.loadDemoAssetsIntoManager(window.assetManager);
          logger.debug('Assets de demonstration charges avec succes');
        }
      } else {
        logger.debug(
          `${report.images.available} images et ${report.sounds.available} sons charges`
        );
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement des assets:', error);
    }
  }

  /**
   * Patch la fonction renderFloor pour supporter les backgrounds par vague
   */
  function patchRenderFloor() {
    if (!window.GameRenderer) {
      return;
    }

    const originalRenderFloor = window.GameRenderer.prototype.renderFloor;

    window.GameRenderer.prototype.renderFloor = function (config) {
      // Essayer d'utiliser un background image
      const backgroundImage = currentBackgroundImage;

      if (backgroundImage) {
        // Dessiner le background en mode pattern/tile
        const pattern = this.ctx.createPattern(backgroundImage, 'repeat');
        if (pattern) {
          this.ctx.fillStyle = pattern;
          this.ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);

          // Ajouter un overlay sombre pour l'ambiance
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
          this.ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);
          return;
        }
      }

      // Fallback vers le rendu procédural original
      originalRenderFloor.call(this, config);
    };

    logger.debug('Patch renderFloor applique');
  }

  /**
   * Patch la fonction drawZombieSprite pour supporter différents sprites par type
   */
  function patchZombieRendering() {
    if (!window.GameRenderer) {
      return;
    }

    const _originalDrawZombie = window.GameRenderer.prototype.drawZombieSprite;

    window.GameRenderer.prototype.drawZombieSprite = function (zombie, config) {
      // Essayer de charger le sprite du zombie selon son type
      const zombieSprite = window.assetManager.getImage(`zombie_${zombie.type}`);

      if (zombieSprite) {
        const size = zombie.isBoss ? config.ZOMBIE_SIZE * 1.5 : config.ZOMBIE_SIZE;

        this.ctx.save();

        // Calculer l'angle de rotation basé sur la vélocité
        let angle = 0;
        if (zombie.velocityX !== 0 || zombie.velocityY !== 0) {
          angle = Math.atan2(zombie.velocityY, zombie.velocityX);
        }

        this.ctx.translate(zombie.x, zombie.y);
        this.ctx.rotate(angle);

        // Dessiner le sprite centré
        this.ctx.drawImage(zombieSprite, -size, -size, size * 2, size * 2);

        this.ctx.restore();

        // Dessiner la barre de vie par-dessus le sprite
        this.drawZombieHealthBar(zombie, config);
        return;
      }

      // Fallback vers le rendu procédural original (amélioré)
      this.drawEnhancedZombieSprite(zombie, config);
    };

    /**
     * Version améliorée du rendu procédural des zombies
     */
    window.GameRenderer.prototype.drawEnhancedZombieSprite = function (zombie, config) {
      const size = zombie.isBoss ? config.ZOMBIE_SIZE * 1.5 : config.ZOMBIE_SIZE;
      const headSize = size * 0.8;
      const bodyHeight = size * 1.2;
      const bodyWidth = size * 0.6;

      this.ctx.save();

      // Animation de marche
      const _walkCycle = Math.sin(Date.now() / 200) * 0.3;
      const legSwing = Math.sin(Date.now() / 150) * 15;
      const armSwing = Math.sin(Date.now() / 180) * 20;

      // Couleur selon le type
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

      const zombieColor = typeColors[zombie.type] || '#00ff00';

      // Corps
      this.ctx.fillStyle = zombieColor;
      this.ctx.fillRect(zombie.x - bodyWidth / 2, zombie.y - size, bodyWidth, bodyHeight);

      // Bordure plus épaisse pour les boss
      if (zombie.isBoss) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(zombie.x - bodyWidth / 2, zombie.y - size, bodyWidth, bodyHeight);
      }

      // Tête
      this.ctx.fillStyle = this.darkenColor(zombieColor, 20);
      this.ctx.beginPath();
      this.ctx.arc(zombie.x, zombie.y - size - headSize / 2, headSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Yeux rouges brillants
      this.ctx.fillStyle = '#ff0000';
      const eyeOffset = headSize * 0.3;
      const eyeSize = headSize * 0.2;

      // Œil gauche
      this.ctx.beginPath();
      this.ctx.arc(zombie.x - eyeOffset, zombie.y - size - headSize / 2, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Œil droit
      this.ctx.beginPath();
      this.ctx.arc(zombie.x + eyeOffset, zombie.y - size - headSize / 2, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Effet de lueur pour les yeux
      this.ctx.shadowColor = '#ff0000';
      this.ctx.shadowBlur = 10;
      this.ctx.fill();
      this.ctx.shadowBlur = 0;

      // Jambes animées
      this.ctx.strokeStyle = zombieColor;
      this.ctx.lineWidth = 4;

      // Jambe gauche
      this.ctx.beginPath();
      this.ctx.moveTo(zombie.x - bodyWidth / 4, zombie.y);
      this.ctx.lineTo(
        zombie.x - bodyWidth / 4 + Math.sin((legSwing * Math.PI) / 180) * 5,
        zombie.y + size * 0.8
      );
      this.ctx.stroke();

      // Jambe droite
      this.ctx.beginPath();
      this.ctx.moveTo(zombie.x + bodyWidth / 4, zombie.y);
      this.ctx.lineTo(
        zombie.x + bodyWidth / 4 - Math.sin((legSwing * Math.PI) / 180) * 5,
        zombie.y + size * 0.8
      );
      this.ctx.stroke();

      // Bras animés
      this.ctx.lineWidth = 3;

      // Bras gauche
      this.ctx.beginPath();
      this.ctx.moveTo(zombie.x - bodyWidth / 2, zombie.y - size * 0.8);
      this.ctx.lineTo(
        zombie.x - bodyWidth / 2 - size * 0.5,
        zombie.y - size * 0.4 + Math.sin((armSwing * Math.PI) / 180) * 8
      );
      this.ctx.stroke();

      // Bras droit
      this.ctx.beginPath();
      this.ctx.moveTo(zombie.x + bodyWidth / 2, zombie.y - size * 0.8);
      this.ctx.lineTo(
        zombie.x + bodyWidth / 2 + size * 0.5,
        zombie.y - size * 0.4 - Math.sin((armSwing * Math.PI) / 180) * 8
      );
      this.ctx.stroke();

      // Indicateur spécial pour certains types
      if (zombie.type === 'explosive') {
        // Symbole d'explosion
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('💥', zombie.x, zombie.y - size * 1.8);
      } else if (zombie.type === 'healer') {
        // Croix de soigneur
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('+', zombie.x, zombie.y - size * 1.8);
      } else if (zombie.type === 'poison') {
        // Symbole de poison
        this.ctx.fillStyle = '#00ff00';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('☠', zombie.x, zombie.y - size * 1.8);
      }

      this.ctx.restore();

      // Barre de vie
      this.drawZombieHealthBar(zombie, config);
    };

    /**
     * Dessine la barre de vie d'un zombie
     */
    window.GameRenderer.prototype.drawZombieHealthBar = function (zombie, config) {
      if (!zombie.health || !zombie.maxHealth) {
        return;
      }

      const size = zombie.isBoss ? config.ZOMBIE_SIZE * 1.5 : config.ZOMBIE_SIZE;
      const barWidth = size * 1.5;
      const barHeight = 4;
      const barY = zombie.y - size * 2 - 10;

      const healthPercent = zombie.health / zombie.maxHealth;

      // Fond de la barre
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(zombie.x - barWidth / 2, barY, barWidth, barHeight);

      // Barre de vie colorée
      let healthColor = '#00ff00';
      if (healthPercent < 0.3) {
        healthColor = '#ff0000';
      } else if (healthPercent < 0.6) {
        healthColor = '#ffaa00';
      }

      this.ctx.fillStyle = healthColor;
      this.ctx.fillRect(zombie.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

      // Bordure
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(zombie.x - barWidth / 2, barY, barWidth, barHeight);
    };

    /**
     * Utilitaire pour assombrir une couleur
     */
    window.GameRenderer.prototype.darkenColor = function (color, percent) {
      const num = parseInt(color.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) - amt;
      const G = ((num >> 8) & 0x00ff) - amt;
      const B = (num & 0x0000ff) - amt;
      return (
        '#' +
        (
          0x1000000 +
          (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
          (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
          (B < 255 ? (B < 1 ? 0 : B) : 255)
        )
          .toString(16)
          .slice(1)
      );
    };

    logger.debug('Patch zombie rendering applique');
  }

  /**
   * Patch la fonction drawPlayerSprite pour un meilleur design
   */
  function patchPlayerRendering() {
    if (!window.GameRenderer) {
      return;
    }

    const _originalDrawPlayer = window.GameRenderer.prototype.drawPlayerSprite;

    window.GameRenderer.prototype.drawPlayerSprite = function (player, isCurrentPlayer, config) {
      // Essayer de charger le sprite du joueur
      const playerSprite = window.assetManager.getImage('player_walk');

      if (playerSprite) {
        const size = config.PLAYER_SIZE;

        this.ctx.save();

        // Rotation vers la souris pour le joueur actuel
        if (isCurrentPlayer && window.inputManager) {
          const angle = Math.atan2(
            window.inputManager.mouse.y - player.y,
            window.inputManager.mouse.x - player.x
          );
          this.ctx.translate(player.x, player.y);
          this.ctx.rotate(angle);
          this.ctx.translate(-player.x, -player.y);
        }

        // Dessiner le sprite centré
        this.ctx.drawImage(playerSprite, player.x - size, player.y - size, size * 2, size * 2);

        this.ctx.restore();
        return;
      }

      // Fallback amélioré
      this.drawEnhancedPlayerSprite(player, isCurrentPlayer, config);
    };

    /**
     * Version améliorée du rendu procédural du joueur
     */
    window.GameRenderer.prototype.drawEnhancedPlayerSprite = function (
      player,
      isCurrentPlayer,
      config
    ) {
      const size = config.PLAYER_SIZE;
      const color = isCurrentPlayer ? '#0088ff' : '#ff8800';

      this.ctx.save();

      // Animation de marche
      const isMoving = Math.abs(player.velocityX) > 0.1 || Math.abs(player.velocityY) > 0.1;
      const legSwing = isMoving ? Math.sin(Date.now() / 100) * 10 : 0;
      const armSwing = isMoving ? Math.sin(Date.now() / 120) * 15 : 0;

      // Corps principal (ellipse pour plus de détail)
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.ellipse(player.x, player.y - size * 0.3, size * 0.6, size * 0.9, 0, 0, Math.PI * 2);
      this.ctx.fill();

      // Bordure du corps
      this.ctx.strokeStyle = this.darkenColor(color, 30);
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      // Tête
      this.ctx.fillStyle = this.darkenColor(color, 20);
      this.ctx.beginPath();
      this.ctx.arc(player.x, player.y - size * 1.3, size * 0.6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // Visière/yeux (deux points blancs)
      this.ctx.fillStyle = '#ffffff';
      const eyeSize = size * 0.15;
      this.ctx.beginPath();
      this.ctx.arc(player.x - size * 0.2, player.y - size * 1.3, eyeSize, 0, Math.PI * 2);
      this.ctx.arc(player.x + size * 0.2, player.y - size * 1.3, eyeSize, 0, Math.PI * 2);
      this.ctx.fill();

      // Jambes
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = 5;

      // Jambe gauche
      this.ctx.beginPath();
      this.ctx.moveTo(player.x - size * 0.3, player.y + size * 0.3);
      this.ctx.lineTo(
        player.x - size * 0.3 + Math.sin((legSwing * Math.PI) / 180) * 8,
        player.y + size * 1.2
      );
      this.ctx.stroke();

      // Jambe droite
      this.ctx.beginPath();
      this.ctx.moveTo(player.x + size * 0.3, player.y + size * 0.3);
      this.ctx.lineTo(
        player.x + size * 0.3 - Math.sin((legSwing * Math.PI) / 180) * 8,
        player.y + size * 1.2
      );
      this.ctx.stroke();

      // Bras
      this.ctx.lineWidth = 4;

      // Bras gauche
      this.ctx.beginPath();
      this.ctx.moveTo(player.x - size * 0.6, player.y - size * 0.5);
      this.ctx.lineTo(player.x - size * 0.9, player.y + Math.sin((armSwing * Math.PI) / 180) * 10);
      this.ctx.stroke();

      // Bras droit (pointe vers la souris pour le joueur actuel)
      if (isCurrentPlayer && window.inputManager) {
        const angle = Math.atan2(
          window.inputManager.mouse.y - player.y,
          window.inputManager.mouse.x - player.x
        );

        this.ctx.beginPath();
        this.ctx.moveTo(player.x + size * 0.6, player.y - size * 0.5);
        this.ctx.lineTo(
          player.x + Math.cos(angle) * size * 1.2,
          player.y + Math.sin(angle) * size * 1.2
        );
        this.ctx.stroke();

        // Arme (rectangle)
        this.ctx.fillStyle = '#555555';
        this.ctx.save();
        this.ctx.translate(player.x, player.y);
        this.ctx.rotate(angle);
        this.ctx.fillRect(size * 0.8, -size * 0.15, size * 0.8, size * 0.3);
        this.ctx.restore();
      } else {
        this.ctx.beginPath();
        this.ctx.moveTo(player.x + size * 0.6, player.y - size * 0.5);
        this.ctx.lineTo(
          player.x + size * 0.9,
          player.y - Math.sin((armSwing * Math.PI) / 180) * 10
        );
        this.ctx.stroke();
      }

      // Indicateur de santé (aura de couleur)
      if (player.health && player.maxHealth) {
        const healthPercent = player.health / player.maxHealth;
        if (healthPercent < 0.5) {
          this.ctx.strokeStyle = healthPercent < 0.25 ? '#ff0000' : '#ffaa00';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(player.x, player.y, size * 1.8, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      this.ctx.restore();
    };

    logger.debug('Patch player rendering applique');
  }

  /**
   * Met à jour le background selon la vague actuelle
   */
  function updateBackgroundForWave(waveNumber) {
    if (waveNumber === currentWave) {
      return;
    }

    currentWave = waveNumber;
    currentBackgroundImage = window.assetManager.getBackgroundByWave(waveNumber);

    if (currentBackgroundImage) {
      logger.debug(`Background change pour la vague ${waveNumber}`);
    }
  }

  // MEMORY LEAK FIX: Track intervals for cleanup
  let waveCheckInterval = null;

  /**
   * Écoute les changements de vague
   */
  function listenForWaveChanges() {
    // Intercepter les mises à jour de vague du serveur
    if (window.socket) {
      const _originalOnGameState = window.socket._callbacks?.$gameState;

      window.socket.on('gameState', function (state) {
        if (state && state.wave && state.wave !== currentWave) {
          updateBackgroundForWave(state.wave);
        }
      });
    }

    // MEMORY LEAK FIX: Clear existing interval before creating new one
    if (waveCheckInterval) {
      clearInterval(waveCheckInterval);
    }

    // Vérifier périodiquement
    waveCheckInterval = setInterval(() => {
      const waveElement = document.getElementById('wave-value');
      if (waveElement) {
        const waveNumber = parseInt(waveElement.textContent) || 1;
        updateBackgroundForWave(waveNumber);
      }
    }, 1000);
  }

  // MEMORY LEAK FIX: Expose cleanup function
  window.cleanupAssetIntegration = function () {
    if (waveCheckInterval) {
      clearInterval(waveCheckInterval);
      waveCheckInterval = null;
    }
    logger.debug('Asset integration cleaned up');
  };

  /**
   * Patch le système audio pour utiliser les sons chargés
   */
  function patchAudioSystem() {
    if (!window.audioManager) {
      return;
    }

    const originalPlaySound = window.audioManager.playSound?.bind(window.audioManager);

    if (originalPlaySound) {
      window.audioManager.playSound = function (soundType, ...args) {
        // Mapper les types de sons
        const soundMapping = {
          shoot: 'sfx_shootPistol',
          hit: 'sfx_playerHurt',
          zombieDeath: 'sfx_zombieDeath',
          explosion: 'sfx_explosion',
          coin: 'sfx_coinCollect',
          levelUp: 'sfx_levelUp',
          powerup: 'sfx_powerup'
        };

        const assetKey = soundMapping[soundType];

        if (assetKey && window.assetManager.hasAsset('sfx', assetKey.replace('sfx_', ''))) {
          window.assetManager.playSound(assetKey, args[0] || 1.0);
          return;
        }

        // Fallback vers le système audio procédural
        originalPlaySound(soundType, ...args);
      };
    }

    logger.debug('Patch audio system applique');
  }

  /**
   * Initialise tous les patches
   */
  async function initialize() {
    logger.debug("Demarrage de l'integration des assets...");

    // Charger les assets
    await initializeAssets();

    // MEMORY LEAK FIX: Track attempts and add timeout to prevent infinite interval
    let waitAttempts = 0;
    const maxAttempts = 100; // 10 seconds max wait

    // Attendre que le GameRenderer soit disponible
    const waitForRenderer = setInterval(() => {
      waitAttempts++;

      if (window.GameRenderer) {
        clearInterval(waitForRenderer);

        patchRenderFloor();
        patchZombieRendering();
        patchPlayerRendering();
        patchAudioSystem();
        listenForWaveChanges();

        logger.info('Integration des assets completee');
      } else if (waitAttempts >= maxAttempts) {
        // MEMORY LEAK FIX: Clear interval after timeout to prevent infinite loop
        clearInterval(waitForRenderer);
        logger.warn('GameRenderer not found after 10s, asset integration aborted');
      }
    }, 100);
  }

  // Démarrer l'initialisation quand le DOM est prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
