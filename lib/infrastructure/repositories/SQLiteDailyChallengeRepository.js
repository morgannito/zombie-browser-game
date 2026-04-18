'use strict';


/** Deterministic seeded PRNG (mulberry32) — same output for same seed */
function seededRng(seed) {
  let s = seed >>> 0;
  return () => {
 s += 0x6d2b79f5; let t = Math.imul(s ^ (s >>> 15), 1 | s); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
}

/** Numeric hash of a YYYY-MM-DD string */
function dateToSeed(dateStr) {
  const s = dateStr.replace(/-/g, '');
  let h = 0x811c9dc5;
  for (const c of s) {
 h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
}
  return h;
}

const POOL = [
  { id: 'kill_50_zombies', type: 'zombies_killed', target: 50, reward: { gold: 100, gems: 10 } },
  { id: 'kill_fast_zombies', type: 'zombies_killed_type', zombieType: 'fast', target: 30, reward: { gold: 120, gems: 12 } },
  { id: 'kill_tank_zombies', type: 'zombies_killed_type', zombieType: 'tank', target: 15, reward: { gold: 150, gems: 15 } },
  { id: 'reach_level_15', type: 'reach_level', target: 15, reward: { gold: 150, gems: 15 } },
  { id: 'earn_1000_gold', type: 'gold_earned', target: 1000, reward: { gold: 200, gems: 20 } },
  { id: 'survive_10_waves', type: 'waves_survived', target: 10, reward: { gold: 180, gems: 18 } },
  { id: 'critical_hits_20', type: 'critical_hits', target: 20, reward: { gold: 130, gems: 13 } },
  { id: 'defeat_boss', type: 'bosses_defeated', target: 2, reward: { gold: 200, gems: 20 } },
  { id: 'no_damage_5min', type: 'no_damage_time', target: 300, reward: { gold: 250, gems: 25 } },
  { id: 'no_shop_purchase', type: 'no_shop_purchase', target: 1, reward: { gold: 150, gems: 15 } }
];

/** Pick 3 challenges deterministically for a date string (YYYY-MM-DD UTC) */
function generateForDate(dateStr) {
  const rng = seededRng(dateToSeed(dateStr));
  const pool = [...POOL];
  const picks = [];
  while (picks.length < 3 && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

class SQLiteDailyChallengeRepository {
  constructor(db) {
    this.db = db;
    this._prepare();
  }

  _prepare() {
    this.stmts = {
      getDate: this.db.prepare('SELECT challenges_json FROM daily_challenges WHERE challenge_date = ?'),
      insertDate: this.db.prepare('INSERT OR IGNORE INTO daily_challenges (challenge_date, challenges_json) VALUES (?, ?)'),
      getProgress: this.db.prepare('SELECT challenge_id, progress, completed, reward_claimed FROM player_daily_challenges WHERE player_id = ? AND challenge_date = ?'),
      upsertProgress: this.db.prepare(`INSERT INTO player_daily_challenges (player_id, challenge_date, challenge_id, progress, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(player_id, challenge_date, challenge_id) DO UPDATE SET
          progress = excluded.progress, completed = excluded.completed, completed_at = COALESCE(player_daily_challenges.completed_at, excluded.completed_at)`),
      claimReward: this.db.prepare(`UPDATE player_daily_challenges SET reward_claimed = 1, claimed_at = ?
        WHERE player_id = ? AND challenge_date = ? AND challenge_id = ? AND completed = 1 AND reward_claimed = 0`),
      getOne: this.db.prepare('SELECT progress, completed, reward_claimed, claimed_at FROM player_daily_challenges WHERE player_id = ? AND challenge_date = ? AND challenge_id = ?')
    };
  }

  /** Get or create the challenge set for a date */
  getChallengesForDate(dateStr) {
    let row = this.stmts.getDate.get(dateStr);
    if (!row) {
      const challenges = generateForDate(dateStr);
      this.stmts.insertDate.run(dateStr, JSON.stringify(challenges));
      row = this.stmts.getDate.get(dateStr);
    }
    return JSON.parse(row.challenges_json);
  }

  /** Get player progress map for a date, keyed by challenge_id */
  getPlayerProgress(playerId, dateStr) {
    const rows = this.stmts.getProgress.all(playerId, dateStr);
    return Object.fromEntries(rows.map(r => [r.challenge_id, r]));
  }

  /** Apply a delta to a player's challenge progress (not a full scan) */
  applyDelta(playerId, dateStr, challengeId, delta, target) {
    const existing = this.stmts.getOne.get(playerId, dateStr, challengeId);
    const prev = existing ? existing.progress : 0;
    const newProgress = Math.min(prev + delta, target);
    const completed = newProgress >= target ? 1 : 0;
    const completedAt = completed && !(existing && existing.completed) ? Math.floor(Date.now() / 1000) : (existing && existing.completed_at) || null;
    this.stmts.upsertProgress.run(playerId, dateStr, challengeId, newProgress, completed, completedAt);
    return { progress: newProgress, completed: !!completed, justCompleted: completed && !(existing && existing.completed) };
  }

  /** Atomic reward claim — returns true only if claim succeeds (prevents double-claim) */
  claimReward(playerId, dateStr, challengeId) {
    const now = Math.floor(Date.now() / 1000);
    const result = this.stmts.claimReward.run(now, playerId, dateStr, challengeId);
    return result.changes > 0;
  }
}

module.exports = { SQLiteDailyChallengeRepository, generateForDate, POOL };
