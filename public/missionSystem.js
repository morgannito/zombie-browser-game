/**
 * MISSION SYSTEM - Missions secondaires en run
 * @version 1.0.0
 */

class MissionSystem {
  constructor() {
    this.currentMissions = [];
    this.completedMissions = [];
    this.availableMissions = this.initializeMissions();
  }

  // Initialiser les types de missions
  initializeMissions() {
    return [
      {
        id: 'speed_kill_5',
        name: '⚡ Tuerie Rapide',
        description: 'Tuer 5 zombies en moins de 10 secondes',
        type: 'speed_kills',
        target: 5,
        timeLimit: 10000,
        reward: { gold: 50, xp: 100 },
        rarity: 'common'
      },
      {
        id: 'no_hit_30s',
        name: '🛡️ Intouchable',
        description: 'Survivre 30 secondes sans prendre de dégâts',
        type: 'no_damage_time',
        target: 30000,
        reward: { gold: 75, xp: 150 },
        rarity: 'rare'
      },
      {
        id: 'boss_speed',
        name: '⏱️ Boss Speedrun',
        description: 'Tuer le boss en moins de 30 secondes',
        type: 'boss_speed',
        target: 30000,
        reward: { gold: 100, xp: 200, upgradeReroll: true },
        rarity: 'epic'
      },
      {
        id: 'perfect_room',
        name: '💯 Salle Parfaite',
        description: 'Terminer la salle sans prendre de dégâts',
        type: 'perfect_room',
        reward: { gold: 150, xp: 250, rareUpgrade: true },
        rarity: 'epic'
      },
      {
        id: 'headshot_streak',
        name: '🎯 Série de Headshots',
        description: 'Faire 3 headshots/critiques consécutifs',
        type: 'crit_streak',
        target: 3,
        reward: { gold: 60, xp: 120 },
        rarity: 'rare'
      },
      {
        id: 'gold_collector',
        name: '💰 Collectionneur',
        description: 'Collecter 500 or dans cette salle',
        type: 'gold_collect',
        target: 500,
        reward: { gold: 100, xp: 150 },
        rarity: 'common'
      },
      {
        id: 'efficient_killer',
        name: '🎖️ Tueur Efficace',
        description: 'Tuer 15 zombies avec moins de 50 balles',
        type: 'efficient_kills',
        killTarget: 15,
        bulletLimit: 50,
        reward: { gold: 80, xp: 160 },
        rarity: 'rare'
      },
      {
        id: 'close_combat',
        name: '⚔️ Combat Rapproché',
        description: 'Tuer 10 zombies à moins de 100px de distance',
        type: 'close_kills',
        target: 10,
        distance: 100,
        reward: { gold: 70, xp: 140 },
        rarity: 'common'
      },
      {
        id: 'one_weapon',
        name: '🔫 Spécialiste',
        description: 'Terminer la salle avec une seule arme',
        type: 'single_weapon',
        reward: { gold: 90, xp: 180 },
        rarity: 'rare'
      },
      {
        id: 'no_shop',
        name: '💎 Économe',
        description: 'Terminer la salle sans acheter au shop',
        type: 'no_shop',
        reward: { gold: 100, gems: 10 },
        rarity: 'rare'
      }
    ];
  }

  // Générer des missions pour une nouvelle salle
  generateMissionsForRoom(difficulty = 1) {
    // Nombre de missions basé sur la difficulté
    const missionCount = Math.min(2, 1 + Math.floor(difficulty / 3));

    // Filtrer par rareté basée sur difficulté
    let availablePool = [...this.availableMissions];

    if (difficulty < 3) {
      availablePool = availablePool.filter(m => m.rarity === 'common' || m.rarity === 'rare');
    }

    // Mélanger et prendre N missions
    const shuffled = availablePool.sort(() => Math.random() - 0.5);
    this.currentMissions = shuffled.slice(0, missionCount).map(mission => ({
      ...mission,
      progress: 0,
      completed: false,
      startTime: Date.now(),
      tracking: {}
    }));

    // Afficher les missions
    this.showMissionNotifications();

    return this.currentMissions;
  }

  // Afficher notifications des nouvelles missions
  showMissionNotifications() {
    if (window.toastManager) {
      window.toastManager.show(
        `🎯 ${this.currentMissions.length} nouvelle${this.currentMissions.length > 1 ? 's' : ''} mission${this.currentMissions.length > 1 ? 's' : ''}!`,
        'mission',
        4000
      );
    }

    // Créer une notification spéciale pour chaque mission
    this.currentMissions.forEach((mission, index) => {
      setTimeout(() => {
        this.showMissionCard(mission);
      }, 500 + index * 1000);
    });
  }

