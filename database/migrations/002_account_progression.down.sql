-- ================================================================================================
-- ROLLBACK 002: Account Progression + Skill Tree + Achievement Tables
-- Drops tables/indexes created by 002 migration.
-- ================================================================================================

DROP INDEX IF EXISTS idx_achievement_unlocked;
DROP INDEX IF EXISTS idx_player_achievements;
DROP INDEX IF EXISTS idx_skill_tier;
DROP INDEX IF EXISTS idx_skill_category;
DROP INDEX IF EXISTS idx_progression_prestige;
DROP INDEX IF EXISTS idx_progression_level;

DROP TABLE IF EXISTS player_achievements;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS skill_tree;
DROP TABLE IF EXISTS account_progression;
