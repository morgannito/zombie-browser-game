/**
 * RETENTION HOOKS - "Just One More Run" système
 * @version 1.0.0
 */

class RetentionHooksSystem {
  constructor() {
    this.lastRunStats = null;
  }

  // Enregistrer les stats de la run qui vient de se terminer
  recordRunEnd(stats) {
    this.lastRunStats = stats;
    localStorage.setItem('last_run_stats', JSON.stringify(stats));
  }

  // Charger les stats de la dernière run
  loadLastRunStats() {
    const saved = localStorage.getItem('last_run_stats');
    return saved ? JSON.parse(saved) : null;
  }

  // Générer les hooks pour l'écran de game over
  generateGameOverHooks(stats) {
    const hooks = [];

    // Hook 1: Presque atteint un achievement
    const nearAchievement = this.checkNearAchievement(stats);
    if (nearAchievement) {
      hooks.push({
        type: 'near_achievement',
        message: `🎯 Vous étiez à ${nearAchievement.remaining} ${nearAchievement.unit} de débloquer:\n"${nearAchievement.name}"`,
        icon: '🏆',
        actionText: 'Recommencer pour le débloquer!',
        priority: 10
      });
    }

    // Hook 2: Presque terminé un défi
    const nearChallenge = this.checkNearChallenge(stats);
    if (nearChallenge) {
      hooks.push({
        type: 'near_challenge',
        message: `📅 Défi quotidien presque terminé!\n${nearChallenge.name}: ${nearChallenge.progress}/${nearChallenge.target}`,
        icon: '🎯',
        actionText: `Plus que ${nearChallenge.remaining}!`,
        priority: 9
      });
    }

    // Hook 3: Proche du leaderboard
    const leaderboardPosition = this.checkLeaderboardPosition(stats);
    if (leaderboardPosition) {
      hooks.push({
        type: 'near_leaderboard',
        message: `🏆 Vous êtes #${leaderboardPosition.rank}!\nSeulement ${leaderboardPosition.pointsNeeded} points du Top ${leaderboardPosition.targetRank}`,
        icon: '📊',
        actionText: 'Visez le Top 10!',
        priority: 8
      });
    }

    // Hook 4: Nouveau record personnel proche
    const nearRecord = this.checkNearPersonalRecord(stats);
    if (nearRecord) {
      hooks.push({
        type: 'near_record',
        message: `⭐ Vous étiez proche de votre record!\n${nearRecord.category}: ${nearRecord.current} (Record: ${nearRecord.record})`,
        icon: '🎖️',
        actionText: 'Battez votre record!',
        priority: 7
      });
    }

    // Hook 5: Ami a battu votre score (simulation)
    const friendScore = this.checkFriendScore(stats);
    if (friendScore) {
      hooks.push({
        type: 'friend_score',
        message: `👥 ${friendScore.friendName} vient de battre votre score de ${friendScore.difference} points!`,
        icon: '🎮',
        actionText: 'Reprenez le dessus!',
        priority: 6
      });
    }

    // Hook 6: Bonus de revenge
    hooks.push({
      type: 'revenge',
      message: '💪 REVENGE RUN disponible!\nBonus: +10% dégâts pour la prochaine run',
      icon: '⚡',
      actionText: 'Accepter le Revenge Bonus',
      priority: 5
    });

    // Hook 7: Streak en danger
    if (window.dailyChallengeSystem) {
      const streak = window.dailyChallengeSystem.loginStreak;
      if (streak >= 3) {
        hooks.push({
          type: 'streak_reminder',
          message: `🔥 ${streak} jours de suite!\nNe cassez pas votre streak, revenez demain!`,
          icon: '🔥',
          actionText: 'Continuez la série!',
          priority: 4
        });
      }
    }

    // Hook 8: Progression de déblocage
    if (window.unlockSystem) {
      const progress = window.unlockSystem.getProgress();
      if (progress.percentage < 100) {
        const nextUnlock = this.getNextWeaponUnlock();
        if (nextUnlock) {
          hooks.push({
            type: 'next_unlock',
            message: `🔓 Prochaine arme à débloquer:\n${nextUnlock.name}\n${nextUnlock.requirement}`,
            icon: '🎁',
            actionText: 'Débloquez-la maintenant!',
            priority: 3
          });
        }
      }
    }

    // Trier par priorité
    hooks.sort((a, b) => b.priority - a.priority);

    return hooks.slice(0, 3); // Garder les 3 meilleurs
  }

