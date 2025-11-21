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
  },
  chainLightning: {
    name: 'Fusil Éclair',
    damage: 55,
    fireRate: 700,
    bulletSpeed: 20,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff',
    isChainLightning: true,
    chainMaxJumps: 4, // Saute sur 4 ennemis max
    chainRange: 200, // Distance max entre zombies pour le saut
    chainDamageReduction: 0.7 // Chaque saut fait 70% des dégâts précédents
  },
  poisonDart: {
    name: 'Fléchettes Toxiques',
    damage: 35,
    fireRate: 450,
    bulletSpeed: 16,
    bulletCount: 1,
    spread: 0,
    color: '#88ff00',
    isPoisonDart: true,
    poisonDamage: 3, // Dégâts par tick (500ms)
    poisonDuration: 5000, // 5 secondes de poison
    poisonSpreadRadius: 100, // Rayon de propagation du poison aux autres zombies
    poisonSpreadChance: 0.3 // 30% de chance de propager le poison
  },
  teslaCoil: {
    name: 'Bobine Tesla',
    damage: 8,
    fireRate: 100,
    bulletSpeed: 0, // Pas de projectile
    bulletCount: 1,
    spread: 0,
    color: '#00ccff',
    isTeslaCoil: true,
    teslaRange: 250, // Portée de la zone électrique
    teslaMaxTargets: 5, // Nombre max d'ennemis affectés simultanément
    teslaChainDelay: 50 // Délai entre chaque arc électrique (ms)
  },
  iceCannon: {
    name: 'Canon de Glace',
    damage: 65,
    fireRate: 850,
    bulletSpeed: 12,
    bulletCount: 1,
    spread: 0,
    color: '#aaddff',
    isIceCannon: true,
    slowAmount: 0.5, // Ralentit de 50%
    slowDuration: 3000, // 3 secondes de ralentissement
    freezeChance: 0.15, // 15% de chance de freeze complet (immobilise 2s)
    freezeDuration: 2000,
    iceExplosionRadius: 80 // Rayon de l'effet de glace autour de l'impact
  },
  plasmaRifle: {
    name: 'Fusil Plasma',
    damage: 48,
    fireRate: 200,
    bulletSpeed: 22,
    bulletCount: 1,
    spread: 0.02,
    color: '#ff00ff',
    isPlasmaRifle: true,
    ignoresWalls: true, // Traverse les obstacles
    plasmaTrailInterval: 10, // Créer des particules tous les 10px
    plasmaPiercing: 3 // Traverse 3 ennemis de base
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
  },
  chainLightning: {
    color: '#00ffff',
    effect: (player) => {
      player.weapon = 'chainLightning';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  poisonDart: {
    color: '#88ff00',
    effect: (player) => {
      player.weapon = 'poisonDart';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  teslaCoil: {
    color: '#00ccff',
    effect: (player) => {
      player.weapon = 'teslaCoil';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  iceCannon: {
    color: '#aaddff',
    effect: (player) => {
      player.weapon = 'iceCannon';
      player.weaponTimer = Date.now() + 30000;
    }
  },
  plasmaRifle: {
    color: '#ff00ff',
    effect: (player) => {
      player.weapon = 'plasmaRifle';
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
    // Aura de mort passive
    deathAuraRadius: 80, // Rayon de l'aura
    deathAuraDamage: 5, // Dégâts par seconde
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
    // Bouclier pré-rage
    shieldDamageReduction: 0.8, // 80% de réduction avant rage
    shieldColor: '#00ccff',
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
    // Clones (Phase 3)
    cloneCooldown: 30000, // 30 secondes entre invocations de clones
    cloneCount: 2, // Nombre de clones créés
    cloneHealth: 500, // HP des clones
    cloneDuration: 30000, // 30 secondes de vie
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
    // Laser (Phase 4)
    laserCooldown: 8000,
    laserDamage: 50, // Dégâts instantanés
    laserRange: 800, // Portée du laser
    laserWidth: 20, // Largeur du laser
    laserDuration: 1000, // Durée du laser (ms)
    laserColor: '#00ffff',
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
  berserker: {
    name: 'Zombie Berserker',
    health: 200,
    speed: 2.5,
    damage: 20,
    xp: 40,
    gold: 28,
    size: 30,
    color: '#ff6600',
    // Rage mechanics
    rageThreshold: 0.5, // Entre en rage à 50% HP
    extremeRageThreshold: 0.25, // Rage extrême à 25% HP
    rageSpeedMultiplier: 1.5, // x1.5 vitesse en rage
    rageDamageMultiplier: 1.3, // x1.3 dégâts en rage
    extremeRageSpeedMultiplier: 2.0, // x2 vitesse en rage extrême
    extremeRageDamageMultiplier: 1.6, // x1.6 dégâts en rage extrême
    dashCooldown: 5000, // 5 secondes entre chaque dash
    dashSpeed: 8, // Vitesse du dash
    dashDuration: 300, // Durée du dash en ms
    rageColor: '#ff0000' // Rouge en rage
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
  },
  // ZOMBIES ÉLITES (Mini-Boss)
  necromancer: {
    name: 'Nécromancien',
    health: 250,
    speed: 1.4,
    damage: 18,
    xp: 60,
    gold: 40,
    size: 32,
    color: '#663399',
    isElite: true,
    resurrectCooldown: 8000, // 8 secondes entre chaque résurrection
    resurrectRange: 300, // Rayon de détection des zombies morts
    resurrectMaxTargets: 2, // Nombre max de zombies ressuscités par cast
    resurrectHealthPercent: 0.4, // Les zombies ressuscitent avec 40% HP
    auraColor: '#9966cc' // Couleur de l'aura nécromantique
  },
  brute: {
    name: 'Brute',
    health: 350,
    speed: 1.8,
    damage: 35,
    xp: 70,
    gold: 50,
    size: 38,
    color: '#cc3300',
    isElite: true,
    chargeCooldown: 6000, // 6 secondes entre chaque charge
    chargeRange: 500, // Distance max pour déclencher une charge
    chargeSpeed: 12, // Vitesse pendant la charge
    chargeDuration: 1500, // Durée de la charge (1.5s)
    stunDuration: 1500, // Durée du stun (1.5s)
    stunRadius: 50, // Rayon d'impact du stun
    chargeColor: '#ff4400' // Couleur pendant la charge
  },
  mimic: {
    name: 'Mimic',
    health: 180,
    speed: 3.0,
    damage: 28,
    xp: 55,
    gold: 45,
    size: 12, // Petit comme un loot quand déguisé
    color: '#ffaa00',
    isElite: true,
    disguisedSize: 12, // Taille en mode déguisé
    revealedSize: 30, // Taille en mode révélé
    revealRange: 150, // Distance à laquelle il se révèle
    ambushDamageMultiplier: 2.0, // x2 dégâts sur la première attaque
    disguiseColor: '#ffdd00', // Couleur en mode déguisé (comme de l'or)
    revealedColor: '#ff6600' // Couleur après révélation
  },
  splitter: {
    name: 'Splitter',
    health: 220,
    speed: 2.2,
    damage: 20,
    xp: 65,
    gold: 55,
    size: 30,
    color: '#00cc99',
    isElite: true,
    splitCount: 3, // Se divise en 3 mini-zombies
    splitHealthPercent: 0.3, // Chaque split a 30% des HP du splitter
    splitSpeedMultiplier: 1.5, // Les splits sont 1.5x plus rapides
    splitDamageMultiplier: 0.5, // Les splits font 50% des dégâts
    splitSize: 18, // Taille des splits
    splitColor: '#00ffaa', // Couleur des splits
    splitExplosionRadius: 100 // Rayon de l'explosion lors du split
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
