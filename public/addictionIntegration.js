/**
 * ADDICTION INTEGRATION - Intégration de tous les systèmes d'addiction
 * @version 1.0.0
 */

class AddictionIntegration {
  constructor() {
    this.initialized = false;
    this.gameStarted = false;
    this.periodicCheckInterval = null; // MEMORY LEAK FIX: Track interval for cleanup
  }

  // Initialiser tous les systèmes
  initialize() {
    if (this.initialized) {
      return;
    }

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
    if (!homeWidgets) {
      return;
    }

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
      achievementsBtn.addEventListener('click', () => {
        window.achievementSystem.openPanel();
      });
    }

    // Challenges
    const challengesBtn = document.getElementById('menu-btn-challenges');
    if (challengesBtn && window.dailyChallengeSystem) {
      challengesBtn.addEventListener('click', () => {
        window.dailyChallengeSystem.openPanel();
      });
    }

    // Leaderboard
    const leaderboardBtn = document.getElementById('menu-btn-leaderboard');
    if (leaderboardBtn && window.leaderboardSystem) {
      leaderboardBtn.addEventListener('click', () => {
        window.leaderboardSystem.openPanel();
      });
    }

    // Unlocks
    const unlocksBtn = document.getElementById('menu-btn-unlocks');
    if (unlocksBtn && window.unlockSystem) {
      unlocksBtn.addEventListener('click', () => {
        window.unlockSystem.openPanel();
      });
    }

    // Synergies
    const synergiesBtn = document.getElementById('menu-btn-synergies');
    if (synergiesBtn && window.synergySystem) {
      synergiesBtn.addEventListener('click', () => {
        window.synergySystem.openPanel();
      });
    }

    // Lifetime Stats
    const statsBtn = document.getElementById('menu-btn-lifetime-stats');
    if (statsBtn && window.lifetimeStatsSystem) {
      statsBtn.addEventListener('click', () => {
        window.lifetimeStatsSystem.openPanel();
      });
    }

    // Gem Shop
    const gemShopBtn = document.getElementById('menu-btn-gem-shop');
    if (gemShopBtn && window.gemSystem) {
      gemShopBtn.addEventListener('click', () => {
        window.gemSystem.openPanel();
      });
    }

    // Meta Progression
    const progressionBtn = document.getElementById('menu-btn-progression');
    if (progressionBtn && window.metaProgressionSystem) {
      progressionBtn.addEventListener('click', () => {
        window.metaProgressionSystem.openPanel();
      });
    }
  }

  // Setup event listeners
  setupEventListeners() {
    this._listeners = [];

    this._onGameStarted = () => {
 this.onGameStart();
};
    this._onGameOver = (e) => {
 this.onGameOver(e.detail);
};
    this._onZombieKilled = (e) => {
 this.onZombieKilled(e.detail);
};
    this._onLevelUp = (e) => {
 this.onLevelUp(e.detail);
};
    this._onUpgradeObtained = (e) => {
 this.onUpgradeObtained(e.detail);
};
    this._onBossDefeated = (e) => {
 this.onBossDefeated(e.detail);
};
    this._onGoldCollected = (e) => {
 this.onGoldCollected(e.detail);
};
    this._onCriticalHit = () => {
 this.onCriticalHit();
};
    this._onDodge = () => {
 this.onDodge();
};
    this._onWaveChanged = (e) => {
 this.onWaveChanged(e.detail);
};
    this._onRoomChanged = (e) => {
 this.onRoomChanged(e.detail);
};
    this._onMissionRewardGold = (_e) => {
      if (window.gameEngine) { /* Sera géré par le jeu principal */ }
    };
    this._onMissionRewardXp = (_e) => {
      if (window.gameEngine) { /* Sera géré par le jeu principal */ }
    };

    const pairs = [
      ['game_started', this._onGameStarted],
      ['game_over', this._onGameOver],
      ['zombie_killed', this._onZombieKilled],
      ['level_up', this._onLevelUp],
      ['upgrade_obtained', this._onUpgradeObtained],
      ['boss_defeated', this._onBossDefeated],
      ['gold_collected', this._onGoldCollected],
      ['critical_hit', this._onCriticalHit],
      ['dodge', this._onDodge],
      ['wave_changed', this._onWaveChanged],
      ['room_changed', this._onRoomChanged],
      ['mission_reward_gold', this._onMissionRewardGold],
      ['mission_reward_xp', this._onMissionRewardXp]
    ];

    for (const [event, handler] of pairs) {
      document.addEventListener(event, handler);
      this._listeners.push({ event, handler });
    }
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
      setTimeout(() => {
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
    if (!this.gameStarted) {
      return;
    }

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

  // MEMORY LEAK FIX: Start periodic check with tracked interval
  startPeriodicCheck() {
    // Clear any existing interval first
    this.stopPeriodicCheck();

    this.periodicCheckInterval = setInterval(() => {
      this.periodicCheck();
    }, 5000);
  }

  // MEMORY LEAK FIX: Stop periodic check and clear interval
  stopPeriodicCheck() {
    if (this.periodicCheckInterval) {
      clearInterval(this.periodicCheckInterval);
      this.periodicCheckInterval = null;
    }
  }

  // MEMORY LEAK FIX: Cleanup method for destroying the system
  destroy() {
    this.stopPeriodicCheck();
    if (this._listeners) {
      for (const { event, handler } of this._listeners) {
        document.removeEventListener(event, handler);
      }
      this._listeners = [];
    }
    this.initialized = false;
    this.gameStarted = false;
    console.log('AddictionIntegration destroyed');
  }
}

// Initialiser le système d'intégration
window.addictionIntegration = new AddictionIntegration();

// Auto-initialiser après le chargement du DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.addictionIntegration.initialize();
    window.addictionIntegration.startPeriodicCheck(); // MEMORY LEAK FIX: Use tracked interval
  });
} else {
  window.addictionIntegration.initialize();
  window.addictionIntegration.startPeriodicCheck(); // MEMORY LEAK FIX: Use tracked interval
}

console.log('Addiction Integration Loaded!');