  // Vérifier si proche d'un achievement
  checkNearAchievement(stats) {
    if (!window.achievementSystem) {
      return null;
    }

    const achievements = window.achievementSystem.achievements;
    const playerStats = window.achievementSystem.stats;

    let nearest = null;
    let minDistance = Infinity;

    for (const achievement of Object.values(achievements)) {
      if (window.achievementSystem.unlockedAchievements[achievement.id]) {
        continue;
      }

      // Vérifier pour les achievements de zombies
      if (achievement.id === 'zombie_hunter' && playerStats.totalZombiesKilled >= 80) {
        const remaining = 100 - playerStats.totalZombiesKilled;
        if (remaining < minDistance) {
          minDistance = remaining;
          nearest = { ...achievement, remaining, unit: 'zombies' };
        }
      }

      // Vérifier pour level
      if (achievement.id === 'level_10' && playerStats.highestLevel >= 8) {
        const remaining = 10 - playerStats.highestLevel;
        if (remaining < minDistance) {
          minDistance = remaining;
          nearest = { ...achievement, remaining, unit: 'niveaux' };
        }
      }

      // Vérifier pour vagues
      if (achievement.id === 'wave_10' && playerStats.highestWave >= 7) {
        const remaining = 10 - playerStats.highestWave;
        if (remaining < minDistance) {
          minDistance = remaining;
          nearest = { ...achievement, remaining, unit: 'vagues' };
        }
      }
    }

    return nearest;
  }

  // Vérifier si proche de terminer un défi
  checkNearChallenge(stats) {
    if (!window.dailyChallengeSystem) {
      return null;
    }

    const challenges = window.dailyChallengeSystem.dailyChallenges;

    for (const challenge of challenges) {
      if (challenge.completed) {
        continue;
      }

      const percentage = (challenge.progress / challenge.target) * 100;
      if (percentage >= 70) {
        return {
          ...challenge,
          remaining: challenge.target - challenge.progress
        };
      }
    }

    return null;
  }

  // Vérifier position leaderboard
  checkLeaderboardPosition(stats) {
    if (!window.leaderboardSystem) {
      return null;
    }

    const score = window.leaderboardSystem.calculateScore(stats);
    const playerName = stats.playerName;

    const position = window.leaderboardSystem.getPlayerPosition(playerName);

    if (position && position <= 50) {
      const topScores = window.leaderboardSystem.getTopScores(100);

      let targetRank = 10;
      if (position <= 10) {
        targetRank = 3;
      }
      if (position <= 3) {
        targetRank = 1;
      }

      if (position > targetRank) {
        const targetScore = topScores[targetRank - 1]?.score || 0;
        const pointsNeeded = Math.max(0, targetScore - score);

        if (pointsNeeded < score * 0.5) { // Si moins de 50% d'écart
          return {
            rank: position,
            targetRank,
            pointsNeeded: Math.ceil(pointsNeeded)
          };
        }
      }
    }

    return null;
  }

  // Vérifier si proche d'un record personnel
  checkNearPersonalRecord(stats) {
    if (!window.lifetimeStatsSystem) {
      return null;
    }

    const lifetime = window.lifetimeStatsSystem.stats;

    // Vérifier plusieurs catégories
    const categories = [
      {
        name: 'Zombies tués',
        current: stats.zombiesKilled,
        record: lifetime.mostZombiesKilledInRun
      },
      {
        name: 'Or gagné',
        current: stats.goldEarned,
        record: lifetime.mostGoldEarnedInRun
      },
      {
        name: 'Niveau atteint',
        current: stats.level,
        record: lifetime.highestLevelInRun
      }
    ];

    for (const cat of categories) {
      if (cat.current >= cat.record * 0.8 && cat.current < cat.record) {
        return {
          category: cat.name,
          current: cat.current,
          record: cat.record
        };
      }
    }

    return null;
  }

