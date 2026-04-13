-- ================================================================================================
-- ROLLBACK 004: Performance Indexes
-- ================================================================================================

DROP INDEX IF EXISTS idx_skill_tree_category_tier;
DROP INDEX IF EXISTS idx_achievements_category_sort;
DROP INDEX IF EXISTS idx_player_achievements_player_unlocked;
DROP INDEX IF EXISTS idx_progression_player;
DROP INDEX IF EXISTS idx_leaderboard_score_player;
DROP INDEX IF EXISTS idx_leaderboard_player_score;
