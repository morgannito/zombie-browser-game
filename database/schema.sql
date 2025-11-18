-- ================================================================================================
-- ZOMBIE MULTIPLAYER GAME DATABASE SCHEMA
-- SQLite3 Database Design
-- Version: 1.0.0
-- ================================================================================================

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- Performance optimizations
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;

-- ================================================================================================
-- PLAYERS TABLE - Core player profiles and authentication
-- ================================================================================================
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_uuid TEXT NOT NULL UNIQUE,              -- UUID for cross-session identification
    nickname TEXT NOT NULL UNIQUE,                 -- Player display name
    password_hash TEXT,                            -- Optional: for authenticated accounts
    email TEXT UNIQUE,                             -- Optional: for account recovery
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_login_at INTEGER,
    is_banned BOOLEAN DEFAULT 0,
    ban_reason TEXT,
    ban_expires_at INTEGER,

    -- Account settings
    settings_json TEXT DEFAULT '{}',               -- JSON blob for client preferences

    -- Indexes
    CHECK (length(nickname) >= 3 AND length(nickname) <= 20)
);

CREATE INDEX idx_players_nickname ON players(nickname);
CREATE INDEX idx_players_last_login ON players(last_login_at);
CREATE INDEX idx_players_uuid ON players(player_uuid);

-- ================================================================================================
-- PLAYER_STATS TABLE - Lifetime statistics and progression
-- ================================================================================================
CREATE TABLE IF NOT EXISTS player_stats (
    player_id INTEGER PRIMARY KEY,

    -- Lifetime combat stats
    total_kills INTEGER DEFAULT 0,
    total_deaths INTEGER DEFAULT 0,
    zombies_killed INTEGER DEFAULT 0,
    boss_kills INTEGER DEFAULT 0,
    highest_combo INTEGER DEFAULT 0,
    total_damage_dealt INTEGER DEFAULT 0,
    total_damage_taken INTEGER DEFAULT 0,
    shots_fired INTEGER DEFAULT 0,
    shots_hit INTEGER DEFAULT 0,
    headshots INTEGER DEFAULT 0,

    -- Progression stats
    total_xp_earned INTEGER DEFAULT 0,
    highest_level INTEGER DEFAULT 0,
    total_gold_earned INTEGER DEFAULT 0,
    total_gold_spent INTEGER DEFAULT 0,

    -- Survival stats
    total_playtime_seconds INTEGER DEFAULT 0,
    longest_survival_seconds INTEGER DEFAULT 0,
    highest_wave INTEGER DEFAULT 0,
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,

    -- Achievement stats
    achievements_unlocked INTEGER DEFAULT 0,
    total_achievement_points INTEGER DEFAULT 0,

    -- Analytics
    first_game_at INTEGER,
    last_game_at INTEGER,
    favorite_weapon TEXT,

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_player_stats_kills ON player_stats(total_kills);
CREATE INDEX idx_player_stats_level ON player_stats(highest_level);

-- ================================================================================================
-- PLAYER_UNLOCKS TABLE - Permanent unlocks and purchases
-- ================================================================================================
CREATE TABLE IF NOT EXISTS player_unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    unlock_type TEXT NOT NULL,                     -- 'weapon', 'skin', 'upgrade', 'character'
    unlock_id TEXT NOT NULL,
    unlock_tier INTEGER DEFAULT 1,                 -- For upgradeable items
    purchased_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    purchase_price INTEGER,
    equipped BOOLEAN DEFAULT 0,

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    UNIQUE(player_id, unlock_type, unlock_id)
);

CREATE INDEX idx_unlocks_player ON player_unlocks(player_id);
CREATE INDEX idx_unlocks_type ON player_unlocks(unlock_type);

