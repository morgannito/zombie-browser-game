/**
 * PLAYER ENTITY - Domain model
 * Pure business logic, no infrastructure dependencies
 */

class Player {
  constructor({
    id,
    username,
    totalKills = 0,
    totalDeaths = 0,
    highestWave = 0,
    highestLevel = 0,
    totalPlaytime = 0,
    totalGoldEarned = 0,
    createdAt = Date.now(),
    lastSeen = Date.now()
  }) {
    this.id = id;
    this.username = username;
    this.totalKills = totalKills;
    this.totalDeaths = totalDeaths;
    this.highestWave = highestWave;
    this.highestLevel = highestLevel;
    this.totalPlaytime = totalPlaytime;
    this.totalGoldEarned = totalGoldEarned;
    this.createdAt = createdAt;
    this.lastSeen = lastSeen;
  }

  /**
   * Update player stats after game session
   */
  updateStats({ kills, deaths, wave, level, playtime, goldEarned }) {
    this.totalKills += kills;
    this.totalDeaths += deaths;
    this.highestWave = Math.max(this.highestWave, wave);
    this.highestLevel = Math.max(this.highestLevel, level);
    this.totalPlaytime += playtime;
    this.totalGoldEarned += goldEarned;
    this.lastSeen = Date.now();
  }

  /**
   * Check if player has achieved new personal record
   */
  isNewRecord(wave, level) {
    return wave > this.highestWave || level > this.highestLevel;
  }

  /**
   * Calculate player's overall score
   */
  calculateScore() {
    return (
      this.totalKills * 10 +
      this.highestWave * 100 +
      this.highestLevel * 50 +
      this.totalGoldEarned
    );
  }

  /**
   * Get K/D ratio
   */
  getKDRatio() {
    return this.totalDeaths === 0
      ? this.totalKills
      : (this.totalKills / this.totalDeaths).toFixed(2);
  }

  /**
   * Convert to plain object for serialization
   */
  toObject() {
    return {
      id: this.id,
      username: this.username,
      totalKills: this.totalKills,
      totalDeaths: this.totalDeaths,
      highestWave: this.highestWave,
      highestLevel: this.highestLevel,
      totalPlaytime: this.totalPlaytime,
      totalGoldEarned: this.totalGoldEarned,
      createdAt: this.createdAt,
      lastSeen: this.lastSeen
    };
  }

  /**
   * Create from database row
   */
  static fromDB(row) {
    return new Player({
      id: row.id,
      username: row.username,
      totalKills: row.total_kills,
      totalDeaths: row.total_deaths,
      highestWave: row.highest_wave,
      highestLevel: row.highest_level,
      totalPlaytime: row.total_playtime,
      totalGoldEarned: row.total_gold_earned,
      createdAt: row.created_at * 1000, // SQLite uses seconds
      lastSeen: row.last_seen * 1000
    });
  }
}

module.exports = Player;
