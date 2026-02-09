-- ================================================================================================
-- ROLLBACK 001: Initial Schema
-- Drops all tables, views, triggers, and indexes created by schema.sql
-- WARNING: This destroys all game data. Use only in development.
-- ================================================================================================

-- Drop views first (depend on tables)
DROP VIEW IF EXISTS v_current_leaderboard;
DROP VIEW IF EXISTS v_player_profiles;

-- Drop triggers (depend on tables)
DROP TRIGGER IF EXISTS tr_init_player_stats;
DROP TRIGGER IF EXISTS tr_update_player_stats_on_session_end;
DROP TRIGGER IF EXISTS tr_cleanup_active_session;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS chat_logs;
DROP TABLE IF EXISTS player_relationships;
DROP TABLE IF EXISTS analytics_events;
DROP TABLE IF EXISTS weapon_stats;
DROP TABLE IF EXISTS player_daily_challenges;
DROP TABLE IF EXISTS daily_challenges;
DROP TABLE IF EXISTS player_achievements;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS leaderboards;
DROP TABLE IF EXISTS active_sessions;
DROP TABLE IF EXISTS game_sessions;
DROP TABLE IF EXISTS permanent_upgrades;
DROP TABLE IF EXISTS player_unlocks;
DROP TABLE IF EXISTS player_stats;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS schema_migrations;
