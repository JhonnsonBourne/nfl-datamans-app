"""
Database query layer for NFL data.

Provides high-level query functions that abstract away SQL details
and provide type-safe, optimized queries.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import pandas as pd
import logging

from .connection import SessionLocal

# Import resiliency utilities with fallback
try:
    from utils.retry import retry_on_db_error
    from utils.circuit_breaker import db_circuit_breaker
    RESILIENCY_AVAILABLE = True
except ImportError:
    RESILIENCY_AVAILABLE = False
    # Fallback decorators that do nothing
    def retry_on_db_error(*args, **kwargs):
        def decorator(f):
            return f
        return decorator
    
    class MockCircuitBreaker:
        def call(self, f):
            return f
        def get_state(self):
            return {"state": "not_available"}
    
    db_circuit_breaker = MockCircuitBreaker()

logger = logging.getLogger(__name__)


class PlayerStatsQuery:
    """Query layer for player stats from PostgreSQL."""
    
    @staticmethod
    def get_player_stats(
        seasons: Optional[List[int]] = None,
        position: Optional[str] = None,
        limit: Optional[int] = None,
        offset: int = 0,
        order_by: str = "fantasy_points_ppr",
        order_desc: bool = True
    ) -> pd.DataFrame:
        """
        Get player stats from staging view.
        
        Args:
            seasons: List of seasons to filter (e.g., [2024, 2025])
            position: Position filter (QB, RB, WR, TE)
            limit: Maximum number of records to return
            offset: Number of records to skip
            order_by: Column to order by
            order_desc: Whether to order descending
        
        Returns:
            DataFrame with player stats
        """
        db = SessionLocal()
        try:
            query_parts = ["SELECT * FROM stg_nfl.stg_player_stats WHERE 1=1"]
            params = {}
            
            if seasons:
                query_parts.append("AND season = ANY(:seasons)")
                params['seasons'] = seasons
            
            if position:
                query_parts.append("AND position = :position")
                params['position'] = position.upper()
            
            # Ordering
            order_dir = "DESC" if order_desc else "ASC"
            query_parts.append(f"ORDER BY {order_by} {order_dir}")
            
            # Pagination
            if limit:
                query_parts.append("LIMIT :limit OFFSET :offset")
                params['limit'] = limit
                params['offset'] = offset
            
            query = text(" ".join(query_parts))
            
            result = db.execute(query, params)
            rows = result.fetchall()
            columns = result.keys()
            
            if not rows:
                return pd.DataFrame()
            
            return pd.DataFrame(rows, columns=columns)
            
        except Exception as e:
            logger.error(f"Error querying player stats: {e}")
            raise
        finally:
            db.close()
    
    @staticmethod
    @retry_on_db_error(max_retries=3) if RESILIENCY_AVAILABLE else lambda f: f
    @db_circuit_breaker.call if RESILIENCY_AVAILABLE else lambda f: f
    def get_player_profile(
        player_id: str,
        seasons: Optional[List[int]] = None
    ) -> Dict[str, Any]:
        """
        Get detailed player profile with aggregated stats.
        
        Args:
            player_id: Player identifier
            seasons: Optional list of seasons to include
        
        Returns:
            Dictionary with player profile data
        """
        db = SessionLocal()
        try:
            query_parts = [
                """
                SELECT 
                    player_id,
                    player_name,
                    position,
                    season,
                    COUNT(*) as games_played,
                    SUM(fantasy_points_ppr) as total_fantasy_points,
                    AVG(fantasy_points_ppr) as avg_fantasy_points,
                    SUM(passing_yards) as total_passing_yards,
                    SUM(rushing_yards) as total_rushing_yards,
                    SUM(receiving_yards) as total_receiving_yards,
                    SUM(passing_tds) as total_passing_tds,
                    SUM(rushing_tds) as total_rushing_tds,
                    SUM(receiving_tds) as total_receiving_tds,
                    MAX(week) as last_week
                FROM stg_nfl.stg_player_stats
                WHERE player_id = :player_id
                """
            ]
            params = {'player_id': player_id}
            
            if seasons:
                query_parts.append("AND season = ANY(:seasons)")
                params['seasons'] = seasons
            
            query_parts.append("GROUP BY player_id, player_name, position, season")
            query_parts.append("ORDER BY season DESC")
            
            query = text(" ".join(query_parts))
            result = db.execute(query, params)
            rows = result.fetchall()
            columns = result.keys()
            
            if not rows:
                return {}
            
            df = pd.DataFrame(rows, columns=columns)
            return df.to_dict(orient='records')
            
        except Exception as e:
            logger.error(f"Error querying player profile: {e}")
            raise
        finally:
            db.close()
    
    @staticmethod
    @retry_on_db_error(max_retries=3) if RESILIENCY_AVAILABLE else lambda f: f
    def get_season_summary(season: int) -> Dict[str, Any]:
        """
        Get summary statistics for a season.
        
        Args:
            season: Season year
        
        Returns:
            Dictionary with season summary
        """
        db = SessionLocal()
        try:
            query = text("""
                SELECT 
                    COUNT(DISTINCT player_id) as unique_players,
                    COUNT(*) as total_records,
                    COUNT(DISTINCT week) as weeks_played,
                    AVG(fantasy_points_ppr) as avg_fantasy_points,
                    MAX(fantasy_points_ppr) as max_fantasy_points
                FROM stg_nfl.stg_player_stats
                WHERE season = :season
            """)
            
            result = db.execute(query, {'season': season})
            row = result.fetchone()
            
            if row:
                return dict(zip(result.keys(), row))
            return {}
            
        except Exception as e:
            logger.error(f"Error querying season summary: {e}")
            raise
        finally:
            db.close()


class ScheduleQuery:
    """Query layer for schedule/game data."""
    
    @staticmethod
    @retry_on_db_error(max_retries=3) if RESILIENCY_AVAILABLE else lambda f: f
    def get_schedule(
        season: int,
        week: Optional[int] = None
    ) -> pd.DataFrame:
        """
        Get schedule data.
        
        Args:
            season: Season year
            week: Optional week number
        
        Returns:
            DataFrame with schedule data
        """
        db = SessionLocal()
        try:
            query_parts = ["SELECT * FROM stg_nfl.stg_schedules WHERE season = :season"]
            params = {'season': season}
            
            if week:
                query_parts.append("AND week = :week")
                params['week'] = week
            
            query_parts.append("ORDER BY week, game_id")
            
            query = text(" ".join(query_parts))
            result = db.execute(query, params)
            rows = result.fetchall()
            columns = result.keys()
            
            if not rows:
                return pd.DataFrame()
            
            return pd.DataFrame(rows, columns=columns)
            
        except Exception as e:
            logger.error(f"Error querying schedule: {e}")
            raise
        finally:
            db.close()

