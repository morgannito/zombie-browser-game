/**
 * DARK ZOMBIE TYPES - Aliens, Lovecraftian, Undead, Demons
 * @version 2.0.0
 */

// ===== Aliens =====

const ALIEN_ZOMBIES = {
  greyAlien: {
    name: 'Alien Gris Zombie',
    health: 160,
    speed: 2.4,
    damage: 28,
    xp: 48,
    gold: 38,
    size: 28,
    color: '#c0c0c0',
    mindControl: true,
    controlDuration: 3000,
    abductionBeam: true,
    beamCooldown: 10000,
    telekinesis: true
  },

  xenomorph: {
    name: 'Xenomorphe Zombie',
    health: 240,
    speed: 3.6,
    damage: 44,
    xp: 76,
    gold: 60,
    size: 32,
    color: '#000000',
    acidBlood: true,
    acidDamage: 15,
    acidRadius: 60,
    wallCrawler: true,
    innerJaw: true,
    jawDamage: 60
  },

  saucer: {
    name: 'Soucoupe Zombie',
    health: 320,
    speed: 2.8,
    damage: 38,
    xp: 70,
    gold: 56,
    size: 38,
    color: '#00ff00',
    flying: true,
    laserBeam: true,
    beamDamage: 32,
    beamCooldown: 3000,
    gravityWell: true,
    wellRadius: 150
  }
};

// ===== Lovecraftian Horrors =====

const LOVECRAFTIAN_ZOMBIES = {
  shoggoth: {
    name: 'Shoggoth',
    health: 550,
    speed: 1.6,
    damage: 48,
    xp: 98,
    gold: 78,
    size: 46,
    color: '#4b5320',
    isElite: true,
    formless: true,
    absorb: true,
    absorbHealthGain: 50,
    tentacleSlam: true,
    slamRadius: 160
  },

  deepOne: {
    name: 'Habitant des Profondeurs',
    health: 280,
    speed: 2.2,
    damage: 36,
    xp: 62,
    gold: 50,
    size: 34,
    color: '#2f4f4f',
    aquatic: true,
    tridentStrike: true,
    strikeDamage: 50,
    callOfCthulhu: true,
    callCooldown: 15000
  },

  elderThing: {
    name: 'Chose Ancienne',
    health: 400,
    speed: 1.8,
    damage: 42,
    xp: 84,
    gold: 68,
    size: 40,
    color: '#663399',
    isElite: true,
    madnessAura: true,
    auraRadius: 160,
    confusionChance: 0.3,
    anciententKnowledge: true,
    teleportCooldown: 8000
  }
};

// ===== Special Undead =====

const UNDEAD_ZOMBIES = {
  lich: {
    name: 'Liche',
    health: 380,
    speed: 1.4,
    damage: 40,
    xp: 92,
    gold: 74,
    size: 36,
    color: '#800080',
    isElite: true,
    necromancy: true,
    raiseDeadCooldown: 10000,
    undeadServants: 4,
    darkMagic: true,
    spellDamage: 45,
    phylactery: true
  },

  revenant: {
    name: 'Revenant',
    health: 260,
    speed: 2.4,
    damage: 38,
    xp: 64,
    gold: 52,
    size: 32,
    color: '#696969',
    vengeance: true,
    vengeanceMultiplier: 2.0,
    vengeanceThreshold: 0.25,
    spiritForm: true,
    formCooldown: 12000
  },

  wraith: {
    name: 'Spectre',
    health: 180,
    speed: 3.0,
    damage: 32,
    xp: 54,
    gold: 44,
    size: 28,
    color: '#e6e6fa',
    incorporeal: true,
    lifeTouch: true,
    touchDrain: 18,
    wailOfDeath: true,
    wailDamage: 25,
    wailRadius: 120
  },

  boneLord: {
    name: 'Seigneur des Os',
    health: 420,
    speed: 1.6,
    damage: 46,
    xp: 86,
    gold: 70,
    size: 38,
    color: '#f5f5dc',
    isElite: true,
    boneShield: true,
    shieldHealth: 200,
    boneSpear: true,
    spearDamage: 55,
    spearCooldown: 5000,
    skeletonArmy: true
  }
};

// ===== Demons =====

const DEMON_ZOMBIES = {
  imp: {
    name: 'Diablotin Zombie',
    health: 90,
    speed: 3.4,
    damage: 20,
    xp: 30,
    gold: 22,
    size: 22,
    color: '#ff4500',
    flying: true,
    fireball: true,
    fireballDamage: 28,
    fireballCooldown: 3000,
    blink: true,
    blinkCooldown: 6000
  },

  hellhound: {
    name: 'Cerbere Zombie',
    health: 200,
    speed: 3.8,
    damage: 36,
    xp: 58,
    gold: 46,
    size: 32,
    color: '#8b0000',
    fireBreath: true,
    breathDamage: 30,
    breathRadius: 100,
    breathCooldown: 5000,
    packAlpha: true
  },

  demon: {
    name: 'Demon Zombie',
    health: 460,
    speed: 2.0,
    damage: 52,
    xp: 96,
    gold: 76,
    size: 42,
    color: '#dc143c',
    isElite: true,
    hellfire: true,
    fireDamage: 40,
    fireRadius: 140,
    demonicPower: 1.5,
    corruption: true
  },

  archdevil: {
    name: 'Archidiable',
    health: 700,
    speed: 2.2,
    damage: 70,
    xp: 130,
    gold: 105,
    size: 50,
    color: '#8b0000',
    isElite: true,
    infernalLord: true,
    soulSteal: true,
    stealAmount: 25,
    hellgatePortal: true,
    portalCooldown: 15000,
    demonSummonCount: 6
  }
};

module.exports = {
  ALIEN_ZOMBIES,
  LOVECRAFTIAN_ZOMBIES,
  UNDEAD_ZOMBIES,
  DEMON_ZOMBIES
};
