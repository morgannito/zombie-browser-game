/**
 * MECHANICAL ZOMBIE TYPES - Cyborg/Robot Zombies
 * @version 2.0.0
 */

const MECHANICAL_ZOMBIES = {
  cyborg: {
    name: 'Zombie Cyborg',
    health: 200,
    speed: 2.4,
    damage: 28,
    xp: 42,
    gold: 28,
    size: 29,
    color: '#708090',
    isMechanical: true,
    armorPlating: 0.25,
    overchargeMode: true,
    overchargeMultiplier: 1.5
  },

  drone: {
    name: 'Drone Zombie',
    health: 80,
    speed: 3.8,
    damage: 18,
    xp: 28,
    gold: 20,
    size: 20,
    color: '#4682b4',
    isMechanical: true,
    flying: true,
    scanRadius: 500,
    homingMissiles: true,
    missileDamage: 25,
    missileCooldown: 4000
  },

  turret: {
    name: 'Tourelle Zombie',
    health: 180,
    speed: 0,
    damage: 32,
    xp: 38,
    gold: 30,
    size: 35,
    color: '#2f4f4f',
    isMechanical: true,
    stationary: true,
    autoAim: true,
    shootRange: 600,
    shootCooldown: 1500,
    bulletSpeed: 10
  },

  mech: {
    name: 'Zombie Mech',
    health: 450,
    speed: 1.4,
    damage: 42,
    xp: 68,
    gold: 55,
    size: 45,
    color: '#696969',
    isMechanical: true,
    isElite: true,
    energyShield: true,
    shieldHealth: 200,
    shieldRegenRate: 5
  },

  sentinel: {
    name: 'Sentinelle',
    health: 320,
    speed: 1.8,
    damage: 36,
    xp: 52,
    gold: 42,
    size: 36,
    color: '#778899',
    isMechanical: true,
    laserSight: true,
    precisionShot: true,
    critMultiplier: 2.5
  }
};

module.exports = { MECHANICAL_ZOMBIES };
