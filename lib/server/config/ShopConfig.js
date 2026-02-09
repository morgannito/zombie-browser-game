/**
 * SHOP CONFIG - Items du shop et upgrades de niveau
 * @version 1.0.0
 */

// Upgrades de niveau
const LEVEL_UP_UPGRADES = {
  damageBoost: {
    id: 'damageBoost',
    name: 'Boost de Degats',
    description: '+15% de degats',
    rarity: 'common',
    effect: player => {
      player.damageMultiplier = (player.damageMultiplier || 1) * 1.15;
    }
  },
  healthBoost: {
    id: 'healthBoost',
    name: 'Boost de Vie',
    description: '+20 PV max',
    rarity: 'common',
    effect: player => {
      player.maxHealth += 20;
      player.health = Math.min(player.health + 20, player.maxHealth);
    }
  },
  speedBoost: {
    id: 'speedBoost',
    name: 'Boost de Vitesse',
    description: '+15% vitesse',
    rarity: 'common',
    effect: player => {
      player.speedMultiplier = (player.speedMultiplier || 1) * 1.15;
    }
  },
  fireRateBoost: {
    id: 'fireRateBoost',
    name: 'Cadence de Tir',
    description: '+20% cadence de tir',
    rarity: 'common',
    effect: player => {
      player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.8;
    }
  },
  autoTurret: {
    id: 'autoTurret',
    name: 'Tourelle Auto',
    description: '+1 tourelle automatique',
    rarity: 'rare',
    effect: player => {
      player.autoTurrets = (player.autoTurrets || 0) + 1;
    }
  },
  regeneration: {
    id: 'regeneration',
    name: 'Regeneration',
    description: '+1 PV/sec',
    rarity: 'rare',
    effect: player => {
      player.regeneration = (player.regeneration || 0) + 1;
    }
  },
  bulletPiercing: {
    id: 'bulletPiercing',
    name: 'Balles Perforantes',
    description: 'Les balles traversent 1 ennemi de plus',
    rarity: 'rare',
    effect: player => {
      player.bulletPiercing = (player.bulletPiercing || 0) + 1;
    }
  },
  lifeSteal: {
    id: 'lifeSteal',
    name: 'Vol de Vie',
    description: '+5% de vol de vie sur degats',
    rarity: 'rare',
    effect: player => {
      player.lifeSteal = (player.lifeSteal || 0) + 0.05;
    }
  },
  criticalChance: {
    id: 'criticalChance',
    name: 'Coup Critique',
    description: '+10% chance de critique (x2 degats)',
    rarity: 'rare',
    effect: player => {
      player.criticalChance = (player.criticalChance || 0) + 0.1;
    }
  },
  goldMagnet: {
    id: 'goldMagnet',
    name: 'Aimant a Or',
    description: '+50% rayon de collecte',
    rarity: 'common',
    effect: player => {
      player.goldMagnetRadius = (player.goldMagnetRadius || 0) + 50;
    }
  },
  dodgeChance: {
    id: 'dodgeChance',
    name: 'Esquive',
    description: "+10% chance d'esquive",
    rarity: 'rare',
    effect: player => {
      player.dodgeChance = (player.dodgeChance || 0) + 0.1;
    }
  },
  explosiveRounds: {
    id: 'explosiveRounds',
    name: 'Balles Explosives',
    description: '+1 niveau de munitions explosives',
    rarity: 'legendary',
    effect: player => {
      player.explosiveRounds = (player.explosiveRounds || 0) + 1;
      player.explosionRadius = 60 + player.explosiveRounds * 20;
      player.explosionDamagePercent = 0.3 + player.explosiveRounds * 0.1;
    }
  },
  thorns: {
    id: 'thorns',
    name: 'Epines',
    description: 'Renvoie 30% des degats subis',
    rarity: 'rare',
    effect: player => {
      player.thorns = (player.thorns || 0) + 0.3;
    }
  },
  extraBullets: {
    id: 'extraBullets',
    name: 'Balles Supplementaires',
    description: '+1 balle par tir',
    rarity: 'rare',
    effect: player => {
      player.extraBullets = (player.extraBullets || 0) + 1;
    }
  }
};

// Objets de la boutique
const SHOP_ITEMS = {
  permanent: {
    maxHealth: {
      name: 'PV Maximum',
      description: '+20 PV max',
      baseCost: 50,
      costIncrease: 25,
      maxLevel: 10,
      effect: player => {
        player.maxHealth += 20;
        player.health = Math.min(player.health + 20, player.maxHealth);
      }
    },
    damage: {
      name: 'Degats',
      description: '+10% degats',
      baseCost: 75,
      costIncrease: 35,
      maxLevel: 5,
      effect: player => {
        player.damageMultiplier = (player.damageMultiplier || 1) * 1.1;
      }
    },
    speed: {
      name: 'Vitesse',
      description: '+10% vitesse',
      baseCost: 60,
      costIncrease: 30,
      maxLevel: 5,
      effect: player => {
        player.speedMultiplier = (player.speedMultiplier || 1) * 1.1;
      }
    },
    fireRate: {
      name: 'Cadence de Tir',
      description: '+15% cadence',
      baseCost: 80,
      costIncrease: 40,
      maxLevel: 5,
      effect: player => {
        player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.85;
      }
    }
  },
  temporary: {
    fullHeal: {
      name: 'Soin Complet',
      description: 'Restaure toute la vie',
      cost: 30,
      effect: player => {
        player.health = player.maxHealth;
      }
    },
    shotgun: {
      name: 'Shotgun',
      description: 'Shotgun pour 1 salle',
      cost: 40,
      effect: player => {
        player.weapon = 'shotgun';
        player.weaponTimer = null;
      }
    },
    minigun: {
      name: 'Minigun',
      description: 'Minigun pour 1 salle',
      cost: 50,
      effect: player => {
        player.weapon = 'minigun';
        player.weaponTimer = null;
      }
    },
    speedBoost: {
      name: 'Boost de Vitesse',
      description: 'x2 vitesse pour 1 salle',
      cost: 35,
      effect: player => {
        player.speedBoost = Infinity;
      }
    }
  }
};

module.exports = { LEVEL_UP_UPGRADES, SHOP_ITEMS };
