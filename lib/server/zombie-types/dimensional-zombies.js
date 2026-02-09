/**
 * DIMENSIONAL ZOMBIE TYPES - Void, Shadow, Time
 * @version 2.0.0
 */

const DIMENSIONAL_ZOMBIES = {
  voidwalker: {
    name: 'Marcheur du Vide',
    health: 150,
    speed: 2.8,
    damage: 26,
    xp: 48,
    gold: 38,
    size: 28,
    color: '#191970',
    isDimensional: true,
    phaseShift: true,
    phaseInterval: 6000,
    phaseDuration: 2000,
    voidAura: true,
    auraDamage: 4
  },

  shadowfiend: {
    name: 'Ombre Maudite',
    health: 130,
    speed: 3.2,
    damage: 22,
    xp: 40,
    gold: 32,
    size: 26,
    color: '#0d0d0d',
    isDimensional: true,
    invisible: true,
    revealRange: 100,
    backstabMultiplier: 2.0
  },

  timewraith: {
    name: 'Spectre Temporel',
    health: 180,
    speed: 2.0,
    damage: 30,
    xp: 58,
    gold: 46,
    size: 30,
    color: '#8a2be2',
    isDimensional: true,
    isElite: true,
    timeStop: true,
    slowRadius: 150,
    slowAmount: 0.6,
    rewindHealth: true,
    rewindThreshold: 0.2
  },

  dimensionBeast: {
    name: 'Bete Dimensionnelle',
    health: 400,
    speed: 2.2,
    damage: 44,
    xp: 72,
    gold: 58,
    size: 42,
    color: '#4b0082',
    isDimensional: true,
    isElite: true,
    portalSummon: true,
    portalCount: 2,
    portalCooldown: 12000,
    minionsPerPortal: 3
  }
};

module.exports = { DIMENSIONAL_ZOMBIES };
