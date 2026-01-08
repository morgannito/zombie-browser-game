/**
 * @fileoverview ZombieSpawnManager Unit Tests
 * @description Tests wave progression and intelligent zombie selection
 */

const ZombieSpawnManager = require('../ZombieSpawnManager');

describe('ZombieSpawnManager', () => {
  let spawnManager;

  beforeEach(() => {
    spawnManager = new ZombieSpawnManager();
  });

  describe('buildWaveProgression', () => {
    it('should create distinct wave phases', () => {
      const progression = spawnManager.buildWaveProgression();

      // Should have all key phases
      expect(progression).toHaveProperty('early');
      expect(progression).toHaveProperty('beginner');
      expect(progression).toHaveProperty('boss1');
      expect(progression).toHaveProperty('intermediate');
      expect(progression).toHaveProperty('advanced');
      expect(progression).toHaveProperty('finalBoss');

      // Should have 10 boss waves + intermediate phases
      expect(Object.keys(progression).length).toBeGreaterThanOrEqual(13);
    });

    it('should have correct wave ranges', () => {
      const progression = spawnManager.buildWaveProgression();

      expect(progression.early.range).toEqual([1, 10]);
      expect(progression.boss1.range).toEqual([25, 25]);
      expect(progression.boss2.range).toEqual([50, 50]);
      expect(progression.finalBoss.range).toEqual([200, 200]);
    });

    it('should mark boss waves with forceBoss flag', () => {
      const progression = spawnManager.buildWaveProgression();

      expect(progression.boss1.forceBoss).toBe(true);
      expect(progression.boss2.forceBoss).toBe(true);
      expect(progression.boss3.forceBoss).toBe(true);
      expect(progression.finalBoss.forceBoss).toBe(true);
    });

    it('should have correct zombie types per phase', () => {
      const progression = spawnManager.buildWaveProgression();

      // Early waves: only normal and fast
      expect(progression.early.types).toEqual(['normal', 'fast']);

      // Beginner: normal, fast, tank, healer, slower
      expect(progression.beginner.types).toContain('normal');
      expect(progression.beginner.types).toContain('fast');
      expect(progression.beginner.types).toContain('tank');

      // Boss waves: specific boss type
      expect(progression.boss1.types).toEqual(['bossCharnier']);
      expect(progression.boss2.types).toEqual(['bossInfect']);
    });
  });

  describe('Wave range checks', () => {
    it('should have valid wave configs for wave 1', () => {
      const config = spawnManager.waveConfig.early;
      expect(config.range).toEqual([1, 10]);
      expect(config.types).toContain('normal');
    });

    it('should have boss wave at 25', () => {
      const config = spawnManager.waveConfig.boss1;
      expect(config.range).toEqual([25, 25]);
      expect(config.forceBoss).toBe(true);
      expect(config.types).toEqual(['bossCharnier']);
    });

    it('should have boss wave at 50', () => {
      const config = spawnManager.waveConfig.boss2;
      expect(config.range).toEqual([50, 50]);
      expect(config.types).toEqual(['bossInfect']);
    });

    it('should have boss wave at 100', () => {
      const config = spawnManager.waveConfig.boss4;
      expect(config.range).toEqual([100, 100]);
      expect(config.types).toEqual(['bossRoi']);
    });

    it('should have final boss at wave 200', () => {
      const config = spawnManager.waveConfig.finalBoss;
      expect(config.range).toEqual([200, 200]);
      expect(config.types).toEqual(['bossApocalypse']);
    });

    it('should have intermediate phase for waves 26-49', () => {
      const config = spawnManager.waveConfig.intermediate;
      expect(config.range).toEqual([26, 49]);
      expect(config.types.length).toBeGreaterThan(5);
    });
  });

  describe('selectZombieType', () => {
    it('should return normal or fast zombie for wave 1', () => {
      const type = spawnManager.selectZombieType(1);
      expect(['normal', 'fast']).toContain(type);
    });

    it('should return boss for wave 25', () => {
      const type = spawnManager.selectZombieType(25);
      expect(type).toBe('bossCharnier');
    });

    it('should return boss for wave 50', () => {
      const type = spawnManager.selectZombieType(50);
      expect(type).toBe('bossInfect');
    });

    it('should return boss for wave 100', () => {
      const type = spawnManager.selectZombieType(100);
      expect(type).toBe('bossRoi');
    });

    it('should return boss for wave 200', () => {
      const type = spawnManager.selectZombieType(200);
      expect(type).toBe('bossApocalypse');
    });

    it('should return valid zombie type for wave 30', () => {
      const type = spawnManager.selectZombieType(30);
      expect(type).toBeDefined();
      expect(typeof type).toBe('string');
    });

    it('should occasionally return elite zombies for wave 50+', () => {
      const types = new Set();

      // Run 100 times to check elite spawn chance
      for (let i = 0; i < 100; i++) {
        const type = spawnManager.selectZombieType(60);
        types.add(type);
      }

      // Should have variety including potential elites
      expect(types.size).toBeGreaterThan(2);
    });

    it('should return different types across multiple calls (randomness)', () => {
      const types = new Set();

      for (let i = 0; i < 20; i++) {
        const type = spawnManager.selectZombieType(15);
        types.add(type);
      }

      // Should not always return same type
      expect(types.size).toBeGreaterThan(1);
    });
  });

  describe('Helper methods', () => {
    it('shouldSpawnBoss returns true for boss waves', () => {
      expect(spawnManager.shouldSpawnBoss(25)).toBe(true);
      expect(spawnManager.shouldSpawnBoss(50)).toBe(true);
      expect(spawnManager.shouldSpawnBoss(100)).toBe(true);
      expect(spawnManager.shouldSpawnBoss(200)).toBe(true);
    });

    it('shouldSpawnBoss returns false for non-boss waves', () => {
      expect(spawnManager.shouldSpawnBoss(1)).toBe(false);
      expect(spawnManager.shouldSpawnBoss(30)).toBe(false);
      expect(spawnManager.shouldSpawnBoss(99)).toBe(false);
    });

    it('getBossType returns correct boss for wave', () => {
      expect(spawnManager.getBossType(25)).toBe('bossCharnier');
      expect(spawnManager.getBossType(50)).toBe('bossInfect');
      expect(spawnManager.getBossType(100)).toBe('bossRoi');
      expect(spawnManager.getBossType(200)).toBe('bossApocalypse');
    });

    it('getBossType returns null for non-boss waves', () => {
      expect(spawnManager.getBossType(1)).toBeNull();
      expect(spawnManager.getBossType(30)).toBeNull();
    });

    it('getSpawnCount increases with wave number', () => {
      const count1 = spawnManager.getSpawnCount(1);
      const count50 = spawnManager.getSpawnCount(50);
      const count100 = spawnManager.getSpawnCount(100);

      expect(count50).toBeGreaterThan(count1);
      expect(count100).toBeGreaterThan(count50);
    });
  });

  describe('Edge cases', () => {
    it('should handle negative wave numbers', () => {
      const type = spawnManager.selectZombieType(-5);
      expect(type).toBeDefined();
    });

    it('should handle very large wave numbers', () => {
      const type = spawnManager.selectZombieType(999999);
      expect(type).toBeDefined();
    });

    it('should handle wave 0', () => {
      const type = spawnManager.selectZombieType(0);
      expect(type).toBeDefined();
    });
  });

  describe('Wave progression integrity', () => {
    it('should have no gaps in wave ranges', () => {
      const progression = spawnManager.buildWaveProgression();
      const phases = Object.values(progression);

      // Check that all waves 1-200 are covered
      const coveredWaves = new Set();

      phases.forEach(phase => {
        const [start, end] = phase.range;
        for (let wave = start; wave <= end; wave++) {
          coveredWaves.add(wave);
        }
      });

      // Should cover at least waves 1-200
      for (let wave = 1; wave <= 200; wave++) {
        expect(coveredWaves.has(wave)).toBe(true);
      }
    });

    it('should not have overlapping wave ranges', () => {
      const progression = spawnManager.buildWaveProgression();
      const phases = Object.values(progression);

      const waveOccurrences = {};

      phases.forEach(phase => {
        const [start, end] = phase.range;
        for (let wave = start; wave <= end; wave++) {
          waveOccurrences[wave] = (waveOccurrences[wave] || 0) + 1;
        }
      });

      // No wave should appear in multiple phases
      Object.values(waveOccurrences).forEach(count => {
        expect(count).toBe(1);
      });
    });

    it('should have exactly 10 boss waves', () => {
      const progression = spawnManager.buildWaveProgression();
      const bossPhases = Object.values(progression).filter(p => p.forceBoss);

      expect(bossPhases.length).toBe(10);
    });
  });
});
