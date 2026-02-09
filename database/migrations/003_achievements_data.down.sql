-- ================================================================================================
-- ROLLBACK 003: Achievements Data
-- Removes all seeded achievement rows inserted by 003_achievements_data.sql
-- Does NOT drop the achievements table (created by 001_initial_schema)
-- ================================================================================================

DELETE FROM achievements WHERE id IN (
  -- Combat
  'first_blood',
  'zombie_slayer',
  'zombie_hunter',
  'zombie_exterminator',
  'apocalypse_ender',
  'boss_killer',
  'boss_master',
  'combo_starter',
  'combo_master',
  -- Survival
  'survivor',
  'veteran',
  'legend',
  'immortal',
  'level_up',
  'power_house',
  'max_level',
  'marathon_runner',
  'iron_man',
  -- Collection
  'dedicated',
  'addicted',
  'no_life',
  'winner',
  'champion',
  'time_traveler',
  'time_lord'
);