  // Afficher carte de mission
  showMissionCard(mission) {
    const card = document.createElement('div');
    card.className = 'mission-card-notification';
    card.innerHTML = `
      <div class="mission-card-inner ${mission.rarity}">
        <div class="mission-header">🎯 NOUVELLE MISSION</div>
        <div class="mission-name">${mission.name}</div>
        <div class="mission-desc">${mission.description}</div>
        <div class="mission-reward">
          Récompense: ${mission.reward.gold ? `💰 ${mission.reward.gold}` : ''}
          ${mission.reward.xp ? ` | ⭐ ${mission.reward.xp} XP` : ''}
          ${mission.reward.gems ? ` | 💎 ${mission.reward.gems} Gems` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(card);

    setTimeout(() => card.classList.add('show'), 100);

    setTimeout(() => {
      card.classList.remove('show');
      setTimeout(() => card.remove(), 500);
    }, 5000);
  }

  // Mettre à jour le progrès d'une mission
  updateProgress(type, data) {
    this.currentMissions.forEach(mission => {
      if (mission.completed) return;

      switch (mission.type) {
        case 'speed_kills':
          this.trackSpeedKills(mission, data);
          break;

        case 'no_damage_time':
          this.trackNoDamageTime(mission, data);
          break;

        case 'boss_speed':
          this.trackBossSpeed(mission, data);
          break;

        case 'perfect_room':
          this.trackPerfectRoom(mission, data);
          break;

        case 'crit_streak':
          this.trackCritStreak(mission, data);
          break;

        case 'gold_collect':
          this.trackGoldCollect(mission, data);
          break;

        case 'efficient_kills':
          this.trackEfficientKills(mission, data);
          break;

        case 'close_kills':
          this.trackCloseKills(mission, data);
          break;

        case 'single_weapon':
          this.trackSingleWeapon(mission, data);
          break;

        case 'no_shop':
          this.trackNoShop(mission, data);
          break;
      }
    });
  }

  // Tracking pour speed kills
  trackSpeedKills(mission, data) {
    if (data.event === 'zombie_kill') {
      if (!mission.tracking.kills) {
        mission.tracking.kills = [];
      }

      mission.tracking.kills.push(Date.now());

      // Garder seulement les kills des dernières 10 secondes
      const now = Date.now();
      mission.tracking.kills = mission.tracking.kills.filter(t => now - t < mission.timeLimit);

      if (mission.tracking.kills.length >= mission.target) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour no damage time
  trackNoDamageTime(mission, data) {
    if (data.event === 'player_damaged') {
      mission.tracking.lastDamageTime = Date.now();
    } else if (data.event === 'update') {
      if (!mission.tracking.lastDamageTime) {
        mission.tracking.lastDamageTime = mission.startTime;
      }

      const timeSinceLastDamage = Date.now() - mission.tracking.lastDamageTime;
      if (timeSinceLastDamage >= mission.target) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour boss speed
  trackBossSpeed(mission, data) {
    if (data.event === 'boss_spawned') {
      mission.tracking.bossSpawnTime = Date.now();
    } else if (data.event === 'boss_killed') {
      if (mission.tracking.bossSpawnTime) {
        const killTime = Date.now() - mission.tracking.bossSpawnTime;
        if (killTime <= mission.target) {
          this.completeMission(mission);
        }
      }
    }
  }

  // Tracking pour perfect room
  trackPerfectRoom(mission, data) {
    if (data.event === 'player_damaged') {
      mission.tracking.tookDamage = true;
    } else if (data.event === 'room_complete') {
      if (!mission.tracking.tookDamage) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour crit streak
  trackCritStreak(mission, data) {
    if (data.event === 'critical_hit') {
      mission.tracking.streak = (mission.tracking.streak || 0) + 1;
      if (mission.tracking.streak >= mission.target) {
        this.completeMission(mission);
      }
    } else if (data.event === 'normal_hit') {
      mission.tracking.streak = 0;
    }
  }

  // Tracking pour gold collect
  trackGoldCollect(mission, data) {
    if (data.event === 'gold_collected') {
      mission.tracking.gold = (mission.tracking.gold || 0) + data.amount;
      if (mission.tracking.gold >= mission.target) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour efficient kills
  trackEfficientKills(mission, data) {
    if (data.event === 'bullet_fired') {
      mission.tracking.bullets = (mission.tracking.bullets || 0) + 1;
    } else if (data.event === 'zombie_kill') {
      mission.tracking.kills = (mission.tracking.kills || 0) + 1;

      if (mission.tracking.kills >= mission.killTarget) {
        if (mission.tracking.bullets <= mission.bulletLimit) {
          this.completeMission(mission);
        }
      }
    }
  }

  // Tracking pour close kills
  trackCloseKills(mission, data) {
    if (data.event === 'zombie_kill' && data.distance <= mission.distance) {
      mission.tracking.closeKills = (mission.tracking.closeKills || 0) + 1;
      if (mission.tracking.closeKills >= mission.target) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour single weapon
  trackSingleWeapon(mission, data) {
    if (data.event === 'weapon_changed') {
      mission.tracking.weapons = mission.tracking.weapons || new Set();
      mission.tracking.weapons.add(data.weapon);

      if (mission.tracking.weapons.size > 1) {
        mission.tracking.failed = true;
      }
    } else if (data.event === 'room_complete') {
      if (!mission.tracking.failed && (!mission.tracking.weapons || mission.tracking.weapons.size <= 1)) {
        this.completeMission(mission);
      }
    }
  }

  // Tracking pour no shop
  trackNoShop(mission, data) {
    if (data.event === 'shop_purchase') {
      mission.tracking.failed = true;
    } else if (data.event === 'room_complete') {
      if (!mission.tracking.failed) {
        this.completeMission(mission);
      }
    }
  }

  // Compléter une mission
  completeMission(mission) {
    if (mission.completed) return;

    mission.completed = true;
    mission.completedAt = Date.now();

    this.completedMissions.push(mission);

    // Afficher notification
    this.showMissionComplete(mission);

    // Donner les récompenses
    this.grantRewards(mission);
  }

  // Afficher notification de mission complétée
  showMissionComplete(mission) {
    if (window.toastManager) {
      window.toastManager.show(
        `✅ MISSION COMPLÉTÉE!\n${mission.name}`,
        'mission',
        5000
      );
    }

    // Popup spéciale
    const popup = document.createElement('div');
    popup.className = 'mission-complete-popup';
    popup.innerHTML = `
      <div class="mission-complete-inner ${mission.rarity}">
        <div class="mission-complete-header">✅ MISSION COMPLÉTÉE!</div>
        <div class="mission-complete-name">${mission.name}</div>
        <div class="mission-complete-reward">
          ${mission.reward.gold ? `💰 +${mission.reward.gold} Or` : ''}
          ${mission.reward.xp ? ` | ⭐ +${mission.reward.xp} XP` : ''}
          ${mission.reward.gems ? ` | 💎 +${mission.reward.gems} Gems` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(popup);

    setTimeout(() => popup.classList.add('show'), 100);

    setTimeout(() => {
      popup.classList.remove('show');
      setTimeout(() => popup.remove(), 500);
    }, 5000);
  }

  // Donner les récompenses
  grantRewards(mission) {
    const rewards = mission.reward;

    // Or
    if (rewards.gold && window.lifetimeStatsSystem) {
      window.lifetimeStatsSystem.recordGoldEarned(rewards.gold);
      // Ajouter or au joueur (sera géré par le jeu principal)
      window.dispatchEvent(new CustomEvent('mission_reward_gold', { detail: rewards.gold }));
    }

    // XP
    if (rewards.xp) {
      window.dispatchEvent(new CustomEvent('mission_reward_xp', { detail: rewards.xp }));
    }

    // Gems
    if (rewards.gems && window.gemSystem) {
      window.gemSystem.addGems(rewards.gems, `Mission: ${mission.name}`);
    }

    // Upgrade spécial
    if (rewards.upgradeReroll) {
      window.dispatchEvent(new CustomEvent('mission_reward_reroll'));
    }

    if (rewards.rareUpgrade) {
      window.dispatchEvent(new CustomEvent('mission_reward_rare_upgrade'));
    }
  }

  // Reset missions (nouvelle salle)
  reset() {
    this.currentMissions = [];
    this.completedMissions = [];
  }

  // Obtenir les missions actuelles
  getCurrentMissions() {
    return this.currentMissions;
  }

  // Créer widget de missions actives
  createMissionWidget() {
    const widget = document.createElement('div');
    widget.id = 'mission-widget';
    widget.className = 'mission-widget';

    widget.innerHTML = `
      <div class="mission-widget-header">
        <h4>🎯 Missions</h4>
      </div>
      <div class="mission-widget-list" id="mission-widget-list">
        ${this.renderMissionList()}
      </div>
    `;

    return widget;
  }

  // Rendre la liste de missions
  renderMissionList() {
    if (this.currentMissions.length === 0) {
      return '<div class="mission-empty">Aucune mission active</div>';
    }

    return this.currentMissions.map(mission => {
      const completed = mission.completed;

      return `
        <div class="mission-item ${completed ? 'completed' : 'active'}">
          <div class="mission-item-name">${mission.name}</div>
          <div class="mission-item-desc">${mission.description}</div>
          <div class="mission-item-status">
            ${completed ? '✅ Complétée' : '⏳ En cours'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Mettre à jour le widget
  updateWidget() {
    const list = document.getElementById('mission-widget-list');
    if (list) {
      list.innerHTML = this.renderMissionList();
    }
  }
}

// Initialiser le système global
window.missionSystem = new MissionSystem();
