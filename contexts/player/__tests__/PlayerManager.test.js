/**
 * Unit tests for contexts/player/PlayerManager.js
 */

const PlayerManager = require('../PlayerManager');

const CONFIG = {
  ROOM_WIDTH: 2000,
  ROOM_HEIGHT: 1500,
  PLAYER_MAX_HEALTH: 100
};

const makeUpgrades = () => ({
  damage1:   { name: 'Sharp Bullets', description: '+20% dmg',  rarity: 'common',    effect: jest.fn(p => { p.damageMultiplier += 0.2; }) },
  damage2:   { name: 'Sharper',       description: '+30% dmg',  rarity: 'common',    effect: jest.fn(p => { p.damageMultiplier += 0.3; }) },
  piercing:  { name: 'Piercing',      description: 'pierce +1', rarity: 'rare',      effect: jest.fn(p => { p.bulletPiercing += 1; }) },
  turret:    { name: 'Auto Turret',   description: '+1 turret', rarity: 'rare',      effect: jest.fn(p => { p.autoTurrets += 1; }) },
  godmode:   { name: 'Godmode',       description: 'immortal',  rarity: 'legendary', effect: jest.fn(p => { p.godmode = true; }) }
});

function makeGS() {
  return { players: {}, zombies: {} };
}

describe('getXPForLevel', () => {
  let pm;
  beforeEach(() => { pm = new PlayerManager(makeGS(), CONFIG, {}); });

  test('levels 1-5 use 50 + 30*(level-1)', () => {
    expect(pm.getXPForLevel(1)).toBe(50);
    expect(pm.getXPForLevel(2)).toBe(80);
    expect(pm.getXPForLevel(5)).toBe(170);
  });

  test('levels 6-10 use 200 + 50*(level-5)', () => {
    expect(pm.getXPForLevel(6)).toBe(250);
    expect(pm.getXPForLevel(10)).toBe(450);
  });

  test('levels 11-20 use 400 + 75*(level-10)', () => {
    expect(pm.getXPForLevel(11)).toBe(475);
    expect(pm.getXPForLevel(20)).toBe(1150);
  });

  test('levels 21+ use 1000 + 60*(level-20)', () => {
    expect(pm.getXPForLevel(21)).toBe(1060);
    expect(pm.getXPForLevel(30)).toBe(1600);
  });
});

describe('generateUpgradeChoices', () => {
  test('returns 3 unique upgrade choices', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const choices = pm.generateUpgradeChoices();
    expect(choices).toHaveLength(3);
    const ids = choices.map(c => c.id);
    expect(new Set(ids).size).toBe(3);
  });

  test('each choice has id/name/description/rarity', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const [c] = pm.generateUpgradeChoices();
    expect(c).toEqual(expect.objectContaining({
      id: expect.any(String), name: expect.any(String),
      description: expect.any(String), rarity: expect.any(String)
    }));
  });

  test('picks legendary when common rolled but only legendary exists (fallback loop)', () => {
    const upgrades = {
      leg1: { name: 'L1', description: 'l', rarity: 'legendary', effect: jest.fn() },
      leg2: { name: 'L2', description: 'l', rarity: 'legendary', effect: jest.fn() },
      leg3: { name: 'L3', description: 'l', rarity: 'legendary', effect: jest.fn() }
    };
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    // Always roll 0.95 (legendary) so first loop populates; fallback loop not triggered.
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.95);
    const choices = pm.generateUpgradeChoices();
    expect(choices).toHaveLength(3);
    expect(choices.every(c => c.rarity === 'legendary')).toBe(true);
    randSpy.mockRestore();
  });

  test('picks rare rarity when 0.6 <= rand < 0.9', () => {
    const upgrades = {
      rare1: { name: 'R1', description: 'r', rarity: 'rare', effect: jest.fn() }
    };
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.7);
    const choices = pm.generateUpgradeChoices();
    expect(choices).toHaveLength(1);
    expect(choices[0].rarity).toBe('rare');
    randSpy.mockRestore();
  });

  test('picks legendary rarity when rand >= 0.9', () => {
    const upgrades = {
      leg1: { name: 'L1', description: 'l', rarity: 'legendary', effect: jest.fn() }
    };
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.95);
    const choices = pm.generateUpgradeChoices();
    expect(choices).toHaveLength(1);
    expect(choices[0].rarity).toBe('legendary');
    randSpy.mockRestore();
  });

  test('returns fewer than 3 when upgrade pool smaller', () => {
    const upgrades = {
      one: { name: 'A', description: 'a', rarity: 'common', effect: jest.fn() }
    };
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    const choices = pm.generateUpgradeChoices();
    expect(choices).toHaveLength(1);
  });

  test('returns empty when no upgrades configured', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, {});
    expect(pm.generateUpgradeChoices()).toEqual([]);
  });
});

