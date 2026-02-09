/**
 * WEAPON CONFIG - Definitions de toutes les armes du jeu
 * @version 1.0.0
 */

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
    name: "Fusil d'Assaut",
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
    name: 'Arbalete',
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
    name: 'Fusil Eclair',
    damage: 55,
    fireRate: 700,
    bulletSpeed: 20,
    bulletCount: 1,
    spread: 0,
    color: '#00ffff',
    isChainLightning: true,
    chainMaxJumps: 4,
    chainRange: 200,
    chainDamageReduction: 0.7
  },
  poisonDart: {
    name: 'Flechettes Toxiques',
    damage: 35,
    fireRate: 450,
    bulletSpeed: 16,
    bulletCount: 1,
    spread: 0,
    color: '#88ff00',
    isPoisonDart: true,
    poisonDamage: 3,
    poisonDuration: 5000,
    poisonSpreadRadius: 100,
    poisonSpreadChance: 0.3
  },
  teslaCoil: {
    name: 'Bobine Tesla',
    damage: 8,
    fireRate: 100,
    bulletSpeed: 0,
    bulletCount: 1,
    spread: 0,
    color: '#00ccff',
    isTeslaCoil: true,
    teslaRange: 250,
    teslaMaxTargets: 5,
    teslaChainDelay: 50
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
    slowAmount: 0.5,
    slowDuration: 3000,
    freezeChance: 0.15,
    freezeDuration: 2000,
    iceExplosionRadius: 80
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
    ignoresWalls: true,
    plasmaTrailInterval: 10,
    plasmaPiercing: 3
  }
};

module.exports = { WEAPONS };
