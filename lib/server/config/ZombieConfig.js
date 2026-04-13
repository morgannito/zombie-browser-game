/**
 * ZOMBIE CONFIG - Types de zombies du jeu
 * @version 1.1.0
 *
 * WAVE SCALING (ZombieManager.js):
 *   waveMultiplier  = 1 + (min(wave,130) - 1) × 0.15   → ×1.0 wave1, ×2.35 wave10, ×20.35 wave130 (cap)
 *   speedCap        = type.speed × 1.8                  → évite les zombies trop rapides (wall-clip)
 *   bossMultiplier  = 1 + (min(wave,130) - 1) × 0.20   → scaling plus agressif pour les boss
 *   eliteChance     = 5% après vague 5                  → ×2 hp/dmg, ×3 gold
 *   zombieCount     = ZOMBIES_PER_ROOM + (wave-1) × 7   → vague 1: ~10, vague 20: ~143 (cap wave 130)
 *
 * GOLD/XP RATIO GUIDE (valeurs base):
 *   normal  : 5g / 10xp  — ratio 0.5 g/xp
 *   fast    : 8g / 15xp  — ratio 0.53 g/xp (bonus mobilité)
 *   tank    : 20g / 30xp — ratio 0.67 g/xp (bonus durabilité)
 *   boss    : 200g/500xp — ratio 0.40 g/xp (boss standard toutes vagues)
 *   elites  : ×3 gold base (ZombieManager applique le multiplicateur)
 */

