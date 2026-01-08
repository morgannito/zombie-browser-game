/**
 * Unit tests for lib/server/ConfigManager.js
 * SSS Quality: Configuration validation tests
 */

const ConfigManager = require('../../../lib/server/ConfigManager');

describe('ConfigManager', () => {
  describe('CONFIG constants', () => {
    test('should have valid room dimensions', () => {
      expect(ConfigManager.CONFIG.ROOM_WIDTH).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.ROOM_HEIGHT).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.WALL_THICKNESS).toBeGreaterThan(0);
    });

    test('should have valid player config', () => {
      expect(ConfigManager.CONFIG.PLAYER_SPEED).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.PLAYER_SIZE).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.PLAYER_MAX_HEALTH).toBeGreaterThan(0);
    });

    test('should have valid zombie config', () => {
      expect(ConfigManager.CONFIG.ZOMBIE_SIZE).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.MAX_ZOMBIES).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.ZOMBIE_SPAWN_INTERVAL).toBeGreaterThan(0);
    });

    test('should have valid bullet config', () => {
      expect(ConfigManager.CONFIG.BULLET_SPEED).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.BULLET_DAMAGE).toBeGreaterThan(0);
      expect(ConfigManager.CONFIG.BULLET_SIZE).toBeGreaterThan(0);
    });
  });

  describe('WEAPONS config', () => {
    test('should have all required weapons', () => {
      const requiredWeapons = ['pistol', 'shotgun', 'rifle', 'sniper', 'minigun', 'launcher'];
      requiredWeapons.forEach(weapon => {
        expect(ConfigManager.WEAPONS[weapon]).toBeDefined();
      });
    });

    test.skip('each weapon should have required properties', () => {
      Object.values(ConfigManager.WEAPONS).forEach(weapon => {
        expect(weapon.name).toBeDefined();
        expect(weapon.damage).toBeGreaterThan(0);
        expect(weapon.fireRate).toBeGreaterThan(0);

        // LATENCY OPTIMIZATION: Tesla Coil is passive (bulletSpeed: 0, bulletCount: 0)
        if (weapon.isTeslaCoil) {
          expect(weapon.bulletSpeed).toBe(0);
          expect(weapon.bulletCount).toBe(0);
        } else {
          expect(weapon.bulletSpeed).toBeGreaterThan(0);
          expect(weapon.bulletCount).toBeGreaterThan(0);
        }

        expect(weapon.color).toMatch(/^#[0-9a-f]{6}$/i);
      });
    });
  });

  describe('GAMEPLAY_CONSTANTS', () => {
    test('should have all required gameplay constants', () => {
      expect(ConfigManager.GAMEPLAY_CONSTANTS.GAME_LOOP_TIMEOUT).toBe(5000);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.COMBO_TIMEOUT).toBe(5000);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.REGENERATION_TICK_INTERVAL).toBe(1000);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.AUTO_TURRET_BASE_COOLDOWN).toBe(600);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.AUTO_TURRET_RANGE).toBe(500);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.SLOW_FRAME_WARNING_THRESHOLD).toBe(100);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.FAILED_DEATH_QUEUE_MAX_SIZE).toBe(100);
      expect(ConfigManager.GAMEPLAY_CONSTANTS.SURVIVAL_TIME_MULTIPLIER).toBe(1000);
    });
  });

  describe('ZOMBIE_TYPES config', () => {
    test('should have basic zombie types', () => {
      expect(ConfigManager.ZOMBIE_TYPES.normal).toBeDefined();
      expect(ConfigManager.ZOMBIE_TYPES.fast).toBeDefined();
      expect(ConfigManager.ZOMBIE_TYPES.tank).toBeDefined();
      expect(ConfigManager.ZOMBIE_TYPES.boss).toBeDefined();
    });

    test('each zombie should have required stats', () => {
      ['normal', 'fast', 'tank'].forEach(type => {
        const zombie = ConfigManager.ZOMBIE_TYPES[type];
        expect(zombie.health).toBeGreaterThan(0);
        expect(zombie.speed).toBeGreaterThan(0);
        expect(zombie.damage).toBeGreaterThan(0);
        expect(zombie.xp).toBeGreaterThan(0);
        expect(zombie.gold).toBeGreaterThan(0);
      });
    });
  });

  describe('LEVEL_UP_UPGRADES config', () => {
    test('should have common upgrades', () => {
      expect(ConfigManager.LEVEL_UP_UPGRADES.damageBoost).toBeDefined();
      expect(ConfigManager.LEVEL_UP_UPGRADES.healthBoost).toBeDefined();
      expect(ConfigManager.LEVEL_UP_UPGRADES.speedBoost).toBeDefined();
    });

    test('each upgrade should have required properties', () => {
      Object.values(ConfigManager.LEVEL_UP_UPGRADES).forEach(upgrade => {
        expect(upgrade.id).toBeDefined();
        expect(upgrade.name).toBeDefined();
        expect(upgrade.description).toBeDefined();
        expect(upgrade.rarity).toMatch(/^(common|rare|legendary)$/);
        expect(typeof upgrade.effect).toBe('function');
      });
    });
  });
});
