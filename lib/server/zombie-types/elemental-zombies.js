/**
 * ELEMENTAL ZOMBIE TYPES - Fire, Ice, Lightning, Earth, Wind
 * @version 2.0.0
 */

const ELEMENTAL_ZOMBIES = {
  inferno: {
    name: 'Zombie Inferno',
    health: 140,
    speed: 2.3,
    damage: 22,
    xp: 32,
    gold: 20,
    size: 28,
    color: '#ff4500',
    isElemental: true,
    element: 'fire',
    burnDamage: 3,
    burnDuration: 4000,
    fireAuraRadius: 60
  },

  glacier: {
    name: 'Zombie Glacier',
    health: 180,
    speed: 1.3,
    damage: 18,
    xp: 28,
    gold: 18,
    size: 30,
    color: '#87ceeb',
    isElemental: true,
    element: 'ice',
    freezeOnHit: true,
    freezeDuration: 1500,
    iceArmorReduction: 0.3
  },

  thunderstorm: {
    name: 'Zombie Tempete',
    health: 120,
    speed: 2.6,
    damage: 24,
    xp: 35,
    gold: 22,
    size: 26,
    color: '#4169e1',
    isElemental: true,
    element: 'lightning',
    shockChance: 0.25,
    shockDuration: 500,
    lightningChainRange: 150
  },

  boulder: {
    name: 'Zombie Rocher',
    health: 400,
    speed: 0.8,
    damage: 40,
    xp: 45,
    gold: 30,
    size: 38,
    color: '#8b7355',
    isElemental: true,
    element: 'earth',
    earthquakeDamage: 15,
    earthquakeRadius: 100,
    earthquakeCooldown: 3000
  },

  tornado: {
    name: 'Zombie Tornade',
    health: 100,
    speed: 3.5,
    damage: 16,
    xp: 30,
    gold: 19,
    size: 24,
    color: '#b0e0e6',
    isElemental: true,
    element: 'wind',
    pushbackForce: 5,
    pushbackRadius: 80
  }
};

module.exports = { ELEMENTAL_ZOMBIES };
