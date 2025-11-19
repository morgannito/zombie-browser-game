/**
 * ADDICTION INTEGRATION - Intégration de tous les systèmes d'addiction
 * @version 1.0.0
 */

class AddictionIntegration {
  constructor() {
    this.initialized = false;
    this.gameStarted = false;
  }

  // Initialiser tous les systèmes
  initialize() {
    if (this.initialized) return;

    console.log('🎮 Initializing Addiction Systems...');

    // Créer tous les panneaux UI
    this.createAllPanels();

    // Setup event listeners
    this.setupEventListeners();

    // Initialiser le leaderboard avec socket
    if (window.socket && window.leaderboardSystem) {
      window.leaderboardSystem.initialize(window.socket);
    }

    // Vérifier les déblocages au démarrage
    if (window.unlockSystem) {
      window.unlockSystem.checkUnlocks();
    }

    // Vérifier les achievements
    if (window.achievementSystem) {
      window.achievementSystem.checkAchievements();
    }

    // Mettre à jour la date de connexion
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.updateLoginDate();
    }

    // Afficher widgets sur l'écran d'accueil
    this.setupHomeScreen();

    // Afficher le menu de navigation
    this.setupGameMenu();

    // Initialiser les gems display
    if (window.gemSystem) {
      window.gemSystem.updateGemDisplay();
    }

    // Vérifier les événements actifs
    if (window.eventSystem) {
      window.eventSystem.checkActiveEvents();
    }

