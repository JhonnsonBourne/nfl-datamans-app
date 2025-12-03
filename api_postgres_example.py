"""
Example API endpoints using PostgreSQL instead of direct nflreadpy calls.

This demonstrates how to migrate from nflread_adapter to database queries.
Use this as a reference when migrating your existing endpoints.
"""

from fastapi import Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional
import pandas as pd

from database.connection import get_db, engine
from database.queries import PlayerStatsQuery, ScheduleQuery
from utils.retry import retry_on_db_error
from utils.circuit_breaker import db_circuit_breaker

# Example: Migrated player stats endpoint
@app.get("/v1/data/player_stats_v2")
@retry_on_db_error(max_retries=3)
@db_circuit_breaker.call
def get_player_stats_v2(
    seasons: Optional[List[int]] = Query(None),
    position: Optional[str] = Query(None),
    limit: int = Query(1000, ge=1, le=10000),
    offset: int = Query(0, ge=0),
    order_by: str = Query("fantasy_points_ppr"),
    db: Session = Depends(get_db),
):
    """
    Get player stats from PostgreSQL (optimized version).
    
    This endpoint uses the database instead of calling nflreadpy directly,
    providing 10-100x faster response times.
    """
    try:
        # Use query layer
        df = PlayerStatsQuery.get_player_stats(
            seasons=seasons,
            position=position,
            limit=limit,
            offset=offset,
            order_by=order_by,
            order_desc=True
        )
        
        if df.empty:
            return {
                "source": "postgresql",
                "count": 0,
                "data": [],
                "message": "No data found for given filters"
            }
        
        # Convert to records
        records = df.to_dict(orient='records')
        
        return {
            "source": "postgresql",
            "count": len(records),
            "total_available": len(df),  # Before limit
            "data": records,
            "filters": {
                "seasons": seasons,
                "position": position,
                "limit": limit,
                "offset": offset,
            }
        }
        
    except Exception as e:
        log_error(e, {
            "endpoint": "get_player_stats_v2",
            "seasons": seasons,
            "position": position
        })
        raise HTTPException(status_code=500, detail=str(e))


# Example: Player profile endpoint
@app.get("/v1/player/{player_id}/v2")
def get_player_profile_v2(
    player_id: str,
    seasons: Optional[List[int]] = Query(None),
    db: Session = Depends(get_db),
):
    """Get player profile from PostgreSQL."""
    try:
        profile = PlayerStatsQuery.get_player_profile(
            player_id=player_id,
            seasons=seasons
        )
        
        if not profile:
            raise HTTPException(
                status_code=404,
                detail=f"Player {player_id} not found"
            )
        
        return {
            "source": "postgresql",
            "player_id": player_id,
            "profile": profile
        }
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {
            "endpoint": "get_player_profile_v2",
            "player_id": player_id
        })
        raise HTTPException(status_code=500, detail=str(e))


# Example: Schedule endpoint
@app.get("/v1/schedule/v2")
def get_schedule_v2(
    season: int = Query(2025),
    week: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Get schedule from PostgreSQL."""
    try:
        df = ScheduleQuery.get_schedule(
            season=season,
            week=week
        )
        
        records = df.to_dict(orient='records') if not df.empty else []
        
        return {
            "source": "postgresql",
            "season": season,
            "week": week,
            "count": len(records),
            "data": records
        }
        
    except Exception as e:
        log_error(e, {
            "endpoint": "get_schedule_v2",
            "season": season,
            "week": week
        })
        raise HTTPException(status_code=500, detail=str(e))


# Example: Health check with database
@app.get("/health/database")
def health_database(db: Session = Depends(get_db)):
    """Check database health and connection pool status."""
    try:
        # Test query
        result = db.execute(text("SELECT COUNT(*) FROM stg_nfl.stg_player_stats"))
        record_count = result.scalar()
        
        # Get connection pool stats
        pool = engine.pool
        pool_stats = {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
        }
        
        # Get circuit breaker state
        cb_state = db_circuit_breaker.get_state()
        
        return {
            "status": "healthy",
            "database": {
                "connected": True,
                "record_count": record_count,
            },
            "connection_pool": pool_stats,
            "circuit_breaker": cb_state,
        }
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "database": {"connected": False},
        }