  // Simuler un ami (pour démo)
  checkFriendScore(stats) {
    // Simuler avec 30% de chance
    if (Math.random() > 0.7) {
      const friendNames = ['Alex', 'Jordan', 'Morgan', 'Casey', 'Riley'];
      const friendName = friendNames[Math.floor(Math.random() * friendNames.length)];

      const score = window.leaderboardSystem?.calculateScore(stats) || 0;
      const difference = Math.floor(100 + Math.random() * 500);

      return {
        friendName,
        friendScore: score + difference,
        difference
      };
    }

    return null;
  }

  // Obtenir la prochaine arme à débloquer
  getNextWeaponUnlock() {
    if (!window.unlockSystem) {
      return null;
    }

    const weapons = window.unlockSystem.weaponRequirements;

    for (const [id, weapon] of Object.entries(weapons)) {
      if (!window.unlockSystem.isUnlocked(id)) {
        return weapon;
      }
    }

    return null;
  }

  // Activer le revenge bonus
  activateRevengeBonus() {
    localStorage.setItem('revenge_bonus', 'true');

    if (window.toastManager) {
      window.toastManager.show(
        '💪 REVENGE BONUS ACTIVÉ!\n+10% dégâts pour cette run',
        'bonus',
        5000
      );
    }
  }

  // Vérifier si revenge bonus actif
  hasRevengeBonus() {
    return localStorage.getItem('revenge_bonus') === 'true';
  }

  // Consommer le revenge bonus
  consumeRevengeBonus() {
    localStorage.removeItem('revenge_bonus');
  }

  // Créer l'UI des hooks sur game over
  enhanceGameOverScreen(stats) {
    const hooks = this.generateGameOverHooks(stats);

    const gameOverDiv = document.getElementById('game-over');
    if (!gameOverDiv) {
      return;
    }

    // Créer une section pour les hooks
    let hooksContainer = gameOverDiv.querySelector('.retention-hooks');

    if (!hooksContainer) {
      hooksContainer = document.createElement('div');
      hooksContainer.className = 'retention-hooks';

      // Insérer avant le bouton respawn
      const respawnBtn = gameOverDiv.querySelector('#respawn-btn');
      if (respawnBtn) {
        respawnBtn.parentNode.insertBefore(hooksContainer, respawnBtn);
      } else {
        gameOverDiv.appendChild(hooksContainer);
      }
    }

    hooksContainer.innerHTML = hooks.map(hook => `
      <div class="retention-hook ${hook.type}">
        <div class="hook-icon">${hook.icon}</div>
        <div class="hook-content">
          <div class="hook-message">${hook.message}</div>
          <div class="hook-action">${hook.actionText}</div>
        </div>
      </div>
    `).join('');

    // Ajouter event listener pour revenge bonus
    const revengeHook = hooksContainer.querySelector('.retention-hook.revenge');
    if (revengeHook) {
      revengeHook.addEventListener('click', () => {
        this.activateRevengeBonus();
        revengeHook.classList.add('activated');
      });
    }
  }

  // Créer des statistiques comparatives
  createComparisonStats(stats) {
    const lifetime = window.lifetimeStatsSystem?.stats || {};

    return {
      zombiesKilled: {
        thisRun: stats.zombiesKilled || 0,
        average: Math.floor((lifetime.totalZombiesKilled || 0) / Math.max(1, lifetime.totalRuns || 1)),
        best: lifetime.mostZombiesKilledInRun || 0
      },
      goldEarned: {
        thisRun: stats.goldEarned || 0,
        average: Math.floor((lifetime.totalGoldEarned || 0) / Math.max(1, lifetime.totalRuns || 1)),
        best: lifetime.mostGoldEarnedInRun || 0
      },
      level: {
        thisRun: stats.level || 0,
        average: Math.floor((lifetime.totalLevelsGained || 0) / Math.max(1, lifetime.totalRuns || 1)),
        best: lifetime.highestLevel || 0
      }
    };
  }
}

// Initialiser le système global
window.retentionHooksSystem = new RetentionHooksSystem();
