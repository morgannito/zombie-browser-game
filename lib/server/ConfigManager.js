/**
 * CONFIG MANAGER - Configuration centralisée du jeu
 * Contient toutes les constantes, configurations d'armes, zombies, powerups, etc.
 * @version 1.0.0
 */

// Configuration générale du jeu
const CONFIG = {
  ROOM_WIDTH: 3000,
  ROOM_HEIGHT: 2400,
  WALL_THICKNESS: 40,
  PLAYER_SPEED: 5,
  PLAYER_SIZE: 20,
  ZOMBIE_SIZE: 25,
  ZOMBIE_SPAWN_INTERVAL: 1000,
  MAX_ZOMBIES: 50,
  BULLET_SPEED: 10,
  BULLET_DAMAGE: 34,
  BULLET_SIZE: 5,
  PLAYER_MAX_HEALTH: 100,
  POWERUP_SPAWN_INTERVAL: 15000,
  POWERUP_SIZE: 15,
  ZOMBIES_PER_ROOM: 25,
  LOOT_SIZE: 10,
  DOOR_WIDTH: 120,
  ROOMS_PER_RUN: 3
};

// Types d'armes
const WEAPONS = {
  pistol: {
    name: 'Pistolet',
    damage: 40,
    fireRate: 180,
    bulletSpeed: 14,
    bulletCount: 1,
    spread: 0,
    color: '#ffff00'
  },
  shotgun: {
    name: 'Shotgun',
    damage: 25,
    fireRate: 600,
    bulletSpeed: 11,
    bulletCount: 8,
    spread: 0.4,
    color: '#ff6600'
  },
  rifle: {
    name: 'Fusil d\'Assaut',
    damage: 30,
    fireRate: 120,
    bulletSpeed: 16,
    bulletCount: 1,
    spread: 0.05,
    color: '#00ff00'
  },
  sniper: {
    name: 'Sniper',
    damage: 120,
    fireRate: 1200,
    bulletSpeed: 25,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff'
  },
  minigun: {
    name: 'Minigun',
    damage: 12,
    fireRate: 80,
    bulletSpeed: 13,
    bulletCount: 1,
    spread: 0.2,
    color: '#ff00ff'
  },
  launcher: {
    name: 'Lance-Roquettes',
    damage: 80,
    fireRate: 1500,
    bulletSpeed: 8,
    bulletCount: 1,
    spread: 0,
    color: '#ff0000',
    explosionRadius: 120,
    explosionDamage: 60,
    hasExplosion: true
  },
  flamethrower: {
    name: 'Lance-Flammes',
    damage: 15,
    fireRate: 80,
    bulletSpeed: 7,
    bulletCount: 3,
    spread: 0.3,
    color: '#ff8800',
    lifetime: 500,
    isFlame: true
  },
  laser: {
    name: 'Laser',
    damage: 45,
    fireRate: 100,
    bulletSpeed: 30,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff',
    isLaser: true
  },
  grenadeLauncher: {
    name: 'Lance-Grenades',
    damage: 50,
    fireRate: 800,
    bulletSpeed: 10,
    bulletCount: 1,
    spread: 0,
    color: '#88ff00',
    explosionRadius: 100,
    explosionDamage: 40,
    gravity: 0.2,
    hasExplosion: true,
    isGrenade: true
  },
  crossbow: {
    name: 'Arbalète',
    damage: 90,
    fireRate: 900,
    bulletSpeed: 18,
    bulletCount: 1,
    spread: 0,
    color: '#8800ff',
    piercing: 2,
    isCrossbow: true
  }
};

