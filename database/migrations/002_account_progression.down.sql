-- ================================================================================================
-- ROLLBACK 002: Account Progression
-- Drops account_progression, skill_tree, related trigger, view, and indexes
-- ================================================================================================

-- Drop view first (depends on tables)
DROP VIEW IF EXISTS v_player_with_progression;

-- Drop trigger
DROP TRIGGER IF EXISTS tr_init_account_progression;

-- Drop indexes (explicit drop for non-IF-NOT-EXISTS indexes)
DROP INDEX IF EXISTS idx_account_progression_level;
DROP INDEX IF EXISTS idx_account_progression_prestige;
DROP INDEX IF EXISTS idx_skill_tree_category;
DROP INDEX IF EXISTS idx_skill_tree_tier;

-- Drop tables
DROP TABLE IF EXISTS skill_tree;
DROP TABLE IF EXISTS account_progression;
