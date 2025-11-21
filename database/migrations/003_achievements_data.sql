-- ================================================================================================
-- ACHIEVEMENTS DATA MIGRATION
-- Adds default achievements to the database
-- Version: 1.0.0
-- ================================================================================================

-- Combat Achievements
INSERT OR IGNORE INTO achievements VALUES
('first_blood', 'combat', 'First Blood', 'Kill your first zombie', '🩸', 10, 'bronze', '{"zombiesKilled": 1}', 0, 1),
('zombie_slayer', 'combat', 'Zombie Slayer', 'Kill 100 zombies', '⚔️', 20, 'bronze', '{"zombiesKilled": 100}', 0, 2),
('zombie_hunter', 'combat', 'Zombie Hunter', 'Kill 500 zombies', '🏹', 30, 'silver', '{"zombiesKilled": 500}', 0, 3),
('zombie_exterminator', 'combat', 'Zombie Exterminator', 'Kill 1000 zombies', '💀', 50, 'gold', '{"zombiesKilled": 1000}', 0, 4),
('apocalypse_ender', 'combat', 'Apocalypse Ender', 'Kill 5000 zombies', '🔥', 100, 'platinum', '{"zombiesKilled": 5000}', 0, 5),

('boss_killer', 'combat', 'Boss Killer', 'Kill your first boss', '👹', 30, 'silver', '{"bossKills": 1}', 0, 10),
('boss_master', 'combat', 'Boss Master', 'Kill 10 bosses', '👑', 50, 'gold', '{"bossKills": 10}', 0, 11),

('combo_starter', 'combat', 'Combo Starter', 'Achieve a 10 kill combo', '🌟', 20, 'bronze', '{"highestCombo": 10}', 0, 20),
('combo_master', 'combat', 'Combo Master', 'Achieve a 50 kill combo', '✨', 40, 'gold', '{"highestCombo": 50}', 0, 21),

-- Survival Achievements
('survivor', 'survival', 'Survivor', 'Reach wave 5', '🛡️', 15, 'bronze', '{"highestWave": 5}', 0, 30),
('veteran', 'survival', 'Veteran', 'Reach wave 10', '🎖️', 25, 'silver', '{"highestWave": 10}', 0, 31),
('legend', 'survival', 'Legend', 'Reach wave 20', '⭐', 50, 'gold', '{"highestWave": 20}', 0, 32),
('immortal', 'survival', 'Immortal', 'Reach wave 50', '👼', 100, 'platinum', '{"highestWave": 50}', 0, 33),

('level_up', 'survival', 'Level Up', 'Reach level 10', '📈', 15, 'bronze', '{"highestLevel": 10}', 0, 40),
('power_house', 'survival', 'Power House', 'Reach level 25', '💪', 30, 'silver', '{"highestLevel": 25}', 0, 41),
('max_level', 'survival', 'Max Level', 'Reach level 50', '🚀', 50, 'gold', '{"highestLevel": 50}', 0, 42),

('marathon_runner', 'survival', 'Marathon Runner', 'Survive for 30 minutes', '🏃', 30, 'silver', '{"longestSurvivalSeconds": 1800}', 0, 50),
('iron_man', 'survival', 'Iron Man', 'Survive for 1 hour', '🦾', 60, 'gold', '{"longestSurvivalSeconds": 3600}', 0, 51),

-- Collection Achievements
('dedicated', 'collection', 'Dedicated', 'Play 10 games', '🎮', 15, 'bronze', '{"gamesPlayed": 10}', 0, 60),
('addicted', 'collection', 'Addicted', 'Play 100 games', '🎯', 30, 'silver', '{"gamesPlayed": 100}', 0, 61),
('no_life', 'collection', 'No Life', 'Play 500 games', '🏆', 60, 'gold', '{"gamesPlayed": 500}', 0, 62),

('winner', 'collection', 'Winner', 'Win your first game', '🥇', 25, 'silver', '{"gamesWon": 1}', 0, 70),
('champion', 'collection', 'Champion', 'Win 10 games', '👑', 50, 'gold', '{"gamesWon": 10}', 0, 71),

('time_traveler', 'collection', 'Time Traveler', 'Play for 10 hours total', '⏰', 30, 'silver', '{"totalPlaytimeSeconds": 36000}', 0, 80),
('time_lord', 'collection', 'Time Lord', 'Play for 100 hours total', '⌛', 100, 'platinum', '{"totalPlaytimeSeconds": 360000}', 0, 81);
