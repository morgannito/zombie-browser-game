/**
 * SYNERGY SYSTEM - Système de synergies d'upgrades
 * @version 1.0.0
 */

class SynergySystem {
  constructor() {
    this.activeSynergies = [];
    this.currentUpgrades = [];
    this.synergies = this.initializeSynergies();
  }

  // Définir toutes les synergies possibles
  initializeSynergies() {
    return [
      {
        id: 'missile_barrage',
        name: '🚀 Missile Barrage',
        description: 'Les explosions ont +50% de rayon',
        requires: ['explosiveRounds', 'multishot'],
        effect: {
          type: 'explosion_radius',
          multiplier: 1.5
        },
        rarity: 'epic',
        icon: '🚀💥'
      },
      {
        id: 'assassins_mark',
        name: '🎯 Marque de l\'Assassin',
        description: 'Les critiques percent +3 ennemis supplémentaires',
        requires: ['piercingBullets', 'criticalStrike'],
        effect: {
          type: 'crit_pierce',
          bonus: 3
        },
        rarity: 'epic',
        icon: '🎯⚡'
      },
      {
        id: 'vampire_tank',
        name: '🧛 Tank Vampire',
        description: 'Double le vol de vie et les dégâts de thorns',
        requires: ['lifeSteal', 'thorns'],
        effect: {
          type: 'lifesteal_thorns_boost',
          multiplier: 2
        },
        rarity: 'legendary',
        icon: '🧛🛡️'
      },
      {
        id: 'sentry_network',
        name: '🤖 Réseau de Sentinelles',
        description: 'Déploie 2 tourelles au lieu d\'une',
        requires: ['autoTurret', 'fireRate'],
        effect: {
          type: 'extra_turret',
          count: 1
        },
        rarity: 'legendary',
        icon: '🤖🤖'
      },
      {
        id: 'rapid_regeneration',
        name: '💚 Régénération Rapide',
        description: 'La régénération est 3x plus rapide',
        requires: ['regeneration', 'maxHealth'],
        effect: {
          type: 'regen_speed',
          multiplier: 3
        },
        rarity: 'rare',
        icon: '💚⚡'
      },
      {
        id: 'bullet_storm',
        name: '⛈️ Tempête de Balles',
        description: 'Tir rapide + multishot = cadence encore +30%',
        requires: ['fireRate', 'multishot'],
        effect: {
          type: 'fire_rate',
          bonus: 0.3
        },
        rarity: 'epic',
        icon: '⛈️💨'
      },
      {
        id: 'explosive_pierce',
        name: '💥 Perçage Explosif',
        description: 'Chaque ennemi percé déclenche une explosion',
        requires: ['piercingBullets', 'explosiveRounds'],
        effect: {
          type: 'pierce_explosion',
          enabled: true
        },
        rarity: 'legendary',
        icon: '💥🔫'
      },
      {
        id: 'critical_dodge',
        name: '⚡ Esquive Critique',
        description: 'Après une esquive, +100% chance de crit pendant 2s',
        requires: ['dodge', 'criticalStrike'],
        effect: {
          type: 'dodge_crit_buff',
          duration: 2000,
          critBonus: 1.0
        },
        rarity: 'epic',
        icon: '⚡💥'
      },
      {
        id: 'speed_demon',
        name: '👹 Démon de Vitesse',
        description: 'Vitesse + Esquive = +20% vitesse et +5% esquive',
        requires: ['speed', 'dodge'],
        effect: {
          type: 'speed_dodge_boost',
          speedBonus: 0.2,
          dodgeBonus: 0.05
        },
        rarity: 'rare',
        icon: '👹💨'
      },
      {
        id: 'healing_aura',
        name: '✨ Aura de Soin',
        description: 'Régénération + Vol de vie = soigne aussi sur kill',
        requires: ['regeneration', 'lifeSteal'],
        effect: {
          type: 'kill_heal',
          healAmount: 5
        },
        rarity: 'rare',
        icon: '✨💚'
      },
      {
        id: 'glass_cannon',
        name: '💎 Canon de Verre',
        description: 'Dégâts + Crit = +50% dégâts mais -20% vie max',
        requires: ['damage', 'criticalStrike'],
        effect: {
          type: 'glass_cannon',
          damageBonus: 0.5,
          healthPenalty: 0.2
        },
        rarity: 'epic',
        icon: '💎💥'
      },
      {
        id: 'fortress',
        name: '🏰 Forteresse',
        description: 'Vie max + Thorns = +30% vie max et +50% thorns',
        requires: ['maxHealth', 'thorns'],
        effect: {
          type: 'fortress',
          healthBonus: 0.3,
          thornsBonus: 0.5
        },
        rarity: 'rare',
        icon: '🏰🛡️'
      },
      {
        id: 'goldmancer',
        name: '💰 Goldmancer',
        description: 'Rayon d\'or + Vol de vie = gagne de l\'or en soignant',
        requires: ['goldMagnet', 'lifeSteal'],
        effect: {
          type: 'gold_on_heal',
          goldPerHeal: 2
        },
        rarity: 'rare',
        icon: '💰✨'
      },
      {
        id: 'turret_barrage',
        name: '🎯 Barrage Automatique',
        description: 'Tourelle + Explosions = les tourelles tirent des explosifs',
        requires: ['autoTurret', 'explosiveRounds'],
        effect: {
          type: 'explosive_turret',
          enabled: true
        },
        rarity: 'legendary',
        icon: '🎯💥'
      },
      {
        id: 'unstoppable',
        name: '💪 Imparable',
        description: 'Vitesse + Dégâts + Vie = +15% tous les stats',
        requires: ['speed', 'damage', 'maxHealth'],
        effect: {
          type: 'all_stats_boost',
          bonus: 0.15
        },
        rarity: 'legendary',
        icon: '💪⭐'
      }
    ];
  }