// Types de power-ups
const POWERUP_TYPES = {
  health: {
    color: '#00ff00',
    effect: (player) => {
      player.health = Math.min(player.health + 50, player.maxHealth);
    }
  },
  speed: {
    color: '#00ffff',
    effect: (player) => {
      player.speedBoost = Date.now() + 10000; // 10 secondes
    }
  },
  shotgun: {
    color: '#ff6600',
    effect: (player) => {
      player.weapon = 'shotgun';
      player.weaponTimer = Date.now() + 30000; // 30 secondes
    }
  },
  rifle: {
    color: '#00ff00',
    effect: (player) => {
      player.weapon = 'rifle';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  sniper: {
    color: '#00ffff',
    effect: (player) => {
      player.weapon = 'sniper';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  minigun: {
    color: '#ff00ff',
    effect: (player) => {
      player.weapon = 'minigun';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  launcher: {
    color: '#ff0000',
    effect: (player) => {
      player.weapon = 'launcher';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  flamethrower: {
    color: '#ff8800',
    effect: (player) => {
      player.weapon = 'flamethrower';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  laser: {
    color: '#00ffff',
    effect: (player) => {
      player.weapon = 'laser';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  grenadeLauncher: {
    color: '#88ff00',
    effect: (player) => {
      player.weapon = 'grenadeLauncher';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  crossbow: {
    color: '#8800ff',
    effect: (player) => {
      player.weapon = 'crossbow';
      player.weaponTimer = Date.now() + 30000;
    }
  }
};

// Types de zombies
const ZOMBIE_TYPES = {
  normal: {
    name: 'Zombie Normal',
    health: 100,
    speed: 2,
    damage: 15,
    xp: 10,
    gold: 5,
    size: 25,
    color: '#00ff00'
  },
  fast: {
    name: 'Zombie Rapide',
    health: 60,
    speed: 4.5,
    damage: 12,
    xp: 15,
    gold: 8,
    size: 22,
    color: '#ffff00'
  },
  tank: {
    name: 'Zombie Tank',
    health: 300,
    speed: 1.2,
    damage: 30,
    xp: 30,
    gold: 20,
    size: 35,
    color: '#ff0000'
  },
  boss: {
    name: 'BOSS ZOMBIE',
    health: 2000,
    speed: 1.8,
    damage: 50,
    xp: 500,
    gold: 200,
    size: 60,
    color: '#ff00ff'
  },
  // Boss spéciaux tous les 25 vagues
  bossCharnier: {
    name: 'RAIIVY',
    health: 2500,
    speed: 1.5,
    damage: 60,
    xp: 1500,
    gold: 800,
    size: 70,
    color: '#8b0000',
    spawnCooldown: 10000, // Spawne zombies toutes les 10 secondes
    spawnCount: 3, // Nombre de zombies spawnés
    wave: 25
  },
  bossInfect: {
    name: 'SORENZA',
    health: 3500,
    speed: 2.0,
    damage: 70,
    xp: 2500,
    gold: 1200,
    size: 75,
    color: '#00ff00',
    toxicPoolCooldown: 3000, // Crée flaques toutes les 3 secondes
    toxicPoolDamage: 15,
    toxicPoolDuration: 8000,
    toxicPoolRadius: 60,
    wave: 50
  },
  bossColosse: {
    name: 'HAIER',
    health: 5000,
    speed: 1.2,
    damage: 80,
    xp: 4000,
    gold: 1800,
    size: 90,
    color: '#ff4500',
    enrageThreshold: 0.3, // S'enrage à 30% HP
    enrageSpeedMultiplier: 2.0,
    enrageDamageMultiplier: 1.5,
    wave: 75
  },
  bossRoi: {
    name: 'KUROI TO SUTA',
    health: 7500,
    speed: 1.8,
    damage: 100,
    xp: 6000,
    gold: 2500,
    size: 100,
    color: '#ffd700',
    // Multi-phases
    phase2Threshold: 0.66, // Phase 2 à 66% HP
    phase3Threshold: 0.33, // Phase 3 à 33% HP
    teleportCooldown: 8000,
    summonCooldown: 12000,
    wave: 100
  },
  bossOmega: {
    name: 'MORGANNITO',
    health: 12000,
    speed: 2.2,
    damage: 120,
    xp: 10000,
    gold: 5000,
    size: 110,
    color: '#ff00ff',
    // Boss final ultime - combine toutes les capacités
    phase2Threshold: 0.75,
    phase3Threshold: 0.50,
    phase4Threshold: 0.25,
    teleportCooldown: 6000,
    summonCooldown: 10000,
    toxicPoolCooldown: 4000,
    laserCooldown: 8000,
    wave: 130
  },
  healer: {
    name: 'Zombie Soigneur',
    health: 120,
    speed: 1.8,
    damage: 10,
    xp: 25,
    gold: 15,
    size: 28,
    color: '#00ffff',
    healAmount: 30,
    healRadius: 150,
    healCooldown: 3000
  },
  slower: {
    name: 'Zombie Ralentisseur',
    health: 90,
    speed: 2,
    damage: 12,
    xp: 20,
    gold: 12,
    size: 26,
    color: '#8888ff',
    slowRadius: 120,
    slowAmount: 0.5,
    slowDuration: 2000
  },
  shooter: {
    name: 'Zombie Tireur',
    health: 80,
    speed: 1.5,
    damage: 20,
    xp: 22,
    gold: 14,
    size: 24,
    color: '#ff8800',
    shootRange: 400,
    shootCooldown: 2000,
    bulletSpeed: 8,
    bulletColor: '#ff4400'
  },
  poison: {
    name: 'Zombie Poison',
    health: 110,
    speed: 2.2,
    damage: 18,
    xp: 28,
    gold: 18,
    size: 27,
    color: '#88ff00',
    poisonTrailInterval: 500,
    poisonDamage: 2,
    poisonDuration: 3000,
    poisonRadius: 35
  },
  explosive: {
    name: 'Zombie Explosif',
    health: 150,
    speed: 2.5,
    damage: 25,
    xp: 35,
    gold: 25,
    size: 30,
    color: '#ff00ff',
    explosionRadius: 150,
    explosionDamage: 80
  },
  teleporter: {
    name: 'Zombie Téléporteur',
    health: 95,
    speed: 2.8,
    damage: 16,
    xp: 32,
    gold: 22,
    size: 26,
    color: '#9900ff',
    teleportCooldown: 5000, // 5 secondes entre téléportations
    teleportRange: 200, // Distance max du joueur après téléportation
    teleportMinRange: 80 // Distance min du joueur après téléportation
  },
  summoner: {
    name: 'Zombie Invocateur',
    health: 140,
    speed: 1.4,
    damage: 14,
    xp: 45,
    gold: 30,
    size: 30,
    color: '#cc00ff',
    summonCooldown: 8000, // 8 secondes entre invocations
    summonRange: 100, // Rayon autour de l'invocateur
    minionsPerSummon: 2, // Nombre de mini-zombies par invocation
    maxMinions: 4 // Nombre max de minions actifs
  },
  shielded: {
    name: 'Zombie Bouclier',
    health: 180,
    speed: 1.6,
    damage: 22,
    xp: 38,
    gold: 26,
    size: 32,
    color: '#00ccff',
    frontDamageReduction: 0.5, // 50% de réduction de face
    shieldAngle: Math.PI / 2 // 90 degrés de couverture du bouclier
  },
  // Mini-zombie spawné par l'invocateur
  minion: {
    name: 'Mini-Zombie',
    health: 30,
    speed: 3.5,
    damage: 8,
    xp: 5,
    gold: 3,
    size: 18,
    color: '#ff99ff',
    isMinion: true // Flag pour identifier les minions
  }
};

// Upgrades de niveau
const LEVEL_UP_UPGRADES = {
  damageBoost: {
    id: 'damageBoost',
    name: '💥 Boost de Dégâts',
    description: '+15% de dégâts',
    rarity: 'common',
    effect: (player) => {
      player.damageMultiplier = (player.damageMultiplier || 1) * 1.15;
    }
  },
  healthBoost: {
    id: 'healthBoost',
    name: '❤️ Boost de Vie',
    description: '+20 PV max',
    rarity: 'common',
    effect: (player) => {
      player.maxHealth += 20;
      player.health = Math.min(player.health + 20, player.maxHealth);
    }
  },
  speedBoost: {
    id: 'speedBoost',
    name: '⚡ Boost de Vitesse',
    description: '+15% vitesse',
    rarity: 'common',
    effect: (player) => {
      player.speedMultiplier = (player.speedMultiplier || 1) * 1.15;
    }
  },
  fireRateBoost: {
    id: 'fireRateBoost',
    name: '🔫 Cadence de Tir',
    description: '+20% cadence de tir',
    rarity: 'common',
    effect: (player) => {
      player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.8;
    }
  },
  autoTurret: {
    id: 'autoTurret',
    name: '🔧 Tourelle Auto',
    description: '+1 tourelle automatique',
    rarity: 'rare',
    effect: (player) => {
      player.autoTurrets = (player.autoTurrets || 0) + 1;
    }
  },
  regeneration: {
    id: 'regeneration',
    name: '💚 Régénération',
    description: '+1 PV/sec',
    rarity: 'rare',
    effect: (player) => {
      player.regeneration = (player.regeneration || 0) + 1;
    }
  },
  bulletPiercing: {
    id: 'bulletPiercing',
    name: '🎯 Balles Perforantes',
    description: 'Les balles traversent 1 ennemi de plus',
    rarity: 'rare',
    effect: (player) => {
      player.bulletPiercing = (player.bulletPiercing || 0) + 1;
    }
  },
  lifeSteal: {
    id: 'lifeSteal',
    name: '🩸 Vol de Vie',
    description: '+5% de vol de vie sur dégâts',
    rarity: 'rare',
    effect: (player) => {
      player.lifeSteal = (player.lifeSteal || 0) + 0.05;
    }
  },
  criticalChance: {
    id: 'criticalChance',
    name: '💥 Coup Critique',
    description: '+10% chance de critique (x2 dégâts)',
    rarity: 'rare',
    effect: (player) => {
      player.criticalChance = (player.criticalChance || 0) + 0.10;
    }
  },
  goldMagnet: {
    id: 'goldMagnet',
    name: '💰 Aimant à Or',
    description: '+50% rayon de collecte',
    rarity: 'common',
    effect: (player) => {
      player.goldMagnetRadius = (player.goldMagnetRadius || 0) + 50;
    }
  },
  dodgeChance: {
    id: 'dodgeChance',
    name: '🌀 Esquive',
    description: '+10% chance d\'esquive',
    rarity: 'rare',
    effect: (player) => {
      player.dodgeChance = (player.dodgeChance || 0) + 0.10;
    }
  },
  explosiveRounds: {
    id: 'explosiveRounds',
    name: '💣 Balles Explosives',
    description: '+1 niveau de munitions explosives',
    rarity: 'legendary',
    effect: (player) => {
      player.explosiveRounds = (player.explosiveRounds || 0) + 1;
      player.explosionRadius = 60 + (player.explosiveRounds * 20);
      player.explosionDamagePercent = 0.3 + (player.explosiveRounds * 0.1);
    }
  },
  // CORRECTION: Ajout des upgrades manquants thorns et extraBullets
  thorns: {
    id: 'thorns',
    name: '🌵 Épines',
    description: 'Renvoie 30% des dégâts subis',
    rarity: 'rare',
    effect: (player) => {
      player.thorns = (player.thorns || 0) + 0.30;
    }
  },
  extraBullets: {
    id: 'extraBullets',
    name: '🔫 Balles Supplémentaires',
    description: '+1 balle par tir',
    rarity: 'rare',
    effect: (player) => {
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
      effect: (player) => {
        player.maxHealth += 20;
        player.health = Math.min(player.health + 20, player.maxHealth);
      }
    },
    damage: {
      name: 'Dégâts',
      description: '+10% dégâts',
      baseCost: 75,
      costIncrease: 35,
      maxLevel: 5,
      effect: (player) => {
        player.damageMultiplier = (player.damageMultiplier || 1) * 1.10;
      }
    },
    speed: {
      name: 'Vitesse',
      description: '+10% vitesse',
      baseCost: 60,
      costIncrease: 30,
      maxLevel: 5,
      effect: (player) => {
        player.speedMultiplier = (player.speedMultiplier || 1) * 1.10;
      }
    },
    fireRate: {
      name: 'Cadence de Tir',
      description: '+15% cadence',
      baseCost: 80,
      costIncrease: 40,
      maxLevel: 5,
      effect: (player) => {
        player.fireRateMultiplier = (player.fireRateMultiplier || 1) * 0.85;
      }
    }
  },
  temporary: {
    fullHeal: {
      name: 'Soin Complet',
      description: 'Restaure toute la vie',
      cost: 30,
      effect: (player) => {
        player.health = player.maxHealth;
      }
    },
    shotgun: {
      name: 'Shotgun',
      description: 'Shotgun pour 1 salle',
      cost: 40,
      effect: (player) => {
        player.weapon = 'shotgun';
        player.weaponTimer = null; // Permanent jusqu'à la fin de la salle
      }
    },
    minigun: {
      name: 'Minigun',
      description: 'Minigun pour 1 salle',
      cost: 50,
      effect: (player) => {
        player.weapon = 'minigun';
        player.weaponTimer = null;
      }
    },
    speedBoost: {
      name: 'Boost de Vitesse',
      description: 'x2 vitesse pour 1 salle',
      cost: 35,
      effect: (player) => {
        player.speedBoost = Infinity; // Permanent jusqu'à la fin de la salle
      }
    }
  }
};

// Constantes diverses
const INACTIVITY_TIMEOUT = 120000;
const HEARTBEAT_CHECK_INTERVAL = 15000;

module.exports = {
  CONFIG,
  WEAPONS,
  POWERUP_TYPES,
  ZOMBIE_TYPES,
  LEVEL_UP_UPGRADES,
  SHOP_ITEMS,
  INACTIVITY_TIMEOUT,
  HEARTBEAT_CHECK_INTERVAL
};
