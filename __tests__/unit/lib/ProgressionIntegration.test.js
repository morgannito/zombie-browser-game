/**
 * Unit tests for lib/server/ProgressionIntegration.js
 *
 * Mocks: container (infra), io (infra), Logger (infra)
 * Domain logic: skill delegation, damage handling, second chance, berserker
 */

jest.mock('../../../lib/infrastructure/Logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const ProgressionIntegration = require('../../../lib/server/ProgressionIntegration');

function makeContainer(overrides = {}) {
  return {
    get: name => {
      if (name === 'accountProgressionService') {
        return (
          overrides.accountProgressionService || {
            getPlayerSkillBonuses: jest.fn().mockResolvedValue({}),
            handlePlayerDeath: jest
              .fn()
              .mockResolvedValue({
                success: true,
                currentXP: 100,
                levelsGained: 0,
                skillPointsGained: 0,
                newLevel: 1,
                progression: {}
              })
          }
        );
      }
      if (name === 'achievementService') {
        return (
          overrides.achievementService || {
            checkAndUnlockAchievements: jest.fn().mockResolvedValue([])
          }
        );
      }
      return null;
    }
  };
}

function makeIo(sockets = new Map()) {
  return {
    sockets: { sockets },
    emit: jest.fn()
  };
}

function makePlayer(overrides = {}) {
  return {
    id: 'socket1',
    health: 100,
    maxHealth: 100,
    gold: 0,
    alive: true,
    ...overrides
  };
}

// --- constructor ---

describe('ProgressionIntegration constructor', () => {
  test('constructor_setsContainerAndIo', () => {
    const container = makeContainer();
    const io = makeIo();

    const pi = new ProgressionIntegration(container, io);

    expect(pi.container).toBe(container);
    expect(pi.io).toBe(io);
  });

  test('constructor_resolvesServicesFromContainer', () => {
    const accountProgressionService = {
      getPlayerSkillBonuses: jest.fn(),
      handlePlayerDeath: jest.fn()
    };
    const achievementService = { checkAndUnlockAchievements: jest.fn() };
    const container = makeContainer({ accountProgressionService, achievementService });

    const pi = new ProgressionIntegration(container, makeIo());

    expect(pi.accountProgressionService).toBe(accountProgressionService);
    expect(pi.achievementService).toBe(achievementService);
  });
});

// --- findPlayerSocket ---

describe('ProgressionIntegration findPlayerSocket', () => {
  test('findPlayerSocket_socketExists_returnsSocket', () => {
    const socket = { emit: jest.fn() };
    const sockets = new Map([['socket1', socket]]);
    const pi = new ProgressionIntegration(makeContainer(), makeIo(sockets));

    const result = pi.findPlayerSocket('socket1');

    expect(result).toBe(socket);
  });

  test('findPlayerSocket_socketMissing_returnsNull', () => {
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.findPlayerSocket('unknownId');

    expect(result).toBeNull();
  });
});

// --- applySkillBonusesOnSpawn ---

describe('ProgressionIntegration applySkillBonusesOnSpawn', () => {
  test('applySkillBonusesOnSpawn_nullPlayer_returnsNull', async () => {
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = await pi.applySkillBonusesOnSpawn(null, 'uuid', {});

    expect(result).toBeNull();
  });

  test('applySkillBonusesOnSpawn_nullUUID_returnsPlayerUnchanged', async () => {
    const player = makePlayer();
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = await pi.applySkillBonusesOnSpawn(player, null, {});

    expect(result).toBe(player);
  });

  test('applySkillBonusesOnSpawn_callsGetPlayerSkillBonuses', async () => {
    const getPlayerSkillBonuses = jest.fn().mockResolvedValue({});
    const container = makeContainer({
      accountProgressionService: { getPlayerSkillBonuses, handlePlayerDeath: jest.fn() }
    });
    const pi = new ProgressionIntegration(container, makeIo());
    const player = makePlayer();

    await pi.applySkillBonusesOnSpawn(player, 'uuid-123', {});

    expect(getPlayerSkillBonuses).toHaveBeenCalledWith('uuid-123');
  });

  test('applySkillBonusesOnSpawn_applysBonuses_toPlayer', async () => {
    const bonuses = { maxHealthBonus: 50 };
    const getPlayerSkillBonuses = jest.fn().mockResolvedValue(bonuses);
    const container = makeContainer({
      accountProgressionService: { getPlayerSkillBonuses, handlePlayerDeath: jest.fn() }
    });
    const pi = new ProgressionIntegration(container, makeIo());
    const player = makePlayer({ health: 100, maxHealth: 100 });

    await pi.applySkillBonusesOnSpawn(player, 'uuid-123', {});

    expect(player.maxHealth).toBe(150);
  });

  test('applySkillBonusesOnSpawn_emitsSkillBonusesLoaded_whenSocketFound', async () => {
    const socket = { emit: jest.fn() };
    const sockets = new Map([['socket1', socket]]);
    const bonuses = { maxHealthBonus: 10 };
    const getPlayerSkillBonuses = jest.fn().mockResolvedValue(bonuses);
    const container = makeContainer({
      accountProgressionService: { getPlayerSkillBonuses, handlePlayerDeath: jest.fn() }
    });
    const pi = new ProgressionIntegration(container, makeIo(sockets));
    const player = makePlayer({ id: 'socket1' });

    await pi.applySkillBonusesOnSpawn(player, 'uuid-123', {});

    expect(socket.emit).toHaveBeenCalledWith('skillBonusesLoaded', bonuses);
  });

  test('applySkillBonusesOnSpawn_noSocket_doesNotThrow', async () => {
    const pi = new ProgressionIntegration(makeContainer(), makeIo());
    const player = makePlayer({ id: 'no-socket' });

    await expect(pi.applySkillBonusesOnSpawn(player, 'uuid-123', {})).resolves.not.toThrow();
  });

  test('applySkillBonusesOnSpawn_serviceThrows_returnsPlayerUnchanged', async () => {
    const getPlayerSkillBonuses = jest.fn().mockRejectedValue(new Error('DB error'));
    const container = makeContainer({
      accountProgressionService: { getPlayerSkillBonuses, handlePlayerDeath: jest.fn() }
    });
    const pi = new ProgressionIntegration(container, makeIo());
    const player = makePlayer();

    const result = await pi.applySkillBonusesOnSpawn(player, 'uuid-123', {});

    expect(result).toBe(player);
  });
});

// --- handlePlayerDeath ---

describe('ProgressionIntegration handlePlayerDeath', () => {
  test('handlePlayerDeath_nullPlayer_returnsEarly', async () => {
    const handlePlayerDeathSvc = jest.fn();
    const container = makeContainer({
      accountProgressionService: {
        getPlayerSkillBonuses: jest.fn(),
        handlePlayerDeath: handlePlayerDeathSvc
      }
    });
    const pi = new ProgressionIntegration(container, makeIo());

    await pi.handlePlayerDeath(null, 'uuid');

    expect(handlePlayerDeathSvc).not.toHaveBeenCalled();
  });

  test('handlePlayerDeath_nullUUID_returnsEarly', async () => {
    const handlePlayerDeathSvc = jest.fn();
    const container = makeContainer({
      accountProgressionService: {
        getPlayerSkillBonuses: jest.fn(),
        handlePlayerDeath: handlePlayerDeathSvc
      }
    });
    const pi = new ProgressionIntegration(container, makeIo());

    await pi.handlePlayerDeath(makePlayer(), null);

    expect(handlePlayerDeathSvc).not.toHaveBeenCalled();
  });

  test('handlePlayerDeath_calculatesSurvivalTime_whenMissing', async () => {
    const gameStartTime = Date.now() - 5000;
    const player = makePlayer({ gameStartTime });
    const container = makeContainer();
    const pi = new ProgressionIntegration(container, makeIo());

    await pi.handlePlayerDeath(player, 'uuid', {});

    expect(player.survivalTime).toBeGreaterThanOrEqual(4);
    expect(player.survivalTime).toBeLessThanOrEqual(6);
  });

  test('handlePlayerDeath_survivalTimeAlreadySet_notOverridden', async () => {
    const player = makePlayer({ survivalTime: 99 });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    await pi.handlePlayerDeath(player, 'uuid', {});

    expect(player.survivalTime).toBe(99);
  });

  test('handlePlayerDeath_callsAccountProgressionService', async () => {
    const handlePlayerDeathSvc = jest
      .fn()
      .mockResolvedValue({
        success: true,
        currentXP: 50,
        levelsGained: 0,
        skillPointsGained: 0,
        newLevel: 1,
        progression: {}
      });
    const container = makeContainer({
      accountProgressionService: {
        getPlayerSkillBonuses: jest.fn(),
        handlePlayerDeath: handlePlayerDeathSvc
      }
    });
    const pi = new ProgressionIntegration(container, makeIo());
    const player = makePlayer();

    await pi.handlePlayerDeath(player, 'uuid', {});

    expect(handlePlayerDeathSvc).toHaveBeenCalledWith(player, 'uuid');
  });

  test('handlePlayerDeath_callsAchievementService', async () => {
    const checkAndUnlockAchievements = jest.fn().mockResolvedValue([]);
    const container = makeContainer({ achievementService: { checkAndUnlockAchievements } });
    const pi = new ProgressionIntegration(container, makeIo());

    await pi.handlePlayerDeath(makePlayer(), 'uuid', { kills: 5 });

    expect(checkAndUnlockAchievements).toHaveBeenCalledWith('uuid', { kills: 5 });
  });

  test('handlePlayerDeath_emitsAccountXPGained_whenSocketExists', async () => {
    const socket = { emit: jest.fn() };
    const sockets = new Map([['socket1', socket]]);
    const pi = new ProgressionIntegration(makeContainer(), makeIo(sockets));
    const player = makePlayer({ id: 'socket1' });

    await pi.handlePlayerDeath(player, 'uuid', {});

    expect(socket.emit).toHaveBeenCalledWith(
      'accountXPGained',
      expect.objectContaining({ xpEarned: 100 })
    );
  });

  test('handlePlayerDeath_emitsAchievementsUnlocked_whenAchievementsGranted', async () => {
    const socket = { emit: jest.fn() };
    const sockets = new Map([['socket1', socket]]);
    const achievement = { toObject: () => ({ id: 'hero' }) };
    const checkAndUnlockAchievements = jest.fn().mockResolvedValue([achievement]);
    const container = makeContainer({ achievementService: { checkAndUnlockAchievements } });
    const pi = new ProgressionIntegration(container, makeIo(sockets));
    const player = makePlayer({ id: 'socket1' });

    await pi.handlePlayerDeath(player, 'uuid', {});

    expect(socket.emit).toHaveBeenCalledWith(
      'achievementsUnlocked',
      expect.objectContaining({ count: 1 })
    );
  });

  test('handlePlayerDeath_serviceThrows_doesNotPropagateError', async () => {
    const handlePlayerDeathSvc = jest.fn().mockRejectedValue(new Error('fail'));
    const container = makeContainer({
      accountProgressionService: {
        getPlayerSkillBonuses: jest.fn(),
        handlePlayerDeath: handlePlayerDeathSvc
      }
    });
    const pi = new ProgressionIntegration(container, makeIo());

    await expect(pi.handlePlayerDeath(makePlayer(), 'uuid', {})).resolves.not.toThrow();
  });
});

// --- updateDynamicBonuses ---

describe('ProgressionIntegration updateDynamicBonuses', () => {
  test('updateDynamicBonuses_nullPlayer_returnsNull', () => {
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.updateDynamicBonuses(null);

    expect(result).toBeNull();
  });

  test('updateDynamicBonuses_deadPlayer_returnsUnchanged', () => {
    const player = makePlayer({ alive: false });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.updateDynamicBonuses(player);

    expect(result).toBe(player);
  });

  test('updateDynamicBonuses_alivePlayer_returnsSamePlayer', () => {
    const player = makePlayer({ alive: true });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.updateDynamicBonuses(player);

    expect(result).toBe(player);
  });

  test('updateDynamicBonuses_berserkerPlayer_activatesBerserkerWhenLowHealth', () => {
    const player = makePlayer({
      alive: true,
      health: 20,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    pi.updateDynamicBonuses(player);

    expect(player.berserkerActive).toBe(true);
  });
});

// --- handleIncomingDamage ---

describe('ProgressionIntegration handleIncomingDamage', () => {
  test('handleIncomingDamage_delegatesToSkillEffectsApplicator', () => {
    const player = makePlayer();
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.handleIncomingDamage(player, 40);

    expect(result.actualDamage).toBe(40);
    expect(result.blocked).toBe(false);
  });

  test('handleIncomingDamage_withShield_absorbsDamage', () => {
    const player = makePlayer({ shield: 100 });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.handleIncomingDamage(player, 40);

    expect(result.blocked).toBe(true);
    expect(result.actualDamage).toBe(0);
  });
});

// --- checkSecondChance ---

describe('ProgressionIntegration checkSecondChance', () => {
  test('checkSecondChance_noFlag_returnsFalse', () => {
    const player = makePlayer({ health: 0 });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.checkSecondChance(player);

    expect(result).toBe(false);
  });

  test('checkSecondChance_eligible_revivesPlayer', () => {
    const player = makePlayer({
      health: 0,
      maxHealth: 100,
      hasSecondChance: true,
      secondChanceUsed: false
    });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.checkSecondChance(player);

    expect(result).toBe(true);
    expect(player.health).toBe(50);
  });
});

// --- applyBerserkerDamage ---

describe('ProgressionIntegration applyBerserkerDamage', () => {
  test('applyBerserkerDamage_noBerserker_returnsBaseDamage', () => {
    const player = makePlayer({ health: 80, maxHealth: 100 });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.applyBerserkerDamage(100, player);

    expect(result).toBe(100);
  });

  test('applyBerserkerDamage_berserkerActive_multipliesDamage', () => {
    const player = makePlayer({
      health: 20,
      maxHealth: 100,
      berserkerDamage: 0.5,
      berserkerThreshold: 0.3
    });
    const pi = new ProgressionIntegration(makeContainer(), makeIo());

    const result = pi.applyBerserkerDamage(100, player);

    expect(result).toBe(150);
  });
});
