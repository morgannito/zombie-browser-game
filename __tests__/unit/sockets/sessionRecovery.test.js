const {
  disconnectedPlayers,
  startSessionCleanupInterval,
  stopSessionCleanupInterval,
  normalizeSessionId,
  sanitizePlayersState,
  createRecoverablePlayerState,
  restoreRecoverablePlayerState,
  getDisconnectedSessionCount
} = require("../../../contexts/session/sessionRecovery");

describe('sessionRecovery', () => {
  beforeEach(() => {
    disconnectedPlayers.clear();
    stopSessionCleanupInterval();
    jest.useRealTimers();
  });

  afterAll(() => {
    stopSessionCleanupInterval();
    jest.useRealTimers();
  });

  test('normalizeSessionId accepts only UUIDs', () => {
    expect(normalizeSessionId('550e8400-e29b-41d4-a716-446655440000')).toBe(
      '550e8400-e29b-41d4-a716-446655440000'
    );
    expect(normalizeSessionId('not-a-uuid')).toBeNull();
    expect(normalizeSessionId('')).toBeNull();
    expect(normalizeSessionId(null)).toBeNull();
  });

  test('sanitizePlayersState removes sensitive identifiers', () => {
    const players = {
      socketA: {
        socketId: 'socketA',
        sessionId: 'sessionA',
        accountId: 'accountA',
        nickname: 'A'
      }
    };

    const sanitized = sanitizePlayersState(players);
    expect(sanitized.socketA.nickname).toBe('A');
    expect(sanitized.socketA.socketId).toBeUndefined();
    expect(sanitized.socketA.sessionId).toBeUndefined();
    expect(sanitized.socketA.accountId).toBeUndefined();
  });

  test('create/restore recoverable player state preserves gameplay fields', () => {
    const original = {
      id: 'socket-old',
      socketId: 'socket-old',
      sessionId: '550e8400-e29b-41d4-a716-446655440000',
      accountId: 'account-1',
      nickname: 'Tester',
      hasNickname: true,
      spawnProtection: false,
      spawnProtectionEndTime: 0,
      invisible: false,
      invisibleEndTime: 0,
      lastActivityTime: 1,
      x: 10,
      y: 20,
      health: 90,
      maxHealth: 100,
      level: 3,
      xp: 50,
      gold: 120,
      score: 400,
      alive: true,
      angle: 0.5,
      weapon: 'pistol',
      lastShot: 0,
      speedBoost: null,
      weaponTimer: null,
      kills: 2,
      zombiesKilled: 4,
      combo: 1,
      comboTimer: 0,
      highestCombo: 2,
      totalScore: 400,
      survivalTime: 1000,
      upgrades: { maxHealth: 1, damage: 1, speed: 0, fireRate: 0 },
      damageMultiplier: 1.1,
      speedMultiplier: 1,
      fireRateMultiplier: 1,
      regeneration: 0,
      bulletPiercing: 0,
      lifeSteal: 0,
      criticalChance: 0,
      goldMagnetRadius: 0,
      dodgeChance: 0,
      explosiveRounds: 0,
      explosionRadius: 0,
      explosionDamagePercent: 0,
      extraBullets: 0,
      thorns: 0,
      lastRegenTick: 1000,
      autoTurrets: 0,
      lastAutoShot: 1000
    };

    const snapshot = createRecoverablePlayerState(original);
    const restored = restoreRecoverablePlayerState(
      snapshot,
      'socket-new',
      '550e8400-e29b-41d4-a716-446655440001',
      'account-1'
    );

    expect(restored.id).toBe('socket-new');
    expect(restored.socketId).toBe('socket-new');
    expect(restored.sessionId).toBe('550e8400-e29b-41d4-a716-446655440001');
    expect(restored.accountId).toBe('account-1');
    expect(restored.nickname).toBe('Tester');
    expect(restored.level).toBe(3);
  });

  test('SESSION_RECOVERY_TIMEOUT is 10 minutes', () => {
    const { SESSION_RECOVERY_TIMEOUT } = require('../../../config/constants');
    expect(SESSION_RECOVERY_TIMEOUT).toBe(10 * 60 * 1000);
  });

  test('cleanup interval removes expired sessions and reports count', () => {
    jest.useFakeTimers();
    const logger = { info: jest.fn() };
    const now = Date.now();

    disconnectedPlayers.set('expired', {
      disconnectedAt: now - 11 * 60 * 1000, // 11 min ago > 10 min TTL
      playerState: {}
    });
    disconnectedPlayers.set('fresh', {
      disconnectedAt: now,
      playerState: {}
    });

    expect(getDisconnectedSessionCount()).toBe(2);

    startSessionCleanupInterval(logger);
    jest.advanceTimersByTime(60000);

    expect(disconnectedPlayers.has('expired')).toBe(false);
    expect(disconnectedPlayers.has('fresh')).toBe(true);
    expect(getDisconnectedSessionCount()).toBe(1);
    expect(logger.info).toHaveBeenCalledWith(
      'Session recovery cleanup',
      expect.objectContaining({ cleanedCount: 1 })
    );
  });
});
