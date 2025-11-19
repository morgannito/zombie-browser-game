/**
 * GAME PATCH
 * Patche le jeu existant pour utiliser les nouveaux systèmes
 * Ce fichier doit être chargé APRÈS game.js
 * @version 1.0.0
 */

(function() {
  'use strict';

  console.log('Applying game patches for enhanced systems...');

  // Vérifier si les systèmes requis sont prêts
  function areSystemsReady() {
    return window.GameEngine &&
           window.Renderer &&
           window.PlayerController &&
           typeof window.GameEngine === 'function' &&
           typeof window.Renderer === 'function' &&
           typeof window.PlayerController === 'function';
  }

  // Attendre que le DOM soit chargé avant de commencer
  function initPatches() {
    if (areSystemsReady()) {
      applyPatches();
      return;
    }

    // Polling avec timerManager pour éviter memory leak
    let patchAttempts = 0;
    const MAX_PATCH_ATTEMPTS = 50; // 5 secondes max (50 * 100ms)

    const patchInterval = window.timerManager ?
      window.timerManager.setInterval(() => {
        if (areSystemsReady()) {
          window.timerManager.clearInterval(patchInterval);
          applyPatches();
        } else if (++patchAttempts >= MAX_PATCH_ATTEMPTS) {
          window.timerManager.clearInterval(patchInterval);
          console.error('❌ Failed to load game systems after 5 seconds. Required: GameEngine, Renderer, PlayerController');
          console.error('Available:', {
            GameEngine: !!window.GameEngine,
            Renderer: !!window.Renderer,
            PlayerController: !!window.PlayerController
          });
        }
      }, 100) :
      // Fallback si timerManager pas encore chargé
      (window.timerManager ? window.timerManager.setInterval : setInterval)(() => {
        if (areSystemsReady()) {
          clearInterval(patchInterval);
          applyPatches();
        } else if (++patchAttempts >= MAX_PATCH_ATTEMPTS) {
          clearInterval(patchInterval);
          console.error('❌ Failed to load game systems after 5 seconds.');
        }
      }, 100);
  }

  // Attendre DOMContentLoaded avant d'initialiser
  if (document.readyState === 'loading') {
    if (window.eventListenerManager) {
      window.eventListenerManager.add(document, 'DOMContentLoaded', initPatches);
    } else {
      document.addEventListener('DOMContentLoaded', initPatches);
    }
  } else {
    // DOM déjà chargé
    initPatches();
  }

  function applyPatches() {
    console.log('Patching game systems...');

    // ===============================================
    // PATCH 1: Améliorer la boucle de jeu via update()
    // ===============================================
    // On patche update() plutôt que gameLoop() pour éviter les animation frame leaks
    const originalUpdate = GameEngine.prototype.update;
    GameEngine.prototype.update = function(deltaTime) {
      // Appeler l'update original
      if (originalUpdate) {
        originalUpdate.call(this, deltaTime);
      }

      // Mise à jour des systèmes améliorés
      if (window.updateEnhancedSystems) {
        try {
          // deltaTime peut être undefined si pas fourni, utiliser 16ms par défaut (60 FPS)
          const dt = deltaTime !== undefined ? deltaTime : 16;
          window.updateEnhancedSystems(dt);
        } catch (error) {
          console.error('Enhanced systems error:', error);
        }
      }
    };

    // ===============================================
    // PATCH 2: Améliorer le rendu
    // ===============================================
    const originalRender = Renderer.prototype.render;
    Renderer.prototype.render = function(gameState, playerId) {
      // Rendu original
      originalRender.call(this, gameState, playerId);

      // Appliquer le screen shake
      if (window.enhancedEffects && window.enhancedEffects.screenShake) {
        this.ctx.save();
        window.enhancedEffects.screenShake.apply(this.ctx);
        this.ctx.restore();
      }

      // Rendu des effets améliorés (par dessus tout)
      if (window.renderEnhancedEffects) {
        this.ctx.save();
        // Retirer la transformation de la caméra pour les effets d'écran
        const pixelRatio = window.devicePixelRatio || 1;
        this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        window.renderEnhancedEffects(this.ctx, this.canvas.width, this.canvas.height);
        this.ctx.restore();
      }
    };

    // ===============================================
    // PATCH 3: Améliorer le rendu des joueurs avec skins
    // ===============================================
    // Note: On ne remplace PAS complètement renderPlayers car
    // l'implémentation originale est déjà complète dans game.js
    // On laisse l'original gérer tout le rendu

    // ===============================================
    // PATCH 4: Améliorer le rendu des balles avec skins
    // ===============================================
    // Note: On ne remplace PAS complètement renderBullets car
    // l'implémentation originale est déjà complète dans game.js
    // On laisse l'original gérer tout le rendu avec les effets de lumière

    // ===============================================
    // PATCH 5: Intercepter le tir pour les effets
    // ===============================================
    const originalShoot = PlayerController.prototype.shoot;
    PlayerController.prototype.shoot = function(canvasWidth, canvasHeight) {
      // Appeler la méthode originale
      originalShoot.call(this, canvasWidth, canvasHeight);

      // Effets lors du tir (après l'appel original)
      if (window.gameState) {
        const player = window.gameState.getPlayer();
        if (player && player.alive) {
          const weaponType = player.weapon || 'pistol';
          if (window.onPlayerShoot) {
            window.onPlayerShoot(player.x, player.y, player.angle, weaponType);
          }
        }
      }
    };

    // ===============================================
    // PATCH 6: Intercepter les événements réseau
    // ===============================================
    if (window.NetworkManager) {
      const setupNetworkHooks = () => {
        if (!window.networkManager || !window.networkManager.socket) {
          if (window.timerManager) {
            window.timerManager.setTimeout(setupNetworkHooks, 100);
          } else {
            (window.timerManager ? window.timerManager.setTimeout : setTimeout)(setupNetworkHooks, 100);
          }
          return;
        }

        const socket = window.networkManager.socket;

        // Hook pour les mises à jour d'état
        socket.on('gameState', (state) => {
          const oldState = window.gameState ? window.gameState.state : null;

          // Détecter les événements
          if (oldState && state) {
            detectGameEvents(oldState, state);
          }

          // Mettre à jour les barres de progression
          if (window.updateHealthBar && state.players && window.gameState.playerId) {
            const player = state.players[window.gameState.playerId];
            if (player) {
              window.updateHealthBar(player.health, player.maxHealth);
              // Utiliser la fonction depuis window si disponible, sinon calculer localement
              const nextLevelXP = window.getXPForLevel ? window.getXPForLevel(player.level + 1) : getXPForLevel(player.level + 1);
              if (window.updateXPBar) {
                window.updateXPBar(player.xp, nextLevelXP);
              }
            }
          }
        });

        console.log('Network hooks installed');
      };

      setupNetworkHooks();
    }

    // ===============================================
    // FONCTION: Détection des événements de jeu
    // ===============================================
    function detectGameEvents(oldState, newState) {
      // Détecter la mort de zombies
      if (oldState.zombies && newState.zombies) {
        Object.keys(oldState.zombies).forEach(zid => {
          if (!newState.zombies[zid]) {
            const zombie = oldState.zombies[zid];
            if (window.onZombieDeath) {
              const color = getZombieColor(zombie.type);
              window.onZombieDeath(zombie.x, zombie.y, color);
            }
          }
        });
      }

      // Détecter la collecte de loot
      if (oldState.loot && newState.loot) {
        Object.keys(oldState.loot).forEach(lid => {
          if (!newState.loot[lid]) {
            const loot = oldState.loot[lid];
            if (loot.type === 'gold' && window.onGoldCollect) {
              window.onGoldCollect(loot.x, loot.y, loot.amount);
            } else if (loot.type === 'xp' && window.onXPGain) {
              window.onXPGain(loot.x, loot.y, loot.amount);
            }
          }
        });
      }

      // Détecter le level up
      const playerId = window.gameState.playerId;
      if (playerId && oldState.players && newState.players) {
        const oldPlayer = oldState.players[playerId];
        const newPlayer = newState.players[playerId];

        if (oldPlayer && newPlayer) {
          // Level up
          if (newPlayer.level > oldPlayer.level && window.onLevelUp) {
            window.onLevelUp(newPlayer.x, newPlayer.y, newPlayer.level);
          }

          // Dégâts reçus
          if (newPlayer.health < oldPlayer.health && window.onPlayerDamage) {
            const damage = oldPlayer.health - newPlayer.health;
            window.onPlayerDamage(newPlayer.x, newPlayer.y, damage);
          }

          // Heal
          if (newPlayer.health > oldPlayer.health && window.onPlayerHeal) {
            const heal = newPlayer.health - oldPlayer.health;
            window.onPlayerHeal(newPlayer.x, newPlayer.y, heal);
          }
        }
      }

      // Détecter l'apparition d'un boss
      if (oldState.zombies && newState.zombies) {
        Object.entries(newState.zombies).forEach(([zid, zombie]) => {
          if (!oldState.zombies[zid] && zombie.type === 'boss' && window.onBossSpawn) {
            window.onBossSpawn(zombie.x, zombie.y);
          }
        });
      }

      // Détecter le début du combat
      if (!oldState.zombies || Object.keys(oldState.zombies).length === 0) {
        if (newState.zombies && Object.keys(newState.zombies).length > 0 && window.onCombatStart) {
          window.onCombatStart();
        }
      }
    }

    // ===============================================
    // FONCTIONS UTILITAIRES
    // ===============================================
    function getZombieColor(type) {
      const colors = {
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
      return colors[type] || '#00ff00';
    }

    function getXPForLevel(level) {
      return Math.floor(100 * Math.pow(1.5, level - 1));
    }

    // ===============================================
    // PATCH 7: Ajouter des contrôles audio à l'UI
    // ===============================================
    function addAudioControls() {
      const controlsContainer = document.createElement('div');
      controlsContainer.id = 'audio-controls';
      controlsContainer.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        z-index: 100;
        display: flex;
        gap: 10px;
      `;

      // Bouton musique
      const musicBtn = document.createElement('button');
      musicBtn.textContent = '🎵';
      musicBtn.title = 'Musique On/Off';
      musicBtn.style.cssText = `
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        border: 2px solid #00ff00;
        cursor: pointer;
        font-size: 20px;
      `;

      const musicClickHandler = () => {
        if (window.advancedAudio) {
          const enabled = window.advancedAudio.toggleMusic();
          musicBtn.style.opacity = enabled ? '1' : '0.5';
          musicBtn.textContent = enabled ? '🎵' : '🔇';
        }
      };

      if (window.eventListenerManager) {
        window.eventListenerManager.add(musicBtn, 'click', musicClickHandler);
      } else {
        musicBtn.addEventListener('click', musicClickHandler);
      }

      // Bouton sons
      const soundBtn = document.createElement('button');
      soundBtn.textContent = '🔊';
      soundBtn.title = 'Sons On/Off';
      soundBtn.style.cssText = musicBtn.style.cssText;

      const soundClickHandler = () => {
        if (window.advancedAudio) {
          const enabled = window.advancedAudio.toggleSound();
          soundBtn.style.opacity = enabled ? '1' : '0.5';
          soundBtn.textContent = enabled ? '🔊' : '🔇';
        }
      };

      if (window.eventListenerManager) {
        window.eventListenerManager.add(soundBtn, 'click', soundClickHandler);
      } else {
        soundBtn.addEventListener('click', soundClickHandler);
      }

      controlsContainer.appendChild(musicBtn);
      controlsContainer.appendChild(soundBtn);
      document.body.appendChild(controlsContainer);
    }

    addAudioControls();

    console.log('✓ All patches applied successfully!');
  }
})();
