/**
 * LIFETIME STATS SYSTEM - Statistiques détaillées permanentes
 * @version 1.0.0
 */

class LifetimeStatsSystem {
  constructor() {
    this.stats = this.loadStats();
    this.sessionStats = this.initializeSessionStats();
    this.sessionStartTime = Date.now();
  }

  // Initialiser les statistiques
  loadStats() {
    const saved = localStorage.getItem('lifetime_stats');
    if (saved) {
      return JSON.parse(saved);
    }

    return {
      // Statistiques globales
      totalPlayTime: 0, // en secondes
      totalRuns: 0,
      totalRunsCompleted: 0,
      totalDeaths: 0,
      bestScore: 0,
      totalScore: 0,

      // Zombies
      totalZombiesKilled: 0,
      zombiesKilledByType: {
        normal: 0,
        fast: 0,
        tank: 0,
        explosive: 0,
        healer: 0,
        slower: 0,
        poison: 0,
        shooter: 0,
        boss: 0
      },

      // Vagues et niveaux
      highestWave: 0,
      highestLevel: 0,
      totalWavesSurvived: 0,
      totalLevelsGained: 0,

      // Or et économie
      totalGoldEarned: 0,
      totalGoldSpent: 0,
      totalGemsEarned: 0,
      totalGemsSpent: 0,

      // Combat
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalHealing: 0,
      totalCriticalHits: 0,
      totalDodges: 0,
      totalKillsWithoutDamage: 0,

      // Armes
      favoriteWeapon: null,
      weaponUsageTime: {}, // temps d'utilisation par arme
      killsByWeapon: {},

      // Upgrades
      totalUpgradesObtained: 0,
      upgradesObtained: [],
      legendaryUpgradesFound: 0,
      rareUpgradesFound: 0,

      // Boss
      totalBossesDefeated: 0,
      fastestBossKill: null, // en secondes
      noDamageBossKills: 0,

      // Runs spéciales
      pistolOnlyRuns: 0,
      flawlessRuns: 0, // sans prendre de dégâts
      speedruns: 0, // runs en moins de X temps

      // Temps
      longestRun: 0, // en secondes
      fastestRunCompletion: null,
      averageRunDuration: 0,

      // Divers
      totalRoomsExplored: 0,
      totalPowerupsCollected: 0,
      totalShopPurchases: 0,
      deathsByZombieType: {},

      // Records personnels
      mostZombiesKilledInRun: 0,
      mostGoldEarnedInRun: 0,
      highestLevelInRun: 0,
      longestSurvivalTime: 0,

      // Date tracking
      firstPlayDate: Date.now(),
      lastPlayDate: Date.now(),
      totalDaysPlayed: 1,
      loginDates: [new Date().toDateString()]
    };
  }

  // Initialiser stats de session
  initializeSessionStats() {
    return {
      zombiesKilled: 0,
      goldEarned: 0,
      damageDealt: 0,
      damageTaken: 0,
      critsThisSession: 0,
      dodgesThisSession: 0,
      currentRunStartTime: null,
      runsThisSession: 0
    };
  }

  // Sauvegarder les stats
  saveStats() {
    localStorage.setItem('lifetime_stats', JSON.stringify(this.stats));
  }

  // Mettre à jour une stat
  updateStat(statName, value) {
    if (typeof this.stats[statName] === 'number') {
      this.stats[statName] += value;
    } else {
      this.stats[statName] = value;
    }
    this.saveStats();
  }

  // Incrementer une stat
  increment(statName, amount = 1) {
    if (this.stats[statName] !== undefined) {
      this.stats[statName] += amount;
      this.saveStats();
    }
  }

  // Enregistrer un kill de zombie
  recordZombieKill(zombieType, weaponUsed) {
    this.stats.totalZombiesKilled++;
    this.stats.zombiesKilledByType[zombieType] = (this.stats.zombiesKilledByType[zombieType] || 0) + 1;

    if (weaponUsed) {
      this.stats.killsByWeapon[weaponUsed] = (this.stats.killsByWeapon[weaponUsed] || 0) + 1;
    }

    this.sessionStats.zombiesKilled++;
    this.saveStats();

    // Mettre à jour achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('totalZombiesKilled', 1);
      window.achievementSystem.updateStat('zombiesKilledByType', { [zombieType]: 1 });
    }

