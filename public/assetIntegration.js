/**
 * Asset Integration - Patches EntityRenderer & BackgroundRenderer to use loaded assets
 * Falls back to procedural rendering when assets unavailable.
 */

(function () {
  'use strict';

  if (typeof AssetManager === 'undefined') {
    logger.warn('AssetManager non disponible - rendu procedural uniquement');
    return;
  }

  window.assetManager = new AssetManager();

  let currentBackgroundImage = null;
  let currentWave = 0;
  let waveCheckInterval = null;

  async function initializeAssets() {
    logger.debug("Initialisation du systeme d'assets...");
    try {
      await window.assetManager.loadAllAssets();
      const report = window.assetManager.getLoadReport();
      logger.debug('Rapport de chargement:', report);

      if (report.images.available === 0) {
        if (typeof ProfessionalAssetGenerator !== 'undefined') {
          const gen = new ProfessionalAssetGenerator();
          await gen.loadProfessionalAssetsIntoManager(window.assetManager);
        }
      } else {
        logger.info(`${report.images.available} images chargees`);
      }
    } catch (error) {
      logger.error('Erreur chargement assets:', error);
    }
  }

  // --- BACKGROUND RENDERER PATCH ---
  function patchBackgroundRenderer() {
    if (!window.BackgroundRenderer) {
      return false;
    }

    const orig = window.BackgroundRenderer.prototype.renderFloor;

    window.BackgroundRenderer.prototype.renderFloor = function (ctx, config, dayNight) {
      const bg = currentBackgroundImage;
      if (bg) {
        try {
          const pattern = ctx.createPattern(bg, 'repeat');
          if (pattern) {
            ctx.fillStyle = pattern;
            ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, config.ROOM_WIDTH, config.ROOM_HEIGHT);
            return;
          }
        } catch {
          // Pattern creation failed, fallback
        }
      }
      orig.call(this, ctx, config, dayNight);
    };

    logger.debug('Patch BackgroundRenderer.renderFloor OK');
    return true;
  }

  // --- ENTITY RENDERER PATCHES ---
  function patchEntityRenderer() {
    if (!window.EntityRenderer) {
      return false;
    }

    const origZombie = window.EntityRenderer.prototype.drawZombieSprite;
    const origPlayer = window.EntityRenderer.prototype.drawPlayerSprite;

    // Patch zombie sprite rendering
    window.EntityRenderer.prototype.drawZombieSprite = function (ctx, zombie, timestamp) {
      const sprite = window.assetManager.getImage(`zombie_${zombie.type}`);

      if (sprite) {
        const size = zombie.size || 25;
        const drawSize = zombie.isBoss ? size * 1.5 : size;

        ctx.save();
        ctx.translate(zombie.x, zombie.y);

        // Rotation based on velocity
        if (zombie.velocityX || zombie.velocityY) {
          ctx.rotate(Math.atan2(zombie.velocityY || 0, zombie.velocityX || 0));
        }

        ctx.drawImage(sprite, -drawSize, -drawSize, drawSize * 2, drawSize * 2);
        ctx.restore();
        return;
      }

      // Fallback to procedural
      origZombie.call(this, ctx, zombie, timestamp);
    };

    // Patch player sprite rendering
    window.EntityRenderer.prototype.drawPlayerSprite = function (
      ctx,
      player,
      isCurrentPlayer,
      timestamp
    ) {
      const sprite = window.assetManager.getImage('player_default');

      if (sprite) {
        const size = 20;
        ctx.save();
        ctx.translate(player.x, player.y);

        if (player.angle) {
          ctx.rotate(player.angle);
        }

        ctx.drawImage(sprite, -size, -size, size * 2, size * 2);
        ctx.restore();
        return;
      }

      // Fallback to procedural
      origPlayer.call(this, ctx, player, isCurrentPlayer, timestamp);
    };

    logger.debug('Patch EntityRenderer OK');
    return true;
  }

  // --- WAVE BACKGROUND MANAGEMENT ---
  function updateBackgroundForWave(waveNumber) {
    if (waveNumber === currentWave) {
      return;
    }
    currentWave = waveNumber;
    currentBackgroundImage = window.assetManager.getBackgroundByWave(waveNumber);
    if (currentBackgroundImage) {
      logger.debug(`Background vague ${waveNumber}`);
    }
  }

  function listenForWaveChanges() {
    if (window.socket) {
      window.socket.on('gameState', function (state) {
        if (state && state.wave && state.wave !== currentWave) {
          updateBackgroundForWave(state.wave);
        }
      });
    }

    if (waveCheckInterval) {
      clearInterval(waveCheckInterval);
    }

    waveCheckInterval = setInterval(() => {
      const el = document.getElementById('wave-value');
      if (el) {
        updateBackgroundForWave(parseInt(el.textContent) || 1);
      }
    }, 1000);
  }

  window.cleanupAssetIntegration = function () {
    if (waveCheckInterval) {
      clearInterval(waveCheckInterval);
      waveCheckInterval = null;
    }
  };

  // --- INITIALIZATION ---
  async function initialize() {
    logger.debug('Demarrage integration assets...');
    await initializeAssets();

    let attempts = 0;
    const maxAttempts = 100;

    const waitForRenderers = setInterval(() => {
      attempts++;
      const bgOk = window.BackgroundRenderer;
      const entityOk = window.EntityRenderer;

      if (bgOk && entityOk) {
        clearInterval(waitForRenderers);
        patchBackgroundRenderer();
        patchEntityRenderer();
        listenForWaveChanges();
        logger.info('Integration assets completee - renderers patches');
      } else if (attempts >= maxAttempts) {
        clearInterval(waitForRenderers);
        logger.warn('Renderers introuvables apres 10s - integration annulee');
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
