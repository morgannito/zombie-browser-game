-- ================================================================================================
-- MIGRATION 004: Performance Indexes
-- Description: Add missing indexes for leaderboard queries, player lookups, and achievement joins.
-- ================================================================================================

-- leaderboard: composite index for per-player score lookups (getByPlayer, getBestForPlayer)
CREATE INDEX IF NOT EXISTS idx_leaderboard_player_score ON leaderboard(player_id, score DESC);

-- leaderboard: composite index for rank computation (scores > threshold)
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_player ON leaderboard(score DESC, player_id);

-- account_progression: lookups by player_id not covered by PK in some SQLite planners
-- (PK is already an index but explicit covering index helps query planner with joins)
CREATE INDEX IF NOT EXISTS idx_progression_player ON account_progression(player_id);

-- player_achievements: composite index for per-player listing ordered by unlock date
CREATE INDEX IF NOT EXISTS idx_player_achievements_player_unlocked ON player_achievements(player_id, unlocked_at DESC);

-- achievements: composite index for full-table ordered scan by category + sort_order
CREATE INDEX IF NOT EXISTS idx_achievements_category_sort ON achievements(category, sort_order);

-- skill_tree: lookup by skill_id is PK; add composite for category+tier ordered scans
CREATE INDEX IF NOT EXISTS idx_skill_tree_category_tier ON skill_tree(skill_category, tier, sort_order);