    // Mettre à jour défis
    if (window.dailyChallengeSystem) {
      window.dailyChallengeSystem.updateProgress('zombies_killed', 1);
      window.dailyChallengeSystem.updateProgress('zombies_killed_type', 1, { zombieType });
    }
  }

  // Enregistrer un boss défait
  recordBossDefeated(timeTaken, damageTaken) {
    this.stats.totalBossesDefeated++;

    if (!this.stats.fastestBossKill || timeTaken < this.stats.fastestBossKill) {
      this.stats.fastestBossKill = timeTaken;
    }

    if (damageTaken === 0) {
      this.stats.noDamageBossKills++;
    }

    this.saveStats();

    // Mettre à jour achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('bossesDefeated', 1);
      if (damageTaken === 0) {
        window.achievementSystem.updateStat('noDamageBossKills', 1);
      }
    }

    // Mettre à jour défis
    if (window.dailyChallengeSystem) {
      window.dailyChallengeSystem.updateProgress('bosses_defeated', 1);
    }
  }

  // Enregistrer un level up
  recordLevelUp(newLevel) {
    this.stats.totalLevelsGained++;

    if (newLevel > this.stats.highestLevel) {
      this.stats.highestLevel = newLevel;

      // Mettre à jour achievements
      if (window.achievementSystem) {
        window.achievementSystem.updateStat('highestLevel', newLevel);
      }

      // Mettre à jour défis
      if (window.dailyChallengeSystem) {
        window.dailyChallengeSystem.updateProgress('reach_level', 1);
      }
    }

    this.saveStats();
  }

  // Enregistrer une nouvelle vague
  recordWave(waveNumber) {
    this.stats.totalWavesSurvived++;

    if (waveNumber > this.stats.highestWave) {
      this.stats.highestWave = waveNumber;

      // Mettre à jour achievements
      if (window.achievementSystem) {
        window.achievementSystem.updateStat('highestWave', waveNumber);
      }

      // Mettre à jour défis
      if (window.dailyChallengeSystem) {
        window.dailyChallengeSystem.updateProgress('waves_survived', 1);
      }
    }

    this.saveStats();
  }

  // Enregistrer or gagné
  recordGoldEarned(amount) {
    this.stats.totalGoldEarned += amount;
    this.sessionStats.goldEarned += amount;
    this.saveStats();

    // Mettre à jour achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('totalGoldEarned', amount);
    }

    // Mettre à jour défis
    if (window.dailyChallengeSystem) {
      window.dailyChallengeSystem.updateProgress('gold_earned', amount);
    }
  }

  // Enregistrer un crit
  recordCriticalHit() {
    this.stats.totalCriticalHits++;
    this.sessionStats.critsThisSession++;
    this.saveStats();

    // Mettre à jour achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('totalCriticalHits', 1);
    }

    // Mettre à jour défis
    if (window.dailyChallengeSystem) {
      window.dailyChallengeSystem.updateProgress('critical_hits', 1);
    }
  }

  // Enregistrer une esquive
  recordDodge() {
    this.stats.totalDodges++;
    this.sessionStats.dodgesThisSession++;
    this.saveStats();

    // Mettre à jour achievements
    if (window.achievementSystem) {
      window.achievementSystem.updateStat('totalDodges', 1);
    }
  }

  // Enregistrer un upgrade obtenu
  recordUpgrade(upgradeId, rarity) {
    this.stats.totalUpgradesObtained++;

    if (!this.stats.upgradesObtained.includes(upgradeId)) {
      this.stats.upgradesObtained.push(upgradeId);

      // Mettre à jour achievements
      if (window.achievementSystem) {
        window.achievementSystem.updateStat('upgradesObtained', upgradeId);
      }
    }

    if (rarity === 'legendary') {
      this.stats.legendaryUpgradesFound++;
    } else if (rarity === 'rare') {
      this.stats.rareUpgradesFound++;
    }

    this.saveStats();
  }

  // Démarrer une nouvelle run
  startRun() {
    this.sessionStats.currentRunStartTime = Date.now();
    this.stats.totalRuns++;
    this.sessionStats.runsThisSession++;
    this.saveStats();
  }

  // Terminer une run
  endRun(stats) {
    const runDuration = (Date.now() - this.sessionStats.currentRunStartTime) / 1000;

    // Records personnels
    if (stats.zombiesKilled > this.stats.mostZombiesKilledInRun) {
      this.stats.mostZombiesKilledInRun = stats.zombiesKilled;
    }

    if (stats.goldEarned > this.stats.mostGoldEarnedInRun) {
      this.stats.mostGoldEarnedInRun = stats.goldEarned;
    }

    if (stats.level > this.stats.highestLevelInRun) {
      this.stats.highestLevelInRun = stats.level;
    }

    if (runDuration > this.stats.longestRun) {
      this.stats.longestRun = runDuration;
    }

    if (stats.completed) {
      this.stats.totalRunsCompleted++;

      if (!this.stats.fastestRunCompletion || runDuration < this.stats.fastestRunCompletion) {
        this.stats.fastestRunCompletion = runDuration;
      }

      // Mettre à jour achievements
      if (window.achievementSystem) {
        window.achievementSystem.updateStat('totalRunsCompleted', 1);
      }

      // Mettre à jour défis
      if (window.dailyChallengeSystem) {
        window.dailyChallengeSystem.updateProgress('runs_completed', 1);
      }
    } else {
      this.stats.totalDeaths++;

      if (stats.killedBy) {
        this.stats.deathsByZombieType[stats.killedBy] = (this.stats.deathsByZombieType[stats.killedBy] || 0) + 1;
      }
    }

    // Score
    const score = this.calculateScore(stats);
    this.stats.totalScore += score;

    if (score > this.stats.bestScore) {
      this.stats.bestScore = score;
    }

    // Moyenne durée
    this.stats.averageRunDuration = ((this.stats.averageRunDuration * (this.stats.totalRuns - 1)) + runDuration) / this.stats.totalRuns;

    // Runs spéciales
    if (stats.pistolOnly) {
      this.stats.pistolOnlyRuns++;
    }

    if (stats.damageTaken === 0) {
      this.stats.flawlessRuns++;
    }

    this.saveStats();

    // Soumettre au leaderboard
    if (window.leaderboardSystem) {
      window.leaderboardSystem.submitScore(stats.playerName, stats);
    }
  }

  // Calculer le score
  calculateScore(stats) {
    return (stats.wave || 0) * 100 +
           (stats.level || 0) * 50 +
           (stats.zombiesKilled || 0) * 10 +
           (stats.goldEarned || 0);
  }

  // Mettre à jour le temps de jeu
  updatePlayTime() {
    const sessionTime = (Date.now() - this.sessionStartTime) / 1000;
    this.stats.totalPlayTime += sessionTime;
    this.sessionStartTime = Date.now();
    this.saveStats();
  }

  // Mettre à jour les dates de connexion
  updateLoginDate() {
    const today = new Date().toDateString();

    if (!this.stats.loginDates.includes(today)) {
      this.stats.loginDates.push(today);
      this.stats.totalDaysPlayed = this.stats.loginDates.length;
    }

    this.stats.lastPlayDate = Date.now();
    this.saveStats();
  }

  // Formater le temps
  formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  // Obtenir un résumé des statistiques
  getSummary() {
    return {
      totalPlayTime: this.formatTime(this.stats.totalPlayTime),
      totalRuns: this.stats.totalRuns,
      completionRate: this.stats.totalRuns > 0 ? Math.floor((this.stats.totalRunsCompleted / this.stats.totalRuns) * 100) : 0,
      totalZombiesKilled: this.stats.totalZombiesKilled.toLocaleString(),
      highestWave: this.stats.highestWave,
      highestLevel: this.stats.highestLevel,
      bestScore: this.stats.bestScore.toLocaleString(),
      favoriteWeapon: this.getFavoriteWeapon(),
      totalDaysPlayed: this.stats.totalDaysPlayed
    };
  }

  // Obtenir l'arme favorite
  getFavoriteWeapon() {
    let maxKills = 0;
    let favorite = 'Aucune';

    for (const [weapon, kills] of Object.entries(this.stats.killsByWeapon)) {
      if (kills > maxKills) {
        maxKills = kills;
        favorite = weapon;
      }
    }

    return favorite;
  }

  // Créer l'UI des statistiques
  createStatsUI() {
    const summary = this.getSummary();

    const container = document.createElement('div');
    container.id = 'lifetime-stats-panel';
    container.className = 'lifetime-stats-panel';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="lifetime-stats-header">
        <h2>📊 STATISTIQUES GLOBALES</h2>
        <button class="lifetime-stats-close-btn">×</button>
      </div>
      <div class="lifetime-stats-content">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">⏱️</div>
            <div class="stat-value">${summary.totalPlayTime}</div>
            <div class="stat-label">Temps de jeu total</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🎮</div>
            <div class="stat-value">${summary.totalRuns}</div>
            <div class="stat-label">Runs totales</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${summary.completionRate}%</div>
            <div class="stat-label">Taux de réussite</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🧟</div>
            <div class="stat-value">${summary.totalZombiesKilled}</div>
            <div class="stat-label">Zombies tués</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🌊</div>
            <div class="stat-value">${summary.highestWave}</div>
            <div class="stat-label">Vague max</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⬆️</div>
            <div class="stat-value">${summary.highestLevel}</div>
            <div class="stat-label">Niveau max</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🏆</div>
            <div class="stat-value">${summary.bestScore}</div>
            <div class="stat-label">Meilleur score</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">🔫</div>
            <div class="stat-value">${summary.favoriteWeapon}</div>
            <div class="stat-label">Arme favorite</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💥</div>
            <div class="stat-value">${this.stats.totalCriticalHits.toLocaleString()}</div>
            <div class="stat-label">Coups critiques</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-value">${this.stats.totalDodges.toLocaleString()}</div>
            <div class="stat-label">Esquives</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">💰</div>
            <div class="stat-value">${this.stats.totalGoldEarned.toLocaleString()}</div>
            <div class="stat-label">Or total gagné</div>
          </div>
          <div class="stat-card">
            <div class="stat-icon">👹</div>
            <div class="stat-value">${this.stats.totalBossesDefeated}</div>
            <div class="stat-label">Boss vaincus</div>
          </div>
        </div>

        <div class="stats-section">
          <h3>🧟 Zombies tués par type</h3>
          <div class="zombie-stats">
            ${Object.entries(this.stats.zombiesKilledByType).map(([type, count]) => `
              <div class="zombie-stat-row">
                <span class="zombie-type">${type}</span>
                <span class="zombie-count">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="stats-section">
          <h3>🏆 Records Personnels</h3>
          <div class="records-list">
            <div class="record-row">
              <span class="record-label">Plus de zombies en une run:</span>
              <span class="record-value">${this.stats.mostZombiesKilledInRun}</span>
            </div>
            <div class="record-row">
              <span class="record-label">Plus d'or en une run:</span>
              <span class="record-value">${this.stats.mostGoldEarnedInRun}</span>
            </div>
            <div class="record-row">
              <span class="record-label">Boss le plus rapide:</span>
              <span class="record-value">${this.stats.fastestBossKill ? this.formatTime(this.stats.fastestBossKill) : 'N/A'}</span>
            </div>
            <div class="record-row">
              <span class="record-label">Run la plus longue:</span>
              <span class="record-value">${this.formatTime(this.stats.longestRun)}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.lifetime-stats-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    return container;
  }

  // Ouvrir le panneau
  openPanel() {
    let panel = document.getElementById('lifetime-stats-panel');
    if (!panel) {
      panel = this.createStatsUI();
    }
    panel.style.display = 'block';
  }
}

// Initialiser le système global
window.lifetimeStatsSystem = new LifetimeStatsSystem();