  // Ajouter un upgrade à la liste courante
  addUpgrade(upgradeId) {
    if (!this.currentUpgrades.includes(upgradeId)) {
      this.currentUpgrades.push(upgradeId);
      this.checkSynergies();
    }
  }

  // Retirer un upgrade (utile pour reset entre runs)
  removeUpgrade(upgradeId) {
    const index = this.currentUpgrades.indexOf(upgradeId);
    if (index > -1) {
      this.currentUpgrades.splice(index, 1);
      this.checkSynergies();
    }
  }

  // Reset tous les upgrades (nouvelle run)
  reset() {
    this.currentUpgrades = [];
    this.activeSynergies = [];
  }

  // Vérifier les synergies
  checkSynergies() {
    const newSynergies = [];

    for (const synergy of this.synergies) {
      // Vérifier si déjà activée
      if (this.activeSynergies.find(s => s.id === synergy.id)) {
        continue;
      }

      // Vérifier si tous les prérequis sont présents
      const hasAllRequirements = synergy.requires.every(req =>
        this.currentUpgrades.includes(req)
      );

      if (hasAllRequirements) {
        this.activateSynergy(synergy);
        newSynergies.push(synergy);
      }
    }

    return newSynergies;
  }

  // Activer une synergie
  activateSynergy(synergy) {
    this.activeSynergies.push(synergy);
    this.showSynergyNotification(synergy);
  }

  // Afficher notification de synergie
  showSynergyNotification(synergy) {
    if (window.toastManager) {
      window.toastManager.show(
        `⚡ SYNERGIE ACTIVÉE!\n${synergy.icon} ${synergy.name}`,
        'synergy',
        6000
      );
    }

    // Créer popup spéciale
    this.createSynergyPopup(synergy);
  }

  // Créer popup de synergie
  createSynergyPopup(synergy) {
    const popup = document.createElement('div');
    popup.className = 'synergy-popup';
    popup.innerHTML = `
      <div class="synergy-popup-inner ${synergy.rarity}">
        <div class="synergy-header">⚡ SYNERGIE ACTIVÉE! ⚡</div>
        <div class="synergy-icon-large">${synergy.icon}</div>
        <div class="synergy-name">${synergy.name}</div>
        <div class="synergy-desc">${synergy.description}</div>
        <div class="synergy-rarity">${synergy.rarity.toUpperCase()}</div>
      </div>
    `;

    document.body.appendChild(popup);

    // Animation spéciale
    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => popup.classList.add('show'), 100);

