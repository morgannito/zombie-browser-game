-- ================================================================================================
-- MIGRATION 005: Daily Challenges
-- Description: Tables for daily challenge definitions and per-player progress
-- ================================================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS daily_challenges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  challenge_date TEXT NOT NULL UNIQUE,          -- YYYY-MM-DD UTC
  challenges_json TEXT NOT NULL,                -- JSON array of 3 challenge objects (seed-based)
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_daily_challenges_date ON daily_challenges(challenge_date);

CREATE TABLE IF NOT EXISTS player_daily_challenges (
  player_id TEXT NOT NULL,
  challenge_date TEXT NOT NULL,                 -- YYYY-MM-DD UTC
  challenge_id TEXT NOT NULL,                   -- e.g. 'kill_50_zombies'
  progress INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  completed_at INTEGER,
  reward_claimed INTEGER DEFAULT 0,
  claimed_at INTEGER,
  PRIMARY KEY (player_id, challenge_date, challenge_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_pdc_player_date ON player_daily_challenges(player_id, challenge_date);
