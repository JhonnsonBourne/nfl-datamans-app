{{ config(
    materialized='table',
    indexes=[
        {'columns': ['player_id', 'season'], 'unique': True},
        {'columns': ['season', 'position', 'total_fantasy_points'], 'type': 'btree'},
    ]
) }}

-- Pre-aggregated player season stats for fast API queries
-- This materialized table provides instant access to season-level aggregations
-- without needing to compute them on-the-fly

SELECT 
    player_id,
    player_name,
    position,
    season,
    COUNT(*) as games_played,
    
    -- Fantasy points
    SUM(fantasy_points_ppr) as total_fantasy_points,
    AVG(fantasy_points_ppr) as avg_fantasy_points,
    MAX(fantasy_points_ppr) as max_fantasy_points,
    MIN(fantasy_points_ppr) as min_fantasy_points,
    
    -- Passing stats
    SUM(passing_yards) as total_passing_yards,
    SUM(passing_tds) as total_passing_tds,
    SUM(interceptions) as total_interceptions,
    SUM(attempts) as total_attempts,
    SUM(completions) as total_completions,
    
    -- Rushing stats
    SUM(rushing_yards) as total_rushing_yards,
    SUM(rushing_tds) as total_rushing_tds,
    SUM(carries) as total_carries,
    
    -- Receiving stats
    SUM(receiving_yards) as total_receiving_yards,
    SUM(receiving_tds) as total_receiving_tds,
    SUM(receptions) as total_receptions,
    SUM(targets) as total_targets,
    SUM(routes) as total_routes,
    
    -- EPA stats
    SUM(passing_epa) as total_passing_epa,
    SUM(rushing_epa) as total_rushing_epa,
    SUM(receiving_epa) as total_receiving_epa,
    
    -- Per-game averages
    AVG(passing_yards) as avg_passing_yards_pg,
    AVG(rushing_yards) as avg_rushing_yards_pg,
    AVG(receiving_yards) as avg_receiving_yards_pg,
    
    -- Efficiency metrics
    CASE 
        WHEN SUM(attempts) > 0 
        THEN SUM(passing_yards)::numeric / SUM(attempts)
        ELSE NULL 
    END as yards_per_attempt,
    
    CASE 
        WHEN SUM(carries) > 0 
        THEN SUM(rushing_yards)::numeric / SUM(carries)
        ELSE NULL 
    END as yards_per_carry,
    
    CASE 
        WHEN SUM(targets) > 0 
        THEN SUM(receiving_yards)::numeric / SUM(targets)
        ELSE NULL 
    END as yards_per_target,
    
    CASE 
        WHEN SUM(routes) > 0 
        THEN SUM(receiving_yards)::numeric / SUM(routes)
        ELSE NULL 
    END as yards_per_route,
    
    -- Week range
    MIN(week) as first_week,
    MAX(week) as last_week,
    
    -- Metadata
    MAX(team) as most_recent_team,
    MAX(updated_at) as last_updated

FROM {{ ref('stg_player_stats') }}
GROUP BY player_id, player_name, position, season

