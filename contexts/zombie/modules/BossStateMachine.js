/**
 * @fileoverview Boss AI state machine
 * @description idle → aggro → special → cooldown transitions for all boss types
 */

const BOSS_STATES = { IDLE: 'idle', AGGRO: 'aggro', SPECIAL: 'special', COOLDOWN: 'cooldown' };

const BOSS_STATE_CONFIG = {
  aggroRange: 600,
  specialDuration: 2000,
  cooldownDuration: 4000
};

/**
 * Transition boss to a new state if conditions are met.
 * Returns true if a transition occurred.
 */
function transitionBossState(boss, now, closestPlayerDist) {
  const cfg = BOSS_STATE_CONFIG;
  const state = boss.aiState || BOSS_STATES.IDLE;

  if (state === BOSS_STATES.IDLE) {
    if (closestPlayerDist !== null && closestPlayerDist < cfg.aggroRange) {
      boss.aiState = BOSS_STATES.AGGRO;
      return true;
    }
    return false;
  }

  if (state === BOSS_STATES.AGGRO) {
    if (!boss.lastSpecial || now - boss.lastSpecial >= cfg.cooldownDuration) {
      boss.aiState = BOSS_STATES.SPECIAL;
      boss.specialStart = now;
      boss.lastSpecial = now;
      return true;
    }
    return false;
  }

  if (state === BOSS_STATES.SPECIAL) {
    if (now - (boss.specialStart || 0) >= cfg.specialDuration) {
      boss.aiState = BOSS_STATES.COOLDOWN;
      boss.cooldownStart = now;
      return true;
    }
    return false;
  }

  if (state === BOSS_STATES.COOLDOWN) {
    if (now - (boss.cooldownStart || 0) >= cfg.cooldownDuration) {
      boss.aiState = BOSS_STATES.AGGRO;
      return true;
    }
    return false;
  }

  return false;
}

/**
 * Update boss state machine. Call once per tick before ability updates.
 * @returns {string} current state after update
 */
function updateBossStateMachine(boss, now, collisionManager) {
  if (!boss.aiState) {
    boss.aiState = BOSS_STATES.IDLE;
  }

  let dist = null;
  if (collisionManager) {
    const closest = collisionManager.findClosestPlayer(boss.x, boss.y, BOSS_STATE_CONFIG.aggroRange, {
      ignoreSpawnProtection: true,
      ignoreInvisible: false
    });
    if (closest) {
      const dx = closest.x - boss.x;
      const dy = closest.y - boss.y;
      dist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  transitionBossState(boss, now, dist);
  return boss.aiState;
}

module.exports = { BOSS_STATES, updateBossStateMachine, transitionBossState };
