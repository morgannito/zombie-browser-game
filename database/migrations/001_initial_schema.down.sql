-- ================================================================================================
-- ROLLBACK 001: Core Runtime Schema
-- Drops tables created by 001 (keeps migration metadata table _migrations managed by runner)
-- ================================================================================================

DROP TABLE IF EXISTS leaderboard;
DROP TABLE IF EXISTS permanent_upgrades;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS players;
