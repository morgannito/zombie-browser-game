-- ================================================================================================
-- MIGRATION 003: Seed Achievement Definitions
-- Inserts default achievements using runtime-compatible column names.
-- ================================================================================================

INSERT OR IGNORE INTO achievements (
  achievement_id,
  achievement_name,
  achievement_description,
  category,
  tier,
  unlock_criteria_json,
  reward_type,
  reward_value,
  icon_emoji,
  is_secret,
  sort_order
)
VALUES
  ('first_blood', 'First Blood', 'Kill your first zombie', 'combat', 'bronze', '{"zombiesKilled":1}', 'points', 10, '🩸', 0, 1),
  ('zombie_slayer', 'Zombie Slayer', 'Kill 100 zombies', 'combat', 'bronze', '{"zombiesKilled":100}', 'points', 20, '⚔️', 0, 2),
  ('zombie_hunter', 'Zombie Hunter', 'Kill 500 zombies', 'combat', 'silver', '{"zombiesKilled":500}', 'points', 30, '🏹', 0, 3),
  ('zombie_exterminator', 'Zombie Exterminator', 'Kill 1000 zombies', 'combat', 'gold', '{"zombiesKilled":1000}', 'points', 50, '💀', 0, 4),
  ('apocalypse_ender', 'Apocalypse Ender', 'Kill 5000 zombies', 'combat', 'platinum', '{"zombiesKilled":5000}', 'points', 100, '🔥', 0, 5),
  ('boss_killer', 'Boss Killer', 'Kill your first boss', 'combat', 'silver', '{"bossKills":1}', 'points', 30, '👹', 0, 10),
  ('boss_master', 'Boss Master', 'Kill 10 bosses', 'combat', 'gold', '{"bossKills":10}', 'points', 50, '👑', 0, 11),
  ('combo_starter', 'Combo Starter', 'Achieve a 10 kill combo', 'combat', 'bronze', '{"highestCombo":10}', 'points', 20, '🌟', 0, 20),
  ('combo_master', 'Combo Master', 'Achieve a 50 kill combo', 'combat', 'gold', '{"highestCombo":50}', 'points', 40, '✨', 0, 21),
  ('survivor', 'Survivor', 'Reach wave 5', 'survival', 'bronze', '{"highestWave":5}', 'points', 15, '🛡️', 0, 30),
  ('veteran', 'Veteran', 'Reach wave 10', 'survival', 'silver', '{"highestWave":10}', 'points', 25, '🎖️', 0, 31),
  ('legend', 'Legend', 'Reach wave 20', 'survival', 'gold', '{"highestWave":20}', 'points', 50, '⭐', 0, 32),
  ('immortal', 'Immortal', 'Reach wave 50', 'survival', 'platinum', '{"highestWave":50}', 'points', 100, '👼', 0, 33),
  ('level_up', 'Level Up', 'Reach level 10', 'survival', 'bronze', '{"highestLevel":10}', 'points', 15, '📈', 0, 40),
  ('power_house', 'Power House', 'Reach level 25', 'survival', 'silver', '{"highestLevel":25}', 'points', 30, '💪', 0, 41),
  ('max_level', 'Max Level', 'Reach level 50', 'survival', 'gold', '{"highestLevel":50}', 'points', 50, '🚀', 0, 42),
  ('marathon_runner', 'Marathon Runner', 'Survive for 30 minutes', 'survival', 'silver', '{"longestSurvivalSeconds":1800}', 'points', 30, '🏃', 0, 50),
  ('iron_man', 'Iron Man', 'Survive for 1 hour', 'survival', 'gold', '{"longestSurvivalSeconds":3600}', 'points', 60, '🦾', 0, 51),
  ('dedicated', 'Dedicated', 'Play 10 games', 'collection', 'bronze', '{"gamesPlayed":10}', 'points', 15, '🎮', 0, 60),
  ('addicted', 'Addicted', 'Play 100 games', 'collection', 'silver', '{"gamesPlayed":100}', 'points', 30, '🎯', 0, 61),
  ('no_life', 'No Life', 'Play 500 games', 'collection', 'gold', '{"gamesPlayed":500}', 'points', 60, '🏆', 0, 62),
  ('winner', 'Winner', 'Win your first game', 'collection', 'silver', '{"gamesWon":1}', 'points', 25, '🥇', 0, 70),
  ('champion', 'Champion', 'Win 10 games', 'collection', 'gold', '{"gamesWon":10}', 'points', 50, '👑', 0, 71),
  ('time_traveler', 'Time Traveler', 'Play for 10 hours total', 'collection', 'silver', '{"totalPlaytimeSeconds":36000}', 'points', 30, '⏰', 0, 80),
  ('time_lord', 'Time Lord', 'Play for 100 hours total', 'collection', 'platinum', '{"totalPlaytimeSeconds":360000}', 'points', 100, '⌛', 0, 81);
