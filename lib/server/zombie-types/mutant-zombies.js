/**
 * MUTANT ZOMBIE TYPES - Genetic Experiments
 * @version 2.0.0
 */

const MUTANT_ZOMBIES = {
  abomination: {
    name: 'Abomination',
    health: 350,
    speed: 1.6,
    damage: 38,
    xp: 55,
    gold: 40,
    size: 42,
    color: '#556b2f',
    isMutant: true,
    toxicBloodSplash: true,
    splashRadius: 120,
    splashDamage: 20
  },

  chimera: {
    name: 'Chimere',
    health: 280,
    speed: 2.0,
    damage: 30,
    xp: 50,
    gold: 35,
    size: 35,
    color: '#8b4789',
    isMutant: true,
    shapeshift: true,
    shapeshiftCooldown: 5000,
    formsCount: 3
  },

  parasite: {
    name: 'Zombie Parasite',
    health: 90,
    speed: 3.2,
    damage: 14,
    xp: 26,
    gold: 16,
    size: 22,
    color: '#9370db',
    isMutant: true,
    leechHealth: 10,
    infestChance: 0.15,
    infestDamage: 2,
    infestDuration: 6000
  },

  hydra: {
    name: 'Zombie Hydre',
    health: 220,
    speed: 1.8,
    damage: 26,
    xp: 60,
    gold: 45,
    size: 32,
    color: '#228b22',
    isMutant: true,
    isElite: true,
    regeneration: 5,
    multihead: true,
    headCount: 3
  },

  titan: {
    name: 'Zombie Titan',
    health: 600,
    speed: 1.0,
    damage: 50,
    xp: 75,
    gold: 60,
    size: 50,
    color: '#cd853f',
    isMutant: true,
    isElite: true,
    groundSlam: true,
    slamRadius: 150,
    slamDamage: 35,
    slamCooldown: 8000
  }
};

module.exports = { MUTANT_ZOMBIES };
