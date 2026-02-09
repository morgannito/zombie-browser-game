/**
 * CREATURE ZOMBIE TYPES - Animals, Mythological, Aquatic, Insects
 * @version 2.0.0
 */

// ===== Mutant Animals =====

const ANIMAL_ZOMBIES = {
  hound: {
    name: 'Chien Zombie',
    health: 70,
    speed: 4.2,
    damage: 16,
    xp: 18,
    gold: 12,
    size: 20,
    color: '#8b4513',
    packHunter: true,
    packBonus: 0.2
  },

  raven: {
    name: 'Corbeau Zombie',
    health: 40,
    speed: 5.0,
    damage: 10,
    xp: 15,
    gold: 10,
    size: 16,
    color: '#000000',
    flying: true,
    diveBombCooldown: 3000,
    diveBombDamage: 25
  },

  rat: {
    name: 'Rat Zombie',
    health: 25,
    speed: 4.5,
    damage: 6,
    xp: 8,
    gold: 5,
    size: 14,
    color: '#696969',
    swarm: true,
    swarmSize: 5,
    diseaseCarrier: true
  },

  spider: {
    name: 'Araignee Zombie',
    health: 60,
    speed: 3.0,
    damage: 12,
    xp: 20,
    gold: 14,
    size: 22,
    color: '#8b0000',
    webShot: true,
    webCooldown: 5000,
    webDuration: 3000,
    wallCrawler: true
  },

  bear: {
    name: 'Ours Zombie',
    health: 450,
    speed: 1.5,
    damage: 48,
    xp: 65,
    gold: 50,
    size: 44,
    color: '#a0522d',
    mauling: true,
    maulDamage: 70,
    roarSlow: true,
    roarRadius: 120
  }
};

// ===== Mythological Creatures =====

const MYTHOLOGICAL_ZOMBIES = {
  vampire: {
    name: 'Vampire Zombie',
    health: 200,
    speed: 2.8,
    damage: 32,
    xp: 55,
    gold: 45,
    size: 30,
    color: '#8b0000',
    lifeSteal: 0.4,
    batForm: true,
    batFormSpeed: 4.5,
    hypnosis: true,
    hypnosisCooldown: 10000
  },

  werewolf: {
    name: 'Loup-Garou Zombie',
    health: 280,
    speed: 3.2,
    damage: 40,
    xp: 68,
    gold: 54,
    size: 36,
    color: '#8b4513',
    transform: true,
    fullMoonBonus: 1.5,
    howl: true,
    howlRadius: 200
  },

  mummy: {
    name: 'Momie Zombie',
    health: 220,
    speed: 1.2,
    damage: 28,
    xp: 48,
    gold: 40,
    size: 32,
    color: '#daa520',
    curseOfPharaoh: true,
    curseSlow: 0.4,
    bandageRegen: 3,
    sandstorm: true
  },

  skeleton: {
    name: 'Squelette Zombie',
    health: 80,
    speed: 2.6,
    damage: 22,
    xp: 26,
    gold: 18,
    size: 26,
    color: '#f5f5dc',
    boneArmor: 0.2,
    reassemble: true,
    reassembleTime: 5000
  },

  ghost: {
    name: 'Fantome Zombie',
    health: 100,
    speed: 2.4,
    damage: 24,
    xp: 42,
    gold: 34,
    size: 28,
    color: '#f0f8ff',
    ethereal: true,
    possessionChance: 0.1,
    phaseThrough: true
  }
};

// ===== Aquatic =====

const AQUATIC_ZOMBIES = {
  abyssalHorror: {
    name: 'Horreur des Abysses',
    health: 260,
    speed: 1.8,
    damage: 36,
    xp: 58,
    gold: 46,
    size: 38,
    color: '#000080',
    tentacleGrab: true,
    grabRange: 100,
    grabDuration: 2000,
    waterSlick: true,
    slickRadius: 90
  },

  leviathan: {
    name: 'Leviathan Zombie',
    health: 800,
    speed: 1.4,
    damage: 60,
    xp: 110,
    gold: 88,
    size: 52,
    color: '#1e90ff',
    isElite: true,
    tidalWave: true,
    waveCooldown: 12000,
    waveDamage: 45,
    waveRadius: 300,
    deepSeaPressure: true
  }
};

// ===== Insects =====

const INSECT_ZOMBIES = {
  locustsSwarm: {
    name: 'Essaim de Sauterelles',
    health: 150,
    speed: 2.2,
    damage: 18,
    xp: 36,
    gold: 28,
    size: 40,
    color: '#9acd32',
    swarmMechanic: true,
    devourFlesh: 4,
    blockVision: true,
    splitOnDeath: 5
  },

  mantis: {
    name: 'Mante Zombie',
    health: 140,
    speed: 3.0,
    damage: 34,
    xp: 44,
    gold: 35,
    size: 30,
    color: '#adff2f',
    bladedArms: true,
    slashDamage: 45,
    camouflage: true,
    ambushBonus: 2.0
  },

  scorpion: {
    name: 'Scorpion Zombie',
    health: 180,
    speed: 2.4,
    damage: 28,
    xp: 46,
    gold: 37,
    size: 32,
    color: '#8b4500',
    poisonSting: true,
    stingDamage: 22,
    poisonDoT: 5,
    poisonDuration: 6000,
    tailWhip: true
  }
};

module.exports = {
  ANIMAL_ZOMBIES,
  MYTHOLOGICAL_ZOMBIES,
  AQUATIC_ZOMBIES,
  INSECT_ZOMBIES
};
