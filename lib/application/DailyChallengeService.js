'use strict';

const logger = require('../../infrastructure/logging/Logger');

/** Return today's date as YYYY-MM-DD in UTC */
function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

class DailyChallengeService {
  constructor(dailyChallengeRepository) {
    this.repo = dailyChallengeRepository;
  }

  /** Get today's challenges with player progress merged in */
  async getTodayChallenges(playerId) {
    const date = todayUTC();
    const challenges = this.repo.getChallengesForDate(date);
    const progress = this.repo.getPlayerProgress(playerId, date);
    return challenges.map(c => ({
      ...c,
      progress: progress[c.id]?.progress ?? 0,
      completed: !!(progress[c.id]?.completed),
      rewardClaimed: !!(progress[c.id]?.reward_claimed),
      date
    }));
  }

  /** Apply a delta event for a player. eventType matches challenge.type */
  applyEvent(playerId, eventType, delta = 1, meta = {}) {
    const date = todayUTC();
    const challenges = this.repo.getChallengesForDate(date);
    const results = [];
    for (const c of challenges) {
      if (c.type !== eventType) {
continue;
}
      if (eventType === 'zombies_killed_type' && meta.zombieType !== c.zombieType) {
continue;
}
      const r = this.repo.applyDelta(playerId, date, c.id, delta, c.target);
      if (r.justCompleted) {
logger.info('Daily challenge completed', { playerId, challengeId: c.id, date });
}
      results.push({ challengeId: c.id, ...r });
    }
    return results;
  }

  /** Claim reward atomically. Returns reward object or null if already claimed / not completed */
  claimReward(playerId, challengeId) {
    const date = todayUTC();
    const challenges = this.repo.getChallengesForDate(date);
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) {
return null;
}
    const claimed = this.repo.claimReward(playerId, date, challengeId);
    if (!claimed) {
return null;
}
    logger.info('Daily challenge reward claimed', { playerId, challengeId, date });
    return challenge.reward;
  }
}

module.exports = { DailyChallengeService, todayUTC };
