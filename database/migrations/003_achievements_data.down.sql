-- ================================================================================================
-- ROLLBACK 003: Achievements Seed Data
-- Removes rows inserted by 003_achievements_data.sql.
-- ================================================================================================

DELETE FROM achievements
WHERE achievement_id IN (
  'first_blood',
  'zombie_slayer',
  'zombie_hunter',
  'zombie_exterminator',
  'apocalypse_ender',
  'boss_killer',
  'boss_master',
  'combo_starter',
  'combo_master',
  'survivor',
  'veteran',
  'legend',
  'immortal',
  'level_up',
  'power_house',
  'max_level',
  'marathon_runner',
  'iron_man',
  'dedicated',
  'addicted',
  'no_life',
  'winner',
  'champion',
  'time_traveler',
  'time_lord'
);
