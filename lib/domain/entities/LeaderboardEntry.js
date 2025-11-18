/**
 * LEADERBOARD ENTRY ENTITY
 * Domain model for leaderboard scores
 */

class LeaderboardEntry {
  constructor({
    id = null,
    playerId,
    playerUsername,
    wave,
    level,
    kills,
    survivalTime,
    score,
    createdAt = Date.now()
  }) {
    this.id = id;
    this.playerId = playerId;
    this.playerUsername = playerUsername;
    this.wave = wave;
    this.level = level;
    this.kills = kills;
    this.survivalTime = survivalTime;
    this.score = score;
    this.createdAt = createdAt;
  }

  /**
   * Calculate composite score for ranking
   */
  static calculateScore(wave, level, kills, survivalTime) {
    return (
      wave * 100 +
      level * 50 +
      kills * 10 +
      Math.floor(survivalTime / 60) * 5 // 5 points per minute survived
    );
  }

  /**
   * Format survival time as MM:SS
   */
  getFormattedSurvivalTime() {
    const minutes = Math.floor(this.survivalTime / 60);
    const seconds = this.survivalTime % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Check if entry is better than another
   */
  isBetterThan(other) {
    if (this.score !== other.score) {
      return this.score > other.score;
    }
    if (this.wave !== other.wave) {
      return this.wave > other.wave;
    }
    return this.kills > other.kills;
  }

  /**
   * Convert to plain object
   */
  toObject() {
    return {
      id: this.id,
      playerId: this.playerId,
      playerUsername: this.playerUsername,
      wave: this.wave,
      level: this.level,
      kills: this.kills,
      survivalTime: this.survivalTime,
      score: this.score,
      createdAt: this.createdAt
    };
  }

  /**
   * Create from database row
   */
  static fromDB(row, username = null) {
    return new LeaderboardEntry({
      id: row.id,
      playerId: row.player_id,
      playerUsername: username || row.username,
      wave: row.wave,
      level: row.level,
      kills: row.kills,
      survivalTime: row.survival_time,
      score: row.score,
      createdAt: row.created_at * 1000
    });
  }
}

module.exports = LeaderboardEntry;
