-- Database indexes for performance optimization
-- Run this after initial data load

-- Player stats indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_player_stats_player_season 
    ON raw_nfl.player_stats(player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_stats_season_position 
    ON raw_nfl.player_stats(season, position);

CREATE INDEX IF NOT EXISTS idx_player_stats_fantasy_points 
    ON raw_nfl.player_stats(season, fantasy_points_ppr DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_player_stats_season_pos_fantasy 
    ON raw_nfl.player_stats(season, position, fantasy_points_ppr DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_player_stats_player_season_week 
    ON raw_nfl.player_stats(player_id, season, week);

-- Schedules indexes
CREATE INDEX IF NOT EXISTS idx_schedules_season_week 
    ON raw_nfl.schedules(season, week);

CREATE INDEX IF NOT EXISTS idx_schedules_game_id 
    ON raw_nfl.schedules(game_id);

CREATE INDEX IF NOT EXISTS idx_schedules_season_week_game 
    ON raw_nfl.schedules(season, week, game_id);

-- Indexes for common filter combinations
CREATE INDEX IF NOT EXISTS idx_player_stats_position_season_week 
    ON raw_nfl.player_stats(position, season, week);

-- Partial indexes for active seasons (optional optimization)
CREATE INDEX IF NOT EXISTS idx_player_stats_current_season 
    ON raw_nfl.player_stats(player_id, fantasy_points_ppr DESC)
    WHERE season >= 2024;