-- ================================================================================================
-- PERMANENT_UPGRADES TABLE - Shop upgrades that persist across games
-- ================================================================================================
CREATE TABLE IF NOT EXISTS permanent_upgrades (
    player_id INTEGER NOT NULL,
    upgrade_type TEXT NOT NULL,                    -- 'max_health', 'damage', 'speed', 'fire_rate'
    upgrade_level INTEGER DEFAULT 0,
    total_invested INTEGER DEFAULT 0,              -- Total gold spent on this upgrade

    PRIMARY KEY (player_id, upgrade_type),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- ================================================================================================
-- GAME_SESSIONS TABLE - Individual game sessions
-- ================================================================================================
CREATE TABLE IF NOT EXISTS game_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_uuid TEXT NOT NULL UNIQUE,
    player_id INTEGER NOT NULL,

    -- Session info
    started_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    ended_at INTEGER,
    duration_seconds INTEGER,
    end_reason TEXT,                               -- 'death', 'disconnect', 'victory', 'timeout'

    -- Game state at end
    final_level INTEGER,
    final_wave INTEGER,
    final_score INTEGER,
    final_gold INTEGER,
    final_xp INTEGER,
    zombies_killed INTEGER DEFAULT 0,
    highest_combo INTEGER DEFAULT 0,

    -- Performance metrics
    avg_fps REAL,
    avg_ping INTEGER,
    disconnect_count INTEGER DEFAULT 0,

    -- Analytics
    client_version TEXT,
    client_platform TEXT,                          -- 'web', 'mobile', 'desktop'
    ip_country TEXT,

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_player ON game_sessions(player_id);
CREATE INDEX idx_sessions_started ON game_sessions(started_at);
CREATE INDEX idx_sessions_score ON game_sessions(final_score);
CREATE INDEX idx_sessions_uuid ON game_sessions(session_uuid);

-- ================================================================================================
-- ACTIVE_SESSIONS TABLE - Currently active game sessions for recovery
-- ================================================================================================
CREATE TABLE IF NOT EXISTS active_sessions (
    session_id INTEGER PRIMARY KEY,
    player_id INTEGER NOT NULL,
    socket_id TEXT NOT NULL,

    -- Current game state (for recovery)
    game_state_json TEXT NOT NULL,                 -- Complete serialized game state

    -- Session management
    last_heartbeat INTEGER NOT NULL,
    started_at INTEGER NOT NULL,
    room_id TEXT,

    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX idx_active_sessions_player ON active_sessions(player_id);
CREATE INDEX idx_active_sessions_heartbeat ON active_sessions(last_heartbeat);

-- ================================================================================================
-- LEADERBOARDS TABLE - Score tracking with time windows
-- ================================================================================================
CREATE TABLE IF NOT EXISTS leaderboards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    leaderboard_type TEXT NOT NULL,                -- 'daily', 'weekly', 'monthly', 'all_time'
    period_start INTEGER NOT NULL,                 -- Unix timestamp of period start
    period_end INTEGER,                            -- NULL for all_time

    -- Scores
    score INTEGER NOT NULL,
    rank INTEGER,                                  -- Calculated periodically

    -- Metadata
    level_reached INTEGER,
    wave_reached INTEGER,
    zombies_killed INTEGER,
    play_time_seconds INTEGER,

    submitted_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    session_id INTEGER,

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_leaderboards_type_period_score ON leaderboards(leaderboard_type, period_start, score DESC);
CREATE INDEX idx_leaderboards_player ON leaderboards(player_id);
CREATE UNIQUE INDEX idx_leaderboards_unique_daily ON leaderboards(player_id, leaderboard_type, period_start)
    WHERE leaderboard_type = 'daily';

-- ================================================================================================
-- ACHIEVEMENTS TABLE - Achievement definitions
-- ================================================================================================
CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,                           -- 'zombie_hunter_100', 'wave_survivor_10', etc
    category TEXT NOT NULL,                        -- 'combat', 'survival', 'collection', 'social'
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT,
    points INTEGER DEFAULT 10,
    tier TEXT DEFAULT 'bronze',                    -- 'bronze', 'silver', 'gold', 'platinum'
    requirement_json TEXT NOT NULL,                -- JSON with unlock conditions
    hidden BOOLEAN DEFAULT 0,
    sort_order INTEGER DEFAULT 0
);

-- ================================================================================================
-- PLAYER_ACHIEVEMENTS TABLE - Unlocked achievements
-- ================================================================================================
CREATE TABLE IF NOT EXISTS player_achievements (
    player_id INTEGER NOT NULL,
    achievement_id TEXT NOT NULL,
    unlocked_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    progress INTEGER DEFAULT 0,                    -- For progressive achievements
    session_id INTEGER,                            -- Which game session unlocked it

    PRIMARY KEY (player_id, achievement_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_player_achievements_unlocked ON player_achievements(unlocked_at);

-- ================================================================================================
-- DAILY_CHALLENGES TABLE - Daily challenge definitions
-- ================================================================================================
CREATE TABLE IF NOT EXISTS daily_challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    challenge_date INTEGER NOT NULL UNIQUE,        -- Date as unix timestamp (start of day)
    challenge_type TEXT NOT NULL,                  -- 'kill_count', 'survival_time', 'no_damage', etc
    requirement_json TEXT NOT NULL,                -- JSON with challenge parameters
    reward_type TEXT NOT NULL,                     -- 'gold', 'xp', 'unlock'
    reward_value INTEGER NOT NULL,
    active BOOLEAN DEFAULT 1
);

CREATE INDEX idx_daily_challenges_date ON daily_challenges(challenge_date);

-- ================================================================================================
-- PLAYER_DAILY_CHALLENGES TABLE - Player progress on daily challenges
-- ================================================================================================
CREATE TABLE IF NOT EXISTS player_daily_challenges (
    player_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    completed_at INTEGER,
    reward_claimed BOOLEAN DEFAULT 0,

    PRIMARY KEY (player_id, challenge_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES daily_challenges(id) ON DELETE CASCADE
);

-- ================================================================================================
-- WEAPON_STATS TABLE - Track weapon usage statistics
-- ================================================================================================
CREATE TABLE IF NOT EXISTS weapon_stats (
    player_id INTEGER NOT NULL,
    weapon_id TEXT NOT NULL,

    -- Usage stats
    times_used INTEGER DEFAULT 0,
    shots_fired INTEGER DEFAULT 0,
    shots_hit INTEGER DEFAULT 0,
    headshots INTEGER DEFAULT 0,
    kills INTEGER DEFAULT 0,
    damage_dealt INTEGER DEFAULT 0,

    -- Preferences
    favorite_rank INTEGER,                         -- Player's ranking of weapons

    PRIMARY KEY (player_id, weapon_id),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

-- ================================================================================================
-- ANALYTICS_EVENTS TABLE - Game analytics and telemetry
-- ================================================================================================
CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,                      -- 'level_up', 'death', 'purchase', 'achievement'
    player_id INTEGER,
    session_id INTEGER,
    event_data_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL
);

CREATE INDEX idx_analytics_type_time ON analytics_events(event_type, created_at);
CREATE INDEX idx_analytics_player ON analytics_events(player_id);
CREATE INDEX idx_analytics_session ON analytics_events(session_id);

-- ================================================================================================
-- PLAYER_RELATIONSHIPS TABLE - Friends, blocks, etc
-- ================================================================================================
CREATE TABLE IF NOT EXISTS player_relationships (
    player_id INTEGER NOT NULL,
    target_player_id INTEGER NOT NULL,
    relationship_type TEXT NOT NULL,               -- 'friend', 'blocked', 'muted'
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),

    PRIMARY KEY (player_id, target_player_id, relationship_type),
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (target_player_id) REFERENCES players(id) ON DELETE CASCADE,
    CHECK (player_id != target_player_id)
);

-- ================================================================================================
-- CHAT_LOGS TABLE - In-game chat history (for moderation)
-- ================================================================================================
CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    session_id INTEGER,
    message TEXT NOT NULL,
    channel TEXT DEFAULT 'global',                 -- 'global', 'team', 'private'
    recipient_id INTEGER,                          -- For private messages
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    flagged BOOLEAN DEFAULT 0,                     -- For moderation

    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL,
    FOREIGN KEY (recipient_id) REFERENCES players(id) ON DELETE SET NULL
);

CREATE INDEX idx_chat_player ON chat_logs(player_id);
CREATE INDEX idx_chat_time ON chat_logs(created_at);
CREATE INDEX idx_chat_flagged ON chat_logs(flagged) WHERE flagged = 1;

-- ================================================================================================
-- VIEWS FOR COMMON QUERIES
-- ================================================================================================

-- Current leaderboard view
CREATE VIEW IF NOT EXISTS v_current_leaderboard AS
SELECT
    p.nickname,
    p.player_uuid,
    l.score,
    l.level_reached,
    l.wave_reached,
    l.zombies_killed,
    l.submitted_at,
    RANK() OVER (ORDER BY l.score DESC) as rank
FROM leaderboards l
JOIN players p ON l.player_id = p.id
WHERE l.leaderboard_type = 'all_time'
ORDER BY l.score DESC
LIMIT 100;

-- Player profile view
CREATE VIEW IF NOT EXISTS v_player_profiles AS
SELECT
    p.id,
    p.nickname,
    p.created_at,
    p.last_login_at,
    ps.total_kills,
    ps.zombies_killed,
    ps.highest_level,
    ps.highest_wave,
    ps.games_played,
    ps.total_playtime_seconds,
    COUNT(DISTINCT pa.achievement_id) as achievements_count
FROM players p
LEFT JOIN player_stats ps ON p.id = ps.player_id
LEFT JOIN player_achievements pa ON p.id = pa.player_id
GROUP BY p.id;

-- ================================================================================================
-- TRIGGERS FOR DATA INTEGRITY
-- ================================================================================================

-- Initialize player_stats when a new player is created
CREATE TRIGGER IF NOT EXISTS tr_init_player_stats
AFTER INSERT ON players
BEGIN
    INSERT INTO player_stats (player_id) VALUES (NEW.id);
END;

-- Update player stats after game session ends
CREATE TRIGGER IF NOT EXISTS tr_update_player_stats_on_session_end
AFTER UPDATE ON game_sessions
WHEN OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL
BEGIN
    UPDATE player_stats
    SET
        total_kills = total_kills + COALESCE(NEW.zombies_killed, 0),
        zombies_killed = zombies_killed + COALESCE(NEW.zombies_killed, 0),
        highest_level = MAX(highest_level, COALESCE(NEW.final_level, 0)),
        highest_wave = MAX(highest_wave, COALESCE(NEW.final_wave, 0)),
        highest_combo = MAX(highest_combo, COALESCE(NEW.highest_combo, 0)),
        total_xp_earned = total_xp_earned + COALESCE(NEW.final_xp, 0),
        total_gold_earned = total_gold_earned + COALESCE(NEW.final_gold, 0),
        total_playtime_seconds = total_playtime_seconds + COALESCE(NEW.duration_seconds, 0),
        longest_survival_seconds = MAX(longest_survival_seconds, COALESCE(NEW.duration_seconds, 0)),
        games_played = games_played + 1,
        last_game_at = NEW.ended_at
    WHERE player_id = NEW.player_id;
END;

-- Clean up old active sessions
CREATE TRIGGER IF NOT EXISTS tr_cleanup_active_session
AFTER UPDATE ON game_sessions
WHEN NEW.ended_at IS NOT NULL
BEGIN
    DELETE FROM active_sessions WHERE session_id = NEW.id;
END;