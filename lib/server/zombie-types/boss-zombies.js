/**
 * BOSS ZOMBIE TYPES - Multi-phase thematic bosses
 * Infernal, Cryos, Vortex, Nexus, Apocalypse
 * @version 2.0.0
 */

const BOSS_ZOMBIES = {
  bossInfernal: {
    name: 'LORD INFERNUS',
    health: 8000,
    speed: 1.6,
    damage: 90,
    xp: 7500,
    gold: 3500,
    size: 95,
    color: '#dc143c',
    isBoss: true,
    wave: 115,
    // Phase 1: Fire aura + meteors
    fireAuraRadius: 120,
    fireAuraDamage: 8,
    meteorCooldown: 8000,
    meteorDamage: 60,
    meteorRadius: 100,
    // Phase 2 (66% HP): Lava pools
    phase2Threshold: 0.66,
    lavaPoolCooldown: 5000,
    lavaPoolDamage: 12,
    lavaPoolDuration: 15000,
    // Phase 3 (33% HP): Summon fire minions
    phase3Threshold: 0.33,
    summonCooldown: 15000,
    fireMinionsPerSummon: 5
  },

  bossCryos: {
    name: "CRYOS L'ETERNEL",
    health: 9500,
    speed: 1.3,
    damage: 85,
    xp: 8500,
    gold: 4000,
    size: 100,
    color: '#00bfff',
    isBoss: true,
    wave: 140,
    // Phase 1: Freeze aura + ice spikes
    freezeAuraRadius: 150,
    spikesCooldown: 6000,
    spikesDamage: 50,
    spikesCount: 8,
    // Phase 2: Ice clones
    phase2Threshold: 0.66,
    cloneCooldown: 40000,
    cloneCount: 3,
    cloneHealth: 800,
    // Phase 3: Blizzard
    phase3Threshold: 0.33,
    blizzardCooldown: 10000,
    blizzardDamage: 15,
    blizzardDuration: 8000,
    blizzardRadius: 300
  },

  bossVortex: {
    name: 'VORTEX LE DESTRUCTEUR',
    health: 10000,
    speed: 2.0,
    damage: 100,
    xp: 9000,
    gold: 4500,
    size: 105,
    color: '#00ced1',
    isBoss: true,
    wave: 160,
    // Tornado mechanics
    tornadoCooldown: 7000,
    tornadoDamage: 20,
    tornadoRadius: 180,
    pullForce: 3,
    // Phase 2: Lightning storm
    phase2Threshold: 0.66,
    lightningCooldown: 4000,
    lightningStrikes: 6,
    lightningDamage: 40,
    // Phase 3: Hurricane
    phase3Threshold: 0.33,
    hurricaneDuration: 12000,
    hurricaneDamagePerSec: 18
  },

  bossNexus: {
    name: 'NEXUS DU VIDE',
    health: 11000,
    speed: 1.8,
    damage: 110,
    xp: 11000,
    gold: 5500,
    size: 110,
    color: '#9400d3',
    isBoss: true,
    wave: 180,
    // Void mechanics
    voidRiftCooldown: 9000,
    riftDamage: 45,
    riftRadius: 120,
    // Phase 2: Dimensional summons
    phase2Threshold: 0.66,
    summonCooldown: 18000,
    voidMinionsPerSummon: 8,
    // Phase 3: Reality warp
    phase3Threshold: 0.33,
    warpCooldown: 12000,
    warpConfusionDuration: 5000,
    teleportCooldown: 6000
  },

  bossApocalypse: {
    name: 'APOCALYPSE PRIME',
    health: 15000,
    speed: 2.4,
    damage: 140,
    xp: 15000,
    gold: 8000,
    size: 120,
    color: '#8b0000',
    isBoss: true,
    wave: 200,
    // Boss final ultime - combine tous les elements
    phase2Threshold: 0.75,
    phase3Threshold: 0.5,
    phase4Threshold: 0.25,
    // Fire abilities
    meteorShower: true,
    meteorCooldown: 6000,
    meteorCount: 5,
    // Ice abilities
    icePrisonCooldown: 15000,
    icePrisonDuration: 3000,
    // Lightning abilities
    chainLightningCooldown: 8000,
    chainMaxJumps: 8,
    // Void abilities
    voidBombCooldown: 10000,
    voidBombRadius: 200,
    voidBombDamage: 100,
    // Ultimate
    apocalypseCooldown: 30000,
    apocalypseDamage: 200,
    apocalypseRadius: 400
  }
};

module.exports = { BOSS_ZOMBIES };
