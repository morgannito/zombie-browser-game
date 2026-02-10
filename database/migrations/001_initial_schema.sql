-- ================================================================================================
-- MIGRATION 001: Core Runtime Schema
-- Description: Create base tables used by the runtime (players, sessions, upgrades, leaderboard)
-- ================================================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  last_seen INTEGER DEFAULT (strftime('%s', 'now')),
  total_kills INTEGER DEFAULT 0,
  total_deaths INTEGER DEFAULT 0,
  highest_wave INTEGER DEFAULT 0,
  highest_level INTEGER DEFAULT 0,
  total_playtime INTEGER DEFAULT 0,
  total_gold_earned INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_players_username ON players(username);
CREATE INDEX IF NOT EXISTS idx_players_highest_wave ON players(highest_wave DESC);

CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  socket_id TEXT,
  state TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  disconnected_at INTEGER,
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_player ON sessions(player_id);
CREATE INDEX IF NOT EXISTS idx_sessions_socket ON sessions(socket_id);
CREATE INDEX IF NOT EXISTS idx_sessions_disconnected ON sessions(disconnected_at) WHERE disconnected_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS permanent_upgrades (
  player_id TEXT PRIMARY KEY,
  max_health_level INTEGER DEFAULT 0,
  damage_level INTEGER DEFAULT 0,
  speed_level INTEGER DEFAULT 0,
  fire_rate_level INTEGER DEFAULT 0,
  updated_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  wave INTEGER NOT NULL,
  level INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  survival_time INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard(player_id);
