/**
 * ZOMBIE TYPES EXTENDED - 100+ Types de Zombies
 * Organisés par catégories: Élémentaires, Mutants, Mécaniques, Dimensionnels, Boss, Élites
 * @version 2.0.0
 */

const EXTENDED_ZOMBIE_TYPES = {

  // ===== CATÉGORIE: ÉLÉMENTAIRES (Fire, Ice, Lightning, Earth, Wind) =====

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
    burnDamage: 3, // Dégâts de brûlure par seconde
    burnDuration: 4000, // 4 secondes
    fireAuraRadius: 60 // Rayon de l'aura de feu
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
    iceArmorReduction: 0.3 // 30% réduction dégâts
  },

  thunderstorm: {
    name: 'Zombie Tempête',
    health: 120,
    speed: 2.6,
    damage: 24,
    xp: 35,
    gold: 22,
    size: 26,
    color: '#4169e1',
    isElemental: true,
    element: 'lightning',
    shockChance: 0.25, // 25% chance de shock (stun 0.5s)
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
    earthquake damage: 15, // Dégâts de zone toutes les 3s
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
    pushbackForce: 5, // Force de repoussement
    pushbackRadius: 80
  },

  // ===== CATÉGORIE: MUTANTS (Genetic Experiments) =====

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
    toxicBloodSplash: true, // Éclabousse du sang toxique en mourant
    splashRadius: 120,
    splashDamage: 20
  },

  chimera: {
    name: 'Chimère',
    health: 280,
    speed: 2.0,
    damage: 30,
    xp: 50,
    gold: 35,
    size: 35,
    color: '#8b4789',
    isMutant: true,
    shapeshift: true, // Change aléatoirement de vitesse/dégâts
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
    leechHealth: 10, // Vol de vie par attaque
    infestChance: 0.15, // 15% chance d'infester (DoT)
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
    regeneration: 5, // Régénère 5 HP/sec
    multihead: true,
    headCount: 3 // Doit être tué 3 fois
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
    groundSlam: true, // Attaque de zone AOE
    slamRadius: 150,
    slamDamage: 35,
    slamCooldown: 8000
  },

  // ===== CATÉGORIE: MÉCANIQUES (Cyborg/Robot Zombies) =====

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
    armorPlating: 0.25, // 25% réduction dégâts ballistiques
    overchargeMode: true, // Boost vitesse/dégâts à 25% HP
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
    flying: true, // Ignore obstacles
    scanRadius: 500, // Détecte joueurs de loin
    homingMissiles: true,
    missileDamage: 25,
    missileCooldown: 4000
  },

  turret: {
    name: 'Tourelle Zombie',
    health: 180,
    speed: 0, // Immobile
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
    energyShield: true, // Bouclier régénérable
    shieldHealth: 200,
    shieldRegenRate: 5 // HP/sec
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
    precisionShot: true, // Critiques automatiques
    critMultiplier: 2.5
  },

  // ===== CATÉGORIE: DIMENSIONNELS (Void, Shadow, Time) =====

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
    phaseShift: true, // Devient intangible périodiquement
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
    invisible: true, // Invisible jusqu'à proximité
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
    timeStop: true, // Ralentit joueurs dans un rayon
    slowRadius: 150,
    slowAmount: 0.6, // 60% ralentissement
    rewindHealth: true, // Revient à 50% HP une fois
    rewindThreshold: 0.2
  },

  dimensionBeast: {
    name: 'Bête Dimensionnelle',
    health: 400,
    speed: 2.2,
    damage: 44,
    xp: 72,
    gold: 58,
    size: 42,
    color: '#4b0082',
    isDimensional: true,
    isElite: true,
    portalSummon: true, // Invoque portails
    portalCount: 2,
    portalCooldown: 12000,
    minionsPerPortal: 3
  },

  // ===== NOUVEAUX BOSS (5 Boss Thématiques) =====

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
    name: 'CRYOS L\'ÉTERNEL',
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
    pullForce: 3, // Aspire les joueurs
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
    warpConfusionDuration: 5000, // Inverse contrôles
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
    // Boss final ultime - combine tous les éléments
    phase2Threshold: 0.75,
    phase3Threshold: 0.50,
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
    apocalypseCooldown: 30000, // Attaque ultime toutes les 30s
    apocalypseDamage: 200,
    apocalypseRadius: 400
  },

  // ===== ZOMBIES ÉLITES ADDITIONNELS (10 nouveaux) =====

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
    unstoppable: true, // Ignore knockback
    trample: true, // Piétine tout sur son passage
    trampleDamage: 25,
    armorThickness: 0.4 // 40% réduction dégâts
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
    criticalStrike: 3.0 // x3 dégâts depuis stealth
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
    commandAura: true, // Buff zombies alliés
    auraRadius: 200,
    auraBuffMultiplier: 1.3, // +30% stats
    rallyAllies: true,
    rallyCooldown: 12000
  },

  plague Doctor: {
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
    soulHarvest: true, // Gagne stats pour chaque kill
    harvestStackBonus: 0.05, // +5% per stack
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
    name: 'Seigneur de l\'Effroi',
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
    fearSlow: 0.5, // Ralentit de 50%
    soulDrain: true,
    drainAmount: 15,
    drainCooldown: 6000
  },

  stormcaller: {
    name: 'Invocateur de Tempête',
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
    healingNegation: true, // Annule régénération
    curseOnHit: true,
    curseDamageReduction: 0.3 // -30% dégâts infligés
  },

  behemoth: {
    name: 'Béhémoth',
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
  },

  // ===== ZOMBIES SPÉCIAUX THÉMATIQUES (40+) =====

  // Animaux mutants
  hound: {
    name: 'Chien Zombie',
    health: 70,
    speed: 4.2,
    damage: 16,
    xp: 18,
    gold: 12,
    size: 20,
    color: '#8b4513',
    packHunter: true, // Bonus dégâts en groupe
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
    swarm: true, // Spawne en groupe
    swarmSize: 5,
    diseaseCarrier: true
  },

  spider: {
    name: 'Araignée Zombie',
    health: 60,
    speed: 3.0,
    damage: 12,
    xp: 20,
    gold: 14,
    size: 22,
    color: '#8b0000',
    webShot: true,
    webCooldown: 5000,
    webDuration: 3000, // Immobilise
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
  },

  // Humanoïdes spécialisés
  soldier: {
    name: 'Soldat Zombie',
    health: 160,
    speed: 2.0,
    damage: 26,
    xp: 34,
    gold: 24,
    size: 28,
    color: '#556b2f',
    tacticalAwareness: true,
    coverSeeker: true,
    grenadeThrow: true,
    grenadeCooldown: 8000
  },

  scientist: {
    name: 'Scientifique Zombie',
    health: 90,
    speed: 1.8,
    damage: 18,
    xp: 38,
    gold: 30,
    size: 26,
    color: '#ffffff',
    chemicalFlask: true,
    flaskCooldown: 6000,
    flaskDamage: 30,
    flaskRadius: 80
  },

  athlete: {
    name: 'Athlète Zombie',
    health: 110,
    speed: 3.8,
    damage: 20,
    xp: 28,
    gold: 20,
    size: 27,
    color: '#ff6347',
    stamina: true, // Sprint bursts
    sprintMultiplier: 1.5,
    sprintCooldown: 5000
  },

  chef: {
    name: 'Chef Zombie',
    health: 140,
    speed: 1.6,
    damage: 22,
    xp: 32,
    gold: 25,
    size: 30,
    color: '#fffafa',
    meatCleaver: true,
    cleaverDamage: 35,
    cookingFire: true,
    fireDamage: 8
  },

  ninja: {
    name: 'Ninja Zombie',
    health: 100,
    speed: 3.6,
    damage: 28,
    xp: 45,
    gold: 36,
    size: 25,
    color: '#2f2f2f',
    smokeBomb: true,
    smokeCooldown: 8000,
    shurikenThrow: true,
    shurikenDamage: 20
  },

  // Créatures mythologiques
  vampire: {
    name: 'Vampire Zombie',
    health: 200,
    speed: 2.8,
    damage: 32,
    xp: 55,
    gold: 45,
    size: 30,
    color: '#8b0000',
    lifeSteal: 0.4, // 40% vol de vie
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
    transform: true, // Forme humaine/loup
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
    bandageRegen: 3, // Régén HP/sec
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
    reassemble: true, // Peut se reformer une fois
    reassembleTime: 5000
  },

  ghost: {
    name: 'Fantôme Zombie',
    health: 100,
    speed: 2.4,
    damage: 24,
    xp: 42,
    gold: 34,
    size: 28,
    color: '#f0f8ff',
    ethereal: true, // 50% chance d'éviter dégâts
    possessionChance: 0.1, // 10% chance de posséder (contrôle inversé)
    phaseThrough: true
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
    color: '#000080',
    tentacleGrab: true,
    grabRange: 100,
    grabDuration: 2000,
    waterSlick: true,
    slickRadius: 90
  },

  leviathan: {
    name: 'Léviathan Zombie',
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
  },

  // Insects
  locusts warm: {
    name: 'Essaim de Sauterelles',
    health: 150,
    speed: 2.2,
    damage: 18,
    xp: 36,
    gold: 28,
    size: 40,
    color: '#9acd32',
    swarmMechanic: true,
    devourFlesh: 4, // DoT
    blockVision: true,
    splitOnDeath: 5 // Se divise en 5 petites
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
  },

  // Plantes zombies
  vineZombie: {
    name: 'Zombie Liane',
    health: 200,
    speed: 0.5,
    damage: 24,
    xp: 40,
    gold: 32,
    size: 34,
    color: '#228b22',
    rootedAttack: true,
    vineReach: 250,
    entangle: true,
    entangleDuration: 4000,
    thornDamage: 3
  },

  mushroomZombie: {
    name: 'Zombie Champignon',
    health: 120,
    speed: 1.4,
    damage: 16,
    xp: 34,
    gold: 26,
    size: 28,
    color: '#8b4789',
    sporeCloud: true,
    sporeRadius: 100,
    sporeDamage: 6,
    confusionEffect: true,
    sporeCooldown: 5000
  },

  treeant: {
    name: 'Tréant Zombie',
    health: 500,
    speed: 0.8,
    damage: 42,
    xp: 78,
    gold: 62,
    size: 46,
    color: '#8b7355',
    isElite: true,
    rootSpikes: true,
    spikesDamage: 30,
    spikesRadius: 150,
    leafStorm: true,
    healing Aura: 5
  },

  // Cristaux et Minéraux
  crystalZombie: {
    name: 'Zombie Cristal',
    health: 240,
    speed: 1.6,
    damage: 30,
    xp: 50,
    gold: 40,
    size: 32,
    color: '#87ceeb',
    reflectDamage: 0.25, // Renvoie 25% dégâts
    shardExplosion: true,
    shardDamage: 35,
    shardRadius: 120,
    energyBeam: true
  },

  obsidianGolem: {
    name: 'Golem d\'Obsidienne',
    health: 650,
    speed: 1.0,
    damage: 55,
    xp: 95,
    gold: 75,
    size: 48,
    color: '#000000',
    isElite: true,
    lavaCore: true,
    coreRadius: 80,
    coreDamage: 10,
    impervious: 0.5, // 50% réduction
    rockSlam: true
  },

  // Cosmiques
  starborn: {
    name: 'Né des Étoiles',
    health: 300,
    speed: 2.6,
    damage: 38,
    xp: 65,
    gold: 52,
    size: 34,
    color: '#ffd700',
    cosmicEnergy: true,
    energyBurst: true,
    burstCooldown: 7000,
    burstDamage: 40,
    burstRadius: 140,
    starfall: true
  },

  voidSpawn: {
    name: 'Progéniture du Vide',
    health: 220,
    speed: 2.8,
    damage: 34,
    xp: 56,
    gold: 44,
    size: 30,
    color: '#4b0082',
    voidTouch: true,
    touchDrain: 12,
    dimensionalRift: true,
    riftCooldown: 9000,
    riftDamage: 28
  },

  celestialGuardian: {
    name: 'Gardien Céleste',
    health: 450,
    speed: 2.0,
    damage: 46,
    xp: 88,
    gold: 70,
    size: 40,
    color: '#ffffff',
    isElite: true,
    divineWrath: true,
    wrathDamage: 55,
    wrathCooldown: 8000,
    holyLight: true,
    lightRadius: 180
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
    color: '#696969',
    armorPlating: 0.6,
    cannonFire: true,
    cannonCooldown: 4000,
    cannonDamage: 70,
    cannonRadius: 90
  },

  helicopter: {
    name: 'Hélico Zombie',
    health: 280,
    speed: 3.4,
    damage: 36,
    xp: 68,
    gold: 54,
    size: 36,
    color: '#808080',
    flying: true,
    minigunFire: true,
    gunDamage: 8,
    gunFireRate: 10, // Projectiles/sec
    missileSalvo: true
  },

  submarine: {
    name: 'Sous-marin Zombie',
    health: 400,
    speed: 1.8,
    damage: 42,
    xp: 72,
    gold: 58,
    size: 42,
    color: '#2f4f4f',
    submerge: true,
    submergeDuration: 6000,
    torpedoLaunch: true,
    torpedoDamage: 60,
    torpedoCooldown: 7000
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
    color: '#c0c0c0',
    mindControl: true,
    controlDuration: 3000,
    abductionBeam: true,
    beamCooldown: 10000,
    telekinesis: true
  },

  xenomorph: {
    name: 'Xénomorphe Zombie',
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
  },

  // Horreurs lovecraftiennes
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
    formless: true, // Change de forme
    absorb: true, // Absorbe zombies morts
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
  },

  // Morts-vivants spéciaux
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
    phylactery: true // Revit une fois
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
    vengeance: true, // Plus fort à faible HP
    vengeanc eMultiplier: 2.0,
    venganceThreshold: 0.25,
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
  },

  // Démons
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
    name: 'Cerbère Zombie',
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
    name: 'Démon Zombie',
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
    demonicPower: 1.5, // x1.5 stats
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

module.exports = { EXTENDED_ZOMBIE_TYPES };
