/**
 * Unit tests for BossStateMachine
 */

const { BOSS_STATES, updateBossStateMachine, transitionBossState } = require('../BossStateMachine');

describe('BossStateMachine', () => {
  function makeBoss(overrides = {}) {
    return { x: 0, y: 0, ...overrides };
  }

  describe('transitionBossState', () => {
    test('idle → aggro when player within range', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.IDLE });
      transitionBossState(boss, 1000, 400);
      expect(boss.aiState).toBe(BOSS_STATES.AGGRO);
    });

    test('idle stays idle when no player in range', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.IDLE });
      transitionBossState(boss, 1000, null);
      expect(boss.aiState).toBe(BOSS_STATES.IDLE);
    });

    test('aggro → special when cooldown elapsed', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.AGGRO });
      transitionBossState(boss, 5000, 300);
      expect(boss.aiState).toBe(BOSS_STATES.SPECIAL);
      expect(boss.lastSpecial).toBe(5000);
    });

    test('special → cooldown after specialDuration', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.SPECIAL, specialStart: 1000 });
      transitionBossState(boss, 3100, 300);
      expect(boss.aiState).toBe(BOSS_STATES.COOLDOWN);
    });

    test('special stays special before duration', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.SPECIAL, specialStart: 1000 });
      transitionBossState(boss, 1500, 300);
      expect(boss.aiState).toBe(BOSS_STATES.SPECIAL);
    });

    test('cooldown → aggro after cooldownDuration', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.COOLDOWN, cooldownStart: 1000 });
      transitionBossState(boss, 5100, 300);
      expect(boss.aiState).toBe(BOSS_STATES.AGGRO);
    });
  });

  describe('updateBossStateMachine', () => {
    test('initializes state to idle when missing', () => {
      const boss = makeBoss();
      updateBossStateMachine(boss, 1000, null);
      expect(boss.aiState).toBeDefined();
    });

    test('uses collisionManager to find player distance', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.IDLE });
      const cm = { findClosestPlayer: jest.fn(() => ({ x: 100, y: 0 })) };
      updateBossStateMachine(boss, 1000, cm);
      expect(cm.findClosestPlayer).toHaveBeenCalled();
      expect(boss.aiState).toBe(BOSS_STATES.AGGRO);
    });

    test('stays idle when no collision manager', () => {
      const boss = makeBoss({ aiState: BOSS_STATES.IDLE });
      updateBossStateMachine(boss, 1000, null);
      expect(boss.aiState).toBe(BOSS_STATES.IDLE);
    });

    test('returns current state', () => {
      // cooldown active → stays in AGGRO
      const boss = makeBoss({ aiState: BOSS_STATES.AGGRO, lastSpecial: 500 });
      const state = updateBossStateMachine(boss, 1000, null);
      expect(state).toBe(BOSS_STATES.AGGRO);
    });
  });
});