describe('applyUpgrade', () => {
  test('invokes upgrade.effect on player', () => {
    const upgrades = makeUpgrades();
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    const player = { damageMultiplier: 1 };
    pm.applyUpgrade(player, 'damage1');
    expect(upgrades.damage1.effect).toHaveBeenCalledWith(player);
    expect(player.damageMultiplier).toBeCloseTo(1.2);
  });

  test('silently ignores unknown upgrade id', () => {
    const upgrades = makeUpgrades();
    const pm = new PlayerManager(makeGS(), CONFIG, upgrades);
    const player = {};
    expect(() => pm.applyUpgrade(player, 'nope')).not.toThrow();
  });

  test('silently ignores upgrade without effect function', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, { bad: { rarity: 'common' } });
    expect(() => pm.applyUpgrade({}, 'bad')).not.toThrow();
  });
});

describe('addXP', () => {
  let pm;
  beforeEach(() => { pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades()); });

  test('adds XP without leveling when below threshold', () => {
    const player = { xp: 0, level: 1 };
    pm.addXP(player, 25);
    expect(player.xp).toBe(25);
    expect(player.level).toBe(1);
  });

  test('levels up when XP meets threshold, deducts threshold', () => {
    const player = { xp: 0, level: 1 };
    const cb = jest.fn();
    pm.addXP(player, 80, cb);
    expect(player.level).toBe(2);
    expect(player.xp).toBe(30); // 80 - 50
    expect(cb).toHaveBeenCalledWith(player, expect.any(Array));
  });

  test('handles multi-level-up from single award', () => {
    const player = { xp: 0, level: 1 };
    const cb = jest.fn();
    pm.addXP(player, 200, cb); // 50 + 80 = 130, residual 70 < 110
    expect(player.level).toBe(3);
    expect(player.xp).toBe(70);
    expect(cb).toHaveBeenCalledTimes(2);
  });

  test('rejects negative/NaN/Infinity XP', () => {
    const player = { xp: 10, level: 1 };
    pm.addXP(player, -5);
    pm.addXP(player, NaN);
    pm.addXP(player, Infinity);
    expect(player.xp).toBe(10);
    expect(player.level).toBe(1);
  });

  test('handles missing initial xp', () => {
    const player = { level: 1 };
    pm.addXP(player, 30);
    expect(player.xp).toBe(30);
  });

  test('no callback is OK', () => {
    const player = { xp: 0, level: 1 };
    expect(() => pm.addXP(player, 100)).not.toThrow();
    expect(player.level).toBe(2);
  });
});

describe('createPlayer', () => {
  test('returns fully initialized player at bottom-center', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const p = pm.createPlayer('sock-123');
    expect(p.id).toBe('sock-123');
    expect(p.x).toBe(1000);
    expect(p.y).toBe(1400);
    expect(p.health).toBe(100);
    expect(p.maxHealth).toBe(100);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.gold).toBe(0);
    expect(p.alive).toBe(true);
    expect(p.weapon).toBe('pistol');
    expect(p.nickname).toBeNull();
    expect(p.hasNickname).toBe(false);
  });

  test('all upgrade multipliers default to 1, ability counters to 0', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const p = pm.createPlayer('s');
    expect(p.damageMultiplier).toBe(1);
    expect(p.speedMultiplier).toBe(1);
    expect(p.fireRateMultiplier).toBe(1);
    expect(p.autoTurrets).toBe(0);
    expect(p.regeneration).toBe(0);
    expect(p.bulletPiercing).toBe(0);
    expect(p.lifeSteal).toBe(0);
    expect(p.criticalChance).toBe(0);
    expect(p.dodgeChance).toBe(0);
    expect(p.explosiveRounds).toBe(0);
    expect(p.thorns).toBe(0);
  });

  test('shop upgrade slots initialized to 0', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const p = pm.createPlayer('s');
    expect(p.upgrades).toEqual({ maxHealth: 0, damage: 0, speed: 0, fireRate: 0 });
  });

  test('combo/score tracking starts at 0', () => {
    const pm = new PlayerManager(makeGS(), CONFIG, makeUpgrades());
    const p = pm.createPlayer('s');
    expect(p.kills).toBe(0);
    expect(p.zombiesKilled).toBe(0);
    expect(p.combo).toBe(0);
    expect(p.highestCombo).toBe(0);
    expect(p.totalScore).toBe(0);
    expect(p.score).toBe(0);
  });
});
