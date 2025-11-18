-- ================================================================================================
-- SEED DATA FOR ZOMBIE MULTIPLAYER GAME
-- Initial data for testing and development
-- ================================================================================================

-- ================================================================================================
-- ACHIEVEMENTS
-- ================================================================================================
INSERT OR IGNORE INTO achievements (id, category, name, description, points, tier, requirement_json, sort_order) VALUES
-- Combat Achievements
('zombie_hunter_100', 'combat', 'Zombie Hunter', 'Kill 100 zombies', 10, 'bronze', '{"type":"zombies_killed","value":100}', 1),
('zombie_slayer_500', 'combat', 'Zombie Slayer', 'Kill 500 zombies', 25, 'silver', '{"type":"zombies_killed","value":500}', 2),
('zombie_massacre_1000', 'combat', 'Zombie Massacre', 'Kill 1,000 zombies', 50, 'gold', '{"type":"zombies_killed","value":1000}', 3),
('zombie_legend_5000', 'combat', 'Zombie Legend', 'Kill 5,000 zombies', 100, 'platinum', '{"type":"zombies_killed","value":5000}', 4),

('boss_killer', 'combat', 'Boss Killer', 'Defeat your first boss', 15, 'bronze', '{"type":"boss_kills","value":1}', 5),
('boss_hunter', 'combat', 'Boss Hunter', 'Defeat 10 bosses', 30, 'silver', '{"type":"boss_kills","value":10}', 6),
('boss_master', 'combat', 'Boss Master', 'Defeat 50 bosses', 75, 'gold', '{"type":"boss_kills","value":50}', 7),

('combo_master', 'combat', 'Combo Master', 'Achieve a 50 kill combo', 20, 'silver', '{"type":"highest_combo","value":50}', 8),
('combo_god', 'combat', 'Combo God', 'Achieve a 100 kill combo', 50, 'gold', '{"type":"highest_combo","value":100}', 9),

('marksman', 'combat', 'Marksman', 'Achieve 80% accuracy in a game', 25, 'silver', '{"type":"accuracy","value":80}', 10),
('sharpshooter', 'combat', 'Sharpshooter', 'Achieve 90% accuracy in a game', 50, 'gold', '{"type":"accuracy","value":90}', 11),

-- Survival Achievements
('survivor_5', 'survival', 'Survivor', 'Survive to wave 5', 10, 'bronze', '{"type":"wave","value":5}', 20),
('veteran_10', 'survival', 'Veteran', 'Survive to wave 10', 20, 'silver', '{"type":"wave","value":10}', 21),
('champion_25', 'survival', 'Champion', 'Survive to wave 25', 50, 'gold', '{"type":"wave","value":25}', 22),
('immortal_50', 'survival', 'Immortal', 'Survive to wave 50', 100, 'platinum', '{"type":"wave","value":50}', 23),

('endurance_10min', 'survival', 'Endurance', 'Survive for 10 minutes', 15, 'bronze', '{"type":"survival_time","value":600}', 24),
('marathon_30min', 'survival', 'Marathon Runner', 'Survive for 30 minutes', 40, 'silver', '{"type":"survival_time","value":1800}', 25),
('unstoppable_1hour', 'survival', 'Unstoppable', 'Survive for 1 hour', 100, 'gold', '{"type":"survival_time","value":3600}', 26),

('no_damage_wave', 'survival', 'Untouchable', 'Complete a wave without taking damage', 30, 'silver', '{"type":"no_damage_wave","value":1}', 27),
('perfect_game', 'survival', 'Perfect Game', 'Complete 5 waves without taking damage', 75, 'gold', '{"type":"no_damage_waves","value":5}', 28),

-- Progression Achievements
('level_5', 'progression', 'Apprentice', 'Reach level 5', 10, 'bronze', '{"type":"level","value":5}', 30),
('level_10', 'progression', 'Experienced', 'Reach level 10', 20, 'silver', '{"type":"level","value":10}', 31),
('level_25', 'progression', 'Expert', 'Reach level 25', 50, 'gold', '{"type":"level","value":25}', 32),
('level_50', 'progression', 'Master', 'Reach level 50', 100, 'platinum', '{"type":"level","value":50}', 33),

('rich_1000', 'progression', 'Wealthy', 'Accumulate 1,000 gold', 15, 'bronze', '{"type":"gold_earned","value":1000}', 34),
('rich_10000', 'progression', 'Rich', 'Accumulate 10,000 gold', 35, 'silver', '{"type":"gold_earned","value":10000}', 35),
('millionaire', 'progression', 'Millionaire', 'Accumulate 100,000 gold', 75, 'gold', '{"type":"gold_earned","value":100000}', 36),

('weapon_collector', 'progression', 'Weapon Collector', 'Unlock 5 weapons', 20, 'bronze', '{"type":"weapons_unlocked","value":5}', 37),
('arsenal_master', 'progression', 'Arsenal Master', 'Unlock all weapons', 50, 'gold', '{"type":"all_weapons_unlocked","value":1}', 38),

-- Social Achievements
('team_player', 'social', 'Team Player', 'Play 10 multiplayer games', 10, 'bronze', '{"type":"multiplayer_games","value":10}', 40),
('squad_leader', 'social', 'Squad Leader', 'Play 50 multiplayer games', 25, 'silver', '{"type":"multiplayer_games","value":50}', 41),

('first_friend', 'social', 'Friendly', 'Add your first friend', 10, 'bronze', '{"type":"friends","value":1}', 42),
('popular', 'social', 'Popular', 'Have 10 friends', 20, 'silver', '{"type":"friends","value":10}', 43),

-- Special/Hidden Achievements
('secret_pacifist', 'special', 'Pacifist?', 'Survive 5 minutes without killing a zombie', 50, 'gold', '{"type":"pacifist","value":300}', 100),
('lucky_seven', 'special', 'Lucky Seven', 'Complete wave 7 with exactly 777 gold', 25, 'gold', '{"type":"lucky_seven","value":1}', 101),
('speed_demon', 'special', 'Speed Demon', 'Clear wave 10 in under 2 minutes', 40, 'gold', '{"type":"speed_clear","wave":10,"time":120}', 102);

-- ================================================================================================
-- DAILY CHALLENGES - Examples
-- ================================================================================================
-- Note: In production, these would be generated dynamically by the server

-- Today's challenge (example)
INSERT OR IGNORE INTO daily_challenges (challenge_date, challenge_type, requirement_json, reward_type, reward_value)
VALUES
(strftime('%s', 'now', 'start of day'), 'kill_count', '{"zombies":100,"time_limit":600}', 'gold', 500),
(strftime('%s', 'now', 'start of day', '-1 day'), 'survival_time', '{"time":300,"no_damage":true}', 'xp', 1000),
(strftime('%s', 'now', 'start of day', '-2 days'), 'boss_kill', '{"bosses":3}', 'gold', 750);