    this.initialized = true;
    console.log('✅ Addiction Systems Initialized!');
  }

  // Créer tous les panneaux UI
  createAllPanels() {
    if (window.achievementSystem) {
      window.achievementSystem.createAchievementUI();
    }

    if (window.dailyChallengeSystem) {
      window.dailyChallengeSystem.createChallengeUI();
    }

    if (window.leaderboardSystem) {
      window.leaderboardSystem.createLeaderboardUI();
    }

    if (window.unlockSystem) {
      window.unlockSystem.createUnlockUI();
    }

    if (window.synergySystem) {
      window.synergySystem.createSynergyUI();
    }

    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.createStatsUI();
    }

    if (window.gemSystem) {
      window.gemSystem.createGemShopUI();
    }
  }

  // Setup écran d'accueil
  setupHomeScreen() {
    const homeWidgets = document.getElementById('home-widgets');
    if (!homeWidgets) return;

    homeWidgets.innerHTML = '';

    // Ajouter leaderboard widget
    if (window.leaderboardSystem) {
      const leaderboardWidget = window.leaderboardSystem.createLeaderboardWidget();
      if (leaderboardWidget) {
        homeWidgets.appendChild(leaderboardWidget);
      }
    }

    // Ajouter event widget si événement actif
    if (window.eventSystem) {
      const eventWidget = window.eventSystem.createEventWidget();
      if (eventWidget) {
        homeWidgets.appendChild(eventWidget);
      }

      // Ajouter bannière d'événement
      const banner = window.eventSystem.createEventBanner();
      if (banner) {
        const nicknameScreen = document.getElementById('nickname-screen');
        if (nicknameScreen) {
          nicknameScreen.appendChild(banner);
        }
      }
    }
  }

  // Setup menu de navigation
  setupGameMenu() {
    // Achievements
    const achievementsBtn = document.getElementById('menu-btn-achievements');
    if (achievementsBtn && window.achievementSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(achievementsBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(achievementsBtn, 'click', ()) : achievementsBtn.addEventListener('click', ())) => {
        window.achievementSystem.openPanel();
      });
    }

    // Challenges
    const challengesBtn = document.getElementById('menu-btn-challenges');
    if (challengesBtn && window.dailyChallengeSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(challengesBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(challengesBtn, 'click', ()) : challengesBtn.addEventListener('click', ())) => {
        window.dailyChallengeSystem.openPanel();
      });
    }

    // Leaderboard
    const leaderboardBtn = document.getElementById('menu-btn-leaderboard');
    if (leaderboardBtn && window.leaderboardSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(leaderboardBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(leaderboardBtn, 'click', ()) : leaderboardBtn.addEventListener('click', ())) => {
        window.leaderboardSystem.openPanel();
      });
    }

    // Unlocks
    const unlocksBtn = document.getElementById('menu-btn-unlocks');
    if (unlocksBtn && window.unlockSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(unlocksBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(unlocksBtn, 'click', ()) : unlocksBtn.addEventListener('click', ())) => {
        window.unlockSystem.openPanel();
      });
    }

    // Synergies
    const synergiesBtn = document.getElementById('menu-btn-synergies');
    if (synergiesBtn && window.synergySystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(synergiesBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(synergiesBtn, 'click', ()) : synergiesBtn.addEventListener('click', ())) => {
        window.synergySystem.openPanel();
      });
    }

    // Lifetime Stats
    const statsBtn = document.getElementById('menu-btn-lifetime-stats');
    if (statsBtn && window.lifetimeStatsSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(statsBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(statsBtn, 'click', ()) : statsBtn.addEventListener('click', ())) => {
        window.lifetimeStatsSystem.openPanel();
      });
    }

    // Gem Shop
    const gemShopBtn = document.getElementById('menu-btn-gem-shop');
    if (gemShopBtn && window.gemSystem) {
      (window.eventListenerManager ? window.eventListenerManager.add(gemShopBtn, 'click', () : (window.eventListenerManager ? window.eventListenerManager.add(gemShopBtn, 'click', ()) : gemShopBtn.addEventListener('click', ())) => {
        window.gemSystem.openPanel();
      });
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Écouter le démarrage du jeu
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'game_started', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'game_started', ()) : document.addEventListener('game_started', ())) => {
      this.onGameStart();
    });

    // Écouter la fin du jeu
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'game_over', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'game_over', (e)) : document.addEventListener('game_over', (e))) => {
      this.onGameOver(e.detail);
    });

    // Écouter les kills de zombies
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'zombie_killed', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'zombie_killed', (e)) : document.addEventListener('zombie_killed', (e))) => {
      this.onZombieKilled(e.detail);
    });

    // Écouter les level ups
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'level_up', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'level_up', (e)) : document.addEventListener('level_up', (e))) => {
      this.onLevelUp(e.detail);
    });

    // Écouter les upgrades
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'upgrade_obtained', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'upgrade_obtained', (e)) : document.addEventListener('upgrade_obtained', (e))) => {
      this.onUpgradeObtained(e.detail);
    });

    // Écouter les boss defeats
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'boss_defeated', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'boss_defeated', (e)) : document.addEventListener('boss_defeated', (e))) => {
      this.onBossDefeated(e.detail);
    });

    // Écouter la collecte d'or
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'gold_collected', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'gold_collected', (e)) : document.addEventListener('gold_collected', (e))) => {
      this.onGoldCollected(e.detail);
    });

    // Écouter les critiques
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'critical_hit', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'critical_hit', ()) : document.addEventListener('critical_hit', ())) => {
      this.onCriticalHit();
    });

    // Écouter les esquives
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'dodge', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'dodge', ()) : document.addEventListener('dodge', ())) => {
      this.onDodge();
    });

    // Écouter le changement de vague
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'wave_changed', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'wave_changed', (e)) : document.addEventListener('wave_changed', (e))) => {
      this.onWaveChanged(e.detail);
    });

    // Écouter le changement de room
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'room_changed', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'room_changed', (e)) : document.addEventListener('room_changed', (e))) => {
      this.onRoomChanged(e.detail);
    });

    // Custom events pour missions
    (window.eventListenerManager ? window.eventListenerManager.add(document, 'mission_reward_gold', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'mission_reward_gold', (e)) : document.addEventListener('mission_reward_gold', (e))) => {
      // Ajouter or au joueur
      if (window.gameEngine) {
        // Sera géré par le jeu principal
      }
    });

    (window.eventListenerManager ? window.eventListenerManager.add(document, 'mission_reward_xp', (e) : (window.eventListenerManager ? window.eventListenerManager.add(document, 'mission_reward_xp', (e)) : document.addEventListener('mission_reward_xp', (e))) => {
      // Ajouter XP au joueur
      if (window.gameEngine) {
        // Sera géré par le jeu principal
      }
    });
  }

  // Événement: Démarrage du jeu
  onGameStart() {
    this.gameStarted = true;

    console.log('🎮 Game Started!');

    // Afficher le menu
    const gameMenu = document.getElementById('game-menu');
    if (gameMenu) {
      gameMenu.style.display = 'block';
    }

    // Démarrer une nouvelle run dans les stats
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.startRun();
    }

    // Reset synergies
    if (window.synergySystem) {
      window.synergySystem.reset();
    }

    // Générer missions pour la première salle
    if (window.missionSystem) {
      window.missionSystem.generateMissionsForRoom(1);
    }

    // Nouvelle run pour gem system
    if (window.gemSystem) {
      window.gemSystem.startNewRun();
    }

    // Vérifier si bonus de gems actif
    if (window.eventSystem) {
      const activeEvents = window.eventSystem.getActiveEvents();
      if (activeEvents.length > 0) {
        console.log('🎉 Événements actifs:', activeEvents.map(e => e.name).join(', '));
      }
    }
  }

  // Événement: Game Over
  onGameOver(stats) {
    console.log('💀 Game Over!', stats);

    // Terminer la run dans les stats
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.endRun(stats);
      window.lifetimeStatsSystem.updatePlayTime();
    }

    // Enregistrer dans retention hooks
    if (window.retentionHooksSystem) {
      window.retentionHooksSystem.recordRunEnd(stats);
      // Afficher les hooks sur l'écran de game over
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
        window.retentionHooksSystem.enhanceGameOverScreen(stats);
      }, 500);
    }

    this.gameStarted = false;

    // Cacher le menu
    const gameMenu = document.getElementById('game-menu');
    if (gameMenu) {
      gameMenu.style.display = 'none';
    }
  }

  // Événement: Zombie tué
  onZombieKilled(data) {
    const { zombieType, weaponUsed, distance } = data;

    // Lifetime stats
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordZombieKill(zombieType, weaponUsed);
    }

    // Missions
    if (window.missionSystem) {
      window.missionSystem.updateProgress('update', { event: 'zombie_kill', distance });
    }
  }

  // Événement: Level up
  onLevelUp(data) {
    const { level } = data;

    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordLevelUp(level);
    }

    if (window.dailyChallengeSystem) {
      if (level === 15) {
        window.dailyChallengeSystem.updateProgress('reach_level', 1);
      }
    }
  }

  // Événement: Upgrade obtenu
  onUpgradeObtained(data) {
    const { upgradeId, rarity } = data;

    // Lifetime stats
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordUpgrade(upgradeId, rarity);
    }

    // Synergies
    if (window.synergySystem) {
      window.synergySystem.addUpgrade(upgradeId);
    }
  }

  // Événement: Boss défait
  onBossDefeated(data) {
    const { timeTaken, damageTaken } = data;

    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordBossDefeated(timeTaken, damageTaken);
    }

    if (window.missionSystem) {
      window.missionSystem.updateProgress('update', { event: 'boss_killed' });
    }
  }

  // Événement: Or collecté
  onGoldCollected(data) {
    const { amount } = data;

    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordGoldEarned(amount);
    }

    if (window.missionSystem) {
      window.missionSystem.updateProgress('update', { event: 'gold_collected', amount });
    }
  }

  // Événement: Coup critique
  onCriticalHit() {
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordCriticalHit();
    }

    if (window.missionSystem) {
      window.missionSystem.updateProgress('update', { event: 'critical_hit' });
    }
  }

  // Événement: Esquive
  onDodge() {
    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordDodge();
    }
  }

  // Événement: Changement de vague
  onWaveChanged(data) {
    const { wave } = data;

    if (window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordWave(wave);
    }
  }

  // Événement: Changement de room
  onRoomChanged(data) {
    const { room } = data;

    // Générer nouvelles missions
    if (window.missionSystem) {
      window.missionSystem.reset();
      window.missionSystem.generateMissionsForRoom(room);
    }
  }

  // Vérifier les déblocages et achievements périodiquement
  periodicCheck() {
    if (!this.gameStarted) return;

    // Vérifier déblocages
    if (window.unlockSystem) {
      const newUnlocks = window.unlockSystem.checkUnlocks();
      if (newUnlocks.length > 0) {
        console.log('🔓 Nouvelles armes débloquées:', newUnlocks);
      }
    }

    // Vérifier achievements
    if (window.achievementSystem) {
      const newAchievements = window.achievementSystem.checkAchievements();
      if (newAchievements.length > 0) {
        console.log('🏆 Nouveaux achievements:', newAchievements);
      }
    }
  }

  // Appliquer les bonus actifs (gems, événements, etc.)
  applyActiveBoosts(baseValues) {
    let modified = { ...baseValues };

    // Appliquer boosts de gems
    if (window.gemSystem) {
      const activeBoosts = window.gemSystem.getActiveBoosts();

      for (const boost of activeBoosts) {
        if (boost.type === 'xp' && modified.xp) {
          modified.xp *= boost.multiplier;
        }
        if (boost.type === 'gold' && modified.gold) {
          modified.gold *= boost.multiplier;
        }
      }

      // Appliquer boosts permanents
      const permanentBoosts = window.gemSystem.getPermanentBoosts();

      if (permanentBoosts.xp && modified.xp) {
        modified.xp *= (1 + permanentBoosts.xp);
      }
      if (permanentBoosts.gold && modified.gold) {
        modified.gold *= (1 + permanentBoosts.gold);
      }
    }

    // Appliquer effets d'événements
    if (window.eventSystem) {
      modified = window.eventSystem.applyEventEffects(modified);
    }

    return modified;
  }

  // Obtenir statistiques pour affichage
  getDisplayStats() {
    const stats = {
      achievements: 0,
      completedChallenges: 0,
      leaderboardRank: null,
      unlocks: 0,
      totalStats: {}
    };

    if (window.achievementSystem) {
      const progress = window.achievementSystem.getProgress();
      stats.achievements = progress.unlocked;
    }

    if (window.dailyChallengeSystem) {
      stats.completedChallenges = window.dailyChallengeSystem.dailyChallenges.filter(c => c.completed).length;
    }

    if (window.unlockSystem) {
      const progress = window.unlockSystem.getProgress();
      stats.unlocks = progress.unlocked;
    }

    if (window.lifetimeStatsSystem) {
      stats.totalStats = window.lifetimeStatsSystem.getSummary();
    }

    return stats;
  }
}

// Initialiser le système d'intégration
window.addictionIntegration = new AddictionIntegration();

// Auto-initialiser après le chargement du DOM
if (document.readyState === 'loading') {
  (window.eventListenerManager ? window.eventListenerManager.add(document, 'DOMContentLoaded', () : (window.eventListenerManager ? window.eventListenerManager.add(document, 'DOMContentLoaded', ()) : document.addEventListener('DOMContentLoaded', ())) => {
    window.addictionIntegration.initialize();
  });
} else {
  window.addictionIntegration.initialize();
}

// Check périodique toutes les 5 secondes
(window.timerManager ? window.timerManager.setInterval : setInterval)(() => {
  if (window.addictionIntegration) {
    window.addictionIntegration.periodicCheck();
  }
}, 5000);

console.log('🎮 Addiction Integration Loaded!');
