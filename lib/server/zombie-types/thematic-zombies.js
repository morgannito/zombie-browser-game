/**
 * THEMATIC ZOMBIE TYPES - Humanoids, Plants, Crystals, Cosmic,
 * War Machines, Aliens, Lovecraftian, Undead, Demons
 * @version 2.0.0
 */

// ===== Specialized Humanoids =====

const HUMANOID_ZOMBIES = {
  soldier: {
    name: 'Soldat Zombie',
    health: 160,
    speed: 2.0,
    damage: 26,
    xp: 34,
    gold: 24,
    size: 28,
    color: '#556b2f',
    tacticalAwareness: true,
    coverSeeker: true,
    grenadeThrow: true,
    grenadeCooldown: 8000
  },

  scientist: {
    name: 'Scientifique Zombie',
    health: 90,
    speed: 1.8,
    damage: 18,
    xp: 38,
    gold: 30,
    size: 26,
    color: '#ffffff',
    chemicalFlask: true,
    flaskCooldown: 6000,
    flaskDamage: 30,
    flaskRadius: 80
  },

  athlete: {
    name: 'Athlete Zombie',
    health: 110,
    speed: 3.8,
    damage: 20,
    xp: 28,
    gold: 20,
    size: 27,
    color: '#ff6347',
    stamina: true,
    sprintMultiplier: 1.5,
    sprintCooldown: 5000
  },

  chef: {
    name: 'Chef Zombie',
    health: 140,
    speed: 1.6,
    damage: 22,
    xp: 32,
    gold: 25,
    size: 30,
    color: '#fffafa',
    meatCleaver: true,
    cleaverDamage: 35,
    cookingFire: true,
    fireDamage: 8
  },

  ninja: {
    name: 'Ninja Zombie',
    health: 100,
    speed: 3.6,
    damage: 28,
    xp: 45,
    gold: 36,
    size: 25,
    color: '#2f2f2f',
    smokeBomb: true,
    smokeCooldown: 8000,
    shurikenThrow: true,
    shurikenDamage: 20
  }
};

// ===== Plants =====

const PLANT_ZOMBIES = {
  vineZombie: {
    name: 'Zombie Liane',
    health: 200,
    speed: 0.5,
    damage: 24,
    xp: 40,
    gold: 32,
    size: 34,
    color: '#228b22',
    rootedAttack: true,
    vineReach: 250,
    entangle: true,
    entangleDuration: 4000,
    thornDamage: 3
  },

  mushroomZombie: {
    name: 'Zombie Champignon',
    health: 120,
    speed: 1.4,
    damage: 16,
    xp: 34,
    gold: 26,
    size: 28,
    color: '#8b4789',
    sporeCloud: true,
    sporeRadius: 100,
    sporeDamage: 6,
    confusionEffect: true,
    sporeCooldown: 5000
  },

  treeant: {
    name: 'Treant Zombie',
    health: 500,
    speed: 0.8,
    damage: 42,
    xp: 78,
    gold: 62,
    size: 46,
    color: '#8b7355',
    isElite: true,
    rootSpikes: true,
    spikesDamage: 30,
    spikesRadius: 150,
    leafStorm: true,
    healingAura: 5
  }
};

// ===== Crystals & Minerals =====

const CRYSTAL_ZOMBIES = {
  crystalZombie: {
    name: 'Zombie Cristal',
    health: 240,
    speed: 1.6,
    damage: 30,
    xp: 50,
    gold: 40,
    size: 32,
    color: '#87ceeb',
    reflectDamage: 0.25,
    shardExplosion: true,
    shardDamage: 35,
    shardRadius: 120,
    energyBeam: true
  },

  obsidianGolem: {
    name: "Golem d'Obsidienne",
    health: 650,
    speed: 1.0,
    damage: 55,
    xp: 95,
    gold: 75,
    size: 48,
    color: '#000000',
    isElite: true,
    lavaCore: true,
    coreRadius: 80,
    coreDamage: 10,
    impervious: 0.5,
    rockSlam: true
  }
};

// ===== Cosmic =====

const COSMIC_ZOMBIES = {
  starborn: {
    name: 'Ne des Etoiles',
    health: 300,
    speed: 2.6,
    damage: 38,
    xp: 65,
    gold: 52,
    size: 34,
    color: '#ffd700',
    cosmicEnergy: true,
    energyBurst: true,
    burstCooldown: 7000,
    burstDamage: 40,
    burstRadius: 140,
    starfall: true
  },

  voidSpawn: {
    name: 'Progeniture du Vide',
    health: 220,
    speed: 2.8,
    damage: 34,
    xp: 56,
    gold: 44,
    size: 30,
    color: '#4b0082',
    voidTouch: true,
    touchDrain: 12,
    dimensionalRift: true,
    riftCooldown: 9000,
    riftDamage: 28
  },

  celestialGuardian: {
    name: 'Gardien Celeste',
    health: 450,
    speed: 2.0,
    damage: 46,
    xp: 88,
    gold: 70,
    size: 40,
    color: '#ffffff',
    isElite: true,
    divineWrath: true,
    wrathDamage: 55,
    wrathCooldown: 8000,
    holyLight: true,
    lightRadius: 180
  }
};

// ===== War Machines =====

const WAR_MACHINE_ZOMBIES = {
  tankZombie: {
    name: 'Char Zombie',
    health: 600,
    speed: 1.1,
    damage: 50,
    xp: 82,
    gold: 66,
    size: 50,
    color: '#696969',
    armorPlating: 0.6,
    cannonFire: true,
    cannonCooldown: 4000,
    cannonDamage: 70,
    cannonRadius: 90
  },

  helicopter: {
    name: 'Helico Zombie',
    health: 280,
    speed: 3.4,
    damage: 36,
    xp: 68,
    gold: 54,
    size: 36,
    color: '#808080',
    flying: true,
    minigunFire: true,
    gunDamage: 8,
    gunFireRate: 10,
    missileSalvo: true
  },

  submarine: {
    name: 'Sous-marin Zombie',
    health: 400,
    speed: 1.8,
    damage: 42,
    xp: 72,
    gold: 58,
    size: 42,
    color: '#2f4f4f',
    submerge: true,
    submergeDuration: 6000,
    torpedoLaunch: true,
    torpedoDamage: 60,
    torpedoCooldown: 7000
  }
};

module.exports = {
  HUMANOID_ZOMBIES,
  PLANT_ZOMBIES,
  CRYSTAL_ZOMBIES,
  COSMIC_ZOMBIES,
  WAR_MACHINE_ZOMBIES
};
