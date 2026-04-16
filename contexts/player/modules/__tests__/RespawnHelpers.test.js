/**
 * Unit tests for contexts/player/modules/RespawnHelpers.js
 */

const {
  savePlayerProgressionSnapshot,
  resetPlayerRunState,
  restorePlayerProgression
} = require('../RespawnHelpers');

describe('savePlayerProgressionSnapshot', () => {
  test('captures upgrades, multipliers, progression, and level-up stats', () => {
    const player = {
      upgrades: { damage: 2, fireRate: 1 },
      damageMultiplier: 1.5, speedMultiplier: 1.2, fireRateMultiplier: 0.8,
      level: 7, xp: 1200,
      regeneration: 5, bulletPiercing: 1, lifeSteal: 0.1,
      criticalChance: 0.15, goldMagnetRadius: 100, dodgeChance: 0.05,
      explosiveRounds: true, explosionRadius: 50, explosionDamagePercent: 0.5,
      extraBullets: 2, thorns: 0.3, autoTurrets: 1
    };
    const snap = savePlayerProgressionSnapshot(player);
    expect(snap.upgrades).toEqual({ damage: 2, fireRate: 1 });
    expect(snap.upgrades).not.toBe(player.upgrades); // cloned
    expect(snap.multipliers).toEqual({ damage: 1.5, speed: 1.2, fireRate: 0.8 });
    expect(snap.progression).toEqual({ level: 7, xp: 1200 });
    expect(snap.levelUpStats.lifeSteal).toBe(0.1);
    expect(snap.levelUpStats.thorns).toBe(0.3);
    expect(snap.levelUpStats.autoTurrets).toBe(1);
  });
});

describe('resetPlayerRunState', () => {
  const config = {
    ROOM_WIDTH: 1000,
    ROOM_HEIGHT: 1000,
    WALL_THICKNESS: 40,
    PLAYER_SIZE: 20
  };

  test('wipes per-run stats while leaving progression untouched by caller', () => {
    const player = {
      nickname: 'oldnick',
      hasNickname: true,
      spawnProtection: true,
      spawnProtectionEndTime: 123,
      invisible: true,
      invisibleEndTime: 123,
      alive: false,
      gold: 999,
      score: 9999,
      weapon: 'rocketLauncher',
      combo: 15, highestCombo: 20,
      kills: 10, zombiesKilled: 10,
      level: 7 // kept by caller
    };
    resetPlayerRunState(player, config, 250);

    expect(player.nickname).toBeNull();
    expect(player.hasNickname).toBe(false);
    expect(player.alive).toBe(true);
    expect(player.gold).toBe(0);
    expect(player.weapon).toBe('pistol');
    expect(player.combo).toBe(0);
    expect(player.health).toBe(250);
    expect(player.maxHealth).toBe(250);
    expect(player.spawnProtection).toBe(false);
    expect(player.level).toBe(7); // caller's responsibility
  });

  test('spawns player inside safe area of the room', () => {
    const player = {};
    resetPlayerRunState(player, config, 100);
    expect(player.x).toBeGreaterThan(0);
    expect(player.x).toBeLessThan(config.ROOM_WIDTH);
    expect(player.y).toBeGreaterThan(0);
    expect(player.y).toBeLessThan(config.ROOM_HEIGHT);
  });

  test('uses defaults when config fields missing', () => {
    const player = {};
    const minConfig = { ROOM_WIDTH: 800, ROOM_HEIGHT: 800 };
    expect(() => resetPlayerRunState(player, minConfig, 100)).not.toThrow();
  });
});

describe('restorePlayerProgression', () => {
  test('reapplies snapshot fields and resets timers', () => {
    const player = {
      level: 1, xp: 0, damageMultiplier: 1,
      regeneration: 0
    };
    const snapshot = {
      upgrades: { damage: 3 },
      multipliers: { damage: 2, speed: 1.5, fireRate: 0.5 },
      progression: { level: 10, xp: 5000 },
      levelUpStats: {
        regeneration: 8,
        bulletPiercing: 2,
        lifeSteal: 0.2,
        criticalChance: 0.25,
        goldMagnetRadius: 200,
        dodgeChance: 0.1,
        explosiveRounds: true,
        explosionRadius: 80,
        explosionDamagePercent: 0.7,
        extraBullets: 3,
        thorns: 0.5,
        autoTurrets: 2
      }
    };
    const before = Date.now();
    restorePlayerProgression(player, snapshot);
    expect(player.level).toBe(10);
    expect(player.xp).toBe(5000);
    expect(player.upgrades).toEqual({ damage: 3 });
    expect(player.damageMultiplier).toBe(2);
    expect(player.speedMultiplier).toBe(1.5);
    expect(player.fireRateMultiplier).toBe(0.5);
    expect(player.regeneration).toBe(8);
    expect(player.lifeSteal).toBe(0.2);
    expect(player.autoTurrets).toBe(2);
    expect(player.lastRegenTick).toBeGreaterThanOrEqual(before);
    expect(player.lastAutoShot).toBeGreaterThanOrEqual(before);
  });
});
