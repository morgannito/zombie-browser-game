/**
 * @fileoverview Intelligent Zombie Spawn Manager
 * @description Wave-based progression avec spawn thématique
 */

const ConfigManager = require('../../../lib/server/ConfigManager');
const { ZOMBIE_TYPES } = ConfigManager;

class ZombieSpawnManager {
  constructor() {
    this.waveConfig = this.buildWaveProgression();
  }

  /**
   * Construit la progression des waves 1-200+
   */
  buildWaveProgression() {
    return {
      // Waves 1-10: Basics only
      early: { range: [1, 10], types: ['normal', 'fast'] },

      // Waves 11-24: Introduction variété
      beginner: { range: [11, 24], types: ['normal', 'fast', 'tank', 'healer', 'slower'] },

      // Wave 25: BOSS RAIIVY
      boss1: { range: [25, 25], types: ['bossCharnier'], forceBoss: true },

      // Waves 26-49: Zombies spéciaux
      intermediate: { range: [26, 49], types: ['normal', 'fast', 'tank', 'shooter', 'poison', 'explosive', 'teleporter', 'healer'] },

      // Wave 50: BOSS SORENZA
      boss2: { range: [50, 50], types: ['bossInfect'], forceBoss: true },

      // Waves 51-74: Élites introduction
      advanced: { range: [51, 74], types: ['normal', 'fast', 'tank', 'summoner', 'shielded', 'berserker', 'necromancer', 'brute', 'mimic', 'splitter'] },

      // Wave 75: BOSS HAIER
      boss3: { range: [75, 75], types: ['bossColosse'], forceBoss: true },

      // Waves 76-99: Zombies étendus (élémentaires, mutants)
      expert: { range: [76, 99], types: ['inferno', 'glacier', 'thunderstorm', 'boulder', 'tornado', 'abomination', 'chimera', 'parasite', 'hydra', 'titan', 'cyborg', 'drone', 'turret'] },

      // Wave 100: BOSS KUROI TO SUTA
      boss4: { range: [100, 100], types: ['bossRoi'], forceBoss: true },

      // Waves 101-114: Dimensionnels + Mécaniques
      master: { range: [101, 114], types: ['voidwalker', 'shadowfiend', 'timewraith', 'dimensionBeast', 'mech', 'sentinel', 'hound', 'spider', 'bear', 'soldier', 'ninja'] },

      // Wave 115: BOSS INFERNUS
      boss5: { range: [115, 115], types: ['bossInfernal'], forceBoss: true },

      // Waves 116-129: Mix thématique
      legendary: { range: [116, 129], types: ['vampire', 'werewolf', 'mummy', 'skeleton', 'ghost', 'juggernaut', 'assassin', 'warlord', 'plagueDoctor', 'reaper'] },

      // Wave 130: BOSS MORGANNITO (Omega)
      boss6: { range: [130, 130], types: ['bossOmega'], forceBoss: true },

      // Waves 131-139: Élites avancés
      godlike: { range: [131, 139], types: ['archon', 'dreadlord', 'stormcaller', 'corruptor', 'behemoth', 'leviathan', 'treeant', 'obsidianGolem', 'celestialGuardian'] },

      // Wave 140: BOSS CRYOS
      boss7: { range: [140, 140], types: ['bossCryos'], forceBoss: true },

      // Waves 141-159: Aliens + Lovecraft + War machines
      nightmare: { range: [141, 159], types: ['greyAlien', 'xenomorph', 'saucer', 'shoggoth', 'deepOne', 'elderThing', 'tankZombie', 'helicopter', 'submarine', 'lich', 'boneLord'] },

      // Wave 160: BOSS VORTEX
      boss8: { range: [160, 160], types: ['bossVortex'], forceBoss: true },

      // Waves 161-179: Mix apocalyptique
      apocalyptic: { range: [161, 179], types: ['imp', 'hellhound', 'demon', 'archdevil', 'locustSwarm', 'mantis', 'scorpion', 'vineZombie', 'mushroomZombie', 'crystalZombie', 'starborn', 'voidSpawn'] },

      // Wave 180: BOSS NEXUS
      boss9: { range: [180, 180], types: ['bossNexus'], forceBoss: true },

      // Waves 181-199: Tout disponible (chaos)
      chaos: { range: [181, 199], types: 'ALL' },

      // Wave 200: BOSS APOCALYPSE FINAL
      finalBoss: { range: [200, 200], types: ['bossApocalypse'], forceBoss: true }
    };
  }

  /**
   * Sélectionne le type de zombie basé sur la wave actuelle
   */
  selectZombieType(currentWave) {
    // Trouver la config de wave
    let wavePhase = null;
    for (const phase in this.waveConfig) {
      const config = this.waveConfig[phase];
      if (currentWave >= config.range[0] && currentWave <= config.range[1]) {
        wavePhase = config;
        break;
      }
    }

    // Fallback si wave > 200
    if (!wavePhase) {
      wavePhase = { types: 'ALL', forceBoss: false };
    }

    // Boss forcé
    if (wavePhase.forceBoss) {
      return wavePhase.types[0];
    }

    // Mode ALL (chaos waves)
    if (wavePhase.types === 'ALL') {
      const allTypes = Object.keys(ZOMBIE_TYPES).filter(type => !ZOMBIE_TYPES[type].isBoss);
      return allTypes[Math.floor(Math.random() * allTypes.length)];
    }

    // Sélection pondérée normale
    return this.weightedSelection(wavePhase.types, currentWave);
  }

  /**
   * Sélection pondérée avec augmentation élites aux waves élevées
   */
  weightedSelection(availableTypes, currentWave) {
    // Probabilité élites augmente avec wave
    const eliteChance = Math.min(0.5, currentWave / 200); // Max 50% à wave 100+

    // Filtrer élites vs normaux
    const elites = availableTypes.filter(type => ZOMBIE_TYPES[type]?.isElite);
    const normals = availableTypes.filter(type => !ZOMBIE_TYPES[type]?.isElite);

    // Roll pour élite
    if (elites.length > 0 && Math.random() < eliteChance) {
      return elites[Math.floor(Math.random() * elites.length)];
    }

    // Sinon zombie normal
    return normals.length > 0
      ? normals[Math.floor(Math.random() * normals.length)]
      : availableTypes[Math.floor(Math.random() * availableTypes.length)];
  }

  /**
   * Calcule le nombre de zombies à spawner pour une wave
   */
  getSpawnCount(currentWave, baseCount = 10) {
    // Progression logarithmique
    const waveMultiplier = 1 + Math.log10(currentWave + 1);
    return Math.floor(baseCount * waveMultiplier);
  }

  /**
   * Vérifie si un boss devrait spawner
   */
  shouldSpawnBoss(currentWave) {
    const bossWaves = [25, 50, 75, 100, 115, 130, 140, 160, 180, 200];
    return bossWaves.includes(currentWave);
  }

  /**
   * Récupère le type de boss pour une wave
   */
  getBossType(currentWave) {
    const bossMap = {
      25: 'bossCharnier',
      50: 'bossInfect',
      75: 'bossColosse',
      100: 'bossRoi',
      115: 'bossInfernal',
      130: 'bossOmega',
      140: 'bossCryos',
      160: 'bossVortex',
      180: 'bossNexus',
      200: 'bossApocalypse'
    };
    return bossMap[currentWave] || null;
  }
}

module.exports = ZombieSpawnManager;
