/**
 * ELITE ZOMBIE TYPES - High-tier combat zombies
 * Juggernaut, Assassin, Warlord, Plague Doctor, Reaper,
 * Archon, Dreadlord, Stormcaller, Corruptor, Behemoth
 * @version 2.0.0
 */

const ELITE_ZOMBIES = {
  juggernaut: {
    name: 'Juggernaut',
    health: 500,
    speed: 1.2,
    damage: 40,
    xp: 85,
    gold: 65,
    size: 42,
    color: '#b22222',
    isElite: true,
    unstoppable: true,
    trample: true,
    trampleDamage: 25,
    armorThickness: 0.4
  },

  assassin: {
    name: 'Assassin',
    health: 160,
    speed: 4.0,
    damage: 50,
    xp: 75,
    gold: 58,
    size: 26,
    color: '#2f2f2f',
    isElite: true,
    stealth: true,
    stealthCooldown: 8000,
    stealthDuration: 4000,
    criticalStrike: 3.0
  },

  warlord: {
    name: 'Seigneur de Guerre',
    health: 400,
    speed: 1.9,
    damage: 45,
    xp: 90,
    gold: 70,
    size: 40,
    color: '#cd5c5c',
    isElite: true,
    commandAura: true,
    auraRadius: 200,
    auraBuffMultiplier: 1.3,
    rallyAllies: true,
    rallyCooldown: 12000
  },

  plagueDoctor: {
    name: 'Docteur Peste',
    health: 300,
    speed: 1.6,
    damage: 32,
    xp: 80,
    gold: 62,
    size: 34,
    color: '#556b00',
    isElite: true,
    plagueMiasma: true,
    miasmaDamagePerSec: 6,
    miasmaRadius: 140,
    infectOnHit: true,
    infectionSpreadChance: 0.4
  },

  reaper: {
    name: 'Faucheur',
    health: 350,
    speed: 2.2,
    damage: 55,
    xp: 95,
    gold: 75,
    size: 36,
    color: '#1c1c1c',
    isElite: true,
    soulHarvest: true,
    harvestStackBonus: 0.05,
    maxStacks: 20,
    scytheSwipe: true,
    swipeRadius: 100,
    swipeDamage: 40
  },

  archon: {
    name: 'Archon',
    health: 450,
    speed: 1.7,
    damage: 48,
    xp: 100,
    gold: 80,
    size: 38,
    color: '#ffd700',
    isElite: true,
    divineShield: true,
    shieldAbsorb: 300,
    shieldRegen: 10,
    holyNova: true,
    novaCooldown: 10000,
    novaDamage: 50,
    novaRadius: 160
  },

  dreadlord: {
    name: "Seigneur de l'Effroi",
    health: 480,
    speed: 1.8,
    damage: 52,
    xp: 105,
    gold: 85,
    size: 40,
    color: '#8b008b',
    isElite: true,
    fearAura: true,
    fearRadius: 180,
    fearSlow: 0.5,
    soulDrain: true,
    drainAmount: 15,
    drainCooldown: 6000
  },

  stormcaller: {
    name: 'Invocateur de Tempete',
    health: 320,
    speed: 2.0,
    damage: 38,
    xp: 78,
    gold: 60,
    size: 34,
    color: '#1e90ff',
    isElite: true,
    lightningBolt: true,
    boltCooldown: 4000,
    boltDamage: 45,
    chainLightning: true,
    chainJumps: 5,
    stormCooldown: 15000
  },

  corruptor: {
    name: 'Corrupteur',
    health: 280,
    speed: 1.5,
    damage: 34,
    xp: 72,
    gold: 56,
    size: 32,
    color: '#9932cc',
    isElite: true,
    corruptionField: true,
    fieldRadius: 150,
    corruptionDamage: 5,
    healingNegation: true,
    curseOnHit: true,
    curseDamageReduction: 0.3
  },

  behemoth: {
    name: 'Behemoth',
    health: 700,
    speed: 0.9,
    damage: 65,
    xp: 120,
    gold: 95,
    size: 48,
    color: '#654321',
    isElite: true,
    earthquake: true,
    earthquakeCooldown: 9000,
    earthquakeDamage: 35,
    earthquakeRadius: 250,
    rockThrow: true,
    rockDamage: 50,
    rockCooldown: 6000
  }
};

module.exports = { ELITE_ZOMBIES };