const ZOMBIE_TYPES = {
  // === ZOMBIES DE BASE ===
  normal: {
    name: 'Zombie Normal',
    health: 100,
    speed: 2,
    damage: 15,
    xp: 10,
    gold: 5,
    size: 25,
    color: '#00ff00'
  },
  fast: {
    name: 'Zombie Rapide',
    health: 60,
    speed: 4.5,
    damage: 12,
    xp: 15,
    gold: 8,
    size: 22,
    color: '#ffff00'
  },
  tank: {
    name: 'Zombie Tank',
    health: 300,
    speed: 1.2,
    damage: 30,
    xp: 30,
    gold: 20,
    size: 35,
    color: '#ff0000'
  },
  boss: {
    name: 'BOSS ZOMBIE',
    health: 2000,
    speed: 1.8,
    damage: 50,
    xp: 500,
    gold: 200,
    size: 60,
    color: '#ff00ff'
  },

  // === BOSS SPECIAUX (tous les 25 vagues) ===
  bossCharnier: {
    name: 'RAIIVY',
    health: 2500,
    speed: 1.5,
    damage: 60,
    xp: 1500,
    gold: 800,
    size: 70,
    color: '#8b0000',
    spawnCooldown: 10000,
    spawnCount: 3,
    wave: 25
  },
  bossInfect: {
    name: 'SORENZA',
    health: 3500,
    speed: 2.0,
    damage: 70,
    xp: 2500,
    gold: 1200,
    size: 75,
    color: '#00ff00',
    toxicPoolCooldown: 3000,
    toxicPoolDamage: 15,
    toxicPoolDuration: 8000,
    toxicPoolRadius: 60,
    deathAuraRadius: 80,
    deathAuraDamage: 5,
    wave: 50
  },
  bossColosse: {
    name: 'HAIER',
    health: 5000,
    speed: 1.2,
    damage: 80,
    xp: 4000,
    gold: 1800,
    size: 90,
    color: '#ff4500',
    enrageThreshold: 0.3,
    enrageSpeedMultiplier: 2.0,
    enrageDamageMultiplier: 1.5,
    shieldDamageReduction: 0.8,
    shieldColor: '#00ccff',
    wave: 75
  },
  bossRoi: {
    name: 'KUROI TO SUTA',
    health: 7500,
    speed: 1.8,
    damage: 100,
    xp: 6000,
    gold: 2500,
    size: 100,
    color: '#ffd700',
    phase2Threshold: 0.66,
    phase3Threshold: 0.33,
    teleportCooldown: 8000,
    summonCooldown: 20000,
    cloneCooldown: 50000,
    cloneCount: 2,
    cloneHealth: 500,
    cloneDuration: 30000,
    wave: 100
  },
  bossOmega: {
    name: 'MORGANNITO',
    health: 12000,
    speed: 2.2,
    damage: 120,
    xp: 10000,
    gold: 5000,
    size: 110,
    color: '#ff00ff',
    phase2Threshold: 0.75,
    phase3Threshold: 0.5,
    phase4Threshold: 0.25,
    teleportCooldown: 6000,
    summonCooldown: 10000,
    toxicPoolCooldown: 4000,
    laserCooldown: 8000,
    laserDamage: 50,
    laserRange: 800,
    laserWidth: 20,
    laserDuration: 1000,
    laserColor: '#00ffff',
    wave: 130
  },

  // === ZOMBIES SPECIAUX ===
  healer: {
    name: 'Zombie Soigneur',
    health: 120,
    speed: 1.8,
    damage: 10,
    xp: 25,
    gold: 15,
    size: 28,
    color: '#00ffff',
    healAmount: 30,
    healRadius: 150,
    healCooldown: 3000
  },
  slower: {
    name: 'Zombie Ralentisseur',
    health: 90,
    speed: 2,
    damage: 12,
    xp: 20,
    gold: 12,
    size: 26,
    color: '#8888ff',
    slowRadius: 120,
    slowAmount: 0.5,
    slowDuration: 2000
  },
  shooter: {
    name: 'Zombie Tireur',
    health: 80,
    speed: 1.5,
    damage: 20,
    xp: 22,
    gold: 14,
    size: 24,
    color: '#ff8800',
    shootRange: 400,
    shootCooldown: 2000,
    bulletSpeed: 8,
    bulletColor: '#ff4400'
  },
  poison: {
    name: 'Zombie Poison',
    health: 110,
    speed: 2.2,
    damage: 18,
    xp: 28,
    gold: 18,
    size: 27,
    color: '#88ff00',
    poisonTrailInterval: 500,
    poisonDamage: 2,
    poisonDuration: 3000,
    poisonRadius: 35
  },
  explosive: {
    name: 'Zombie Explosif',
    health: 150,
    speed: 2.5,
    damage: 25,
    xp: 35,
    gold: 25,
    size: 30,
    color: '#ff00ff',
    explosionRadius: 150,
    explosionDamage: 80
  },
  teleporter: {
    name: 'Zombie Teleporteur',
    health: 95,
    speed: 2.8,
    damage: 16,
    xp: 32,
    gold: 22,
    size: 26,
    color: '#9900ff',
    teleportCooldown: 5000,
    teleportRange: 200,
    teleportMinRange: 80
  },
  summoner: {
    name: 'Zombie Invocateur',
    health: 140,
    speed: 1.4,
    damage: 14,
    xp: 45,
    gold: 30,
    size: 30,
    color: '#cc00ff',
    summonCooldown: 8000,
    summonRange: 100,
    minionsPerSummon: 2,
    maxMinions: 4
  },
  shielded: {
    name: 'Zombie Bouclier',
    health: 180,
    speed: 1.6,
    damage: 22,
    xp: 38,
    gold: 26,
    size: 32,
    color: '#00ccff',
    frontDamageReduction: 0.5,
    shieldAngle: Math.PI / 2
  },
  berserker: {
    name: 'Zombie Berserker',
    health: 200,
    speed: 2.5,
    damage: 20,
    xp: 40,
    gold: 28,
    size: 30,
    color: '#ff6600',
    rageThreshold: 0.5,
    extremeRageThreshold: 0.25,
    rageSpeedMultiplier: 1.5,
    rageDamageMultiplier: 1.3,
    extremeRageSpeedMultiplier: 2.0,
    extremeRageDamageMultiplier: 1.6,
    dashCooldown: 5000,
    dashSpeed: 8,
    dashDuration: 300,
    rageColor: '#ff0000'
  },
  minion: {
    name: 'Mini-Zombie',
    health: 30,
    speed: 3.5,
    damage: 8,
    xp: 5,
    gold: 3,
    size: 18,
    color: '#ff99ff',
    isMinion: true
  },

  // === ZOMBIES ELITES (Mini-Boss) ===
  necromancer: {
    name: 'Necromancien',
    health: 250,
    speed: 1.4,
    damage: 18,
    xp: 60,
    gold: 40,
    size: 32,
    color: '#663399',
    isElite: true,
    resurrectCooldown: 8000,
    resurrectRange: 300,
    resurrectMaxTargets: 2,
    resurrectHealthPercent: 0.4,
    auraColor: '#9966cc'
  },
  brute: {
    name: 'Brute',
    health: 350,
    speed: 1.8,
    damage: 35,
    xp: 70,
    gold: 50,
    size: 38,
    color: '#cc3300',
    isElite: true,
    chargeCooldown: 6000,
    chargeRange: 500,
    chargeSpeed: 12,
    chargeDuration: 1500,
    stunDuration: 1500,
    stunRadius: 50,
    chargeColor: '#ff4400'
  },
  mimic: {
    name: 'Mimic',
    health: 180,
    speed: 3.0,
    damage: 28,
    xp: 55,
    gold: 45,
    size: 12,
    color: '#ffaa00',
    isElite: true,
    disguisedSize: 12,
    revealedSize: 30,
    revealRange: 150,
    ambushDamageMultiplier: 2.0,
    disguiseColor: '#ffdd00',
    revealedColor: '#ff6600'
  },
  splitter: {
    name: 'Splitter',
    health: 220,
    speed: 2.2,
    damage: 20,
    xp: 65,
    gold: 55,
    size: 30,
    color: '#00cc99',
    isElite: true,
    splitCount: 3,
    splitHealthPercent: 0.3,
    splitSpeedMultiplier: 1.5,
    splitDamageMultiplier: 0.5,
    splitSize: 18,
    splitColor: '#00ffaa',
    splitExplosionRadius: 100
  },

  // === EXTENDED TYPES ===

  // Elementaires
  inferno: {
    name: 'Zombie Inferno',
    health: 140,
    speed: 2.3,
    damage: 22,
    xp: 32,
    gold: 20,
    size: 28,
    color: '#ff4500'
  },
  glacier: {
    name: 'Zombie Glacier',
    health: 180,
    speed: 1.3,
    damage: 18,
    xp: 28,
    gold: 18,
    size: 30,
    color: '#87ceeb'
  },
  thunderstorm: {
    name: 'Zombie Tempete',
    health: 120,
    speed: 2.6,
    damage: 24,
    xp: 35,
    gold: 22,
    size: 26,
    color: '#4169e1'
  },
  boulder: {
    name: 'Zombie Rocher',
    health: 400,
    speed: 0.8,
    damage: 40,
    xp: 45,
    gold: 30,
    size: 38,
    color: '#8b7355'
  },
  tornado: {
    name: 'Zombie Tornade',
    health: 100,
    speed: 3.5,
    damage: 16,
    xp: 30,
    gold: 19,
    size: 24,
    color: '#b0e0e6'
  },

  // Mutants
  abomination: {
    name: 'Abomination',
    health: 350,
    speed: 1.6,
    damage: 38,
    xp: 55,
    gold: 40,
    size: 42,
    color: '#556b2f'
  },
  chimera: {
    name: 'Chimere',
    health: 280,
    speed: 2.0,
    damage: 30,
    xp: 50,
    gold: 35,
    size: 35,
    color: '#8b4789'
  },
  parasite: {
    name: 'Zombie Parasite',
    health: 90,
    speed: 3.2,
    damage: 14,
    xp: 26,
    gold: 16,
    size: 22,
    color: '#9370db'
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
    isElite: true
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
    isElite: true
  },

  // Mecaniques
  cyborg: {
    name: 'Zombie Cyborg',
    health: 200,
    speed: 2.4,
    damage: 28,
    xp: 42,
    gold: 28,
    size: 29,
    color: '#708090'
  },
  drone: {
    name: 'Drone Zombie',
    health: 80,
    speed: 3.8,
    damage: 18,
    xp: 28,
    gold: 20,
    size: 20,
    color: '#4682b4'
  },
  turret: {
    name: 'Tourelle Zombie',
    health: 180,
    speed: 0,
    damage: 32,
    xp: 38,
    gold: 30,
    size: 35,
    color: '#2f4f4f'
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
    isElite: true
  },
  sentinel: {
    name: 'Sentinelle',
    health: 320,
    speed: 1.8,
    damage: 36,
    xp: 52,
    gold: 42,
    size: 36,
    color: '#778899'
  },

  // Dimensionnels
  voidwalker: {
    name: 'Marcheur du Vide',
    health: 150,
    speed: 2.8,
    damage: 26,
    xp: 48,
    gold: 38,
    size: 28,
    color: '#191970'
  },
  shadowfiend: {
    name: 'Ombre Maudite',
    health: 130,
    speed: 3.2,
    damage: 22,
    xp: 40,
    gold: 32,
    size: 26,
    color: '#0d0d0d'
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
    isElite: true
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
    isElite: true
  },

  // NOUVEAUX BOSS
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
    wave: 115
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
    wave: 140
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
    wave: 160
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
    wave: 180
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
    wave: 200
  },

  // NOUVEAUX ELITES (10)
  juggernaut: {
    name: 'Juggernaut',
    health: 500,
    speed: 1.2,
    damage: 40,
    xp: 85,
    gold: 65,
    size: 42,
    color: '#b22222',
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
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
    isElite: true
  },

  // Animaux
  hound: {
    name: 'Chien Zombie',
    health: 70,
    speed: 4.2,
    damage: 16,
    xp: 18,
    gold: 12,
    size: 20,
    color: '#8b4513'
  },
  raven: {
    name: 'Corbeau Zombie',
    health: 40,
    speed: 5.0,
    damage: 10,
    xp: 15,
    gold: 10,
    size: 16,
    color: '#000000'
  },
  rat: {
    name: 'Rat Zombie',
    health: 25,
    speed: 4.5,
    damage: 6,
    xp: 8,
    gold: 5,
    size: 14,
    color: '#696969'
  },
  spider: {
    name: 'Araignee Zombie',
    health: 60,
    speed: 3.0,
    damage: 12,
    xp: 20,
    gold: 14,
    size: 22,
    color: '#8b0000'
  },
  bear: {
    name: 'Ours Zombie',
    health: 450,
    speed: 1.5,
    damage: 48,
    xp: 65,
    gold: 50,
    size: 44,
    color: '#a0522d'
  },

  // Humanoides
  soldier: {
    name: 'Soldat Zombie',
    health: 160,
    speed: 2.0,
    damage: 26,
    xp: 34,
    gold: 24,
    size: 28,
    color: '#556b2f'
  },
  scientist: {
    name: 'Scientifique Zombie',
    health: 90,
    speed: 1.8,
    damage: 18,
    xp: 38,
    gold: 30,
    size: 26,
    color: '#ffffff'
  },
  athlete: {
    name: 'Athlete Zombie',
    health: 110,
    speed: 3.8,
    damage: 20,
    xp: 28,
    gold: 20,
    size: 27,
    color: '#ff6347'
  },
  chef: {
    name: 'Chef Zombie',
    health: 140,
    speed: 1.6,
    damage: 22,
    xp: 32,
    gold: 25,
    size: 30,
    color: '#fffafa'
  },
  ninja: {
    name: 'Ninja Zombie',
    health: 100,
    speed: 3.6,
    damage: 28,
    xp: 45,
    gold: 36,
    size: 25,
    color: '#2f2f2f'
  },

  // Mythologiques
  vampire: {
    name: 'Vampire Zombie',
    health: 200,
    speed: 2.8,
    damage: 32,
    xp: 55,
    gold: 45,
    size: 30,
    color: '#8b0000'
  },
  werewolf: {
    name: 'Loup-Garou Zombie',
    health: 280,
    speed: 3.2,
    damage: 40,
    xp: 68,
    gold: 54,
    size: 36,
    color: '#8b4513'
  },
  mummy: {
    name: 'Momie Zombie',
    health: 220,
    speed: 1.2,
    damage: 28,
    xp: 48,
    gold: 40,
    size: 32,
    color: '#daa520'
  },
  skeleton: {
    name: 'Squelette Zombie',
    health: 80,
    speed: 2.6,
    damage: 22,
    xp: 26,
    gold: 18,
    size: 26,
    color: '#f5f5dc'
  },
  ghost: {
    name: 'Fantome Zombie',
    health: 100,
    speed: 2.4,
    damage: 24,
    xp: 42,
    gold: 34,
    size: 28,
    color: '#f0f8ff'
  },

  // Aquatiques
  abyssalHorror: {
    name: 'Horreur des Abysses',
    health: 260,
    speed: 1.8,
    damage: 36,
    xp: 58,
    gold: 46,
    size: 38,
    color: '#000080'
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
    isElite: true
  },

  // Insectes
  locustSwarm: {
    name: 'Essaim de Sauterelles',
    health: 150,
    speed: 2.2,
    damage: 18,
    xp: 36,
    gold: 28,
    size: 40,
    color: '#9acd32'
  },
  mantis: {
    name: 'Mante Zombie',
    health: 140,
    speed: 3.0,
    damage: 34,
    xp: 44,
    gold: 35,
    size: 30,
    color: '#adff2f'
  },
  scorpion: {
    name: 'Scorpion Zombie',
    health: 180,
    speed: 2.4,
    damage: 28,
    xp: 46,
    gold: 37,
    size: 32,
    color: '#8b4500'
  },

  // Plantes
  vineZombie: {
    name: 'Zombie Liane',
    health: 200,
    speed: 0.5,
    damage: 24,
    xp: 40,
    gold: 32,
    size: 34,
    color: '#228b22'
  },
  mushroomZombie: {
    name: 'Zombie Champignon',
    health: 120,
    speed: 1.4,
    damage: 16,
    xp: 34,
    gold: 26,
    size: 28,
    color: '#8b4789'
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
    isElite: true
  },

  // Cristaux
  crystalZombie: {
    name: 'Zombie Cristal',
    health: 240,
    speed: 1.6,
    damage: 30,
    xp: 50,
    gold: 40,
    size: 32,
    color: '#87ceeb'
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
    isElite: true
  },

  // Cosmiques
  starborn: {
    name: 'Ne des Etoiles',
    health: 300,
    speed: 2.6,
    damage: 38,
    xp: 65,
    gold: 52,
    size: 34,
    color: '#ffd700'
  },
  voidSpawn: {
    name: 'Progeniture du Vide',
    health: 220,
    speed: 2.8,
    damage: 34,
    xp: 56,
    gold: 44,
    size: 30,
    color: '#4b0082'
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
    isElite: true
  },

  // Machines de guerre
  tankZombie: {
    name: 'Char Zombie',
    health: 600,
    speed: 1.1,
    damage: 50,
    xp: 82,
    gold: 66,
    size: 50,
    color: '#696969'
  },
  helicopter: {
    name: 'Helico Zombie',
    health: 280,
    speed: 3.4,
    damage: 36,
    xp: 68,
    gold: 54,
    size: 36,
    color: '#808080'
  },
  submarine: {
    name: 'Sous-marin Zombie',
    health: 400,
    speed: 1.8,
    damage: 42,
    xp: 72,
    gold: 58,
    size: 42,
    color: '#2f4f4f'
  },

  // Aliens
  greyAlien: {
    name: 'Alien Gris Zombie',
    health: 160,
    speed: 2.4,
    damage: 28,
    xp: 48,
    gold: 38,
    size: 28,
    color: '#c0c0c0'
  },
  xenomorph: {
    name: 'Xenomorphe Zombie',
    health: 240,
    speed: 3.6,
    damage: 44,
    xp: 76,
    gold: 60,
    size: 32,
    color: '#000000'
  },
  saucer: {
    name: 'Soucoupe Zombie',
    health: 320,
    speed: 2.8,
    damage: 38,
    xp: 70,
    gold: 56,
    size: 38,
    color: '#00ff00'
  },

  // Lovecraftiens
  shoggoth: {
    name: 'Shoggoth',
    health: 550,
    speed: 1.6,
    damage: 48,
    xp: 98,
    gold: 78,
    size: 46,
    color: '#4b5320',
    isElite: true
  },
  deepOne: {
    name: 'Habitant des Profondeurs',
    health: 280,
    speed: 2.2,
    damage: 36,
    xp: 62,
    gold: 50,
    size: 34,
    color: '#2f4f4f'
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
    isElite: true
  },

  // Morts-vivants speciaux
  lich: {
    name: 'Liche',
    health: 380,
    speed: 1.4,
    damage: 40,
    xp: 92,
    gold: 74,
    size: 36,
    color: '#800080',
    isElite: true
  },
  revenant: {
    name: 'Revenant',
    health: 260,
    speed: 2.4,
    damage: 38,
    xp: 64,
    gold: 52,
    size: 32,
    color: '#696969'
  },
  wraith: {
    name: 'Spectre',
    health: 180,
    speed: 3.0,
    damage: 32,
    xp: 54,
    gold: 44,
    size: 28,
    color: '#e6e6fa'
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
    isElite: true
  },

  // Demons
  imp: {
    name: 'Diablotin Zombie',
    health: 90,
    speed: 3.4,
    damage: 20,
    xp: 30,
    gold: 22,
    size: 22,
    color: '#ff4500'
  },
  hellhound: {
    name: 'Cerbere Zombie',
    health: 200,
    speed: 3.8,
    damage: 36,
    xp: 58,
    gold: 46,
    size: 32,
    color: '#8b0000'
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
    isElite: true
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
    isElite: true
  }
};

const Joi = require('joi');

const zombieSchema = Joi.object({
  name: Joi.string().required(),
  health: Joi.number().positive().required(),
  // speed=0 allowed for stationary types (e.g. turret)
  speed: Joi.number().min(0).required(),
  damage: Joi.number().positive().required(),
  color: Joi.string()
    .pattern(/^#[0-9a-fA-F]{6}$/)
    .required()
}).unknown(true);

function validateZombieConfig(types) {
  const errors = [];
  for (const [key, def] of Object.entries(types)) {
    const { error } = zombieSchema.validate(def);
    if (error) {
      errors.push(`${key}: ${error.message}`);
    }
  }
  if (errors.length > 0) {
    console.error(
      `[FATAL] ZombieConfig validation failed:\n${errors.map(e => `  - ${e}`).join('\n')}`
    );
    process.exit(1);
  }
}

validateZombieConfig(ZOMBIE_TYPES);

module.exports = { ZOMBIE_TYPES };