    // Effet visuel sur l'écran
    this.createScreenEffect();

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      popup.classList.remove('show');
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => popup.remove(), 500);
    }, 7000);
  }

  // Créer effet visuel sur l'écran
  createScreenEffect() {
    const effect = document.createElement('div');
    effect.className = 'synergy-screen-effect';
    document.body.appendChild(effect);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => effect.classList.add('active'), 50);

    (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => {
      effect.classList.remove('active');
      (window.timerManager ? window.timerManager.setTimeout : setTimeout)(() => effect.remove(), 500);
    }, 1000);
  }

  // Obtenir toutes les synergies actives
  getActiveSynergies() {
    return this.activeSynergies;
  }

  // Obtenir les effets actifs
  getEffects() {
    return this.activeSynergies.map(s => s.effect);
  }

  // Vérifier si une synergie est active
  isSynergyActive(synergyId) {
    return this.activeSynergies.some(s => s.id === synergyId);
  }

  // Appliquer les effets au joueur (à appeler depuis le jeu)
  applyEffects(player) {
    for (const synergy of this.activeSynergies) {
      const effect = synergy.effect;

      switch (effect.type) {
      case 'explosion_radius':
        if (player.explosionRadius) {
          player.explosionRadius *= effect.multiplier;
        }
        break;

      case 'crit_pierce':
        if (player.critPierceBonus !== undefined) {
          player.critPierceBonus = (player.critPierceBonus || 0) + effect.bonus;
        }
        break;

      case 'lifesteal_thorns_boost':
        if (player.lifeSteal) {
          player.lifeSteal *= effect.multiplier;
        }
        if (player.thorns) {
          player.thorns *= effect.multiplier;
        }
        break;

      case 'extra_turret':
        if (player.turretCount !== undefined) {
          player.turretCount = (player.turretCount || 1) + effect.count;
        }
        break;

      case 'regen_speed':
        if (player.regeneration) {
          player.regeneration *= effect.multiplier;
        }
        break;

      case 'fire_rate':
        if (player.fireRateBonus !== undefined) {
          player.fireRateBonus = (player.fireRateBonus || 0) + effect.bonus;
        }
        break;

      case 'speed_dodge_boost':
        if (player.speed) {
          player.speed *= (1 + effect.speedBonus);
        }
        if (player.dodgeChance !== undefined) {
          player.dodgeChance = (player.dodgeChance || 0) + effect.dodgeBonus;
        }
        break;

      case 'glass_cannon':
        if (player.damage) {
          player.damage *= (1 + effect.damageBonus);
        }
        if (player.maxHealth) {
          player.maxHealth *= (1 - effect.healthPenalty);
        }
        break;

      case 'fortress':
        if (player.maxHealth) {
          player.maxHealth *= (1 + effect.healthBonus);
        }
        if (player.thorns) {
          player.thorns *= (1 + effect.thornsBonus);
        }
        break;

      case 'all_stats_boost':
        if (player.speed) {
          player.speed *= (1 + effect.bonus);
        }
        if (player.damage) {
          player.damage *= (1 + effect.bonus);
        }
        if (player.maxHealth) {
          player.maxHealth *= (1 + effect.bonus);
        }
        break;

        // Les autres effets seront gérés dans le code principal du jeu
      }
    }

    return player;
  }

  // Créer l'UI des synergies (panneau d'information)
  createSynergyUI() {
    const container = document.createElement('div');
    container.id = 'synergy-panel';
    container.className = 'synergy-panel';
    container.style.display = 'none';

    container.innerHTML = `
      <div class="synergy-panel-header">
        <h2>⚡ SYNERGIES</h2>
        <p class="synergy-subtitle">Combinez les upgrades pour des effets puissants!</p>
        <button class="synergy-close-btn">×</button>
      </div>
      <div class="synergy-panel-content">
        <div class="synergy-section">
          <h3>✨ Synergies Actives (${this.activeSynergies.length})</h3>
          <div class="synergy-list active">
            ${this.activeSynergies.length > 0 ? this.renderSynergyList(this.activeSynergies) : '<p class="empty">Aucune synergie active pour le moment</p>'}
          </div>
        </div>
        <div class="synergy-section">
          <h3>📖 Toutes les Synergies</h3>
          <div class="synergy-list all">
            ${this.renderSynergyList(this.synergies)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    container.querySelector('.synergy-close-btn').addEventListener('click', () => {
      container.style.display = 'none';
    });

    return container;
  }

  // Rendre la liste des synergies
  renderSynergyList(synergies) {
    return synergies.map(synergy => {
      const isActive = this.isSynergyActive(synergy.id);

      return `
        <div class="synergy-card ${isActive ? 'active' : 'inactive'} ${synergy.rarity}">
          <div class="synergy-card-icon">${synergy.icon}</div>
          <div class="synergy-card-content">
            <div class="synergy-card-name">${synergy.name}</div>
            <div class="synergy-card-desc">${synergy.description}</div>
            <div class="synergy-card-requirements">
              Nécessite: ${synergy.requires.map(r => this.getUpgradeName(r)).join(' + ')}
            </div>
          </div>
          <div class="synergy-card-rarity">${synergy.rarity.toUpperCase()}</div>
        </div>
      `;
    }).join('');
  }

  // Obtenir le nom d'un upgrade (mapping)
  getUpgradeName(upgradeId) {
    const names = {
      explosiveRounds: 'Balles Explosives',
      multishot: 'Tir Multiple',
      piercingBullets: 'Balles Perçantes',
      criticalStrike: 'Coup Critique',
      lifeSteal: 'Vol de Vie',
      thorns: 'Épines',
      autoTurret: 'Tourelle Auto',
      fireRate: 'Cadence de Tir',
      regeneration: 'Régénération',
      maxHealth: 'Vie Max',
      speed: 'Vitesse',
      dodge: 'Esquive',
      damage: 'Dégâts',
      goldMagnet: 'Aimant à Or'
    };

    return names[upgradeId] || upgradeId;
  }

  // Ouvrir le panneau
  openPanel() {
    const panel = document.getElementById('synergy-panel');
    if (panel) {
      panel.style.display = 'block';
      // Refresh l'affichage
      const activeList = panel.querySelector('.synergy-list.active');
      if (activeList) {
        activeList.innerHTML = this.activeSynergies.length > 0 ?
          this.renderSynergyList(this.activeSynergies) :
          '<p class="empty">Aucune synergie active pour le moment</p>';
      }
    }
  }
}

// Initialiser le système global
window.synergySystem = new SynergySystem();
