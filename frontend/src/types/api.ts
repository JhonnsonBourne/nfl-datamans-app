/**
 * Type definitions for API responses
 * These types ensure type safety across the application
 */

// Player-related types
export interface Player {
  player_id: string;
  player_name: string;
  display_name?: string;
  full_name?: string;
  position: string;
  team?: string;
  season?: number;
}

export interface PlayerStats extends Player {
  // Passing stats
  completions?: number;
  attempts?: number;
  passing_yards?: number;
  passing_tds?: number;
  interceptions?: number;
  
  // Rushing stats
  carries?: number;
  rushing_yards?: number;
  rushing_tds?: number;
  
  // Receiving stats
  receptions?: number;
  targets?: number;
  receiving_yards?: number;
  receiving_tds?: number;
  routes?: number;
  
  // Fantasy
  fantasy_points_ppr?: number;
  fantasy_points_standard?: number;
  
  // Advanced metrics
  epa?: number;
  wopr?: number;
  racr?: number;
  pacr?: number;
  
  // NextGen Stats
  avg_cushion?: number;
  avg_separation?: number;
  avg_intended_air_yards?: number;
  avg_air_yards_differential?: number;
  max_speed?: number;
  avg_speed?: number;
}

export interface PlayerProfile extends PlayerStats {
  career_stats?: PlayerStats[];
  season_stats?: PlayerStats[];
  similar_players?: SimilarPlayer[];
}

export interface SimilarPlayer {
  player_id: string;
  player_name: string;
  similarity_score: number;
  position: string;
}

// Team types
export interface Team {
  team: string;
  team_abbr: string;
  team_name: string;
  team_logo?: string;
}

export interface TeamStats extends Team {
  season: number;
  wins?: number;
  losses?: number;
  ties?: number;
  points_for?: number;
  points_against?: number;
  epa_per_play?: number;
  epa_per_pass?: number;
  epa_per_rush?: number;
}

// Game types
export interface Game {
  game_id: string;
  season: number;
  week: number;
  game_type: 'REG' | 'POST';
  away_team: string;
  home_team: string;
  away_score?: number;
  home_score?: number;
  game_date?: string;
  game_time?: string;
}

export interface GameDetail extends Game {
  plays?: any[];
  leaders?: {
    passing?: PlayerStats[];
    rushing?: PlayerStats[];
    receiving?: PlayerStats[];
  };
}

// Leaderboard types
export interface LeaderboardEntry extends PlayerStats {
  rank: number;
  metric_value: number;
}

// Article types
export interface Article {
  id: string;
  title: string;
  content: string;
  author?: string;
  published: boolean;
  created_at: string;
  updated_at: string;
  tags?: string[];
  category?: string;
  featured_image?: string;
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ApiError {
  error: string;
  message?: string;
  status_code?: number;
  details?: Record<string, any>;
}

// Query parameters
export interface PlayerStatsParams {
  seasons?: number[];
  limit?: number;
  include_ngs?: boolean;
  ngs_stat_type?: 'receiving' | 'rushing' | 'passing';
}

export interface LeaderboardParams {
  season: number;
  position?: string;
  metric: string;
  limit?: number;
  sort_by?: string;
}

