"""
🤖 AGENT NOTE: Before modifying this file, read AGENT_INSTRUCTIONS.md
   Update WORK_IN_PROGRESS.md with your changes using: python agent_sync.py --update "description"
"""

from __future__ import annotations

import io
import json
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional
from collections import deque

import numpy as np
import pandas as pd
import math
from fastapi import FastAPI, HTTPException, Query, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

# Optional database imports (for Phase 1 features)
try:
    from sqlalchemy.orm import Session
    from sqlalchemy import text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    SQLALCHEMY_AVAILABLE = False
    # Create dummy Session type for type hints
    Session = None

# Phase 2: Import sklearn for PCA and clustering
try:
    from sklearn.decomposition import PCA
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics.pairwise import cosine_similarity
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    print("Warning: sklearn not available - Phase 2 features disabled")

from nflread_adapter import (
    DATASET_CANDIDATES,
    available_dataset_functions,
    call_dataset,
    import_library,
)

# Performance monitoring
# Note: Using absolute import to avoid conflict with utils.py
_performance_module = None
try:
    import sys
    from pathlib import Path
    import importlib.util
    
    # Import using the package structure - cache the module
    utils_path = Path(__file__).parent / "utils" / "performance.py"
    spec = importlib.util.spec_from_file_location("performance", utils_path)
    if spec and spec.loader:
        _performance_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_performance_module)
        
        PerformanceTimer = _performance_module.PerformanceTimer
        time_operation = _performance_module.time_operation
        track_endpoint_timing = _performance_module.track_endpoint_timing
        get_performance_summary = _performance_module.get_performance_summary
        get_slow_operations = _performance_module.get_slow_operations
        
        PERFORMANCE_MONITORING_AVAILABLE = True
        print("✅ Performance monitoring enabled")
    else:
        raise ImportError("Could not load performance module")
except Exception as e:
    PERFORMANCE_MONITORING_AVAILABLE = False
    print(f"Warning: Performance monitoring not available: {e}")
    # Fallback - no-op context manager
    class PerformanceTimer:
        def __init__(self, *args, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            return False
    
    def time_operation(*args, **kwargs):
        def decorator(f):
            return f
        return decorator
    
    def track_endpoint_timing(*args, **kwargs):
        def decorator(f):
            return f
        return decorator
    
    def get_performance_summary():
        return {"status": "not_available"}
    
    def get_slow_operations(*args, **kwargs):
        return []

# Phase 1: Database connection pooling and resiliency
try:
    from database.connection import get_db, engine
    from utils.circuit_breaker import db_circuit_breaker
    DATABASE_AVAILABLE = True
except ImportError:
    DATABASE_AVAILABLE = False
    print("Warning: Database modules not available - database features disabled")

# Historical data range - player_stats, pbp, and schedules are available back to 1999
# Data quality is consistent with full EPA and advanced metrics throughout
HISTORICAL_SEASONS_START = 1999
CURRENT_SEASON = 2025
ALL_HISTORICAL_SEASONS = list(range(HISTORICAL_SEASONS_START, CURRENT_SEASON + 1))  # 1999-2025 (27 seasons)

# ============================================================================
# CACHING LAYER - Dramatically improves response times for repeated requests
# ============================================================================
import time
from functools import lru_cache

# In-memory cache for expensive dataset operations
# Key: (dataset, seasons_tuple, include_ngs, ngs_stat_type) -> (df, timestamp)
_DATASET_CACHE: Dict[tuple, tuple] = {}
_CACHE_TTL_SECONDS = 300  # 5 minute cache TTL
_CACHE_MAX_SIZE = 20  # Maximum number of cached datasets

def _get_cache_key(dataset: str, seasons: Optional[List[int]], include_ngs: bool = False, ngs_stat_type: str = "receiving") -> tuple:
    """Generate a cache key for dataset requests."""
    seasons_tuple = tuple(sorted(seasons)) if seasons else ()
    return (dataset, seasons_tuple, include_ngs, ngs_stat_type)

def _get_cached_df(cache_key: tuple) -> Optional[pd.DataFrame]:
    """Get a cached DataFrame if it exists and is not expired."""
    if cache_key in _DATASET_CACHE:
        df, timestamp = _DATASET_CACHE[cache_key]
        if time.time() - timestamp < _CACHE_TTL_SECONDS:
            print(f"✅ CACHE HIT: {cache_key[0]} (age: {int(time.time() - timestamp)}s)")
            return df.copy()  # Return a copy to prevent mutation
        else:
            # Expired - remove from cache
            del _DATASET_CACHE[cache_key]
            print(f"🔄 CACHE EXPIRED: {cache_key[0]}")
    return None

def _set_cached_df(cache_key: tuple, df: pd.DataFrame):
    """Cache a DataFrame with current timestamp."""
    # Evict oldest entries if cache is full
    if len(_DATASET_CACHE) >= _CACHE_MAX_SIZE:
        oldest_key = min(_DATASET_CACHE.keys(), key=lambda k: _DATASET_CACHE[k][1])
        del _DATASET_CACHE[oldest_key]
        print(f"🗑️ CACHE EVICTED: {oldest_key[0]}")
    
    _DATASET_CACHE[cache_key] = (df.copy(), time.time())
    print(f"💾 CACHE SET: {cache_key[0]} ({len(df):,} rows)")

def clear_cache():
    """Clear all cached data."""
    global _DATASET_CACHE
    _DATASET_CACHE = {}
    print("🧹 CACHE CLEARED")

app = FastAPI(title="NFL Data API", version="1.0.0")

# Debug logging system - stores recent errors and logs
DEBUG_ERRORS = deque(maxlen=100)  # Store last 100 errors
DEBUG_LOGS = deque(maxlen=500)    # Store last 500 log entries
DEBUG_FILE = "debug_log.json"     # File for agent-readable debug info


class ErrorReport(BaseModel):
    error: str
    traceback: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    timestamp: Optional[str] = None


def log_error(error: Exception, context: Optional[Dict[str, Any]] = None):
    """Log an error to the debug system."""
    error_entry = {
        "timestamp": datetime.now().isoformat(),
        "error_type": type(error).__name__,
        "error_message": str(error),
        "traceback": traceback.format_exc(),
        "context": context or {}
    }
    DEBUG_ERRORS.append(error_entry)
    _write_debug_file()
    print(f"🔴 ERROR LOGGED: {error_entry['error_type']}: {error_entry['error_message']}")


def log_info(message: str, context: Optional[Dict[str, Any]] = None):
    """Log an info message to the debug system."""
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "level": "INFO",
        "message": message,
        "context": context or {}
    }
    DEBUG_LOGS.append(log_entry)
    _write_debug_file()
    print(f"ℹ️  {message}")


def _write_debug_file():
    """Write debug information to a file that agents can read."""
    try:
        debug_data = {
            "last_updated": datetime.now().isoformat(),
            "error_count": len(DEBUG_ERRORS),
            "log_count": len(DEBUG_LOGS),
            "recent_errors": list(DEBUG_ERRORS)[-10:],  # Last 10 errors
            "recent_logs": list(DEBUG_LOGS)[-20:],       # Last 20 logs
        }
        with open(DEBUG_FILE, "w") as f:
            json.dump(debug_data, f, indent=2)
    except Exception as e:
        print(f"Failed to write debug file: {e}")


# Initialize debug file
_write_debug_file()

# CORS: Allow frontend (local dev + production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local Vite dev server
        "http://127.0.0.1:5173",  # Local IP access
        "http://localhost:3000",  # Alternative local
        "https://gridirondatahub.up.railway.app",  # Railway frontend production
        "https://*.vercel.app",   # Vercel deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Helper function to clean dicts for JSON serialization
def clean_dict(d):
    """Clean a dictionary/value for JSON serialization.
    Converts numpy types to native Python types and handles NaN values.
    """
    if d is None:
        return None
    if isinstance(d, dict):
        return {k: clean_dict(v) for k, v in d.items()}
    if isinstance(d, list):
        return [clean_dict(item) for item in d]
    # Handle numpy/pandas types
    if hasattr(d, 'item'):  # numpy scalar (int64, float64, etc.)
        d = d.item()
    if isinstance(d, float) and (pd.isna(d) or d != d):
        return None
    return d


@app.get("/health")
def health() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {"status": "ok"}


@app.get("/cache/status")
def cache_status() -> Dict[str, Any]:
    """Get cache status and statistics."""
    cache_info = []
    for key, (df, timestamp) in _DATASET_CACHE.items():
        age_seconds = int(time.time() - timestamp)
        cache_info.append({
            "dataset": key[0],
            "seasons": list(key[1]) if key[1] else [],
            "include_ngs": key[2],
            "ngs_stat_type": key[3],
            "rows": len(df),
            "age_seconds": age_seconds,
            "expires_in_seconds": max(0, _CACHE_TTL_SECONDS - age_seconds)
        })
    
    return {
        "cache_size": len(_DATASET_CACHE),
        "max_size": _CACHE_MAX_SIZE,
        "ttl_seconds": _CACHE_TTL_SECONDS,
        "entries": cache_info
    }


@app.post("/cache/clear")
def cache_clear():
    """Clear all cached data."""
    clear_cache()
    return {"status": "cleared", "message": "All cached data has been cleared"}


@app.get("/health/detailed")
def health_detailed() -> Dict[str, Any]:
    """
    Detailed health check with dependency status.
    
    Checks:
    - Database connectivity
    - Connection pool status
    - Circuit breaker state
    - dbt models availability
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "checks": {}
    }
    
    # Database check
    if DATABASE_AVAILABLE and SQLALCHEMY_AVAILABLE:
        try:
            from database.connection import get_db, engine
            from sqlalchemy import text
            
            # Test database connection
            db = next(get_db())
            result = db.execute(text("SELECT 1"))
            result.scalar()
            health_status["checks"]["database"] = "healthy"
            
            # Connection pool stats
            pool = engine.pool
            health_status["checks"]["connection_pool"] = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow(),
            }
            
            # Circuit breaker state
            health_status["checks"]["circuit_breaker"] = db_circuit_breaker.get_state()
            
            # Check dbt models
            try:
                result = db.execute(text("SELECT COUNT(*) FROM stg_nfl.stg_player_stats"))
                count = result.scalar()
                health_status["checks"]["dbt_models"] = {
                    "status": "healthy",
                    "player_stats_count": count
                }
            except Exception as e:
                health_status["checks"]["dbt_models"] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                health_status["status"] = "degraded"
                
        except Exception as e:
            health_status["checks"]["database"] = {
                "status": "unhealthy",
                "error": str(e)
            }
            health_status["status"] = "degraded"
    else:
        health_status["checks"]["database"] = "not_available"
        health_status["checks"]["connection_pool"] = "not_available"
        health_status["checks"]["circuit_breaker"] = "not_available"
    
    return health_status


@app.get("/health/circuit-breaker")
def health_circuit_breaker() -> Dict[str, Any]:
    """Get circuit breaker state."""
    if not DATABASE_AVAILABLE:
        return {
            "status": "not_available",
            "message": "Database modules not available"
        }
    
    return {
        "circuit_breaker": db_circuit_breaker.get_state(),
        "timestamp": datetime.now().isoformat()
    }


@app.post("/health/circuit-breaker/reset")
def reset_circuit_breaker() -> Dict[str, str]:
    """Manually reset circuit breaker (admin only)."""
    if not DATABASE_AVAILABLE:
        return {"status": "not_available"}
    
    db_circuit_breaker.reset()
    log_info("Circuit breaker manually reset")
    return {
        "status": "reset",
        "message": "Circuit breaker has been reset to CLOSED state"
    }


@app.post("/debug/report-error")
async def report_error(error_report: ErrorReport):
    """Endpoint for frontend to report errors."""
    error_entry = {
        "timestamp": error_report.timestamp or datetime.now().isoformat(),
        "error_type": "FrontendError",
        "error_message": error_report.error,
        "traceback": error_report.traceback,
        "context": error_report.context or {}
    }
    DEBUG_ERRORS.append(error_entry)
    _write_debug_file()
    log_info("Frontend error reported", {"error": error_report.error})
    return {"status": "logged"}


@app.get("/debug/errors")
def get_errors(limit: int = Query(10, ge=1, le=100)):
    """Get recent errors for debugging."""
    return {
        "count": len(DEBUG_ERRORS),
        "errors": list(DEBUG_ERRORS)[-limit:]
    }


@app.get("/debug/logs")
def get_logs(limit: int = Query(20, ge=1, le=200)):
    """Get recent log entries for debugging."""
    return {
        "count": len(DEBUG_LOGS),
        "logs": list(DEBUG_LOGS)[-limit:]
    }


@app.get("/debug/status")
def get_debug_status():
    """Get debug system status."""
    return {
        "error_count": len(DEBUG_ERRORS),
        "log_count": len(DEBUG_LOGS),
        "debug_file": DEBUG_FILE,
        "last_error": list(DEBUG_ERRORS)[-1] if DEBUG_ERRORS else None,
        "last_log": list(DEBUG_LOGS)[-1] if DEBUG_LOGS else None,
    }


@app.get("/debug/performance")
def get_performance_metrics():
    """Get performance metrics summary."""
    if not PERFORMANCE_MONITORING_AVAILABLE:
        return {"status": "not_available", "message": "Performance monitoring not enabled"}
    try:
        return get_performance_summary()
    except Exception as e:
        log_error(e, {"endpoint": "get_performance_metrics"})
        return {
            "status": "error",
            "error": str(e),
            "message": "Error retrieving performance metrics"
        }


@app.get("/debug/slow-operations")
def get_slow_operations_endpoint(limit: int = Query(20, ge=1, le=100)):
    """Get recent slow operations."""
    if not PERFORMANCE_MONITORING_AVAILABLE:
        return {"status": "not_available", "message": "Performance monitoring not enabled"}
    try:
        slow_ops = get_slow_operations(limit)
        return {
            "count": len(slow_ops),
            "operations": slow_ops
        }
    except Exception as e:
        log_error(e, {"endpoint": "get_slow_operations_endpoint"})
        return {
            "status": "error",
            "error": str(e),
            "message": "Error retrieving slow operations"
        }


@app.post("/debug/profiler-data")
async def receive_profiler_data(request: Request):
    """Receive profiler data from frontend for analysis."""
    try:
        import json
        from pathlib import Path
        
        # Handle both JSON and FormData (for sendBeacon fallback)
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            data = await request.json()
        elif "multipart/form-data" in content_type or "form-data" in content_type:
            form = await request.form()
            data_str = form.get("data")
            if data_str:
                data = json.loads(data_str)
            else:
                return {"status": "error", "message": "No data field in form"}
        else:
            # Try JSON anyway
            try:
                data = await request.json()
            except:
                return {"status": "error", "message": f"Unsupported content-type: {content_type}"}
        
        # Save to file for agent access
        profiler_dir = Path("profiler_logs")
        profiler_dir.mkdir(exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = profiler_dir / f"profiler_data_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        log_info(f"Received profiler data: {filename}", {
            "blocking_detections": len(data.get("blockingDetections", [])),
            "render_count": len(data.get("renderHistory", [])),
            "function_stats_count": len(data.get("functionStats", {})),
        })
        
        return {
            "status": "ok",
            "message": f"Profiler data saved to {filename}",
            "filename": str(filename)
        }
    except Exception as e:
        log_error(e, {"endpoint": "receive_profiler_data"})
        return {
            "status": "error",
            "error": str(e),
            "message": "Error saving profiler data"
        }


@app.get("/debug/profiler-data")
def get_profiler_data(limit: int = Query(5, ge=1, le=20)):
    """Get recent profiler data files."""
    try:
        from pathlib import Path
        
        profiler_dir = Path("profiler_logs")
        if not profiler_dir.exists():
            return {"files": [], "count": 0}
        
        files = sorted(profiler_dir.glob("profiler_data_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)
        files = files[:limit]
        
        return {
            "count": len(files),
            "files": [{"name": f.name, "size": f.stat().st_size, "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat()} for f in files]
        }
    except Exception as e:
        log_error(e, {"endpoint": "get_profiler_data"})
        return {
            "status": "error",
            "error": str(e),
            "message": "Error retrieving profiler data"
        }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to log all unhandled errors."""
    context = {
        "path": str(request.url),
        "method": request.method,
        "query_params": dict(request.query_params),
    }
    log_error(exc, context)
    return JSONResponse(
        status_code=500,
        content={
            "error": str(exc),
            "error_type": type(exc).__name__,
            "path": str(request.url),
        }
    )


@app.get("/test-ngs")
def test_ngs(
    seasons: Optional[List[int]] = Query([2024], description="Seasons to test"),
    stat_type: str = Query("receiving", description="NextGen stat type"),
):
    """Test endpoint to check NextGen Stats loading"""
    try:
        mod = import_library()
        ngs_df, func_name = call_dataset(mod, "nextgen_stats", seasons=seasons, stat_type=stat_type)
        return {
            "status": "success",
            "rows": len(ngs_df),
            "columns": list(ngs_df.columns),
            "function": func_name,
            "sample": ngs_df.head(1).to_dict(orient="records")[0] if len(ngs_df) > 0 else None
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.get("/v1/players")
def get_players():
    """Get all players with profile data including headshots"""
    try:
        mod = import_library()
        df, func_name = call_dataset(mod, "players")
        
        # Clean up data
        df = df.fillna(value=np.nan)
        df = df.replace([np.nan, np.inf, -np.inf], None)
        
        records = df.to_dict(orient="records")
        return JSONResponse(content={
            "count": len(records),
            "data": records,
            "columns": list(df.columns)
        })
    except Exception as e:
        log_error(e, {"context": "get_players"})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/player/{player_id}")
@track_endpoint_timing("/v1/player/{player_id}") if PERFORMANCE_MONITORING_AVAILABLE else lambda f: f
def get_player_profile(
    player_id: str,
    seasons: Optional[List[int]] = Query(None, description="Seasons to include stats for"),
):
    """Get detailed player profile with stats and metadata"""
    try:
        mod = import_library()
        
        # Load player info (rosters/players data)
        player_info = None
        try:
            players_df, _ = call_dataset(mod, "players")
            # Find player by various ID columns
            for id_col in ['gsis_id', 'player_id', 'espn_id', 'yahoo_id']:
                if id_col in players_df.columns:
                    match = players_df[players_df[id_col] == player_id]
                    if len(match) > 0:
                        player_info = match.iloc[0].to_dict()
                        break
        except Exception as e:
            log_info(f"Could not load players data: {e}")
        
        # Load roster info for current team
        roster_info = None
        try:
            roster_df, _ = call_dataset(mod, "rosters", seasons=[2025, 2024])
            for id_col in ['gsis_id', 'player_id']:
                if id_col in roster_df.columns:
                    match = roster_df[roster_df[id_col] == player_id]
                    if len(match) > 0:
                        # Get most recent roster entry
                        if 'season' in match.columns:
                            match = match.sort_values('season', ascending=False)
                        roster_info = match.iloc[0].to_dict()
                        break
        except Exception as e:
            log_info(f"Could not load roster data: {e}")
        
        # Load player stats
        stats_years = seasons or [2025, 2024, 2023]
        player_stats = []
        try:
            stats_df, _ = call_dataset(mod, "player_stats", seasons=stats_years)
            print(f"Loaded player_stats: {len(stats_df)} rows, columns: {list(stats_df.columns)[:10]}...")
            
            for id_col in ['player_id', 'gsis_id']:
                if id_col in stats_df.columns:
                    match = stats_df[stats_df[id_col] == player_id]
                    print(f"Looking for player_id={player_id} in column {id_col}: found {len(match)} rows")
                    if len(match) > 0:
                        # Group by season and aggregate stats
                        if 'season' in match.columns:
                            # Define which columns to sum vs average
                            sum_cols = [
                                'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
                                'sacks', 'sack_yards', 'passing_air_yards', 'passing_yards_after_catch',
                                'passing_first_downs', 'passing_epa', 'carries', 'rushing_yards', 'rushing_tds',
                                'rushing_fumbles', 'rushing_first_downs', 'rushing_epa', 'receptions', 'targets',
                                'receiving_yards', 'receiving_tds', 'receiving_fumbles', 'receiving_air_yards',
                                'receiving_yards_after_catch', 'receiving_first_downs', 'receiving_epa',
                                'fantasy_points', 'fantasy_points_ppr', 'routes'
                            ]
                            
                            for season, group in match.groupby('season'):
                                games = len(group)
                                
                                # Aggregate: sum for counting stats
                                agg_stats = {'games': games}
                                for col in sum_cols:
                                    if col in group.columns:
                                        agg_stats[col] = group[col].sum()
                                
                                # Keep first value for ID columns
                                for col in ['player_name', 'player_display_name', 'position', 'recent_team', 'team']:
                                    if col in group.columns:
                                        agg_stats[col] = group[col].iloc[0]
                                
                                print(f"Season {season}: {games} games, carries={agg_stats.get('carries', 0)}, rush_yds={agg_stats.get('rushing_yards', 0)}")
                                player_stats.append({
                                    'season': int(season),
                                    'games': games,
                                    'stats': agg_stats
                                })
                        else:
                            player_stats = match.to_dict(orient='records')
                        break
        except Exception as e:
            log_info(f"Could not load player stats: {e}")
        
        # Load game logs (weekly data - not aggregated) with schedule info
        game_logs = []
        try:
            # Load player stats
            stats_df, _ = call_dataset(mod, "player_stats", seasons=stats_years)
            
            # Load schedule for game info (opponent, score, W/L)
            schedule_df = None
            try:
                schedule_df, _ = call_dataset(mod, "schedules", seasons=stats_years)
            except Exception as sched_err:
                print(f"Could not load schedule: {sched_err}")
            
            for id_col in ['player_id', 'gsis_id']:
                if id_col in stats_df.columns:
                    match = stats_df[stats_df[id_col] == player_id]
                    if len(match) > 0:
                        # Sort by season and week
                        if 'season' in match.columns and 'week' in match.columns:
                            match = match.sort_values(['season', 'week'], ascending=[False, True])
                        
                        # Get player's team
                        player_team = None
                        for team_col in ['recent_team', 'team', 'team_abbr']:
                            if team_col in match.columns:
                                player_team = match[team_col].iloc[0]
                                break
                        
                        # Convert to list of dicts (one per game)
                        raw_logs = match.to_dict(orient='records')
                        
                        # Enhance with schedule data if available
                        if schedule_df is not None and len(schedule_df) > 0:
                            for log in raw_logs:
                                season = log.get('season')
                                week = log.get('week')
                                team = log.get('recent_team') or log.get('team') or player_team
                                
                                if season and week and team:
                                    # Find the matching game
                                    game_match = schedule_df[
                                        (schedule_df['season'] == season) & 
                                        (schedule_df['week'] == week) &
                                        ((schedule_df['home_team'] == team) | (schedule_df['away_team'] == team))
                                    ]
                                    
                                    if len(game_match) > 0:
                                        game = game_match.iloc[0]
                                        is_home = game['home_team'] == team
                                        opponent = game['away_team'] if is_home else game['home_team']
                                        team_score = game['home_score'] if is_home else game['away_score']
                                        opp_score = game['away_score'] if is_home else game['home_score']
                                        
                                        # Determine W/L/T
                                        if team_score is not None and opp_score is not None:
                                            if not pd.isna(team_score) and not pd.isna(opp_score):
                                                if team_score > opp_score:
                                                    result = 'W'
                                                elif team_score < opp_score:
                                                    result = 'L'
                                                else:
                                                    result = 'T'
                                            else:
                                                result = None
                                        else:
                                            result = None
                                        
                                        log['opponent'] = opponent
                                        log['is_home'] = is_home
                                        log['team_score'] = int(team_score) if team_score is not None and not pd.isna(team_score) else None
                                        log['opp_score'] = int(opp_score) if opp_score is not None and not pd.isna(opp_score) else None
                                        log['result'] = result
                                        log['game_id'] = game.get('game_id')
                        
                        game_logs = raw_logs
                        print(f"Loaded {len(game_logs)} game logs for player {player_id}")
                        break
        except Exception as e:
            log_info(f"Could not load game logs: {e}")
        
        # Calculate season_totals and career_totals from game_logs
        season_totals = {}
        career_totals = {}
        
        if game_logs and len(game_logs) > 0:
            # Sum columns for totals
            sum_cols = [
                'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
                'sacks', 'sack_yards', 'passing_air_yards', 'passing_yards_after_catch',
                'passing_first_downs', 'passing_epa', 'carries', 'rushing_yards', 'rushing_tds',
                'rushing_fumbles', 'rushing_first_downs', 'rushing_epa', 'receptions', 'targets',
                'receiving_yards', 'receiving_tds', 'receiving_fumbles', 'receiving_air_yards',
                'receiving_yards_after_catch', 'receiving_first_downs', 'receiving_epa',
                'fantasy_points', 'fantasy_points_ppr', 'routes'
            ]
            
            # Group by season for season_totals
            if 'season' in (game_logs[0] if game_logs else {}):
                for log in game_logs:
                    season = log.get('season')
                    if season not in season_totals:
                        season_totals[season] = {'games': 0, 'wins': 0, 'losses': 0, 'ties': 0}
                    
                    season_totals[season]['games'] += 1
                    if log.get('result') == 'W':
                        season_totals[season]['wins'] += 1
                    elif log.get('result') == 'L':
                        season_totals[season]['losses'] += 1
                    elif log.get('result') == 'T':
                        season_totals[season]['ties'] += 1
                    
                    for col in sum_cols:
                        if col in log and log[col] is not None:
                            if col not in season_totals[season]:
                                season_totals[season][col] = 0
                            season_totals[season][col] += log[col] or 0
            
            # Calculate career totals
            career_totals = {'games': 0, 'wins': 0, 'losses': 0, 'ties': 0}
            for log in game_logs:
                career_totals['games'] += 1
                if log.get('result') == 'W':
                    career_totals['wins'] += 1
                elif log.get('result') == 'L':
                    career_totals['losses'] += 1
                elif log.get('result') == 'T':
                    career_totals['ties'] += 1
                
                for col in sum_cols:
                    if col in log and log[col] is not None:
                        if col not in career_totals:
                            career_totals[col] = 0
                        career_totals[col] += log[col] or 0
            
            # Calculate efficiency metrics for career totals
            if career_totals.get('attempts', 0) > 0:
                career_totals['completion_pct'] = (career_totals.get('completions', 0) / career_totals['attempts']) * 100
                career_totals['yards_per_attempt'] = career_totals.get('passing_yards', 0) / career_totals['attempts']
                career_totals['td_percentage'] = (career_totals.get('passing_tds', 0) / career_totals['attempts']) * 100
                career_totals['int_percentage'] = (career_totals.get('interceptions', 0) / career_totals['attempts']) * 100
            
            dropbacks = career_totals.get('attempts', 0) + career_totals.get('sacks', 0)
            if dropbacks > 0:
                career_totals['epa_per_dropback'] = career_totals.get('passing_epa', 0) / dropbacks
                career_totals['sack_percentage'] = (career_totals.get('sacks', 0) / dropbacks) * 100
            
            if career_totals.get('carries', 0) > 0:
                career_totals['yards_per_carry'] = career_totals.get('rushing_yards', 0) / career_totals['carries']
                career_totals['rushing_td_rate'] = (career_totals.get('rushing_tds', 0) / career_totals['carries']) * 100
            
            if career_totals.get('targets', 0) > 0:
                career_totals['catch_percentage'] = (career_totals.get('receptions', 0) / career_totals['targets']) * 100
                career_totals['yards_per_target'] = career_totals.get('receiving_yards', 0) / career_totals['targets']
                career_totals['td_rate'] = (career_totals.get('receiving_tds', 0) / career_totals['targets']) * 100
            
            if career_totals.get('receptions', 0) > 0:
                career_totals['yards_per_reception'] = career_totals.get('receiving_yards', 0) / career_totals['receptions']
            
            if career_totals.get('routes', 0) > 0:
                career_totals['yprr'] = career_totals.get('receiving_yards', 0) / career_totals['routes']
                career_totals['tprr'] = career_totals.get('targets', 0) / career_totals['routes']
                career_totals['epa_per_route'] = career_totals.get('receiving_epa', 0) / career_totals['routes']
            
            # Calculate per-game averages
            if career_totals['games'] > 0:
                career_totals['fantasy_points_pg'] = career_totals.get('fantasy_points_ppr', 0) / career_totals['games']
                career_totals['passing_yards_pg'] = career_totals.get('passing_yards', 0) / career_totals['games']
                career_totals['rushing_yards_pg'] = career_totals.get('rushing_yards', 0) / career_totals['games']
                career_totals['receiving_yards_pg'] = career_totals.get('receiving_yards', 0) / career_totals['games']
            
            # Calculate efficiency metrics for each season
            for season, totals in season_totals.items():
                if totals.get('attempts', 0) > 0:
                    totals['completion_pct'] = (totals.get('completions', 0) / totals['attempts']) * 100
                    totals['yards_per_attempt'] = totals.get('passing_yards', 0) / totals['attempts']
                
                dropbacks = totals.get('attempts', 0) + totals.get('sacks', 0)
                if dropbacks > 0:
                    totals['epa_per_dropback'] = totals.get('passing_epa', 0) / dropbacks
                
                if totals.get('carries', 0) > 0:
                    totals['yards_per_carry'] = totals.get('rushing_yards', 0) / totals['carries']
                
                if totals.get('targets', 0) > 0:
                    totals['catch_percentage'] = (totals.get('receptions', 0) / totals['targets']) * 100
                    totals['yards_per_target'] = totals.get('receiving_yards', 0) / totals['targets']
                
                if totals.get('routes', 0) > 0:
                    totals['yprr'] = totals.get('receiving_yards', 0) / totals['routes']
        
        # Combine data
        result = {
            "player_id": player_id,
            "info": player_info,
            "roster": roster_info,
            "stats": player_stats,
            "game_logs": game_logs,
            "season_totals": season_totals,
            "career_totals": career_totals,
        }
        
        # Clean up NaN values and convert numpy types to native Python types
        def clean_dict(d):
            if d is None:
                return None
            if isinstance(d, dict):
                return {k: clean_dict(v) for k, v in d.items()}
            if isinstance(d, list):
                return [clean_dict(item) for item in d]
            # Handle numpy/pandas types
            if hasattr(d, 'item'):  # numpy scalar (int64, float64, etc.)
                d = d.item()
            if isinstance(d, float) and (pd.isna(d) or d != d):
                return None
            return d
        
        result = clean_dict(result)
        
        return JSONResponse(content=result)
    except Exception as e:
        log_error(e, {"context": "get_player_profile", "player_id": player_id})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/datasets")
def list_datasets(module: Optional[str] = Query(None, description="Library override: nflreadpy or nflreadr")):
    try:
        mod = import_library(module)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Import error: {e}") from e

    funcs = available_dataset_functions(mod)
    return {"library": mod.__name__, "available": funcs}


def _parse_seasons(
    seasons: Optional[List[int]] = None,
    seasons_csv: Optional[str] = None,
) -> List[int]:
    out: List[int] = []
    if seasons:
        out.extend(seasons)
    if seasons_csv:
        for tok in seasons_csv.split(","):
            tok = tok.strip()
            if not tok:
                continue
            try:
                out.append(int(tok))
            except ValueError:
                # Ignore invalid tokens
                continue
    # Deduplicate while preserving order
    seen = set()
    unique: List[int] = []
    for y in out:
        if y not in seen:
            seen.add(y)
            unique.append(y)
    return unique


@app.get("/v1/data/{dataset}")
def get_data(
    dataset: str,
    module: Optional[str] = Query(None, description="Library override: nflreadpy or nflreadr"),
    seasons: Optional[List[int]] = Query(None, description="Repeat param, e.g. seasons=2021&seasons=2022"),
    seasons_csv: Optional[str] = Query(None, description="Comma-separated seasons, e.g. 2021,2022"),
    columns: Optional[str] = Query(None, description="Comma-separated column whitelist"),
    limit: int = Query(1000, ge=1, le=100000),
    offset: int = Query(0, ge=0),
    fmt: str = Query("json", pattern="^(json|csv)$", description="json or csv"),
    include_ngs: bool = Query(False, description="Include NextGen Stats data (default: False for Railway free tier)"),
    ngs_stat_type: str = Query("receiving", pattern="^(receiving|rushing|passing)$", description="NextGen Stats type: receiving, rushing, or passing"),
):
    """Get dataset with performance tracking and caching."""
    import time
    start_time = time.perf_counter()
    endpoint_path = f"/v1/data/{dataset}"
    
    # Validate dataset key
    if dataset not in DATASET_CANDIDATES:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown dataset '{dataset}'. Options: {sorted(DATASET_CANDIDATES.keys())}",
        )

    # Import library
    try:
        mod = import_library(module)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Import error: {e}") from e

    # Seasons
    years = _parse_seasons(seasons=seasons, seasons_csv=seasons_csv)
    
    # Check cache for player_stats (the most expensive dataset)
    cache_key = None
    if dataset == "player_stats":
        cache_key = _get_cache_key(dataset, years, include_ngs, ngs_stat_type)
        cached_df = _get_cached_df(cache_key)
        if cached_df is not None:
            # Apply limit/offset to cached data
            df = cached_df
            total_rows = len(df)
            df = df.iloc[offset:offset + limit]
            
            # Convert to response format
            if fmt == "json":
                df = df.fillna(value=np.nan)
                df = df.replace([np.nan, np.inf, -np.inf], None)
                records = df.to_dict(orient="records")
                
                elapsed_ms = (time.perf_counter() - start_time) * 1000
                log_info(f"⚡ FAST (cached): {endpoint_path} took {elapsed_ms:.2f}ms")
                
                return {
                    "library": "nflreadpy",
                    "function": "cached",
                    "dataset": dataset,
                    "count": len(records),
                    "total": total_rows,
                    "cached": True,
                    "data": records,
                }
            else:
                # CSV format
                csv_buffer = io.StringIO()
                df.to_csv(csv_buffer, index=False)
                csv_buffer.seek(0)
                return StreamingResponse(
                    iter([csv_buffer.getvalue()]),
                    media_type="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={dataset}.csv"},
                )

    # Load from source
    try:
        df, func_name = call_dataset(mod, dataset, seasons=years or None)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Load error: {e}") from e

    # Column selection
    if columns:
        wanted = [c.strip() for c in columns.split(",") if c.strip()]
        present = [c for c in wanted if c in df.columns]
        if present:
            df = df[present]
    
    # Aggregate player_stats by player and season for season totals
    if dataset == "player_stats" and 'player_id' in df.columns:
        # Try to calculate routes run from PBP + Participation
        # NOTE: Routes are only relevant for WR/TE/RB - skip for QBs and 2025 season
        # Check if we have any non-QB positions (routes don't apply to QBs)
        has_non_qb_positions = False
        if 'position' in df.columns:
            non_qb_positions = df['position'].isin(['WR', 'TE', 'RB', 'FB'])
            has_non_qb_positions = non_qb_positions.any()
            log_info(f"Unique positions in DF: {df['position'].unique()}")
        else:
            log_info("Position column missing in DF")
        
        log_info(f"Routes check: years={years}, has_non_qb={has_non_qb_positions}")
        
        # Skip routes calculation if:
        # 1. All players are QBs (routes don't apply)
        # 2. Season is 2025 (no participation data available)
        # 3. No position column (can't determine)
        # 4. DISABLED for Railway free tier (requires 1.5-2.5GB RAM, we only have 1GB)
        # Routes calculation disabled to prevent memory issues and timeouts
        should_calculate_routes = False  # Disabled for Railway free tier - too memory intensive
        log_info(f"Should calculate routes: {should_calculate_routes}")
        
        if should_calculate_routes:
            try:
                # Only attempt if we have seasons (to limit data load)
                # Participation data is only available for 2016-2024 as of now
                participation_years = [y for y in years if 2016 <= y <= 2024]
                
                if participation_years:
                    log_info(f"Calculating routes for seasons: {participation_years} (skipping QBs)")
                    
                    with PerformanceTimer("load_pbp_for_routes", threshold_ms=10000):
                        # Load PBP (Play-by-Play) to identify pass plays
                        pbp_df, _ = call_dataset(mod, "pbp", seasons=participation_years)
                    # Select only needed columns to save memory
                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season"]
                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                    
                    with PerformanceTimer("load_participation_for_routes", threshold_ms=5000):
                        # Load Participation to identify players on field
                        part_df, _ = call_dataset(mod, "participation", seasons=participation_years)
                        part_cols = ["nflverse_game_id", "play_id", "offense_players"]
                        part_df = part_df[[c for c in part_cols if c in part_df.columns]]
                        
                        # Filter for pass plays
                        pass_plays = pbp_df[pbp_df['play_type'] == 'pass']
                        
                        with PerformanceTimer("merge_pbp_participation", threshold_ms=10000):
                            # Merge PBP and Participation
                            merged = pd.merge(pass_plays, part_df, left_on=['game_id', 'play_id'], right_on=['nflverse_game_id', 'play_id'])
                        
                        # Explode offense_players (semicolon separated string)
                        # Ensure it's a string before splitting
                        merged['offense_players'] = merged['offense_players'].astype(str)
                        merged['player_id_split'] = merged['offense_players'].str.split(';')
                        exploded = merged.explode('player_id_split')
                        
                        # Count routes (pass snaps) per player per week
                        routes_counts = exploded.groupby(['player_id_split', 'season', 'week']).size().reset_index(name='routes')
                        routes_counts.rename(columns={'player_id_split': 'player_id'}, inplace=True)
                        
                        # Merge routes into main df (only for non-QB positions)
                        # Filter main df to exclude QBs before merge
                        non_qb_df = df[df['position'] != 'QB'].copy() if 'position' in df.columns else df.copy()
                        if len(non_qb_df) > 0:
                            non_qb_df = pd.merge(non_qb_df, routes_counts, on=['player_id', 'season', 'week'], how='left')
                            non_qb_df['routes'] = non_qb_df['routes'].fillna(0)
                            
                            # Merge back with QB data
                            qb_df = df[df['position'] == 'QB'].copy() if 'position' in df.columns else pd.DataFrame()
                            if len(qb_df) > 0:
                                qb_df['routes'] = 0  # QBs don't run routes
                                df = pd.concat([non_qb_df, qb_df], ignore_index=True)
                            else:
                                df = non_qb_df
                        else:
                            df['routes'] = 0
                        
                        log_info(f"Routes calculation complete. Added routes for {len(non_qb_df)} non-QB players")
                
                # 2. Handle seasons WITHOUT participation data (e.g. 2025)
                # This block is OUTSIDE the if participation_years block so it runs for 2025-only requests
                missing_part_years = [y for y in years if y not in participation_years and y <= 2025]
                
                if missing_part_years and has_non_qb_positions:
                    log_info(f"Estimating routes for seasons (using Snaps * Pass Rate): {missing_part_years}")
                    try:
                        # Load PBP for pass rate calculation
                        pbp_est, _ = call_dataset(mod, "pbp", seasons=missing_part_years)
                        log_info(f"Loaded PBP for estimation: {len(pbp_est)} rows")
                        
                        pbp_cols = ["game_id", "play_id", "play_type", "week", "season", "posteam"]
                        pbp_est = pbp_est[[c for c in pbp_cols if c in pbp_est.columns]]
                        
                        # Calculate Team Pass Rate per Game
                        # Group by game_id and posteam
                        game_stats = pbp_est.groupby(['game_id', 'posteam']).agg(
                            pass_plays=('play_type', lambda x: (x == 'pass').sum()),
                            total_plays=('play_type', lambda x: x.isin(['pass', 'run']).sum())
                        ).reset_index()
                        
                        game_stats['pass_rate'] = game_stats['pass_plays'] / game_stats['total_plays']
                        game_stats['pass_rate'] = game_stats['pass_rate'].fillna(0)
                        log_info(f"Calculated game stats: {len(game_stats)} rows")
                        
                        # Load Snap Counts
                        snaps, _ = call_dataset(mod, "snap_counts", seasons=missing_part_years)
                        log_info(f"Loaded snap counts: {len(snaps)} rows")
                        
                        # Snaps has 'pfr_player_id', 'player', 'team', 'season', 'week', 'offense_snaps'
                        # We need to map pfr_player_id to player_id (gsis_id) if possible, or join on name
                        
                        # Load Players for ID mapping
                        players, _ = call_dataset(mod, "players", seasons=None)
                        # Create map: pfr_id -> gsis_id (player_id)
                        # Or display_name -> player_id as backup
                        
                        # Filter snaps to offense
                        off_snaps = snaps[(snaps['offense_snaps'] > 0) & (snaps['position'].isin(['WR', 'TE', 'RB']))].copy()
                        log_info(f"Filtered offense snaps: {len(off_snaps)} rows")
                        
                        # Join Pass Rate to Snaps
                        # Snaps has 'team', 'season', 'week'. game_stats has 'posteam', 'game_id'.
                        # We need to join on team/season/week.
                        # Add season/week to game_stats
                        game_meta = pbp_est[['game_id', 'season', 'week']].drop_duplicates()
                        game_stats = game_stats.merge(game_meta, on='game_id')
                        
                        # Merge Snaps with Pass Rate
                        estimated = pd.merge(
                            off_snaps,
                            game_stats,
                            left_on=['season', 'week', 'team'],
                            right_on=['season', 'week', 'posteam'],
                            how='inner'
                        )
                        log_info(f"Merged snaps with pass rate: {len(estimated)} rows")
                        
                        estimated['estimated_routes'] = (estimated['offense_snaps'] * estimated['pass_rate']).round(1)
                        
                        # Now we need to merge this back to the main DF
                        # Main DF has 'player_id' (gsis_id). Snaps has 'pfr_player_id' and 'player'.
                        # Try to map pfr_id -> gsis_id
                        if 'pfr_id' in players.columns and 'gsis_id' in players.columns:
                            id_map = players[['pfr_id', 'gsis_id']].dropna().set_index('pfr_id')['gsis_id'].to_dict()
                            estimated['player_id'] = estimated['pfr_player_id'].map(id_map)
                        
                        # For those missing ID, try name match (less reliable but necessary fallback)
                        if estimated['player_id'].isna().any():
                            name_map = players[['display_name', 'gsis_id']].dropna().set_index('display_name')['gsis_id'].to_dict()
                            # Fill missing IDs using name
                            mask = estimated['player_id'].isna()
                            estimated.loc[mask, 'player_id'] = estimated.loc[mask, 'player'].map(name_map)
                            
                        # Select relevant columns
                        est_routes = estimated[['player_id', 'season', 'week', 'estimated_routes']].dropna()
                        est_routes.rename(columns={'estimated_routes': 'routes'}, inplace=True)
                        
                        # Merge into main DF
                        # If we already have routes from participation (e.g. mixed years), we need to combine
                        if 'routes' in df.columns:
                            # Update existing routes with estimated ones where missing
                            # Merge estimated routes
                            df = pd.merge(df, est_routes, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_est'))
                            # If routes is 0 or NaN, use estimated
                            df['routes'] = df['routes'].fillna(0)
                            if 'routes_est' in df.columns:
                                df['routes'] = df.apply(lambda x: x['routes_est'] if x['routes'] == 0 and pd.notna(x['routes_est']) else x['routes'], axis=1)
                                df.drop(columns=['routes_est'], inplace=True)
                        else:
                            # Just merge
                            df = pd.merge(df, est_routes, on=['player_id', 'season', 'week'], how='left')
                            df['routes'] = df['routes'].fillna(0)
                            
                        log_info(f"Estimated routes calculated for {len(est_routes)} player-weeks")
                    
                    except Exception as e:
                        log_info(f"Estimation failed: {e}")
                        import traceback
                        traceback.print_exc()
                
                # Final cleanup - ensure routes column exists
                if 'routes' not in df.columns:
                    df['routes'] = 0
                else:
                    df['routes'] = df['routes'].fillna(0)
            except Exception as e:
                log_error(e, {"context": "Routes calculation", "seasons": years})
                # Don't fail the request - just set routes to 0
                if 'routes' not in df.columns:
                    df['routes'] = 0
                else:
                    df['routes'] = df['routes'].fillna(0)
        else:
            # Skip routes calculation - set to 0
            df['routes'] = 0
            if not has_non_qb_positions:
                log_info("Skipping routes calculation - all players are QBs or no position data")
            elif not years or not any(2016 <= y <= 2024 for y in years):
                log_info(f"Skipping routes calculation - no participation data for seasons: {years}")

        # Merge NextGen Stats if requested
        if include_ngs and dataset == "player_stats" and years:
            try:
                with PerformanceTimer(f"load_ngs_{ngs_stat_type}", threshold_ms=10000):
                    log_info(f"Loading NextGen Stats (stat_type={ngs_stat_type}) for seasons: {years}")
                    
                    # Load NextGen Stats
                    ngs_df = None
                    ngs_func_name = None
                    ngs_years = years
                    
                    try:
                        ngs_df, ngs_func_name = call_dataset(mod, "nextgen_stats", seasons=years, stat_type=ngs_stat_type)
                        log_info(f"Loaded {len(ngs_df):,} NextGen Stats rows using {ngs_func_name}", {"rows": len(ngs_df), "function": ngs_func_name})
                    except Exception as load_err:
                        log_error(load_err, {"context": "NextGen Stats load", "seasons": years, "stat_type": ngs_stat_type})
                        ngs_df = None
                
                # If no data and 2025 was requested, try 2024 as fallback
                if (ngs_df is None or (isinstance(ngs_df, pd.DataFrame) and len(ngs_df) == 0)) and 2025 in years and 2024 not in years:
                    log_info("No NextGen Stats data found for 2025. Trying 2024 as fallback...")
                    try:
                        ngs_df, ngs_func_name = call_dataset(mod, "nextgen_stats", seasons=[2024], stat_type=ngs_stat_type)
                        log_info(f"Loaded {len(ngs_df):,} NextGen Stats rows for 2024 (fallback)", {"rows": len(ngs_df)})
                        ngs_years = [2024]  # Use 2024 for merge matching
                    except Exception as fallback_err:
                        log_error(fallback_err, {"context": "NextGen Stats fallback to 2024", "stat_type": ngs_stat_type})
                        ngs_df = None
                    
                # Only proceed with merge if we have NextGen Stats data
                if ngs_df is not None and isinstance(ngs_df, pd.DataFrame) and len(ngs_df) > 0:
                    print(f"NextGen Stats columns: {list(ngs_df.columns)[:15]}")
                    print(f"Main dataframe columns: {list(df.columns)[:15]}")
                    
                    # Filter to only use week 0 (season totals) from NextGen Stats
                    # NextGen Stats raw data contains both weekly rows AND a week 0 summary row
                    # Week 0 = season totals (expected_rush_yards, rush_yards_over_expected are TOTALS)
                    if 'week' in ngs_df.columns:
                        ngs_season_totals = ngs_df[ngs_df['week'] == 0]
                        if len(ngs_season_totals) > 0:
                            print(f"Using week 0 (season totals): {len(ngs_season_totals)} rows")
                            ngs_df = ngs_season_totals
                        else:
                            print("No week 0 data found, using all weekly data (will be averaged)")
                    
                    # Identify player ID column in NextGen Stats
                    ngs_player_col = None
                    for col in ['player_id', 'gsis_id', 'gsis_player_id', 'player_gsis_id']:
                        if col in ngs_df.columns:
                            ngs_player_col = col
                            print(f"Found NextGen player ID column: {ngs_player_col}")
                            break
                    
                    if ngs_player_col is None:
                        print(f"⚠️  No player ID column found in NextGen Stats. Available columns: {list(ngs_df.columns)}")
                        print("⚠️  Skipping NextGen Stats merge - cannot match players")
                    else:
                        # Identify player ID column in main dataframe
                        main_player_col = 'player_id' if 'player_id' in df.columns else None
                        if main_player_col is None:
                            # Try to find alternative
                            for col in ['gsis_id', 'player_id']:
                                if col in df.columns:
                                    main_player_col = col
                                    break
                        
                        if main_player_col is None:
                            print("⚠️  No player ID column found in main dataframe, skipping NextGen merge")
                        else:
                            # Prepare merge keys
                            merge_keys = []
                            
                            # Player ID - rename NextGen column to match main if needed
                            if ngs_player_col != main_player_col:
                                ngs_df = ngs_df.rename(columns={ngs_player_col: main_player_col})
                            merge_keys.append(main_player_col)
                            
                            # Season - only merge if seasons match or we're using fallback
                            # For fallback (2024 NextGen with 2025 player stats), we'll merge on player_id + week only
                            if 'season' in df.columns and 'season' in ngs_df.columns:
                                # Only add season to merge if they match, or skip season matching for fallback
                                if ngs_years == years:
                                    merge_keys.append('season')
                                # For fallback, we'll merge on player_id + week only (if week exists)
                            elif 'season' in ngs_df.columns and 'year' in df.columns:
                                if ngs_years == years:
                                    ngs_df = ngs_df.rename(columns={'season': 'year'})
                                    merge_keys.append('year')
                            
                            # Week - only add to merge keys if NOT using season totals (week 0)
                            # If we filtered to week 0, we merge on player_id + season only
                            using_season_totals = 'week' in ngs_df.columns and (ngs_df['week'] == 0).all()
                            if 'week' in df.columns and 'week' in ngs_df.columns and not using_season_totals:
                                merge_keys.append('week')
                            
                            # Select only relevant columns from NextGen Stats to avoid conflicts
                            # Keep player identifier, temporal columns, and NextGen-specific metrics
                            ngs_keep_cols = [main_player_col]
                            if 'season' in ngs_df.columns:
                                ngs_keep_cols.append('season')
                            elif 'year' in ngs_df.columns:
                                ngs_keep_cols.append('year')
                            if 'week' in ngs_df.columns:
                                ngs_keep_cols.append('week')
                            
                            # Add NextGen-specific metric columns (exclude common stats that might conflict)
                            common_stats = ['receptions', 'targets', 'yards', 'touchdowns', 'tds', 
                                           'player_name', 'player_display_name', 'team', 'team_abbr', 
                                           'position', 'player_position']
                            ngs_metric_cols = [col for col in ngs_df.columns 
                                              if col not in ngs_keep_cols 
                                              and col not in common_stats
                                              and not col.startswith('_')]
                            
                            # Prefix NextGen columns to avoid conflicts
                            ngs_metric_cols_prefixed = [f"ngs_{col}" for col in ngs_metric_cols]
                            ngs_rename_map = {old: new for old, new in zip(ngs_metric_cols, ngs_metric_cols_prefixed)}
                            ngs_df_renamed = ngs_df[ngs_keep_cols + ngs_metric_cols].rename(columns=ngs_rename_map)
                            
                            # Perform merge
                            print(f"Merging NextGen Stats on: {merge_keys}")
                            df = pd.merge(
                                df,
                                ngs_df_renamed,
                                on=merge_keys,
                                how='left',  # Left join to keep all player stats
                                suffixes=('', '_ngs')
                            )
                            
                            ngs_cols_added = len([col for col in df.columns if col.startswith('ngs_')])
                            print(f"✅ NextGen Stats merge complete. Added {ngs_cols_added} NextGen columns")
                            
                            # Show sample of merged data
                            ngs_cols = [col for col in df.columns if col.startswith('ngs_')]
                            if ngs_cols:
                                log_info(f"NextGen columns added: {ngs_cols[:5]}... (showing first 5)", {"columns": ngs_cols[:10]})
                else:
                    log_info("Skipping NextGen Stats merge - no data available after fallback attempts")
            except Exception as e:
                log_error(e, {"context": "NextGen Stats merge", "seasons": years, "stat_type": ngs_stat_type})
                # Continue without NextGen Stats - don't fail the request

        # Rename columns to match expected frontend keys
        rename_map = {
            'passing_interceptions': 'interceptions',
            'sacks_suffered': 'sacks',
            'sack_yards_lost': 'sack_yards'
        }
        df.rename(columns=rename_map, inplace=True)

        # Define aggregation rules for different column types
        sum_cols = [
            'completions', 'attempts', 'passing_yards', 'passing_tds', 'interceptions',
            'sacks', 'sack_yards', 'sack_fumbles', 'sack_fumbles_lost',
            'passing_air_yards', 'passing_yards_after_catch', 'passing_first_downs', 'passing_epa',
            'passing_2pt_conversions', 'carries', 'rushing_yards', 'rushing_tds',
            'rushing_fumbles', 'rushing_fumbles_lost', 'rushing_first_downs', 'rushing_epa',
            'rushing_2pt_conversions', 'receptions', 'targets', 'receiving_yards',
            'receiving_tds', 'receiving_fumbles', 'receiving_fumbles_lost',
            'receiving_air_yards', 'receiving_yards_after_catch', 'receiving_first_downs',
            'receiving_epa', 'receiving_2pt_conversions', 'special_teams_tds',
            'fantasy_points', 'fantasy_points_ppr', 'routes'
        ]
        
        # Rate stats to average
        mean_cols = ['target_share', 'wopr', 'racr', 'air_yards_share', 'pacr', 'dakota', 'passing_cpoe']

        # Find which columns actually exist in the dataframe
        agg_dict = {}
        for col in sum_cols:
            if col in df.columns:
                agg_dict[col] = 'sum'
        
        for col in mean_cols:
            if col in df.columns:
                agg_dict[col] = 'mean'
        
        # NextGen Stats columns - ALL numeric columns should be AVERAGED
        # The raw data already contains per-attempt/per-game metrics, not totals
        # Examples: avg_rush_yards (~4.5), expected_rush_yards (~4.2), efficiency (~45%), etc.
        ngs_cols = [col for col in df.columns if col.startswith('ngs_')]
        
        for col in ngs_cols:
            if col in df.columns:
                col_dtype = df[col].dtype
                if pd.api.types.is_numeric_dtype(col_dtype):
                    # All numeric NGS columns are averages/rates - use mean
                    agg_dict[col] = 'mean'
                else:
                    # For string/categorical columns, use 'first'
                    agg_dict[col] = 'first'
        
        # Add games count
        df['games'] = 1
        agg_dict['games'] = 'sum'
        
        # Keep first value for identification columns
        id_cols = ['player_name', 'player_display_name', 'position', 'position_group', 'recent_team', 'team', 'team_abbr']
        for col in id_cols:
            if col in df.columns:
                agg_dict[col] = 'first'
        
        # Group by player_id and season (if season exists)
        group_by = ['player_id']
        if 'season' in df.columns:
            group_by.append('season')
            
        df = df.groupby(group_by, as_index=False).agg(agg_dict)

    # Calculate efficiency metrics for player_stats dataset
    if dataset == "player_stats":
        # QB Efficiency Metrics
        if 'attempts' in df.columns:
            attempts = df['attempts'].fillna(0)
            df['completion_pct'] = (df['completions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
            df['yards_per_attempt'] = (df['passing_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
            df['td_percentage'] = (df['passing_tds'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
            df['int_percentage'] = (df['interceptions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
            if 'passing_air_yards' in df.columns:
                df['air_yards_per_attempt'] = (df['passing_air_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
        
        # Dropbacks = attempts + sacks
        if 'attempts' in df.columns or 'sacks' in df.columns:
            df['dropbacks'] = (df.get('attempts', pd.Series(0, index=df.index)).fillna(0) + 
                              df.get('sacks', pd.Series(0, index=df.index)).fillna(0))
            dropbacks = df['dropbacks'].replace(0, np.nan)
            if 'passing_epa' in df.columns:
                df['epa_per_dropback'] = (df['passing_epa'].fillna(0) / dropbacks).fillna(0)
            if 'fantasy_points_ppr' in df.columns:
                df['fantasy_points_per_dropback'] = (df['fantasy_points_ppr'].fillna(0) / dropbacks).fillna(0)
            if 'sacks' in df.columns:
                df['sack_percentage'] = (df['sacks'].fillna(0) / dropbacks * 100).fillna(0)
        
        # RB Efficiency Metrics
        if 'carries' in df.columns:
            carries = df['carries'].replace(0, np.nan)
            df['yards_per_carry'] = (df['rushing_yards'].fillna(0) / carries).fillna(0)
            df['rushing_td_rate'] = (df['rushing_tds'].fillna(0) / carries * 100).fillna(0)
            if 'rushing_epa' in df.columns:
                df['rushing_epa_per_carry'] = (df['rushing_epa'].fillna(0) / carries).fillna(0)
        
        # RB Touches (carries + receptions)
        if 'carries' in df.columns or 'receptions' in df.columns:
            df['touches'] = (df.get('carries', pd.Series(0, index=df.index)).fillna(0) + 
                            df.get('receptions', pd.Series(0, index=df.index)).fillna(0))
            touches = df['touches'].replace(0, np.nan)
            if 'rushing_yards' in df.columns and 'receiving_yards' in df.columns:
                total_yards = df['rushing_yards'].fillna(0) + df['receiving_yards'].fillna(0)
                df['yards_per_touch'] = (total_yards / touches).fillna(0)
        
        # WR/TE Efficiency Metrics
        if 'targets' in df.columns:
            targets = df['targets'].replace(0, np.nan)
            df['catch_percentage'] = (df['receptions'].fillna(0) / targets * 100).fillna(0)
            if 'receiving_yards' in df.columns:
                df['yards_per_target'] = (df['receiving_yards'].fillna(0) / targets).fillna(0)
            if 'receiving_tds' in df.columns:
                df['td_rate'] = (df['receiving_tds'].fillna(0) / targets * 100).fillna(0)
            if 'receiving_air_yards' in df.columns:
                df['adot'] = (df['receiving_air_yards'].fillna(0) / targets).fillna(0)
        
        if 'receptions' in df.columns and 'receiving_yards' in df.columns:
            receptions = df['receptions'].replace(0, np.nan)
            df['yards_per_reception'] = (df['receiving_yards'].fillna(0) / receptions).fillna(0)
            if 'receiving_first_downs' in df.columns:
                df['first_down_rate'] = (df['receiving_first_downs'].fillna(0) / receptions * 100).fillna(0)
        
        # Routes-based metrics
        if 'routes' in df.columns:
            routes = df['routes'].replace(0, np.nan)
            if 'receiving_yards' in df.columns:
                df['yprr'] = (df['receiving_yards'].fillna(0) / routes).fillna(0)
            if 'targets' in df.columns:
                df['tprr'] = (df['targets'].fillna(0) / routes).fillna(0)
            if 'receiving_epa' in df.columns:
                df['epa_per_route'] = (df['receiving_epa'].fillna(0) / routes).fillna(0)
        
        # RACR (Receiving Air Conversion Ratio)
        if 'receiving_air_yards' in df.columns and 'receiving_yards' in df.columns:
            air_yards = df['receiving_air_yards'].replace(0, np.nan)
            df['racr'] = (df['receiving_yards'].fillna(0) / air_yards).fillna(0)
        
        # RB Receiving EPA per target
        if 'targets' in df.columns and 'receiving_epa' in df.columns:
            targets_for_epa = df['targets'].replace(0, np.nan)
            df['receiving_epa_per_target'] = (df['receiving_epa'].fillna(0) / targets_for_epa).fillna(0)
        
        # Per-game metrics
        if 'games' in df.columns:
            games = df['games'].replace(0, np.nan)
            per_game_map = {
                'fantasy_points_pg': 'fantasy_points_ppr',
                'passing_yards_pg': 'passing_yards',
                'passing_tds_pg': 'passing_tds',
                'rushing_yards_pg': 'rushing_yards',
                'receiving_yards_pg': 'receiving_yards',
                'targets_pg': 'targets',
                'receptions_pg': 'receptions',
                'receiving_tds_pg': 'receiving_tds',
                'carries_pg': 'carries',
            }
            
            for pg_col, base_col in per_game_map.items():
                if base_col in df.columns:
                    df[pg_col] = (df[base_col].fillna(0) / games).fillna(0)
            
            if 'receiving_epa' in df.columns:
                df['epa_per_game'] = (df['receiving_epa'].fillna(0) / games).fillna(0)

    # Cache the fully processed player_stats DataFrame (before limit/offset)
    if dataset == "player_stats" and cache_key is not None:
        _set_cached_df(cache_key, df)
    
    total_rows = len(df)
    
    # Offset and limit
    if offset:
        df = df.iloc[offset:]
    if limit:
        df = df.iloc[:limit]

    # Format
    if fmt == "json":
        if PERFORMANCE_MONITORING_AVAILABLE:
            with PerformanceTimer("convert_to_json", threshold_ms=1000):
                # Handle NaN values for JSON compliance - use fillna to preserve column names
                df = df.fillna(value=np.nan)  # First ensure NaNs are proper
                df = df.replace([np.nan, np.inf, -np.inf], None)  # Then replace with None
                
                # FastAPI will serialize this efficiently
                records = df.to_dict(orient="records")
        else:
            # Handle NaN values for JSON compliance - use fillna to preserve column names
            df = df.fillna(value=np.nan)  # First ensure NaNs are proper
            df = df.replace([np.nan, np.inf, -np.inf], None)  # Then replace with None
            
        # FastAPI will serialize this efficiently
        records = df.to_dict(orient="records")
        result = JSONResponse(
            content={
                "library": mod.__name__,
                "function": func_name,
                "dataset": dataset,
                "count": len(records),
                "total": total_rows if 'total_rows' in dir() else len(records),
                "cached": False,
                "data": records,
            }
        )
        
        # Track endpoint timing
        if PERFORMANCE_MONITORING_AVAILABLE:
            duration_ms = (time.perf_counter() - start_time) * 1000
            if hasattr(track_endpoint_timing, '__wrapped__'):
                # Track in endpoint stats
                if not hasattr(get_performance_summary, '_endpoint_timings'):
                    get_performance_summary._endpoint_timings = {}
                if endpoint_path not in get_performance_summary._endpoint_timings:
                    get_performance_summary._endpoint_timings[endpoint_path] = []
                get_performance_summary._endpoint_timings[endpoint_path].append(duration_ms)
            
            if duration_ms > 2000:
                log_info(f"🐌 SLOW ENDPOINT: {endpoint_path} took {duration_ms:.2f}ms")
        
        return result
    # CSV streaming
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    filename = f"{dataset}_{'_'.join(map(str, years)) if years else 'all'}.csv"
    return StreamingResponse(
        buf,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# =========================================================================
# GAMES/SCHEDULE ENDPOINTS
# =========================================================================

@app.get("/v1/schedule")
async def get_schedule(
    season: int = Query(2025, description="Season year"),
    week: Optional[int] = Query(None, description="Specific week (1-18, or None for all)"),
):
    """
    Get NFL schedule/games data for a season.
    Returns game results including scores, teams, and basic stats.
    """
    try:
        mod = import_library()
        
        # Load schedule data
        schedule_df, func_name = call_dataset(mod, "schedules", seasons=[season])
        print(f"Loaded {len(schedule_df)} schedule rows using {func_name}")
        print(f"Schedule columns: {list(schedule_df.columns)}")
        
        # Filter by week if specified
        if week is not None and 'week' in schedule_df.columns:
            schedule_df = schedule_df[schedule_df['week'] == week]
        
        # Sort by week and game time
        if 'week' in schedule_df.columns:
            schedule_df = schedule_df.sort_values(['week', 'gameday'] if 'gameday' in schedule_df.columns else ['week'])
        
        # Clean up data for JSON
        schedule_df = schedule_df.replace([np.nan, np.inf, -np.inf], None)
        records = schedule_df.to_dict(orient='records')
        
        # Clean each record
        clean_records = [clean_dict(r) for r in records]
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "week": week,
            "games": len(clean_records),
            "data": clean_records
        })
        
    except Exception as e:
        log_error(e, {"endpoint": "schedule", "season": season, "week": week})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/game/{game_id}")
async def get_game_detail(
    game_id: str,
    include_player_stats: bool = Query(True, description="Include individual player stats"),
):
    """
    Get detailed information for a specific game.
    Includes box score, team stats, and individual player performances.
    """
    try:
        mod = import_library()
        
        # Extract season from game_id (format: YYYY_WW_AWAY_HOME)
        parts = game_id.split('_')
        if len(parts) >= 2:
            season = int(parts[0])
            week = int(parts[1])
        else:
            season = 2025
            week = 1
        
        result = {
            "game_id": game_id,
            "season": season,
            "week": week,
            "game_info": None,
            "home_team": None,
            "away_team": None,
            "player_stats": []
        }
        
        # Load schedule to get game info
        try:
            schedule_df, _ = call_dataset(mod, "schedules", seasons=[season])
            
            # Find the specific game
            game_col = None
            for col in ['game_id', 'nflverse_game_id', 'pfr_game_id']:
                if col in schedule_df.columns:
                    game_col = col
                    break
            
            if game_col:
                game_row = schedule_df[schedule_df[game_col] == game_id]
                if len(game_row) > 0:
                    game_info = game_row.iloc[0].to_dict()
                    result["game_info"] = clean_dict(game_info)
                    result["home_team"] = game_info.get('home_team')
                    result["away_team"] = game_info.get('away_team')
                    result["home_score"] = game_info.get('home_score')
                    result["away_score"] = game_info.get('away_score')
                    print(f"Found game info for {game_id}")
        except Exception as e:
            print(f"Could not load schedule: {e}")
        
        # Load player stats for this game
        if include_player_stats:
            try:
                stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
                
                # Filter to specific week
                if 'week' in stats_df.columns:
                    week_stats = stats_df[stats_df['week'] == week]
                    
                    # Further filter by teams if we know them
                    if result["home_team"] and result["away_team"]:
                        teams = [result["home_team"], result["away_team"]]
                        team_col = None
                        for col in ['recent_team', 'team', 'team_abbr']:
                            if col in week_stats.columns:
                                team_col = col
                                break
                        
                        if team_col:
                            week_stats = week_stats[week_stats[team_col].isin(teams)]
                    
                    # Calculate efficiency metrics for game detail player stats
                    if 'attempts' in week_stats.columns:
                        attempts = week_stats['attempts'].fillna(0)
                        week_stats['completion_pct'] = (week_stats['completions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
                        week_stats['yards_per_attempt'] = (week_stats['passing_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
                    
                    if 'carries' in week_stats.columns:
                        carries = week_stats['carries'].replace(0, np.nan)
                        week_stats['yards_per_carry'] = (week_stats['rushing_yards'].fillna(0) / carries).fillna(0)
                    
                    if 'targets' in week_stats.columns:
                        targets = week_stats['targets'].replace(0, np.nan)
                        week_stats['catch_percentage'] = (week_stats['receptions'].fillna(0) / targets * 100).fillna(0)
                        if 'receiving_yards' in week_stats.columns:
                            week_stats['yards_per_target'] = (week_stats['receiving_yards'].fillna(0) / targets).fillna(0)
                    
                    if 'receptions' in week_stats.columns and 'receiving_yards' in week_stats.columns:
                        receptions = week_stats['receptions'].replace(0, np.nan)
                        week_stats['yards_per_reception'] = (week_stats['receiving_yards'].fillna(0) / receptions).fillna(0)
                    
                    # Sort by fantasy points to show top performers first
                    if 'fantasy_points_ppr' in week_stats.columns:
                        week_stats = week_stats.sort_values('fantasy_points_ppr', ascending=False)
                    
                    # Convert to records
                    week_stats = week_stats.replace([np.nan, np.inf, -np.inf], None)
                    player_records = week_stats.to_dict(orient='records')
                    result["player_stats"] = [clean_dict(r) for r in player_records]
                    print(f"Found {len(result['player_stats'])} player stat rows for week {week}")
                    
            except Exception as e:
                print(f"Could not load player stats: {e}")
        
        return JSONResponse(content=result)
        
    except Exception as e:
        log_error(e, {"endpoint": "game_detail", "game_id": game_id})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/week/{season}/{week}")
async def get_week_summary(
    season: int,
    week: int,
    include_leaders: bool = Query(True, description="Include top performers"),
):
    """
    Get summary of all games for a specific week.
    Includes scores and optional top performers per game.
    """
    try:
        mod = import_library()
        
        games = []
        week_leaders = {
            "passing": None,
            "rushing": None,
            "receiving": None
        }
        
        # Load schedule
        try:
            schedule_df, _ = call_dataset(mod, "schedules", seasons=[season])
            if 'week' in schedule_df.columns:
                week_schedule = schedule_df[schedule_df['week'] == week]
                week_schedule = week_schedule.replace([np.nan, np.inf, -np.inf], None)
                
                for _, game in week_schedule.iterrows():
                    game_dict = clean_dict(game.to_dict())
                    games.append({
                        "game_id": game_dict.get('game_id') or game_dict.get('nflverse_game_id'),
                        "gameday": game_dict.get('gameday'),
                        "gametime": game_dict.get('gametime'),
                        "home_team": game_dict.get('home_team'),
                        "away_team": game_dict.get('away_team'),
                        "home_score": game_dict.get('home_score'),
                        "away_score": game_dict.get('away_score'),
                        "result": game_dict.get('result'),
                        "overtime": game_dict.get('overtime'),
                        "stadium": game_dict.get('stadium'),
                        "roof": game_dict.get('roof'),
                    })
                print(f"Found {len(games)} games for week {week}")
        except Exception as e:
            print(f"Could not load schedule: {e}")
        
        # Load player stats for leaders
        if include_leaders:
            try:
                stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
                if 'week' in stats_df.columns:
                    week_stats = stats_df[stats_df['week'] == week]
                    
                    # Find top passer
                    if 'passing_yards' in week_stats.columns:
                        top_passer = week_stats.nlargest(1, 'passing_yards')
                        if len(top_passer) > 0:
                            p = top_passer.iloc[0]
                            week_leaders["passing"] = {
                                "player_name": p.get('player_display_name') or p.get('player_name'),
                                "player_id": p.get('player_id'),
                                "team": p.get('recent_team') or p.get('team'),
                                "passing_yards": int(p.get('passing_yards', 0)),
                                "passing_tds": int(p.get('passing_tds', 0)),
                                "interceptions": int(p.get('interceptions', 0))
                            }
                    
                    # Find top rusher
                    if 'rushing_yards' in week_stats.columns:
                        top_rusher = week_stats.nlargest(1, 'rushing_yards')
                        if len(top_rusher) > 0:
                            r = top_rusher.iloc[0]
                            week_leaders["rushing"] = {
                                "player_name": r.get('player_display_name') or r.get('player_name'),
                                "player_id": r.get('player_id'),
                                "team": r.get('recent_team') or r.get('team'),
                                "rushing_yards": int(r.get('rushing_yards', 0)),
                                "rushing_tds": int(r.get('rushing_tds', 0)),
                                "carries": int(r.get('carries', 0))
                            }
                    
                    # Find top receiver
                    if 'receiving_yards' in week_stats.columns:
                        top_receiver = week_stats.nlargest(1, 'receiving_yards')
                        if len(top_receiver) > 0:
                            rec = top_receiver.iloc[0]
                            week_leaders["receiving"] = {
                                "player_name": rec.get('player_display_name') or rec.get('player_name'),
                                "player_id": rec.get('player_id'),
                                "team": rec.get('recent_team') or rec.get('team'),
                                "receiving_yards": int(rec.get('receiving_yards', 0)),
                                "receiving_tds": int(rec.get('receiving_tds', 0)),
                                "receptions": int(rec.get('receptions', 0)),
                                "targets": int(rec.get('targets', 0))
                            }
                    
                    # Add top performers to each game
                    for game in games:
                        teams = [game.get('home_team'), game.get('away_team')]
                        team_col = None
                        for col in ['recent_team', 'team', 'team_abbr']:
                            if col in week_stats.columns:
                                team_col = col
                                break
                        
                        if team_col:
                            game_stats = week_stats[week_stats[team_col].isin(teams)]
                            
                            # Top performers for this specific game
                            game["top_passer"] = None
                            game["top_rusher"] = None
                            game["top_receiver"] = None
                            
                            if 'passing_yards' in game_stats.columns and len(game_stats) > 0:
                                tp = game_stats.nlargest(1, 'passing_yards')
                                if len(tp) > 0 and tp.iloc[0]['passing_yards'] > 0:
                                    pp = tp.iloc[0]
                                    game["top_passer"] = {
                                        "name": pp.get('player_display_name') or pp.get('player_name'),
                                        "team": pp.get(team_col),
                                        "yards": int(pp.get('passing_yards', 0)),
                                        "tds": int(pp.get('passing_tds', 0))
                                    }
                            
                            if 'rushing_yards' in game_stats.columns and len(game_stats) > 0:
                                tr = game_stats.nlargest(1, 'rushing_yards')
                                if len(tr) > 0 and tr.iloc[0]['rushing_yards'] > 0:
                                    rr = tr.iloc[0]
                                    game["top_rusher"] = {
                                        "name": rr.get('player_display_name') or rr.get('player_name'),
                                        "team": rr.get(team_col),
                                        "yards": int(rr.get('rushing_yards', 0)),
                                        "tds": int(rr.get('rushing_tds', 0))
                                    }
                            
                            if 'receiving_yards' in game_stats.columns and len(game_stats) > 0:
                                trec = game_stats.nlargest(1, 'receiving_yards')
                                if len(trec) > 0 and trec.iloc[0]['receiving_yards'] > 0:
                                    rrec = trec.iloc[0]
                                    game["top_receiver"] = {
                                        "name": rrec.get('player_display_name') or rrec.get('player_name'),
                                        "team": rrec.get(team_col),
                                        "yards": int(rrec.get('receiving_yards', 0)),
                                        "tds": int(rrec.get('receiving_tds', 0))
                                    }
                    
            except Exception as e:
                print(f"Could not load player stats for leaders: {e}")
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "week": week,
            "game_count": len(games),
            "games": games,
            "week_leaders": week_leaders
        })
        
    except Exception as e:
        log_error(e, {"endpoint": "week_summary", "season": season, "week": week})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/leaderboards/top/batch")
async def get_top_players_batch(
    season: int = Query(2025, description="Season year"),
    metrics: str = Query("fantasy_points_ppr,passing_yards,rushing_yards,receiving_yards,receiving_yards", description="Comma-separated metrics: QB,RB,WR,TE"),
    limit: int = Query(5, ge=1, le=100, description="Number of top players to return per position"),
    min_attempts: Optional[int] = Query(None, description="Minimum pass attempts (for QBs)"),
    min_carries: Optional[int] = Query(None, description="Minimum carries (for RBs)"),
    min_routes: Optional[int] = Query(None, description="Minimum routes (for WRs/TEs)"),
    min_targets: Optional[int] = Query(None, description="Minimum targets (for WRs/TEs)"),
):
    """
    Batch endpoint to get top players for multiple positions/metrics in a single request.
    Metrics format: "qb_metric,rb_metric,wr_metric"
    This is more efficient than making 3 separate requests, especially for advanced stats.
    """
    try:
        metric_list = [m.strip() for m in metrics.split(',')]
        if len(metric_list) != 4:
            raise HTTPException(status_code=400, detail="Must provide exactly 4 metrics: QB,RB,WR,TE")
        
        qb_metric, rb_metric, wr_metric, te_metric = metric_list
        
        # Reuse the same logic but call it 4 times efficiently
        # Load data once and reuse for all positions
        mod = import_library()
        stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
        
        # Load and merge NextGen Stats for all positions (needed for RYOE, etc.)
        # We'll merge rushing stats for RBs, passing for QBs, receiving for WRs/TEs
        try:
            # Load all NextGen stat types
            ngs_rushing, _ = call_dataset(mod, "nextgen_stats", seasons=[season], stat_type="rushing")
            ngs_passing, _ = call_dataset(mod, "nextgen_stats", seasons=[season], stat_type="passing")
            ngs_receiving, _ = call_dataset(mod, "nextgen_stats", seasons=[season], stat_type="receiving")
            
            # Merge rushing stats (for RBs - includes RYOE)
            if ngs_rushing is not None and len(ngs_rushing) > 0:
                if 'week' in ngs_rushing.columns:
                    ngs_rushing = ngs_rushing[ngs_rushing['week'] == 0]  # Season totals
                if 'player_id' in ngs_rushing.columns and 'player_id' in stats_df.columns:
                    ngs_rushing_cols = [col for col in ngs_rushing.columns if col not in ['player_id', 'season', 'week']]
                    ngs_rushing_renamed = {col: f"ngs_{col}" for col in ngs_rushing_cols}
                    ngs_rushing_merged = ngs_rushing[['player_id', 'season'] + ngs_rushing_cols].rename(columns=ngs_rushing_renamed)
                    stats_df = stats_df.merge(ngs_rushing_merged, on=['player_id', 'season'], how='left')
                    print(f"[BATCH] Merged {len(ngs_rushing_cols)} rushing NextGen Stats columns")
            
            # Merge passing stats (for QBs)
            if ngs_passing is not None and len(ngs_passing) > 0:
                if 'week' in ngs_passing.columns:
                    ngs_passing = ngs_passing[ngs_passing['week'] == 0]
                if 'player_id' in ngs_passing.columns and 'player_id' in stats_df.columns:
                    ngs_passing_cols = [col for col in ngs_passing.columns if col not in ['player_id', 'season', 'week']]
                    ngs_passing_renamed = {col: f"ngs_{col}" for col in ngs_passing_cols}
                    ngs_passing_merged = ngs_passing[['player_id', 'season'] + ngs_passing_cols].rename(columns=ngs_passing_renamed)
                    stats_df = stats_df.merge(ngs_passing_merged, on=['player_id', 'season'], how='left')
                    print(f"[BATCH] Merged {len(ngs_passing_cols)} passing NextGen Stats columns")
            
            # Merge receiving stats (for WRs/TEs)
            if ngs_receiving is not None and len(ngs_receiving) > 0:
                if 'week' in ngs_receiving.columns:
                    ngs_receiving = ngs_receiving[ngs_receiving['week'] == 0]
                if 'player_id' in ngs_receiving.columns and 'player_id' in stats_df.columns:
                    ngs_receiving_cols = [col for col in ngs_receiving.columns if col not in ['player_id', 'season', 'week']]
                    ngs_receiving_renamed = {col: f"ngs_{col}" for col in ngs_receiving_cols}
                    ngs_receiving_merged = ngs_receiving[['player_id', 'season'] + ngs_receiving_cols].rename(columns=ngs_receiving_renamed)
                    stats_df = stats_df.merge(ngs_receiving_merged, on=['player_id', 'season'], how='left')
                    print(f"[BATCH] Merged {len(ngs_receiving_cols)} receiving NextGen Stats columns")
        except Exception as e:
            print(f"[BATCH] Warning: Could not load NextGen Stats: {e}")
            # Continue without NextGen Stats
        
        # Calculate routes once if needed (for WR advanced stats)
        needs_routes = wr_metric in ['epa_per_route', 'yprr']
        has_routes = 'routes' in stats_df.columns and stats_df['routes'].notna().any() and (stats_df['routes'] > 0).any()
        
        if needs_routes and not has_routes:
            # Calculate routes (same logic as single endpoint)
            try:
                if season > 2024:
                    print(f"[BATCH] Calculating routes for season {season} using snap counts")
                    pbp_df, _ = call_dataset(mod, "pbp", seasons=[season])
                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season", "posteam"]
                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                    
                    game_stats = pbp_df.groupby(['game_id', 'posteam']).agg(
                        pass_plays=('play_type', lambda x: (x == 'pass').sum()),
                        total_plays=('play_type', lambda x: x.isin(['pass', 'run']).sum())
                    ).reset_index()
                    game_stats['pass_rate'] = game_stats['pass_plays'] / game_stats['total_plays']
                    game_stats['pass_rate'] = game_stats['pass_rate'].fillna(0)
                    
                    game_meta = pbp_df[['game_id', 'season', 'week']].drop_duplicates()
                    game_stats = game_stats.merge(game_meta, on='game_id')
                    
                    snaps, _ = call_dataset(mod, "snap_counts", seasons=[season])
                    off_snaps = snaps[(snaps['offense_snaps'] > 0) & (snaps['position'].isin(['WR', 'TE', 'RB']))].copy()
                    
                    estimated = pd.merge(
                        off_snaps,
                        game_stats,
                        left_on=['season', 'week', 'team'],
                        right_on=['season', 'week', 'posteam'],
                        how='inner'
                    )
                    estimated['estimated_routes'] = (estimated['offense_snaps'] * estimated['pass_rate']).round(1)
                    
                    players, _ = call_dataset(mod, "players", seasons=None)
                    if 'pfr_id' in players.columns and 'gsis_id' in players.columns:
                        id_map = players[['pfr_id', 'gsis_id']].dropna().set_index('pfr_id')['gsis_id'].to_dict()
                        estimated['player_id'] = estimated['pfr_player_id'].map(id_map)
                    
                    if estimated['player_id'].isna().any():
                        name_map = players[['display_name', 'gsis_id']].dropna().set_index('display_name')['gsis_id'].to_dict()
                        mask = estimated['player_id'].isna()
                        estimated.loc[mask, 'player_id'] = estimated.loc[mask, 'player'].map(name_map)
                    
                    est_routes = estimated[['player_id', 'season', 'week', 'estimated_routes']].dropna()
                    est_routes.rename(columns={'estimated_routes': 'routes'}, inplace=True)
                    
                    if 'routes' in stats_df.columns:
                        stats_df = pd.merge(stats_df, est_routes, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_est'))
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                        if 'routes_est' in stats_df.columns:
                            stats_df['routes'] = stats_df.apply(lambda x: x['routes_est'] if x['routes'] == 0 and pd.notna(x['routes_est']) else x['routes'], axis=1)
                            stats_df.drop(columns=['routes_est'], inplace=True)
                    else:
                        stats_df = pd.merge(stats_df, est_routes, on=['player_id', 'season', 'week'], how='left')
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                else:
                    # Use participation data for 2016-2024
                    pbp_df, _ = call_dataset(mod, "pbp", seasons=[season])
                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season"]
                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                    
                    part_df, _ = call_dataset(mod, "participation", seasons=[season])
                    part_cols = ["nflverse_game_id", "play_id", "offense_players"]
                    part_df = part_df[[c for c in part_cols if c in part_df.columns]]
                    
                    pass_plays = pbp_df[pbp_df['play_type'] == 'pass']
                    merged = pd.merge(pass_plays, part_df, left_on=['game_id', 'play_id'], right_on=['nflverse_game_id', 'play_id'])
                    merged['offense_players'] = merged['offense_players'].astype(str)
                    merged['player_id_split'] = merged['offense_players'].str.split(';')
                    exploded = merged.explode('player_id_split')
                    
                    routes_counts = exploded.groupby(['player_id_split', 'season', 'week']).size().reset_index(name='routes')
                    routes_counts.rename(columns={'player_id_split': 'player_id'}, inplace=True)
                    
                    if 'routes' in stats_df.columns:
                        stats_df = pd.merge(stats_df, routes_counts, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_new'))
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                        if 'routes_new' in stats_df.columns:
                            stats_df['routes'] = stats_df.apply(lambda x: x['routes_new'] if x['routes'] == 0 and pd.notna(x['routes_new']) else x['routes'], axis=1)
                            stats_df.drop(columns=['routes_new'], inplace=True)
                    else:
                        stats_df = pd.merge(stats_df, routes_counts, on=['player_id', 'season', 'week'], how='left')
                        stats_df['routes'] = stats_df['routes'].fillna(0)
            except Exception as e:
                print(f"[BATCH] Routes calculation failed: {e}")
                if 'routes' not in stats_df.columns:
                    stats_df['routes'] = 0
                else:
                    stats_df['routes'] = stats_df['routes'].fillna(0)
        
        # Ensure routes column exists
        if 'routes' not in stats_df.columns:
            stats_df['routes'] = 0
        else:
            stats_df['routes'] = stats_df['routes'].fillna(0)
        
        # Helper function to get top players for a position/metric
        def get_top_for_position(pos, met, vol_filters):
            pos_df = stats_df[stats_df['position'] == pos.upper()].copy() if 'position' in stats_df.columns else stats_df.copy()
            
            # Aggregate by player_id and season
            if 'player_id' in pos_df.columns and 'season' in pos_df.columns:
                has_weekly_data = 'week' in pos_df.columns
                if has_weekly_data:
                    agg_dict = {}
                    numeric_cols = pos_df.select_dtypes(include=[np.number]).columns.tolist()
                    for col in numeric_cols:
                        if col not in ['player_id', 'season', 'week', 'games']:
                            agg_dict[col] = 'sum'
                    
                    # Count games played (number of unique weeks) instead of summing games column
                    pos_df['games'] = pos_df.groupby(['player_id', 'season'])['week'].transform('nunique')
                    
                    non_numeric_cols = pos_df.select_dtypes(exclude=[np.number]).columns.tolist()
                    for col in non_numeric_cols:
                        if col not in ['player_id', 'season', 'week']:
                            if col in ['team', 'recent_team', 'opponent_team']:
                                agg_dict[col] = 'last'
                            else:
                                agg_dict[col] = 'first'
                    
                    # Add games to aggregation (use 'first' since all rows for a player will have the same count)
                    agg_dict['games'] = 'first'
                    
                    pos_df = pos_df.groupby(['player_id', 'season']).agg(agg_dict).reset_index()
                    if 'week' in pos_df.columns:
                        pos_df = pos_df.drop(columns=['week'])
            
            # Calculate efficiency metrics
            if 'attempts' in pos_df.columns:
                attempts = pos_df['attempts'].fillna(0)
                if 'completions' in pos_df.columns:
                    pos_df['completion_pct'] = (pos_df['completions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
                if 'passing_yards' in pos_df.columns:
                    pos_df['yards_per_attempt'] = (pos_df['passing_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
                if 'passing_epa' in pos_df.columns:
                    if 'sacks' in pos_df.columns:
                        dropbacks = (attempts + pos_df['sacks'].fillna(0)).replace(0, np.nan)
                    else:
                        dropbacks = attempts.replace(0, np.nan)
                    pos_df['epa_per_dropback'] = (pos_df['passing_epa'].fillna(0) / dropbacks).fillna(0)
            
            if 'carries' in pos_df.columns:
                carries = pos_df['carries'].replace(0, np.nan)
                if 'rushing_yards' in pos_df.columns:
                    pos_df['yards_per_carry'] = (pos_df['rushing_yards'].fillna(0) / carries).fillna(0)
                if 'rushing_epa' in pos_df.columns:
                    pos_df['rushing_epa_per_carry'] = (pos_df['rushing_epa'].fillna(0) / carries).fillna(0)
            
            if 'targets' in pos_df.columns:
                targets = pos_df['targets'].replace(0, np.nan)
                if 'receptions' in pos_df.columns:
                    pos_df['catch_percentage'] = (pos_df['receptions'].fillna(0) / targets * 100).fillna(0)
                if 'receiving_yards' in pos_df.columns:
                    pos_df['yards_per_target'] = (pos_df['receiving_yards'].fillna(0) / targets).fillna(0)
            
            if 'routes' in pos_df.columns:
                routes = pos_df['routes'].replace(0, np.nan)
                if 'receiving_epa' in pos_df.columns:
                    pos_df['epa_per_route'] = (pos_df['receiving_epa'].fillna(0) / routes).replace([np.inf, -np.inf], np.nan)
                if 'receiving_yards' in pos_df.columns:
                    pos_df['yprr'] = (pos_df['receiving_yards'].fillna(0) / routes).replace([np.inf, -np.inf], np.nan)
            
            # Calculate games played for dynamic filters
            games_played = 0
            if 'week' in pos_df.columns:
                max_week = pos_df['week'].max()
                if pd.notna(max_week) and max_week > 0:
                    games_played = int(max_week)
            elif 'games' in pos_df.columns:
                games_played = int(pos_df['games'].max()) if pos_df['games'].notna().any() else 0
            if games_played == 0:
                games_played = 17  # Default to full season
            
            # Apply intelligent volume filters based on position (raised thresholds)
            if pos == 'QB' and 'attempts' in pos_df.columns:
                # Use percentile-based filtering for QBs - raised thresholds
                # Target: keep top 60% by attempts, but ensure at least 15 players
                attempts = pos_df['attempts'].fillna(0)
                if len(attempts) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = attempts.quantile(0.40)
                    # Also ensure minimum threshold: 5 attempts per game (raised from 3)
                    min_per_game = 5 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_attempts = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 15 players
                    sorted_attempts = attempts.sort_values(ascending=False)
                    if len(sorted_attempts) >= 15:
                        # Use 15th player's attempts as minimum
                        min_attempts = min(min_attempts, int(sorted_attempts.iloc[14]))
                    pos_df = pos_df[pos_df['attempts'] >= min_attempts]
                    print(f"[BATCH] QB filter: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_attempts}, remaining={len(pos_df)}")
            elif pos == 'RB' and 'carries' in pos_df.columns:
                # Use percentile-based filtering for RBs - raised thresholds
                # Target: keep top 60% by carries, but ensure at least 20 players
                carries = pos_df['carries'].fillna(0)
                if len(carries) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = carries.quantile(0.40)
                    # Also ensure minimum threshold: 5 carries per game (raised from 3)
                    min_per_game = 5 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_carries = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 20 players
                    sorted_carries = carries.sort_values(ascending=False)
                    if len(sorted_carries) >= 20:
                        # Use 20th player's carries as minimum
                        min_carries = min(min_carries, int(sorted_carries.iloc[19]))
                    pos_df = pos_df[pos_df['carries'] >= min_carries]
                    print(f"[BATCH] RB filter: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_carries}, remaining={len(pos_df)}")
            elif pos == 'WR' and 'receptions' in pos_df.columns:
                # Use percentile-based filtering for WRs - raised thresholds
                # Target: keep top 60% by receptions, but ensure at least 25 players
                receptions = pos_df['receptions'].fillna(0)
                if len(receptions) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = receptions.quantile(0.40)
                    # Also ensure minimum threshold: 3 receptions per game (raised from 2)
                    min_per_game = 3 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_receptions = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 25 players
                    sorted_receptions = receptions.sort_values(ascending=False)
                    if len(sorted_receptions) >= 25:
                        # Use 25th player's receptions as minimum
                        min_receptions = min(min_receptions, int(sorted_receptions.iloc[24]))
                    pos_df = pos_df[pos_df['receptions'] >= min_receptions]
                    print(f"[BATCH] WR filter: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_receptions}, remaining={len(pos_df)}")
            elif pos == 'TE' and 'receptions' in pos_df.columns:
                # Use percentile-based filtering for TEs - raised thresholds
                # Target: keep top 60% by receptions, but ensure at least 15 players
                receptions = pos_df['receptions'].fillna(0)
                if len(receptions) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = receptions.quantile(0.40)
                    # Also ensure minimum threshold: 3 receptions per game (raised from 2)
                    min_per_game = 3 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_receptions = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 15 players
                    sorted_receptions = receptions.sort_values(ascending=False)
                    if len(sorted_receptions) >= 15:
                        # Use 15th player's receptions as minimum
                        min_receptions = min(min_receptions, int(sorted_receptions.iloc[14]))
                    pos_df = pos_df[pos_df['receptions'] >= min_receptions]
                    print(f"[BATCH] TE filter: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_receptions}, remaining={len(pos_df)}")
            
            # Special handling for RB advanced stats: use RYOE if available
            if pos == 'RB' and met in ['yards_per_carry', 'rushing_epa_per_carry']:
                # Check if RYOE is available (NextGen Stats)
                if 'ngs_rush_yards_over_expected' in pos_df.columns:
                    # Filter out players without RYOE data
                    pos_df = pos_df[pos_df['ngs_rush_yards_over_expected'].notna()]
                    # Use RYOE as the metric for sorting
                    met = 'ngs_rush_yards_over_expected'
                    print(f"[BATCH] Using RYOE for RB sorting, {len(pos_df)} RBs with RYOE data")
            
            # Filter and sort
            if met not in pos_df.columns:
                return []
            pos_df = pos_df[pos_df[met].notna()]
            pos_df = pos_df.sort_values(met, ascending=False).head(limit)
            
            # Clean
            if 'week' in pos_df.columns:
                pos_df = pos_df.drop(columns=['week'])
            pos_df = pos_df.replace([np.nan, np.inf, -np.inf], None)
            records = pos_df.to_dict(orient='records')
            return [clean_dict(r) for r in records]
        
        # Get top players for each position
        vol_filters = {
            'min_attempts': min_attempts or 0,
            'min_carries': min_carries or 0,
            'min_routes': min_routes or 0,
            'min_targets': min_targets or 0,
        }
        
        qb_data = get_top_for_position('QB', qb_metric, vol_filters)
        rb_data = get_top_for_position('RB', rb_metric, vol_filters)
        wr_data = get_top_for_position('WR', wr_metric, vol_filters)
        te_data = get_top_for_position('TE', te_metric, vol_filters)
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "limit": limit,
            "data": {
                "qb": qb_data,
                "rb": rb_data,
                "wr": wr_data,
                "te": te_data
            }
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "top_players_batch", "season": season, "metrics": metrics})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/leaderboards/top")
async def get_top_players(
    season: int = Query(2025, description="Season year"),
    position: Optional[str] = Query(None, description="Position filter: QB, RB, WR, TE"),
    metric: str = Query("fantasy_points_ppr", description="Metric to rank by"),
    limit: int = Query(5, ge=1, le=100, description="Number of top players to return"),
    min_attempts: Optional[int] = Query(None, description="Minimum pass attempts (for QBs)"),
    min_carries: Optional[int] = Query(None, description="Minimum carries (for RBs)"),
    min_routes: Optional[int] = Query(None, description="Minimum routes (for WRs/TEs)"),
    min_targets: Optional[int] = Query(None, description="Minimum targets (for WRs/TEs)"),
):
    """
    Get top N players by a specific metric.
    Optimized endpoint for home page and leaderboards.
    """
    try:
        mod = import_library()
        
        # Load player stats
        stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
        
        # Calculate games played in season (for dynamic filters)
        # Count unique weeks with games played
        games_played = 0
        if 'week' in stats_df.columns:
            # Get max week from the data (represents how many weeks have been played)
            max_week = stats_df['week'].max()
            # Also check if we have game data
            if pd.notna(max_week) and max_week > 0:
                games_played = int(max_week)
        elif 'games' in stats_df.columns:
            # Fallback: use max games played by any player
            games_played = int(stats_df['games'].max()) if stats_df['games'].notna().any() else 0
        
        # Default to 17 games if we can't determine (full season)
        if games_played == 0:
            games_played = 17
        
        print(f"Season {season}: {games_played} games played (for dynamic filters)")
        
        # Calculate routes if not already present (needed for epa_per_route)
        # Only calculate if routes column is missing OR if we need epa_per_route and routes are all zero/NaN
        needs_routes = metric in ['epa_per_route', 'yprr'] or (position and position.upper() in ['WR', 'TE'])
        has_routes = 'routes' in stats_df.columns and stats_df['routes'].notna().any() and (stats_df['routes'] > 0).any()
        
        if needs_routes and not has_routes:
            try:
                # For 2025, estimate routes using snap counts and pass rate
                if season > 2024:
                    print(f"Calculating routes for season {season} using snap counts")
                    # Load PBP for pass rate calculation
                    pbp_df, _ = call_dataset(mod, "pbp", seasons=[season])
                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season", "posteam"]
                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                    
                    # Calculate Team Pass Rate per Game
                    game_stats = pbp_df.groupby(['game_id', 'posteam']).agg(
                        pass_plays=('play_type', lambda x: (x == 'pass').sum()),
                        total_plays=('play_type', lambda x: x.isin(['pass', 'run']).sum())
                    ).reset_index()
                    game_stats['pass_rate'] = game_stats['pass_plays'] / game_stats['total_plays']
                    game_stats['pass_rate'] = game_stats['pass_rate'].fillna(0)
                    
                    # Add season/week to game_stats
                    game_meta = pbp_df[['game_id', 'season', 'week']].drop_duplicates()
                    game_stats = game_stats.merge(game_meta, on='game_id')
                    
                    # Load Snap Counts
                    snaps, _ = call_dataset(mod, "snap_counts", seasons=[season])
                    off_snaps = snaps[(snaps['offense_snaps'] > 0) & (snaps['position'].isin(['WR', 'TE', 'RB']))].copy()
                    
                    # Merge Snaps with Pass Rate
                    estimated = pd.merge(
                        off_snaps,
                        game_stats,
                        left_on=['season', 'week', 'team'],
                        right_on=['season', 'week', 'posteam'],
                        how='inner'
                    )
                    estimated['estimated_routes'] = (estimated['offense_snaps'] * estimated['pass_rate']).round(1)
                    
                    # Map pfr_player_id to player_id (gsis_id)
                    players, _ = call_dataset(mod, "players", seasons=None)
                    if 'pfr_id' in players.columns and 'gsis_id' in players.columns:
                        id_map = players[['pfr_id', 'gsis_id']].dropna().set_index('pfr_id')['gsis_id'].to_dict()
                        estimated['player_id'] = estimated['pfr_player_id'].map(id_map)
                    
                    # Fallback to name matching
                    if estimated['player_id'].isna().any():
                        name_map = players[['display_name', 'gsis_id']].dropna().set_index('display_name')['gsis_id'].to_dict()
                        mask = estimated['player_id'].isna()
                        estimated.loc[mask, 'player_id'] = estimated.loc[mask, 'player'].map(name_map)
                    
                    # Merge routes into stats_df
                    est_routes = estimated[['player_id', 'season', 'week', 'estimated_routes']].dropna()
                    est_routes.rename(columns={'estimated_routes': 'routes'}, inplace=True)
                    
                    # Merge with stats_df
                    if 'routes' in stats_df.columns:
                        stats_df = pd.merge(stats_df, est_routes, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_est'))
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                        if 'routes_est' in stats_df.columns:
                            stats_df['routes'] = stats_df.apply(lambda x: x['routes_est'] if x['routes'] == 0 and pd.notna(x['routes_est']) else x['routes'], axis=1)
                            stats_df.drop(columns=['routes_est'], inplace=True)
                    else:
                        stats_df = pd.merge(stats_df, est_routes, on=['player_id', 'season', 'week'], how='left')
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                    
                    print(f"Routes calculated for {len(est_routes)} player-weeks")
                else:
                    # For 2016-2024, use participation data
                    print(f"Calculating routes for season {season} using participation data")
                    pbp_df, _ = call_dataset(mod, "pbp", seasons=[season])
                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season"]
                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                    
                    part_df, _ = call_dataset(mod, "participation", seasons=[season])
                    part_cols = ["nflverse_game_id", "play_id", "offense_players"]
                    part_df = part_df[[c for c in part_cols if c in part_df.columns]]
                    
                    pass_plays = pbp_df[pbp_df['play_type'] == 'pass']
                    merged = pd.merge(pass_plays, part_df, left_on=['game_id', 'play_id'], right_on=['nflverse_game_id', 'play_id'])
                    merged['offense_players'] = merged['offense_players'].astype(str)
                    merged['player_id_split'] = merged['offense_players'].str.split(';')
                    exploded = merged.explode('player_id_split')
                    
                    routes_counts = exploded.groupby(['player_id_split', 'season', 'week']).size().reset_index(name='routes')
                    routes_counts.rename(columns={'player_id_split': 'player_id'}, inplace=True)
                    
                    if 'routes' in stats_df.columns:
                        stats_df = pd.merge(stats_df, routes_counts, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_new'))
                        stats_df['routes'] = stats_df['routes'].fillna(0)
                        if 'routes_new' in stats_df.columns:
                            stats_df['routes'] = stats_df.apply(lambda x: x['routes_new'] if x['routes'] == 0 and pd.notna(x['routes_new']) else x['routes'], axis=1)
                            stats_df.drop(columns=['routes_new'], inplace=True)
                    else:
                        stats_df = pd.merge(stats_df, routes_counts, on=['player_id', 'season', 'week'], how='left')
                        stats_df['routes'] = stats_df['routes'].fillna(0)
            except Exception as e:
                print(f"Routes calculation failed: {e}")
                import traceback
                traceback.print_exc()
                # Set routes to 0 if calculation fails
                if 'routes' not in stats_df.columns:
                    stats_df['routes'] = 0
        
        # Ensure routes column exists
        if 'routes' not in stats_df.columns:
            stats_df['routes'] = 0
        else:
            stats_df['routes'] = stats_df['routes'].fillna(0)
        
        # Filter by position if specified
        if position and 'position' in stats_df.columns:
            stats_df = stats_df[stats_df['position'] == position.upper()]
        
        # Aggregate by player_id and season for season totals (needed for leaderboards)
        # This ensures we get season totals, not single-game performances
        if 'player_id' in stats_df.columns and 'season' in stats_df.columns:
            # Check if we have weekly data (need to aggregate)
            has_weekly_data = 'week' in stats_df.columns
            
            if has_weekly_data:
                agg_dict = {}
                # Sum numeric columns (all stats should be summed)
                numeric_cols = stats_df.select_dtypes(include=[np.number]).columns.tolist()
                for col in numeric_cols:
                    if col not in ['player_id', 'season', 'week', 'games']:
                        agg_dict[col] = 'sum'
                
                # Count games played (number of unique weeks) instead of summing games column
                # This gives us the actual number of games a player participated in
                stats_df['games'] = stats_df.groupby(['player_id', 'season'])['week'].transform('nunique')
                
                # Keep first value for most non-numeric columns (like player_name, position, etc.)
                # But use 'last' for team-related columns to get most recent team
                non_numeric_cols = stats_df.select_dtypes(exclude=[np.number]).columns.tolist()
                for col in non_numeric_cols:
                    if col not in ['player_id', 'season', 'week']:
                        # Use 'last' for team to get most recent team (in case of trades)
                        if col in ['team', 'recent_team', 'opponent_team']:
                            agg_dict[col] = 'last'
                        else:
                            agg_dict[col] = 'first'
                
                # Add games to aggregation (use 'first' since all rows for a player will have the same count)
                agg_dict['games'] = 'first'
                
                # Group by player_id and season, aggregate, then reset index
                stats_df = stats_df.groupby(['player_id', 'season']).agg(agg_dict).reset_index()
                
                # Remove week column if it still exists (shouldn't after aggregation, but just in case)
                if 'week' in stats_df.columns:
                    stats_df = stats_df.drop(columns=['week'])
                
                print(f"Aggregated to season totals: {len(stats_df)} players")
            else:
                # Data is already aggregated, but ensure we have one row per player per season
                if stats_df.duplicated(subset=['player_id', 'season']).any():
                    # If there are duplicates, aggregate them
                    agg_dict = {}
                    numeric_cols = stats_df.select_dtypes(include=[np.number]).columns.tolist()
                    for col in numeric_cols:
                        if col not in ['player_id', 'season']:
                            agg_dict[col] = 'sum'
                    
                    non_numeric_cols = stats_df.select_dtypes(exclude=[np.number]).columns.tolist()
                    for col in non_numeric_cols:
                        if col not in ['player_id', 'season']:
                            agg_dict[col] = 'first'
                    
                    stats_df = stats_df.groupby(['player_id', 'season']).agg(agg_dict).reset_index()
        
        # Calculate efficiency metrics FIRST (before sorting)
        # This ensures calculated metrics like rushing_epa_per_carry are available for sorting
        # Reuse the same logic from /v1/data/player_stats for consistency
        if 'attempts' in stats_df.columns:
            attempts = stats_df['attempts'].fillna(0)
            if 'completions' in stats_df.columns:
                stats_df['completion_pct'] = (stats_df['completions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
            if 'passing_yards' in stats_df.columns:
                stats_df['yards_per_attempt'] = (stats_df['passing_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
            
            # Calculate EPA per dropback for QBs
            if 'passing_epa' in stats_df.columns:
                if 'sacks' in stats_df.columns:
                    dropbacks = (attempts + stats_df['sacks'].fillna(0)).replace(0, np.nan)
                else:
                    dropbacks = attempts.replace(0, np.nan)
                stats_df['epa_per_dropback'] = (stats_df['passing_epa'].fillna(0) / dropbacks).fillna(0)
        
        if 'carries' in stats_df.columns:
            carries = stats_df['carries'].replace(0, np.nan)
            if 'rushing_yards' in stats_df.columns:
                stats_df['yards_per_carry'] = (stats_df['rushing_yards'].fillna(0) / carries).fillna(0)
            
            # Calculate EPA per carry for RBs
            if 'rushing_epa' in stats_df.columns:
                stats_df['rushing_epa_per_carry'] = (stats_df['rushing_epa'].fillna(0) / carries).fillna(0)
        
        if 'targets' in stats_df.columns:
            targets = stats_df['targets'].replace(0, np.nan)
            if 'receptions' in stats_df.columns:
                stats_df['catch_percentage'] = (stats_df['receptions'].fillna(0) / targets * 100).fillna(0)
            if 'receiving_yards' in stats_df.columns:
                stats_df['yards_per_target'] = (stats_df['receiving_yards'].fillna(0) / targets).fillna(0)
        
        # Calculate EPA per route for WRs/TEs
        # Calculate after aggregation since we need season totals
        if 'routes' in stats_df.columns and 'receiving_epa' in stats_df.columns:
            routes = stats_df['routes'].replace(0, np.nan)
            receiving_epa = stats_df['receiving_epa'].fillna(0)
            # Calculate epa_per_route, handling division by zero
            stats_df['epa_per_route'] = (receiving_epa / routes).replace([np.inf, -np.inf], np.nan)
        elif metric == 'epa_per_route':
            # If metric is requested but required columns don't exist, create column with NaN
            stats_df['epa_per_route'] = np.nan
        
        if 'routes' in stats_df.columns and 'receiving_yards' in stats_df.columns:
            routes = stats_df['routes'].replace(0, np.nan)
            receiving_yards = stats_df['receiving_yards'].fillna(0)
            stats_df['yprr'] = (receiving_yards / routes).replace([np.inf, -np.inf], np.nan)
        elif metric == 'yprr':
            # If metric is requested but required columns don't exist, create column with NaN
            stats_df['yprr'] = np.nan
        
        # Now check if the metric exists (including calculated metrics)
        if metric not in stats_df.columns:
            raise HTTPException(status_code=400, detail=f"Metric '{metric}' not found in data. Available columns: {', '.join(sorted(stats_df.columns))}")
        
        # Calculate games played in season (for dynamic filters)
        games_played = 0
        if 'week' in stats_df.columns:
            max_week = stats_df['week'].max()
            if pd.notna(max_week) and max_week > 0:
                games_played = int(max_week)
        elif 'games' in stats_df.columns:
            games_played = int(stats_df['games'].max()) if stats_df['games'].notna().any() else 0
        if games_played == 0:
            games_played = 17  # Default to full season
        
        # Apply intelligent volume filters based on position
        if position:
            if position.upper() == 'QB' and 'attempts' in stats_df.columns:
                # Use percentile-based filtering for QBs - raised thresholds
                # Target: keep top 60% by attempts, but ensure at least 15 players
                attempts = stats_df['attempts'].fillna(0)
                if len(attempts) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = attempts.quantile(0.40)
                    # Also ensure minimum threshold: 5 attempts per game (raised from 3)
                    min_per_game = 5 * games_played
                    # Use the higher of the two to filter more aggressively
                    default_min_attempts = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 15 players
                    sorted_attempts = attempts.sort_values(ascending=False)
                    if len(sorted_attempts) >= 15:
                        # Use 15th player's attempts as minimum
                        default_min_attempts = min(default_min_attempts, int(sorted_attempts.iloc[14]))
                    # Override with explicit filter if provided
                    if min_attempts is not None and min_attempts > 0:
                        default_min_attempts = min_attempts
                    stats_df = stats_df[stats_df['attempts'] >= default_min_attempts]
                    print(f"Filtered QBs: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={default_min_attempts}, remaining={len(stats_df)}")
            elif position.upper() == 'RB' and 'carries' in stats_df.columns:
                # Use percentile-based filtering for RBs - raised thresholds
                # Target: keep top 60% by carries, but ensure at least 20 players
                carries = stats_df['carries'].fillna(0)
                if len(carries) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = carries.quantile(0.40)
                    # Also ensure minimum threshold: 5 carries per game (raised from 3)
                    min_per_game = 5 * games_played
                    # Use the higher of the two to filter more aggressively
                    default_min_carries = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 20 players
                    sorted_carries = carries.sort_values(ascending=False)
                    if len(sorted_carries) >= 20:
                        # Use 20th player's carries as minimum
                        default_min_carries = min(default_min_carries, int(sorted_carries.iloc[19]))
                    # Override with explicit filter if provided
                    if min_carries is not None and min_carries > 0:
                        default_min_carries = min_carries
                    stats_df = stats_df[stats_df['carries'] >= default_min_carries]
                    print(f"Filtered RBs: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={default_min_carries}, remaining={len(stats_df)}")
            elif position.upper() == 'WR' and 'receptions' in stats_df.columns:
                # Use percentile-based filtering for WRs - raised thresholds
                # Target: keep top 60% by receptions, but ensure at least 25 players
                receptions = stats_df['receptions'].fillna(0)
                if len(receptions) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = receptions.quantile(0.40)
                    # Also ensure minimum threshold: 3 receptions per game (raised from 2)
                    min_per_game = 3 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_receptions = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 25 players
                    sorted_receptions = receptions.sort_values(ascending=False)
                    if len(sorted_receptions) >= 25:
                        # Use 25th player's receptions as minimum
                        min_receptions = min(min_receptions, int(sorted_receptions.iloc[24]))
                    stats_df = stats_df[stats_df['receptions'] >= min_receptions]
                    print(f"Filtered WRs: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_receptions}, remaining={len(stats_df)}")
            elif position.upper() == 'TE' and 'receptions' in stats_df.columns:
                # Use percentile-based filtering for TEs - raised thresholds
                # Target: keep top 60% by receptions, but ensure at least 15 players
                receptions = stats_df['receptions'].fillna(0)
                if len(receptions) > 0:
                    # Calculate 40th percentile (keep top 60%)
                    percentile_40 = receptions.quantile(0.40)
                    # Also ensure minimum threshold: 3 receptions per game (raised from 2)
                    min_per_game = 3 * games_played
                    # Use the higher of the two to filter more aggressively
                    min_receptions = max(int(percentile_40), min_per_game)
                    # But ensure we have at least 15 players
                    sorted_receptions = receptions.sort_values(ascending=False)
                    if len(sorted_receptions) >= 15:
                        # Use 15th player's receptions as minimum
                        min_receptions = min(min_receptions, int(sorted_receptions.iloc[14]))
                    stats_df = stats_df[stats_df['receptions'] >= min_receptions]
                    print(f"Filtered TEs: percentile_40={percentile_40:.1f}, min_per_game={min_per_game}, final_min={min_receptions}, remaining={len(stats_df)}")
        
        # Also apply explicit filters if provided (for backward compatibility)
        if min_attempts is not None and min_attempts > 0 and 'attempts' in stats_df.columns:
            stats_df = stats_df[stats_df['attempts'] >= min_attempts]
        
        if min_carries is not None and min_carries > 0 and 'carries' in stats_df.columns:
            stats_df = stats_df[stats_df['carries'] >= min_carries]
        
        if min_routes is not None and min_routes > 0 and 'routes' in stats_df.columns:
            stats_df = stats_df[stats_df['routes'] >= min_routes]
        
        if min_targets is not None and min_targets > 0 and 'targets' in stats_df.columns:
            stats_df = stats_df[stats_df['targets'] >= min_targets]
        
        # Special handling for RB advanced stats: use RYOE if available
        if position and position.upper() == 'RB' and metric in ['yards_per_carry', 'rushing_epa_per_carry']:
            # Check if RYOE is available (NextGen Stats)
            if 'ngs_rush_yards_over_expected' in stats_df.columns:
                # Filter out players without RYOE data
                stats_df = stats_df[stats_df['ngs_rush_yards_over_expected'].notna()]
                # Use RYOE as the metric for sorting (but keep original metric column for display)
                # The frontend will use ngs_rush_yards_over_expected for display
                metric = 'ngs_rush_yards_over_expected'
                print(f"Using RYOE for RB sorting, {len(stats_df)} RBs with RYOE data")
            else:
                print("Warning: RYOE not available, falling back to original metric")
        
        # Filter out players with no meaningful stats for this metric
        # For efficiency metrics, we want to include negative values (they're meaningful)
        # Only filter out NaN values
        stats_df = stats_df[stats_df[metric].notna()]
        
        # Sort by metric (descending)
        stats_df = stats_df.sort_values(metric, ascending=False)
        
        # Limit results
        stats_df = stats_df.head(limit)
        
        # Clean and return
        # Remove week column if it exists (shouldn't after aggregation, but ensure it's gone)
        if 'week' in stats_df.columns:
            stats_df = stats_df.drop(columns=['week'])
        
        stats_df = stats_df.replace([np.nan, np.inf, -np.inf], None)
        records = stats_df.to_dict(orient='records')
        clean_records = [clean_dict(r) for r in records]
        
        # Debug: log sample to verify aggregation
        if clean_records:
            sample = clean_records[0]
            print(f"Sample record keys: {list(sample.keys())}")
            if 'week' in sample:
                print(f"WARNING: Week column still present in response: {sample.get('week')}")
            if 'receiving_yards' in sample:
                print(f"Sample receiving_yards: {sample.get('receiving_yards')}")
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "position": position,
            "metric": metric,
            "limit": limit,
            "count": len(clean_records),
            "data": clean_records
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "leaderboards/top", "season": season, "position": position, "metric": metric})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/leaderboards")
async def get_leaderboards(
    season: int = Query(2025, description="Season year"),
    position: Optional[str] = Query(None, description="Position filter: QB, RB, WR, TE"),
    metric: str = Query("fantasy_points_ppr", description="Metric to rank by"),
    limit: int = Query(20, ge=1, le=500, description="Number of players to return"),
    sort_by: Optional[str] = Query(None, description="Override sort metric (defaults to metric param)"),
):
    """
    Get leaderboard data with backend sorting and limiting.
    Enhanced version of /v1/data/player_stats with optimized sorting.
    """
    try:
        mod = import_library()
        
        # Load player stats
        stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
        
        # Filter by position if specified
        if position and 'position' in stats_df.columns:
            stats_df = stats_df[stats_df['position'] == position.upper()]
        
        # Filter out players with no meaningful stats
        sort_metric = sort_by or metric
        if sort_metric in stats_df.columns:
            stats_df = stats_df[stats_df[sort_metric].notna() & (stats_df[sort_metric] > 0)]
        elif metric in stats_df.columns:
            stats_df = stats_df[stats_df[metric].notna() & (stats_df[metric] > 0)]
        
        # Calculate efficiency metrics (same as /v1/data/player_stats)
        if 'attempts' in stats_df.columns:
            attempts = stats_df['attempts'].fillna(0)
            stats_df['completion_pct'] = (stats_df['completions'].fillna(0) / attempts.replace(0, np.nan) * 100).fillna(0)
            stats_df['yards_per_attempt'] = (stats_df['passing_yards'].fillna(0) / attempts.replace(0, np.nan)).fillna(0)
        
        if 'carries' in stats_df.columns:
            carries = stats_df['carries'].replace(0, np.nan)
            stats_df['yards_per_carry'] = (stats_df['rushing_yards'].fillna(0) / carries).fillna(0)
        
        if 'targets' in stats_df.columns:
            targets = stats_df['targets'].replace(0, np.nan)
            stats_df['catch_percentage'] = (stats_df['receptions'].fillna(0) / targets * 100).fillna(0)
            if 'receiving_yards' in stats_df.columns:
                stats_df['yards_per_target'] = (stats_df['receiving_yards'].fillna(0) / targets).fillna(0)
        
        # Sort by metric (descending)
        if sort_metric in stats_df.columns:
            stats_df = stats_df.sort_values(sort_metric, ascending=False)
        elif metric in stats_df.columns:
            stats_df = stats_df.sort_values(metric, ascending=False)
        else:
            raise HTTPException(status_code=400, detail=f"Metric '{metric}' not found in data")
        
        # Limit results
        stats_df = stats_df.head(limit)
        
        # Clean and return
        stats_df = stats_df.replace([np.nan, np.inf, -np.inf], None)
        records = stats_df.to_dict(orient='records')
        clean_records = [clean_dict(r) for r in records]
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "position": position,
            "metric": metric,
            "sort_by": sort_metric,
            "limit": limit,
            "count": len(clean_records),
            "data": clean_records
        })
        
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "leaderboards", "season": season, "position": position, "metric": metric})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/team_stats")
async def get_team_stats(
    season: int = Query(2025, description="Season year"),
    game_type: str = Query("REG", description="Game type: REG (regular season), POST (playoffs), or ALL"),
):
    """
    Get comprehensive team statistics including:
    - W/L/T record, PF, PA, Point Differential (from schedules)
    - Offensive and Defensive EPA (from play-by-play data)
    
    game_type options:
    - REG: Regular season only (default)
    - POST: Playoffs only
    - ALL: All games
    """
    try:
        mod = import_library()
        
        # Initialize team data structure
        teams = {}
        
        # === STEP 1: Load schedules for W/L, PF, PA ===
        try:
            schedule_df, _ = call_dataset(mod, "schedules", seasons=[season])
            print(f"Loaded {len(schedule_df)} schedule rows for {season}")
            
            # Filter by game type
            if 'game_type' in schedule_df.columns and game_type != 'ALL':
                if game_type == 'REG':
                    schedule_df = schedule_df[schedule_df['game_type'] == 'REG'].copy()
                    print(f"Filtered to {len(schedule_df)} regular season games")
                elif game_type == 'POST':
                    schedule_df = schedule_df[schedule_df['game_type'].isin(['WC', 'DIV', 'CON', 'SB'])].copy()
                    print(f"Filtered to {len(schedule_df)} playoff games")
            else:
                print(f"Including all {len(schedule_df)} games")
            
            # Filter to completed games only
            if 'home_score' in schedule_df.columns:
                completed = schedule_df[schedule_df['home_score'].notna()].copy()
            else:
                completed = schedule_df.copy()
            
            # Process each game for W/L/T and points
            for _, game in completed.iterrows():
                home_team = game.get('home_team')
                away_team = game.get('away_team')
                home_score = game.get('home_score')
                away_score = game.get('away_score')
                
                if not home_team or not away_team:
                    continue
                if pd.isna(home_score) or pd.isna(away_score):
                    continue
                    
                home_score = int(home_score)
                away_score = int(away_score)
                
                # Initialize teams if needed
                for team in [home_team, away_team]:
                    if team not in teams:
                        teams[team] = {
                            "abbr": team,
                            "wins": 0,
                            "losses": 0,
                            "ties": 0,
                            "points_for": 0,
                            "points_against": 0,
                            "games_played": 0,
                            # EPA placeholders
                            "offensive_epa": 0.0,
                            "defensive_epa": 0.0,
                            "pass_offense_epa": 0.0,
                            "rush_offense_epa": 0.0,
                            "pass_defense_epa": 0.0,
                            "rush_defense_epa": 0.0,
                            "offensive_plays": 0,
                            "defensive_plays": 0,
                            "off_pass_plays": 0,
                            "off_rush_plays": 0,
                            # Additional stats
                            "passing_yards": 0,
                            "rushing_yards": 0,
                            "passing_tds": 0,
                            "rushing_tds": 0,
                            # Offensive stats (from PBP)
                            "off_success_plays": 0,
                            "off_total_plays": 0,
                            "off_pass_attempts": 0,
                            "off_completions": 0,
                            "off_interceptions": 0,
                            "off_sacks_taken": 0,
                            "off_scrambles": 0,
                            "off_dropbacks": 0,
                            "off_air_yards": 0,
                            "off_pass_yards": 0,
                            "off_rush_yards": 0,
                            "off_first_downs": 0,
                            "off_turnovers": 0,
                            # Receiving stats (from player stats aggregation)
                            "receiving_yards": 0,
                            "receiving_tds": 0,
                            "receptions": 0,
                            "targets": 0,
                            "receiving_air_yards": 0,
                            "carries": 0,
                            # Defensive stats (from PBP)
                            "def_pass_yards_allowed": 0,
                            "def_rush_yards_allowed": 0,
                            "def_pass_td_allowed": 0,
                            "def_rush_td_allowed": 0,
                            "def_completions_allowed": 0,
                            "def_pass_attempts_faced": 0,
                            "def_sacks": 0,
                            "def_dropbacks_faced": 0,
                            "def_scrambles_allowed": 0,
                            "def_interceptions": 0,
                            "def_air_yards_faced": 0,
                            "def_success_plays": 0,
                            "def_total_plays": 0,
                            # Advanced metrics (from participation data)
                            "def_pressures": 0,  # Total pressures (includes hurries from participation)
                            "def_pressure_opps": 0,  # Opportunities for participation-based pressure
                            "def_sack_hit_pressures": 0,  # Sacks + QB hits only (from PBP, consistent across seasons)
                            "def_sack_hit_opps": 0,  # Dropbacks for sack+hit calculation
                            "def_blitzes": 0,
                            "def_blitz_opps": 0,
                            "def_man_coverage": 0,
                            "def_zone_coverage": 0,
                            "def_coverage_plays": 0,
                            "def_time_to_throw_sum": 0.0,
                            "def_time_to_throw_count": 0,
                        }
                
                # Update home team
                teams[home_team]["games_played"] += 1
                teams[home_team]["points_for"] += home_score
                teams[home_team]["points_against"] += away_score
                if home_score > away_score:
                    teams[home_team]["wins"] += 1
                elif home_score < away_score:
                    teams[home_team]["losses"] += 1
                else:
                    teams[home_team]["ties"] += 1
                
                # Update away team
                teams[away_team]["games_played"] += 1
                teams[away_team]["points_for"] += away_score
                teams[away_team]["points_against"] += home_score
                if away_score > home_score:
                    teams[away_team]["wins"] += 1
                elif away_score < home_score:
                    teams[away_team]["losses"] += 1
                else:
                    teams[away_team]["ties"] += 1
                    
            print(f"Processed {len(teams)} teams from schedules")
        except Exception as e:
            print(f"Error loading schedules: {e}")
            log_error(e, {"step": "schedules", "season": season})
        
        # === STEP 2: Load PBP data for EPA ===
        try:
            pbp_df, _ = call_dataset(mod, "pbp", seasons=[season])
            print(f"Loaded {len(pbp_df)} PBP rows for {season}")
            
            # Filter by game type
            if 'season_type' in pbp_df.columns and game_type != 'ALL':
                if game_type == 'REG':
                    pbp_df = pbp_df[pbp_df['season_type'] == 'REG'].copy()
                    print(f"Filtered to {len(pbp_df)} regular season PBP rows")
                elif game_type == 'POST':
                    pbp_df = pbp_df[pbp_df['season_type'] == 'POST'].copy()
                    print(f"Filtered to {len(pbp_df)} playoff PBP rows")
            else:
                print(f"Including all {len(pbp_df)} PBP rows")
            
            # Filter to regular plays with EPA
            if 'epa' in pbp_df.columns:
                # Filter to actual plays (not timeouts, etc.)
                plays = pbp_df[pbp_df['epa'].notna()].copy()
                
                # Get play type columns
                is_pass = plays.get('pass', plays.get('pass_attempt', pd.Series([0]*len(plays))))
                is_rush = plays.get('rush', plays.get('rush_attempt', pd.Series([0]*len(plays))))
                
                # Get team columns
                posteam_col = 'posteam' if 'posteam' in plays.columns else 'possession_team'
                defteam_col = 'defteam' if 'defteam' in plays.columns else 'defense_team'
                
                # Aggregate EPA and defensive stats by team
                for _, play in plays.iterrows():
                    pos_team = play.get(posteam_col)
                    def_team = play.get(defteam_col)
                    epa = play.get('epa', 0) or 0
                    
                    if pd.isna(pos_team) or pd.isna(def_team):
                        continue
                    
                    is_pass_play = play.get('pass', 0) == 1 or play.get('pass_attempt', 0) == 1
                    is_rush_play = play.get('rush', 0) == 1 or play.get('rush_attempt', 0) == 1
                    is_sack = play.get('sack', 0) == 1
                    is_qb_hit = play.get('qb_hit', 0) == 1
                    is_scramble = play.get('qb_scramble', 0) == 1
                    is_interception = play.get('interception', 0) == 1
                    is_complete = play.get('complete_pass', 0) == 1
                    is_pass_attempt = play.get('pass_attempt', 0) == 1
                    is_qb_dropback = play.get('qb_dropback', 0) == 1
                    is_td = play.get('touchdown', 0) == 1
                    pass_td = play.get('pass_touchdown', 0) == 1
                    rush_td = play.get('rush_touchdown', 0) == 1
                    
                    yards = play.get('yards_gained', 0) or 0
                    air_yards = play.get('air_yards', 0) or 0
                    
                    # Offensive EPA and stats (for possession team)
                    if pos_team in teams:
                        teams[pos_team]["offensive_epa"] += epa
                        teams[pos_team]["offensive_plays"] += 1
                        teams[pos_team]["off_total_plays"] += 1
                        
                        # Success rate (offense succeeds when EPA > 0)
                        if epa > 0:
                            teams[pos_team]["off_success_plays"] += 1
                        
                        if is_pass_play:
                            teams[pos_team]["pass_offense_epa"] += epa
                            teams[pos_team]["off_pass_plays"] += 1
                            
                            if is_qb_dropback:
                                teams[pos_team]["off_dropbacks"] += 1
                            
                            if is_pass_attempt and not is_sack:
                                teams[pos_team]["off_pass_attempts"] += 1
                                if is_complete:
                                    teams[pos_team]["off_completions"] += 1
                                    teams[pos_team]["off_pass_yards"] += yards
                                if not pd.isna(air_yards):
                                    teams[pos_team]["off_air_yards"] += air_yards
                            
                            if is_sack:
                                teams[pos_team]["off_sacks_taken"] += 1
                            if is_scramble:
                                teams[pos_team]["off_scrambles"] += 1
                            if is_interception:
                                teams[pos_team]["off_interceptions"] += 1
                                teams[pos_team]["off_turnovers"] += 1
                                
                        elif is_rush_play:
                            teams[pos_team]["rush_offense_epa"] += epa
                            teams[pos_team]["off_rush_plays"] += 1
                            teams[pos_team]["off_rush_yards"] += yards
                        
                        # First downs
                        is_first_down = play.get('first_down', 0) == 1 or play.get('first_down_rush', 0) == 1 or play.get('first_down_pass', 0) == 1
                        if is_first_down:
                            teams[pos_team]["off_first_downs"] += 1
                        
                        # Fumbles (turnovers)
                        is_fumble = play.get('fumble', 0) == 1
                        fumble_lost = play.get('fumble_lost', 0) == 1
                        if fumble_lost:
                            teams[pos_team]["off_turnovers"] += 1
                    
                    # Defensive EPA and stats (for defensive team - lower is better)
                    if def_team in teams:
                        teams[def_team]["defensive_epa"] += epa
                        teams[def_team]["defensive_plays"] += 1
                        teams[def_team]["def_total_plays"] += 1
                        
                        # Success rate (defense succeeds when EPA <= 0)
                        if epa <= 0:
                            teams[def_team]["def_success_plays"] += 1
                        
                        if is_pass_play:
                            teams[def_team]["pass_defense_epa"] += epa
                            teams[def_team]["def_dropbacks_faced"] += 1
                            
                            # Track sack+hit pressure from PBP (consistent across all seasons)
                            if is_qb_dropback:
                                teams[def_team]["def_sack_hit_opps"] += 1
                                if is_sack or is_qb_hit:
                                    teams[def_team]["def_sack_hit_pressures"] += 1
                            
                            if is_pass_attempt and not is_sack:
                                teams[def_team]["def_pass_attempts_faced"] += 1
                                if is_complete:
                                    teams[def_team]["def_completions_allowed"] += 1
                                    teams[def_team]["def_pass_yards_allowed"] += yards
                                if not pd.isna(air_yards):
                                    teams[def_team]["def_air_yards_faced"] += air_yards
                            
                            if is_sack:
                                teams[def_team]["def_sacks"] += 1
                            if is_scramble:
                                teams[def_team]["def_scrambles_allowed"] += 1
                            if is_interception:
                                teams[def_team]["def_interceptions"] += 1
                            if pass_td:
                                teams[def_team]["def_pass_td_allowed"] += 1
                                
                        elif is_rush_play:
                            teams[def_team]["rush_defense_epa"] += epa
                            teams[def_team]["def_rush_yards_allowed"] += yards
                            if rush_td:
                                teams[def_team]["def_rush_td_allowed"] += 1
                
                print(f"Processed EPA and defensive stats from PBP data")
            else:
                print("No EPA column found in PBP data")
        except Exception as e:
            print(f"Error loading PBP data: {e}")
            log_error(e, {"step": "pbp", "season": season})
        
        # === STEP 3: Load participation data for pressure/blitz/coverage ===
        try:
            part_df, _ = call_dataset(mod, "participation", seasons=[season])
            print(f"Loaded {len(part_df)} participation rows for {season}")
            
            # Merge with PBP to get team info and pressure data
            part_merged = part_df.merge(
                pbp_df[['game_id', 'play_id', 'defteam', 'pass', 'qb_dropback', 'sack', 'qb_hit']].drop_duplicates(),
                left_on=['nflverse_game_id', 'play_id'],
                right_on=['game_id', 'play_id'],
                how='left'
            )
            
            # Filter to pass plays with valid defense team
            pass_plays = part_merged[(part_merged['pass'] == 1) & (part_merged['defteam'].notna())]
            
            for _, play in pass_plays.iterrows():
                def_team = play.get('defteam')
                if not def_team or def_team not in teams:
                    continue
                
                # Pressure from participation data (includes hurries - comprehensive definition)
                was_pressure = play.get('was_pressure')
                if pd.notna(was_pressure):
                    teams[def_team]["def_pressure_opps"] += 1
                    if was_pressure == True or was_pressure == 'True':
                        teams[def_team]["def_pressures"] += 1
                
                # Also track sack+hit from PBP for consistency (same definition as 2025)
                is_qb_dropback = play.get('qb_dropback', 0) == 1
                is_sack = play.get('sack', 0) == 1
                is_qb_hit = play.get('qb_hit', 0) == 1
                
                if is_qb_dropback:
                    teams[def_team]["def_sack_hit_opps"] += 1
                    if is_sack or is_qb_hit:
                        teams[def_team]["def_sack_hit_pressures"] += 1
                
                # Blitz (5+ pass rushers)
                num_rushers = play.get('number_of_pass_rushers')
                if pd.notna(num_rushers) and num_rushers > 0:
                    teams[def_team]["def_blitz_opps"] += 1
                    if num_rushers >= 5:
                        teams[def_team]["def_blitzes"] += 1
                
                # Coverage type
                coverage_type = play.get('defense_man_zone_type')
                if pd.notna(coverage_type):
                    teams[def_team]["def_coverage_plays"] += 1
                    if coverage_type == 'MAN_COVERAGE':
                        teams[def_team]["def_man_coverage"] += 1
                    elif coverage_type == 'ZONE_COVERAGE':
                        teams[def_team]["def_zone_coverage"] += 1
                
                # Time to throw
                ttt = play.get('time_to_throw')
                if pd.notna(ttt) and ttt > 0:
                    teams[def_team]["def_time_to_throw_sum"] += ttt
                    teams[def_team]["def_time_to_throw_count"] += 1
            
            participation_loaded = True
            print(f"Processed participation data for pressure/blitz/coverage")
        except Exception as e:
            participation_loaded = False
            print(f"Error loading participation data: {e}")
            log_error(e, {"step": "participation", "season": season})
            # Note: For 2025, participation data may not be available yet
            # We'll use PBP-based pressure calculations as fallback
        
        # === STEP 3B: Load NextGen Stats for Time to Throw (fallback if no participation) ===
        if not participation_loaded:
            try:
                ngs_df, _ = call_dataset(mod, "nextgen_stats", seasons=[season])
                print(f"Loaded {len(ngs_df)} NextGen Stats rows for {season}")
                
                # Filter to passing stats and aggregate by team
                if 'avg_time_to_throw' in ngs_df.columns and 'team_abbr' in ngs_df.columns:
                    ngs_pass = ngs_df[ngs_df['avg_time_to_throw'].notna()].copy()
                    
                    # Aggregate time to throw by team (weighted by attempts)
                    for _, row in ngs_pass.iterrows():
                        team = row.get('team_abbr')
                        ttt = row.get('avg_time_to_throw')
                        attempts = row.get('attempts', 0) or 0
                        
                        if team and team in teams and pd.notna(ttt) and attempts > 0:
                            # Weight by attempts
                            teams[team]["def_time_to_throw_sum"] += ttt * attempts
                            teams[team]["def_time_to_throw_count"] += attempts
                    
                    print(f"Added Time to Throw from NextGen Stats")
            except Exception as e:
                print(f"Error loading NextGen Stats: {e}")
                # Not critical - time to throw is nice to have but not essential
        
        # === STEP 4 (was 3): Load player stats for yards/TDs ===
        try:
            stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
            
            # Aggregate by team
            team_col = 'recent_team' if 'recent_team' in stats_df.columns else 'team'
            for _, player in stats_df.iterrows():
                team = player.get(team_col)
                if not team or team not in teams:
                    continue
                
                teams[team]["passing_yards"] += player.get('passing_yards', 0) or 0
                teams[team]["rushing_yards"] += player.get('rushing_yards', 0) or 0
                teams[team]["passing_tds"] += player.get('passing_tds', 0) or 0
                teams[team]["rushing_tds"] += player.get('rushing_tds', 0) or 0
                teams[team]["receiving_yards"] += player.get('receiving_yards', 0) or 0
                teams[team]["receiving_tds"] += player.get('receiving_tds', 0) or 0
                teams[team]["receptions"] += player.get('receptions', 0) or 0
                teams[team]["targets"] += player.get('targets', 0) or 0
                teams[team]["receiving_air_yards"] += player.get('receiving_air_yards', 0) or 0
                teams[team]["carries"] += player.get('carries', 0) or 0
            print(f"Added yards/TDs from player stats")
        except Exception as e:
            print(f"Error loading player stats: {e}")
        
        # === STEP 5: Calculate per-play EPA and derived stats ===
        result = []
        for abbr, team in teams.items():
            # Calculate per-play EPA
            off_plays = max(team["offensive_plays"], 1)
            def_plays = max(team["defensive_plays"], 1)
            
            team["offensive_epa_per_play"] = team["offensive_epa"] / off_plays
            team["defensive_epa_per_play"] = team["defensive_epa"] / def_plays
            off_pass_plays = max(team["off_pass_plays"], 1)
            off_rush_plays = max(team["off_rush_plays"], 1)
            team["pass_offense_epa_per_play"] = team["pass_offense_epa"] / off_pass_plays if off_pass_plays > 0 else 0
            team["rush_offense_epa_per_play"] = team["rush_offense_epa"] / off_rush_plays if off_rush_plays > 0 else 0
            team["pass_defense_epa_per_play"] = team["pass_defense_epa"] / def_plays if def_plays > 0 else 0
            team["rush_defense_epa_per_play"] = team["rush_defense_epa"] / def_plays if def_plays > 0 else 0
            
            # Net EPA (offense - defense, but defense lower is better so it's off - def)
            team["net_epa"] = team["offensive_epa"] - team["defensive_epa"]
            team["net_epa_per_play"] = team["offensive_epa_per_play"] - team["defensive_epa_per_play"]
            
            # Point differential
            team["point_diff"] = team["points_for"] - team["points_against"]
            
            # PPG
            games = max(team["games_played"], 1)
            team["ppg"] = team["points_for"] / games
            team["ppg_against"] = team["points_against"] / games
            
            # Defensive percentage stats
            pass_attempts = max(team["def_pass_attempts_faced"], 1)
            dropbacks = max(team["def_dropbacks_faced"], 1)
            total_def_plays = max(team["def_total_plays"], 1)
            
            team["def_comp_pct"] = (team["def_completions_allowed"] / pass_attempts) * 100 if pass_attempts > 0 else 0
            team["def_sack_pct"] = (team["def_sacks"] / dropbacks) * 100 if dropbacks > 0 else 0
            team["def_scramble_pct"] = (team["def_scrambles_allowed"] / dropbacks) * 100 if dropbacks > 0 else 0
            team["def_int_pct"] = (team["def_interceptions"] / pass_attempts) * 100 if pass_attempts > 0 else 0
            team["def_adot"] = team["def_air_yards_faced"] / pass_attempts if pass_attempts > 0 else 0
            team["def_success_pct"] = (team["def_success_plays"] / total_def_plays) * 100 if total_def_plays > 0 else 0
            team["def_total_yards_allowed"] = team["def_pass_yards_allowed"] + team["def_rush_yards_allowed"]
            team["def_total_td_allowed"] = team["def_pass_td_allowed"] + team["def_rush_td_allowed"]
            
            # Offensive percentage stats
            off_pass_attempts = max(team["off_pass_attempts"], 1)
            off_dropbacks = max(team["off_dropbacks"], 1)
            off_total_plays = max(team["off_total_plays"], 1)
            
            team["off_success_pct"] = (team["off_success_plays"] / off_total_plays) * 100 if off_total_plays > 0 else 0
            team["off_comp_pct"] = (team["off_completions"] / off_pass_attempts) * 100 if off_pass_attempts > 0 else 0
            team["off_sack_pct"] = (team["off_sacks_taken"] / off_dropbacks) * 100 if off_dropbacks > 0 else 0
            team["off_scramble_pct"] = (team["off_scrambles"] / off_dropbacks) * 100 if off_dropbacks > 0 else 0
            team["off_int_pct"] = (team["off_interceptions"] / off_pass_attempts) * 100 if off_pass_attempts > 0 else 0
            team["off_adot"] = team["off_air_yards"] / off_pass_attempts if off_pass_attempts > 0 else 0
            team["off_total_epa"] = team["offensive_epa"]  # Total EPA (not per play)
            team["off_total_yards"] = team["passing_yards"] + team["rushing_yards"]  # Use player stats aggregation
            team["off_total_tds"] = team["passing_tds"] + team["rushing_tds"] + team["receiving_tds"]
            
            # Advanced rates (from participation data or PBP fallback)
            # Pressure rate: from participation data (includes hurries - comprehensive)
            pressure_opps = team["def_pressure_opps"]
            team["def_pressure_rate"] = (team["def_pressures"] / pressure_opps) * 100 if pressure_opps > 0 else None
            
            # Sack+Hit rate: from PBP (sack OR qb_hit - consistent across all seasons)
            sack_hit_opps = team["def_sack_hit_opps"]
            team["def_sack_hit_rate"] = (team["def_sack_hit_pressures"] / sack_hit_opps) * 100 if sack_hit_opps > 0 else 0
            
            # Blitz rate: only from participation data (not available in PBP)
            blitz_opps = team["def_blitz_opps"]
            team["def_blitz_rate"] = (team["def_blitzes"] / blitz_opps) * 100 if blitz_opps > 0 else None  # None if no data
            
            # Coverage rates: only from participation data (not available in PBP)
            coverage_plays = team["def_coverage_plays"]
            team["def_man_coverage_pct"] = (team["def_man_coverage"] / coverage_plays) * 100 if coverage_plays > 0 else None
            team["def_zone_coverage_pct"] = (team["def_zone_coverage"] / coverage_plays) * 100 if coverage_plays > 0 else None
            
            # Time to throw: from participation data or NextGen Stats fallback
            ttt_count = team["def_time_to_throw_count"]
            team["def_avg_time_to_throw"] = team["def_time_to_throw_sum"] / ttt_count if ttt_count > 0 else None
            
            result.append(team)
        
        # Sort by net EPA per play
        result.sort(key=lambda x: x["net_epa_per_play"], reverse=True)
        
        # Add rank
        for i, team in enumerate(result):
            team["rank"] = i + 1
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "teams": len(result),
            "data": [clean_dict(t) for t in result]
        })
        
    except Exception as e:
        log_error(e, {"endpoint": "team_stats", "season": season})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/player/{player_id}/similar")
async def get_similar_players(
    player_id: str,
    position: str = Query(..., description="Player position: QB, RB, WR, TE"),
    type: str = Query("career", description="Type: 'career' or 'season'"),
    limit: int = Query(3, description="Number of similar players to return"),
    season: int = Query(2025, description="Season for season-based similarity"),
):
    """
    Get players most similar to the given player.
    Calculates similarity based on position-specific stats.
    This is optimized to only process players of the same position.
    """
    try:
        mod = import_library()
        
        if type == 'season':
            # Load current season stats
            stats_df, _ = call_dataset(mod, "player_stats", seasons=[season])
            
            # Filter to same position
            position_players = stats_df[stats_df['position'] == position].copy()
            
            # Find target player
            target_player = None
            for id_col in ['player_id', 'gsis_id']:
                if id_col in position_players.columns:
                    match = position_players[position_players[id_col] == player_id]
                    if len(match) > 0:
                        target_player = match.iloc[0].to_dict()
                        break
            
            if not target_player:
                return JSONResponse(content={
                    "status": "success",
                    "data": [],
                    "message": "Player not found in season data"
                })
            
            # Calculate similarity for each player (use position-specific stats + efficiency metrics)
            similar_players = []
            
            # Helper function to calculate efficiency metrics
            def calc_efficiency_metrics(player_data, pos):
                metrics = {}
                if pos == 'QB':
                    attempts = player_data.get('attempts', 0) or 0
                    completions = player_data.get('completions', 0) or 0
                    dropbacks = attempts + (player_data.get('sacks', 0) or 0)
                    
                    metrics['completion_pct'] = (completions / attempts * 100) if attempts > 0 else 0
                    metrics['yards_per_attempt'] = (player_data.get('passing_yards', 0) or 0) / attempts if attempts > 0 else 0
                    metrics['td_percentage'] = ((player_data.get('passing_tds', 0) or 0) / attempts * 100) if attempts > 0 else 0
                    metrics['int_percentage'] = ((player_data.get('interceptions', 0) or 0) / attempts * 100) if attempts > 0 else 0
                    metrics['epa_per_dropback'] = (player_data.get('passing_epa', 0) or 0) / dropbacks if dropbacks > 0 else 0
                    metrics['air_yards_per_attempt'] = (player_data.get('passing_air_yards', 0) or 0) / attempts if attempts > 0 else 0
                    metrics['sack_percentage'] = ((player_data.get('sacks', 0) or 0) / dropbacks * 100) if dropbacks > 0 else 0
                    
                elif pos == 'RB':
                    carries = player_data.get('carries', 0) or 0
                    touches = carries + (player_data.get('receptions', 0) or 0)
                    targets = player_data.get('targets', 0) or 0
                    
                    metrics['yards_per_carry'] = (player_data.get('rushing_yards', 0) or 0) / carries if carries > 0 else 0
                    metrics['rushing_td_rate'] = ((player_data.get('rushing_tds', 0) or 0) / carries * 100) if carries > 0 else 0
                    metrics['rushing_epa_per_carry'] = (player_data.get('rushing_epa', 0) or 0) / carries if carries > 0 else 0
                    metrics['yards_per_touch'] = ((player_data.get('rushing_yards', 0) or 0) + (player_data.get('receiving_yards', 0) or 0)) / touches if touches > 0 else 0
                    metrics['receiving_epa_per_target'] = (player_data.get('receiving_epa', 0) or 0) / targets if targets > 0 else 0
                    
                else:  # WR/TE
                    targets = player_data.get('targets', 0) or 0
                    receptions = player_data.get('receptions', 0) or 0
                    routes = player_data.get('routes', 0) or 0
                    air_yards = player_data.get('receiving_air_yards', 0) or 0
                    
                    metrics['catch_percentage'] = (receptions / targets * 100) if targets > 0 else 0
                    metrics['yards_per_target'] = (player_data.get('receiving_yards', 0) or 0) / targets if targets > 0 else 0
                    metrics['yards_per_reception'] = (player_data.get('receiving_yards', 0) or 0) / receptions if receptions > 0 else 0
                    metrics['yprr'] = (player_data.get('receiving_yards', 0) or 0) / routes if routes > 0 else 0
                    metrics['tprr'] = targets / routes if routes > 0 else 0
                    metrics['adot'] = air_yards / targets if targets > 0 else 0
                    metrics['epa_per_route'] = (player_data.get('receiving_epa', 0) or 0) / routes if routes > 0 else 0
                    metrics['td_rate'] = ((player_data.get('receiving_tds', 0) or 0) / targets * 100) if targets > 0 else 0
                    metrics['racr'] = (player_data.get('receiving_yards', 0) or 0) / air_yards if air_yards > 0 else 0
                
                return metrics
            
            # Position-specific volume stats + efficiency metrics
            target_efficiency = calc_efficiency_metrics(target_player, position)
            
            # Base volume stats (for context) - includes EPA and advanced metrics
            base_stats_map = {
                'QB': ['passing_yards', 'passing_tds', 'interceptions', 'completions', 'attempts', 'rushing_yards', 
                      'fantasy_points_ppr', 'passing_epa', 'passing_air_yards', 'sacks'],
                'RB': ['rushing_yards', 'rushing_tds', 'receptions', 'receiving_yards', 'targets', 'carries', 
                      'fantasy_points_ppr', 'rushing_epa', 'receiving_epa'],
                'WR': ['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'receiving_air_yards', 
                      'fantasy_points_ppr', 'receiving_epa', 'routes', 'receiving_first_downs'],
                'TE': ['targets', 'receptions', 'receiving_yards', 'receiving_tds', 'fantasy_points_ppr', 
                      'receiving_epa', 'routes', 'receiving_air_yards', 'receiving_first_downs'],
            }
            base_stats = base_stats_map.get(position, base_stats_map['WR'])
            
            # Phase 1: Pre-calculate percentile ranks for season similarity
            # Calculate percentile ranks for base stats
            season_percentile_ranks = {}
            for stat in base_stats:
                values = [row.get(stat, 0) or 0 for _, row in position_players.iterrows()]
                if values and not all(v == 0 for v in values):
                    sorted_values = sorted(values)
                    n = len(sorted_values)
                    percentile_map = {}
                    for _, row in position_players.iterrows():
                        pid = row.get('player_id') or row.get('gsis_id')
                        val = row.get(stat, 0) or 0
                        if n == 1:
                            percentile_map[pid] = 0.5
                        else:
                            rank = sum(1 for v in sorted_values if v < val)
                            percentile_map[pid] = rank / (n - 1) if n > 1 else 0.5
                    season_percentile_ranks[stat] = percentile_map
            
            # Pre-calculate efficiency metrics and percentile ranks
            all_season_efficiency = {}
            for _, row in position_players.iterrows():
                pid = row.get('player_id') or row.get('gsis_id')
                player = row.to_dict()
                all_season_efficiency[pid] = calc_efficiency_metrics(player, position)
            
            season_efficiency_percentiles = {}
            # Get all player IDs once
            all_pids = [row.get('player_id') or row.get('gsis_id') for _, row in position_players.iterrows()]
            
            for metric_key in target_efficiency.keys():
                values = [all_season_efficiency.get(pid, {}).get(metric_key, 0) for pid in all_pids]
                if values and not all(v == 0 for v in values):
                    sorted_values = sorted(values)
                    n = len(sorted_values)
                    percentile_map = {}
                    for pid in all_pids:
                        val = all_season_efficiency.get(pid, {}).get(metric_key, 0)
                        if n == 1:
                            percentile_map[pid] = 0.5
                        else:
                            rank = sum(1 for v in sorted_values if v < val)
                            percentile_map[pid] = rank / (n - 1) if n > 1 else 0.5
                    season_efficiency_percentiles[metric_key] = percentile_map
            
            # Phase 2: PCA + Cosine Similarity for season similarity
            use_season_phase2 = SKLEARN_AVAILABLE and len(position_players) > 10
            
            if use_season_phase2:
                try:
                    # Build feature matrix
                    feature_matrix = []
                    player_ids_list = []
                    
                    for _, row in position_players.iterrows():
                        pid = row.get('player_id') or row.get('gsis_id')
                        if pid == player_id:
                            continue
                        if (row.get('fantasy_points_ppr', 0) or 0) < 10:
                            continue
                        
                        player = row.to_dict()
                        features = []
                        # Add base stats
                        for stat in base_stats:
                            val = player.get(stat, 0) or 0
                            # Handle None and NaN values
                            if val is None:
                                val = 0
                            if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                                val = 0
                            features.append(float(val))
                        # Add efficiency metrics
                        eff_metrics = all_season_efficiency.get(pid, {})
                        for metric_key in sorted(target_efficiency.keys()):
                            val = eff_metrics.get(metric_key, 0) or 0
                            # Handle None and NaN values
                            if val is None:
                                val = 0
                            if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                                val = 0
                            features.append(float(val))
                        
                        feature_matrix.append(features)
                        player_ids_list.append(pid)
                    
                    # Add target player
                    target_features = []
                    for stat in base_stats:
                        val = target_player.get(stat, 0) or 0
                        # Handle None and NaN values
                        if val is None:
                            val = 0
                        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                            val = 0
                        target_features.append(float(val))
                    for metric_key in sorted(target_efficiency.keys()):
                        val = target_efficiency.get(metric_key, 0) or 0
                        # Handle None and NaN values
                        if val is None:
                            val = 0
                        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                            val = 0
                        target_features.append(float(val))
                    
                    if len(feature_matrix) > 0 and len(feature_matrix[0]) > 0:
                        # Handle NaN values before PCA (PCA doesn't accept NaN)
                        all_features = feature_matrix + [target_features]
                        all_features_array = np.array(all_features)
                        
                        # Replace NaN and inf with 0
                        all_features_array = np.nan_to_num(all_features_array, nan=0.0, posinf=0.0, neginf=0.0)
                        
                        # Standardize and apply PCA
                        scaler = StandardScaler()
                        scaled_features = scaler.fit_transform(all_features_array)
                        
                        n_components = min(10, len(base_stats) + len(target_efficiency) - 1, len(scaled_features) - 1)
                        if n_components > 0:
                            pca = PCA(n_components=n_components)
                            reduced_features = pca.fit_transform(scaled_features)
                            
                            target_reduced = reduced_features[-1].reshape(1, -1)
                            comparison_reduced = reduced_features[:-1]
                            
                            # Cosine similarity
                            cosine_similarities = cosine_similarity(target_reduced, comparison_reduced)[0]
                            
                            # Clustering
                            n_clusters = min(6, len(comparison_reduced) // 3)
                            if n_clusters > 1:
                                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                                clusters = kmeans.fit_predict(comparison_reduced)
                                target_cluster = kmeans.predict(target_reduced)[0]
                                
                                cluster_boost = 0.1
                                for i, cluster_id in enumerate(clusters):
                                    if cluster_id == target_cluster:
                                        cosine_similarities[i] = min(1.0, cosine_similarities[i] + cluster_boost)
                            
                            season_phase2_similarities = {}
                            for i, pid in enumerate(player_ids_list):
                                season_phase2_similarities[pid] = cosine_similarities[i] * 100
                            
                            log_info(f"Season Phase 2: PCA reduced features to {n_components} components")
                        else:
                            use_season_phase2 = False
                    else:
                        use_season_phase2 = False
                except Exception as e:
                    log_info(f"Season Phase 2 failed: {e}")
                    use_season_phase2 = False
                    season_phase2_metadata = {'used': False, 'reason': f'error: {str(e)}'}
            else:
                season_phase2_similarities = {}
                if not SKLEARN_AVAILABLE:
                    season_phase2_metadata = {'used': False, 'reason': 'sklearn_not_available'}
                elif len(position_players) <= 10:
                    season_phase2_metadata = {'used': False, 'reason': 'insufficient_players', 'n_players': len(position_players)}
                else:
                    season_phase2_metadata = {'used': False, 'reason': 'unknown'}
            
            for _, player_row in position_players.iterrows():
                player = player_row.to_dict()
                pid = player.get('player_id') or player.get('gsis_id')
                if pid == player_id:
                    continue
                
                # Skip players with minimal stats
                if (player.get('fantasy_points_ppr', 0) or 0) < 10:
                    continue
                
                # Calculate similarity using both volume and efficiency metrics
                # Phase 1: Using percentile normalization
                sum_squared_diff = 0
                valid_stats = 0
                
                # Compare base volume stats with percentile normalization
                for stat in base_stats:
                    val1 = target_player.get(stat, 0) or 0
                    val2 = player.get(stat, 0) or 0
                    
                    # Use percentile normalization (less sensitive to outliers)
                    if stat in season_percentile_ranks and season_percentile_ranks[stat]:
                        pct1 = season_percentile_ranks[stat].get(player_id, 0.5)
                        pct2 = season_percentile_ranks[stat].get(pid, 0.5)
                        normalized_diff = abs(pct1 - pct2)
                    else:
                        # Fallback to max-value normalization
                        max_val = max(abs(val1), abs(val2), 1)
                        if max_val > 0:
                            normalized_diff = abs(val1 - val2) / max_val
                        else:
                            continue
                    
                    sum_squared_diff += normalized_diff * normalized_diff
                    valid_stats += 1
                
                # Compare efficiency metrics (weighted 1.5x more than volume stats - efficiency is more predictive)
                # Phase 1: Use percentile normalization
                player_efficiency = all_season_efficiency.get(pid, {})
                efficiency_weight = 1.5  # Efficiency metrics are weighted more heavily
                
                for metric_key, metric_val in target_efficiency.items():
                    val1 = metric_val
                    val2 = player_efficiency.get(metric_key, 0)
                    
                    # Use percentile normalization for efficiency metrics
                    if metric_key in season_efficiency_percentiles and season_efficiency_percentiles[metric_key]:
                        pct1 = season_efficiency_percentiles[metric_key].get(player_id, 0.5)
                        pct2 = season_efficiency_percentiles[metric_key].get(pid, 0.5)
                        normalized_diff = abs(pct1 - pct2)
                    else:
                        # Fallback to max-value normalization
                        if 'pct' in metric_key or 'rate' in metric_key or 'percentage' in metric_key:
                            max_val = max(abs(val1), abs(val2), 1)
                            if max_val > 0:
                                normalized_diff = abs(val1 - val2) / max_val
                            else:
                                continue
                        else:
                            max_val = max(abs(val1), abs(val2), 0.1)
                            if max_val > 0:
                                normalized_diff = abs(val1 - val2) / max_val
                            else:
                                continue
                    
                    # Weight efficiency metrics more heavily (especially EPA)
                    weight = 2.0 if 'epa' in metric_key else efficiency_weight
                    sum_squared_diff += (normalized_diff * normalized_diff) * weight
                    valid_stats += weight
                
                if valid_stats > 0:
                    # Phase 1 similarity
                    distance = (sum_squared_diff / valid_stats) ** 0.5
                    phase1_similarity = max(0, 100 - (distance * 50))
                    
                    # Phase 2: Combine if available
                    pid = player.get('player_id') or player.get('gsis_id')
                    phase2_sim = None
                    if use_season_phase2 and pid in season_phase2_similarities:
                        phase2_sim = season_phase2_similarities[pid]
                        similarity = (phase2_sim * 0.6) + (phase1_similarity * 0.4)
                    else:
                        similarity = phase1_similarity
                    
                    player_result = {
                        **player,
                        'similarity': similarity,
                        'similarity_phase1': round(phase1_similarity, 2)
                    }
                    
                    # Add Phase 2 info if available
                    if phase2_sim is not None:
                        player_result['similarity_phase2'] = round(phase2_sim, 2)
                        player_result['similarity_method'] = 'phase2_combined'
                    else:
                        player_result['similarity_method'] = 'phase1_only'
                    
                    similar_players.append(player_result)
            
            # Sort and limit
            similar_players.sort(key=lambda x: x['similarity'], reverse=True)
            similar_players = similar_players[:limit]
            
        else:  # career
            # Load all available historical seasons for comprehensive similarity analysis
            # Using ALL_HISTORICAL_SEASONS (1999-2025) ensures we have the most comprehensive dataset
            # Data quality is consistent across all these seasons with full EPA and advanced metrics
            log_info(f"Loading career data for similarity analysis: {len(ALL_HISTORICAL_SEASONS)} seasons ({HISTORICAL_SEASONS_START}-{CURRENT_SEASON})")
            stats_df, _ = call_dataset(mod, "player_stats", seasons=ALL_HISTORICAL_SEASONS)
            
            # Filter to same position first (optimization: only calculate routes for this position)
            position_players = stats_df[stats_df['position'] == position].copy()
            
            # Calculate routes for WRs/TEs if needed (only for this position's players to save time)
            # Routes aren't in player_stats by default, but we only need them for efficiency metrics
            if position.upper() in ['WR', 'TE']:
                # Check if routes column exists and has data for this position
                has_routes = 'routes' in position_players.columns and position_players['routes'].notna().any() and (position_players['routes'] > 0).any()
                
                if not has_routes:
                    log_info(f"Calculating routes for {position} career similarity (position-specific optimization)")
                    try:
                        # Get unique player IDs and seasons we need routes for
                        needed_players = position_players['player_id'].unique()
                        needed_seasons = position_players['season'].unique()
                        recent_seasons = [s for s in needed_seasons if s >= 2016]
                        
                        if len(recent_seasons) > 0 and len(needed_players) > 0:
                            # Split into 2016-2024 (participation) and 2025+ (snap counts)
                            participation_seasons = [s for s in recent_seasons if s <= 2024]
                            snap_seasons = [s for s in recent_seasons if s > 2024]
                            
                            routes_list = []
                            
                            # Calculate routes from participation data (2016-2024) - batch process
                            if participation_seasons:
                                try:
                                    pbp_df, _ = call_dataset(mod, "pbp", seasons=participation_seasons)
                                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season"]
                                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                                    
                                    part_df, _ = call_dataset(mod, "participation", seasons=participation_seasons)
                                    part_cols = ["nflverse_game_id", "play_id", "offense_players"]
                                    part_df = part_df[[c for c in part_cols if c in part_df.columns]]
                                    
                                    pass_plays = pbp_df[pbp_df['play_type'] == 'pass']
                                    merged = pd.merge(pass_plays, part_df, left_on=['game_id', 'play_id'], right_on=['nflverse_game_id', 'play_id'])
                                    merged['offense_players'] = merged['offense_players'].astype(str)
                                    merged['player_id_split'] = merged['offense_players'].str.split(';')
                                    exploded = merged.explode('player_id_split')
                                    
                                    # Filter to only players we need
                                    exploded = exploded[exploded['player_id_split'].isin(needed_players)]
                                    
                                    routes_counts = exploded.groupby(['player_id_split', 'season', 'week']).size().reset_index(name='routes')
                                    routes_counts.rename(columns={'player_id_split': 'player_id'}, inplace=True)
                                    routes_list.append(routes_counts)
                                    log_info(f"Calculated routes from participation for {len(routes_counts)} player-weeks")
                                except Exception as e:
                                    log_info(f"Failed to calculate routes from participation: {e}")
                            
                            # Calculate routes from snap counts (2025+) - batch process
                            if snap_seasons:
                                try:
                                    pbp_df, _ = call_dataset(mod, "pbp", seasons=snap_seasons)
                                    pbp_cols = ["game_id", "play_id", "play_type", "week", "season", "posteam"]
                                    pbp_df = pbp_df[[c for c in pbp_cols if c in pbp_df.columns]]
                                    
                                    # Calculate Team Pass Rate per Game
                                    game_stats = pbp_df.groupby(['game_id', 'posteam']).agg(
                                        pass_plays=('play_type', lambda x: (x == 'pass').sum()),
                                        total_plays=('play_type', lambda x: x.isin(['pass', 'run']).sum())
                                    ).reset_index()
                                    game_stats['pass_rate'] = game_stats['pass_plays'] / game_stats['total_plays']
                                    game_stats['pass_rate'] = game_stats['pass_rate'].fillna(0)
                                    
                                    # Add season/week to game_stats
                                    game_meta = pbp_df[['game_id', 'season', 'week']].drop_duplicates()
                                    game_stats = game_stats.merge(game_meta, on='game_id')
                                    
                                    # Load Snap Counts
                                    snaps, _ = call_dataset(mod, "snap_counts", seasons=snap_seasons)
                                    off_snaps = snaps[(snaps['offense_snaps'] > 0) & (snaps['position'].isin(['WR', 'TE']))].copy()
                                    
                                    # Filter to only players we need (by matching player_id)
                                    # First try to map pfr_player_id to gsis_id
                                    players, _ = call_dataset(mod, "players", seasons=None)
                                    if 'pfr_id' in players.columns and 'gsis_id' in players.columns:
                                        id_map = players[['pfr_id', 'gsis_id']].dropna().set_index('pfr_id')['gsis_id'].to_dict()
                                        off_snaps['player_id'] = off_snaps['pfr_player_id'].map(id_map)
                                    
                                    # Filter to only needed players
                                    off_snaps = off_snaps[off_snaps['player_id'].isin(needed_players)]
                                    
                                    # Merge Snaps with Pass Rate
                                    estimated = pd.merge(
                                        off_snaps,
                                        game_stats,
                                        left_on=['season', 'week', 'team'],
                                        right_on=['season', 'week', 'posteam'],
                                        how='inner'
                                    )
                                    estimated['routes'] = (estimated['offense_snaps'] * estimated['pass_rate']).round(1)
                                    
                                    routes_counts = estimated[['player_id', 'season', 'week', 'routes']].dropna()
                                    routes_list.append(routes_counts)
                                    log_info(f"Calculated routes from snap counts for {len(routes_counts)} player-weeks")
                                except Exception as e:
                                    log_info(f"Failed to calculate routes from snap counts: {e}")
                            
                            # Combine all routes data and merge
                            if routes_list:
                                all_routes = pd.concat(routes_list, ignore_index=True)
                                
                                # Merge routes into position_players
                                if 'routes' in position_players.columns:
                                    position_players = pd.merge(position_players, all_routes, on=['player_id', 'season', 'week'], how='left', suffixes=('', '_new'))
                                    position_players['routes'] = position_players['routes'].fillna(0)
                                    if 'routes_new' in position_players.columns:
                                        position_players['routes'] = position_players.apply(lambda x: x['routes_new'] if x['routes'] == 0 and pd.notna(x['routes_new']) else x['routes'], axis=1)
                                        position_players.drop(columns=['routes_new'], inplace=True)
                                else:
                                    position_players = pd.merge(position_players, all_routes, on=['player_id', 'season', 'week'], how='left')
                                    position_players['routes'] = position_players['routes'].fillna(0)
                                
                                log_info(f"Routes merged for {len(all_routes)} player-weeks")
                    except Exception as e:
                        log_info(f"Routes calculation failed: {e}")
                        import traceback
                        traceback.print_exc()
                        # Set routes to 0 if calculation fails
                        if 'routes' not in position_players.columns:
                            position_players['routes'] = 0
                
                # Ensure routes column exists
                if 'routes' not in position_players.columns:
                    position_players['routes'] = 0
                else:
                    position_players['routes'] = position_players['routes'].fillna(0)
            
            # Aggregate career stats by player
            career_map = {}
            for _, row in position_players.iterrows():
                pid = row.get('player_id') or row.get('gsis_id')
                if not pid:
                    continue
                
                if pid not in career_map:
                    career_map[pid] = {
                        'player_id': pid,
                        'player_display_name': row.get('player_display_name') or row.get('player_name') or '',
                        'position': position,
                        'recent_team': row.get('recent_team') or row.get('team') or '',
                        'seasons_played': set(),
                        'games_played_weeks': set(),  # Track unique (season, week) combinations
                        'games_played': 0,
                        'career_passing_yards': 0,
                        'career_passing_tds': 0,
                        'career_interceptions': 0,
                        'career_completions': 0,
                        'career_passing_attempts': 0,
                        'career_sacks': 0,
                        'career_passing_epa': 0,
                        'career_passing_air_yards': 0,
                        'career_rushing_yards': 0,
                        'career_rushing_tds': 0,
                        'career_carries': 0,
                        'career_rushing_epa': 0,
                        'career_receptions': 0,
                        'career_receiving_yards': 0,
                        'career_receiving_tds': 0,
                        'career_targets': 0,
                        'career_receiving_epa': 0,
                        'career_routes': 0,
                        'career_receiving_air_yards': 0,
                        'career_receiving_first_downs': 0,
                        'career_fantasy_points_ppr': 0,
                    }
                
                c = career_map[pid]
                season = row.get('season')
                week = row.get('week')
                
                if pd.notna(season):
                    c['seasons_played'].add(int(season))
                
                # Count unique (season, week) combinations for games played
                if pd.notna(season) and pd.notna(week):
                    c['games_played_weeks'].add((int(season), int(week)))
                c['career_passing_yards'] += row.get('passing_yards', 0) or 0
                c['career_passing_tds'] += row.get('passing_tds', 0) or 0
                c['career_interceptions'] += row.get('interceptions', 0) or 0
                c['career_completions'] += row.get('completions', 0) or 0
                c['career_passing_attempts'] += row.get('attempts', 0) or 0
                c['career_sacks'] += row.get('sacks', 0) or 0
                c['career_passing_epa'] += row.get('passing_epa', 0) or 0
                c['career_passing_air_yards'] += row.get('passing_air_yards', 0) or 0
                c['career_rushing_yards'] += row.get('rushing_yards', 0) or 0
                c['career_rushing_tds'] += row.get('rushing_tds', 0) or 0
                c['career_carries'] += row.get('carries', 0) or 0
                c['career_rushing_epa'] += row.get('rushing_epa', 0) or 0
                c['career_receptions'] += row.get('receptions', 0) or 0
                c['career_receiving_yards'] += row.get('receiving_yards', 0) or 0
                c['career_receiving_tds'] += row.get('receiving_tds', 0) or 0
                c['career_targets'] += row.get('targets', 0) or 0
                c['career_receiving_epa'] += row.get('receiving_epa', 0) or 0
                c['career_routes'] += row.get('routes', 0) or 0
                c['career_receiving_air_yards'] += row.get('receiving_air_yards', 0) or 0
                c['career_receiving_first_downs'] += row.get('receiving_first_downs', 0) or 0
                c['career_fantasy_points_ppr'] += row.get('fantasy_points_ppr', 0) or 0
                c['recent_team'] = row.get('recent_team') or row.get('team') or c['recent_team']
            
            # Convert sets to counts
            for pid, player in career_map.items():
                player['seasons_played'] = len(player['seasons_played'])
                # Count unique (season, week) combinations as games played
                player['games_played'] = len(player['games_played_weeks'])
                # Remove the temporary set
                del player['games_played_weeks']
            
            # Find target player
            target_player = career_map.get(player_id)
            if not target_player:
                return JSONResponse(content={
                    "status": "success",
                    "data": [],
                    "message": "Player not found in career data"
                })
            
            # Position-specific base career stats (matching season similarity structure)
            # Include games_played and seasons_played as they're critical for normalizing volume stats
            # MUST be defined before percentile/era calculations
            base_career_stats_map = {
                'QB': ['career_passing_yards', 'career_passing_tds', 'career_interceptions', 'career_completions', 
                      'career_passing_attempts', 'career_rushing_yards', 'career_fantasy_points_ppr', 
                      'career_passing_epa', 'career_passing_air_yards', 'career_sacks', 'games_played', 'seasons_played'],
                'RB': ['career_rushing_yards', 'career_rushing_tds', 'career_receptions', 'career_receiving_yards', 
                      'career_targets', 'career_carries', 'career_fantasy_points_ppr', 'career_rushing_epa', 
                      'career_receiving_epa', 'games_played', 'seasons_played'],
                'WR': ['career_targets', 'career_receptions', 'career_receiving_yards', 'career_receiving_tds', 
                      'career_receiving_air_yards', 'career_fantasy_points_ppr', 'career_receiving_epa', 
                      'career_routes', 'career_receiving_first_downs', 'games_played', 'seasons_played'],
                'TE': ['career_targets', 'career_receptions', 'career_receiving_yards', 'career_receiving_tds', 
                      'career_fantasy_points_ppr', 'career_receiving_epa', 'career_routes', 
                      'career_receiving_air_yards', 'career_receiving_first_downs', 'games_played', 'seasons_played'],
            }
            base_career_stats = base_career_stats_map.get(position, base_career_stats_map['WR'])
            
            # Phase 1 Improvements: Prepare percentile normalization and era adjustment data
            # Calculate percentile ranks for all players (for percentile normalization)
            def calculate_percentile_ranks(career_map, stat_name):
                """Calculate percentile rank (0-1) for each player's stat value"""
                values = [p.get(stat_name, 0) or 0 for p in career_map.values()]
                if not values or all(v == 0 for v in values):
                    return {}
                
                # Sort values to calculate percentiles
                sorted_values = sorted(values)
                n = len(sorted_values)
                
                percentile_map = {}
                for pid, player in career_map.items():
                    val = player.get(stat_name, 0) or 0
                    # Calculate percentile rank (0-1 scale)
                    if n == 1:
                        percentile_map[pid] = 0.5
                    else:
                        # Count how many players have lower values
                        rank = sum(1 for v in sorted_values if v < val)
                        percentile_map[pid] = rank / (n - 1) if n > 1 else 0.5
                
                return percentile_map
            
            # Pre-calculate percentile ranks for all base stats
            percentile_ranks = {}
            for stat in base_career_stats:
                percentile_ranks[stat] = calculate_percentile_ranks(career_map, stat)
            
            # Calculate era-adjusted stats (normalize by league averages per season)
            # For career totals, we'll use a weighted average of era adjustments
            def calculate_era_adjustment_factor(position, stat_name, all_seasons):
                """Calculate era adjustment factors for each season"""
                # Load season-by-season averages for this stat
                era_factors = {}
                
                try:
                    # Get position-specific stats from the original stats_df
                    pos_stats = stats_df[stats_df['position'] == position].copy()
                    
                    for season in all_seasons:
                        season_stats = pos_stats[pos_stats['season'] == season]
                        if len(season_stats) == 0:
                            continue
                        
                        # Map stat name to column name
                        stat_col = None
                        if stat_name == 'career_passing_yards':
                            stat_col = 'passing_yards'
                        elif stat_name == 'career_passing_tds':
                            stat_col = 'passing_tds'
                        elif stat_name == 'career_rushing_yards':
                            stat_col = 'rushing_yards'
                        elif stat_name == 'career_rushing_tds':
                            stat_col = 'rushing_tds'
                        elif stat_name == 'career_receiving_yards':
                            stat_col = 'receiving_yards'
                        elif stat_name == 'career_receiving_tds':
                            stat_col = 'receiving_tds'
                        elif stat_name == 'career_receptions':
                            stat_col = 'receptions'
                        elif stat_name == 'career_targets':
                            stat_col = 'targets'
                        elif stat_name == 'career_carries':
                            stat_col = 'carries'
                        elif stat_name == 'career_passing_attempts':
                            stat_col = 'attempts'
                        elif stat_name == 'career_passing_epa':
                            stat_col = 'passing_epa'
                        elif stat_name == 'career_rushing_epa':
                            stat_col = 'rushing_epa'
                        elif stat_name == 'career_receiving_epa':
                            stat_col = 'receiving_epa'
                        elif stat_name == 'career_fantasy_points_ppr':
                            stat_col = 'fantasy_points_ppr'
                        elif stat_name == 'games_played':
                            # For games_played, use max week as proxy
                            stat_col = 'week'
                        
                        if stat_col and stat_col in season_stats.columns:
                            # Calculate league average for this season
                            if stat_col == 'week':
                                # For games, use max week
                                league_avg = season_stats[stat_col].max() if len(season_stats) > 0 else 17
                            else:
                                # Aggregate by player-season first, then average
                                player_season_totals = season_stats.groupby('player_id')[stat_col].sum()
                                league_avg = player_season_totals.mean() if len(player_season_totals) > 0 else 0
                            
                            if league_avg > 0:
                                era_factors[season] = league_avg
                    
                    # Normalize factors relative to most recent season (2024 or latest available)
                    if era_factors:
                        reference_season = max(era_factors.keys())
                        reference_avg = era_factors[reference_season]
                        
                        # Create normalized factors (1.0 = no adjustment needed)
                        normalized_factors = {}
                        for season, avg in era_factors.items():
                            if reference_avg > 0:
                                normalized_factors[season] = reference_avg / avg
                            else:
                                normalized_factors[season] = 1.0
                        
                        return normalized_factors
                except Exception as e:
                    log_info(f"Error calculating era adjustment for {stat_name}: {e}")
                
                return {}
            
            # Pre-calculate era adjustments for key stats
            era_adjustments = {}
            for stat in base_career_stats:
                if stat not in ['seasons_played', 'games_played']:  # Skip non-statistical fields
                    era_adjustments[stat] = calculate_era_adjustment_factor(position, stat, ALL_HISTORICAL_SEASONS)
            
            # Calculate similarity (career totals + career efficiency)
            similar_players = []
            
            # Helper function to calculate career efficiency metrics (matching season complexity)
            def calc_career_efficiency(player_data, pos):
                metrics = {}
                if pos == 'QB':
                    total_attempts = player_data.get('career_passing_attempts', 0) or 0
                    total_completions = player_data.get('career_completions', 0) or 0
                    total_dropbacks = total_attempts + (player_data.get('career_sacks', 0) or 0)
                    games = player_data.get('games_played', 0) or 1
                    
                    metrics['career_completion_pct'] = (total_completions / total_attempts * 100) if total_attempts > 0 else 0
                    metrics['career_yards_per_attempt'] = (player_data.get('career_passing_yards', 0) or 0) / total_attempts if total_attempts > 0 else 0
                    metrics['career_td_percentage'] = ((player_data.get('career_passing_tds', 0) or 0) / total_attempts * 100) if total_attempts > 0 else 0
                    metrics['career_int_percentage'] = ((player_data.get('career_interceptions', 0) or 0) / total_attempts * 100) if total_attempts > 0 else 0
                    metrics['career_epa_per_dropback'] = (player_data.get('career_passing_epa', 0) or 0) / total_dropbacks if total_dropbacks > 0 else 0
                    metrics['career_air_yards_per_attempt'] = (player_data.get('career_passing_air_yards', 0) or 0) / total_attempts if total_attempts > 0 else 0
                    metrics['career_sack_percentage'] = ((player_data.get('career_sacks', 0) or 0) / total_dropbacks * 100) if total_dropbacks > 0 else 0
                    metrics['career_passing_yards_per_game'] = (player_data.get('career_passing_yards', 0) or 0) / games
                    metrics['career_passing_tds_per_game'] = (player_data.get('career_passing_tds', 0) or 0) / games
                    
                elif pos == 'RB':
                    total_carries = player_data.get('career_carries', 0) or 0
                    total_touches = total_carries + (player_data.get('career_receptions', 0) or 0)
                    total_targets = player_data.get('career_targets', 0) or 0
                    games = player_data.get('games_played', 0) or 1
                    
                    metrics['career_yards_per_carry'] = (player_data.get('career_rushing_yards', 0) or 0) / total_carries if total_carries > 0 else 0
                    metrics['career_rushing_td_rate'] = ((player_data.get('career_rushing_tds', 0) or 0) / total_carries * 100) if total_carries > 0 else 0
                    metrics['career_rushing_epa_per_carry'] = (player_data.get('career_rushing_epa', 0) or 0) / total_carries if total_carries > 0 else 0
                    metrics['career_yards_per_touch'] = ((player_data.get('career_rushing_yards', 0) or 0) + (player_data.get('career_receiving_yards', 0) or 0)) / total_touches if total_touches > 0 else 0
                    metrics['career_receiving_epa_per_target'] = (player_data.get('career_receiving_epa', 0) or 0) / total_targets if total_targets > 0 else 0
                    metrics['career_rushing_yards_per_game'] = (player_data.get('career_rushing_yards', 0) or 0) / games
                    metrics['career_total_tds_per_game'] = ((player_data.get('career_rushing_tds', 0) or 0) + (player_data.get('career_receiving_tds', 0) or 0)) / games
                    
                else:  # WR/TE
                    total_targets = player_data.get('career_targets', 0) or 0
                    total_receptions = player_data.get('career_receptions', 0) or 0
                    total_routes = player_data.get('career_routes', 0) or 0
                    total_air_yards = player_data.get('career_receiving_air_yards', 0) or 0
                    games = player_data.get('games_played', 0) or 1
                    
                    metrics['career_catch_percentage'] = (total_receptions / total_targets * 100) if total_targets > 0 else 0
                    metrics['career_yards_per_target'] = (player_data.get('career_receiving_yards', 0) or 0) / total_targets if total_targets > 0 else 0
                    metrics['career_yards_per_reception'] = (player_data.get('career_receiving_yards', 0) or 0) / total_receptions if total_receptions > 0 else 0
                    metrics['career_yprr'] = (player_data.get('career_receiving_yards', 0) or 0) / total_routes if total_routes > 0 else 0
                    metrics['career_tprr'] = total_targets / total_routes if total_routes > 0 else 0
                    metrics['career_adot'] = total_air_yards / total_targets if total_targets > 0 else 0
                    metrics['career_epa_per_route'] = (player_data.get('career_receiving_epa', 0) or 0) / total_routes if total_routes > 0 else 0
                    metrics['career_td_rate'] = ((player_data.get('career_receiving_tds', 0) or 0) / total_targets * 100) if total_targets > 0 else 0
                    metrics['career_racr'] = (player_data.get('career_receiving_yards', 0) or 0) / total_air_yards if total_air_yards > 0 else 0
                    metrics['career_receiving_yards_per_game'] = (player_data.get('career_receiving_yards', 0) or 0) / games
                    metrics['career_receiving_tds_per_game'] = (player_data.get('career_receiving_tds', 0) or 0) / games
                
                return metrics
            
            # Calculate target player's career efficiency
            target_career_efficiency = calc_career_efficiency(target_player, position)
            
            # Phase 1: Pre-calculate percentile ranks for efficiency metrics (once for all players)
            # Calculate efficiency metrics for all players to get percentile ranks
            all_efficiency_metrics = {}
            for pid, p in career_map.items():
                eff = calc_career_efficiency(p, position)
                all_efficiency_metrics[pid] = eff
            
            # Calculate percentile ranks for each efficiency metric
            efficiency_percentiles = {}
            for metric_key in target_career_efficiency.keys():
                values = [all_efficiency_metrics.get(pid, {}).get(metric_key, 0) for pid in career_map.keys()]
                if values and not all(v == 0 for v in values):
                    sorted_values = sorted(values)
                    n = len(sorted_values)
                    percentile_map = {}
                    for pid in career_map.keys():
                        val = all_efficiency_metrics.get(pid, {}).get(metric_key, 0)
                        if n == 1:
                            percentile_map[pid] = 0.5
                        else:
                            rank = sum(1 for v in sorted_values if v < val)
                            percentile_map[pid] = rank / (n - 1) if n > 1 else 0.5
                    efficiency_percentiles[metric_key] = percentile_map
                else:
                    efficiency_percentiles[metric_key] = {}
            
            # Phase 2: PCA + Cosine Similarity and Clustering Pre-filter
            # Prepare feature matrix for PCA and clustering
            use_phase2 = SKLEARN_AVAILABLE and len(career_map) > 10  # Need enough players for PCA/clustering
            
            if use_phase2:
                try:
                    # Build feature matrix: combine base stats + efficiency metrics
                    feature_names = []
                    feature_matrix = []
                    player_ids_list = []
                    
                    for pid, player in career_map.items():
                        if pid == player_id:
                            continue
                        if player['seasons_played'] < 2:
                            continue
                        if (player.get('career_fantasy_points_ppr', 0) or 0) < 50:
                            continue
                        
                        features = []
                        # Add base stats (with era adjustment)
                        for stat in base_career_stats:
                            val = player.get(stat, 0) or 0
                            # Handle None values (convert to 0)
                            if val is None:
                                val = 0
                            # Handle NaN values
                            if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                                val = 0
                            if stat in era_adjustments and era_adjustments[stat]:
                                avg_era_factor = sum(era_adjustments[stat].values()) / len(era_adjustments[stat]) if era_adjustments[stat] else 1.0
                                val = val * avg_era_factor
                            features.append(float(val))
                        
                        # Add efficiency metrics
                        eff_metrics = all_efficiency_metrics.get(pid, {})
                        for metric_key in sorted(target_career_efficiency.keys()):
                            val = eff_metrics.get(metric_key, 0) or 0
                            # Handle None and NaN values
                            if val is None:
                                val = 0
                            if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                                val = 0
                            features.append(float(val))
                        
                        if len(feature_names) == 0:
                            # First iteration: build feature names
                            feature_names = [f"base_{stat}" for stat in base_career_stats] + [f"eff_{k}" for k in sorted(target_career_efficiency.keys())]
                        
                        feature_matrix.append(features)
                        player_ids_list.append(pid)
                    
                    # Add target player to matrix
                    target_features = []
                    for stat in base_career_stats:
                        val = target_player.get(stat, 0) or 0
                        # Handle None values
                        if val is None:
                            val = 0
                        # Handle NaN values
                        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                            val = 0
                        if stat in era_adjustments and era_adjustments[stat]:
                            avg_era_factor = sum(era_adjustments[stat].values()) / len(era_adjustments[stat]) if era_adjustments[stat] else 1.0
                            val = val * avg_era_factor
                        target_features.append(float(val))
                    for metric_key in sorted(target_career_efficiency.keys()):
                        val = target_career_efficiency.get(metric_key, 0) or 0
                        # Handle None and NaN values
                        if val is None:
                            val = 0
                        if isinstance(val, float) and (np.isnan(val) or np.isinf(val)):
                            val = 0
                        target_features.append(float(val))
                    
                    if len(feature_matrix) > 0 and len(feature_matrix[0]) > 0:
                        # Handle NaN values before PCA (PCA doesn't accept NaN)
                        # Replace NaN with 0 (or median/mean if preferred)
                        all_features = feature_matrix + [target_features]
                        all_features_array = np.array(all_features)
                        
                        # Replace NaN and inf with 0
                        all_features_array = np.nan_to_num(all_features_array, nan=0.0, posinf=0.0, neginf=0.0)
                        
                        # Standardize features
                        scaler = StandardScaler()
                        scaled_features = scaler.fit_transform(all_features_array)
                        
                        # Apply PCA (keep components explaining 90% variance)
                        n_components = min(15, len(feature_names) - 1, len(scaled_features) - 1)
                        if n_components > 0:
                            pca = PCA(n_components=n_components)
                            reduced_features = pca.fit_transform(scaled_features)
                            
                            # Extract target and comparison players
                            target_reduced = reduced_features[-1].reshape(1, -1)
                            comparison_reduced = reduced_features[:-1]
                            
                            # Calculate cosine similarity
                            cosine_similarities = cosine_similarity(target_reduced, comparison_reduced)[0]
                            
                            # Phase 2: Clustering Pre-filter
                            # Cluster players into archetypes (e.g., "possession WR", "deep threat")
                            n_clusters = min(8, len(comparison_reduced) // 3)  # Adaptive cluster count
                            if n_clusters > 1:
                                kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
                                clusters = kmeans.fit_predict(comparison_reduced)
                                target_cluster = kmeans.predict(target_reduced)[0]
                                
                                # Boost similarity for players in same cluster
                                cluster_boost = 0.1  # 10% boost for same cluster
                                for i, cluster_id in enumerate(clusters):
                                    if cluster_id == target_cluster:
                                        cosine_similarities[i] = min(1.0, cosine_similarities[i] + cluster_boost)
                            
                            # Store Phase 2 similarities and metadata
                            phase2_similarities = {}
                            phase2_metadata = {
                                'used': True,
                                'pca_components': n_components,
                                'pca_explained_variance': float(pca.explained_variance_ratio_.sum()),
                                'n_clusters': n_clusters if n_clusters > 1 else 0,
                                'n_players': len(player_ids_list)
                            }
                            for i, pid in enumerate(player_ids_list):
                                # Convert cosine similarity (0-1) to similarity score (0-100)
                                phase2_similarities[pid] = cosine_similarities[i] * 100
                            
                            log_info(f"Phase 2: PCA reduced {len(feature_names)} features to {n_components} components (explained variance: {pca.explained_variance_ratio_.sum():.2%})")
                        else:
                            use_phase2 = False
                            phase2_metadata = {'used': False, 'reason': 'insufficient_components'}
                    else:
                        use_phase2 = False
                        phase2_metadata = {'used': False, 'reason': 'empty_feature_matrix'}
                except Exception as e:
                    log_info(f"Phase 2 calculation failed: {e}, falling back to Phase 1")
                    import traceback
                    traceback.print_exc()
                    use_phase2 = False
                    phase2_metadata = {'used': False, 'reason': f'error: {str(e)}'}
            else:
                phase2_similarities = {}
                if not SKLEARN_AVAILABLE:
                    phase2_metadata = {'used': False, 'reason': 'sklearn_not_available'}
                elif len(career_map) <= 10:
                    phase2_metadata = {'used': False, 'reason': 'insufficient_players', 'n_players': len(career_map)}
                else:
                    phase2_metadata = {'used': False, 'reason': 'unknown'}
            
            for pid, player in career_map.items():
                if pid == player_id:
                    continue
                
                # Skip players with minimal career (matching season similarity filters)
                if player['seasons_played'] < 2:
                    continue
                
                # Skip players with minimal career stats (similar to season similarity's fantasy_points_ppr filter)
                if (player.get('career_fantasy_points_ppr', 0) or 0) < 50:
                    continue
                
                # Calculate similarity using both volume and efficiency metrics
                # Phase 1: Using percentile normalization and era adjustment
                sum_squared_diff = 0
                valid_stats = 0
                
                # Compare base career totals with percentile normalization and era adjustment
                for stat in base_career_stats:
                    val1 = target_player.get(stat, 0) or 0
                    val2 = player.get(stat, 0) or 0
                    
                    # Apply era adjustment if available (normalize for league-wide stat inflation)
                    if stat in era_adjustments and era_adjustments[stat]:
                        # For career totals, use average era adjustment (simplified approach)
                        # In a more sophisticated version, we'd weight by seasons played
                        avg_era_factor = sum(era_adjustments[stat].values()) / len(era_adjustments[stat]) if era_adjustments[stat] else 1.0
                        val1 = val1 * avg_era_factor
                        val2 = val2 * avg_era_factor
                    
                    # Use percentile normalization instead of max-value normalization
                    # This is less sensitive to outliers
                    if stat in percentile_ranks and percentile_ranks[stat]:
                        pct1 = percentile_ranks[stat].get(player_id, 0.5)
                        pct2 = percentile_ranks[stat].get(pid, 0.5)
                        # Percentile difference (0-1 scale)
                        normalized_diff = abs(pct1 - pct2)
                    else:
                        # Fallback to max-value normalization if percentile not available
                        max_val = max(abs(val1), abs(val2), 1)
                        if max_val > 0:
                            normalized_diff = abs(val1 - val2) / max_val
                        else:
                            continue
                    
                    sum_squared_diff += normalized_diff * normalized_diff
                    valid_stats += 1
                
                # Compare career efficiency metrics (weighted more heavily, matching season similarity)
                # Phase 1: Use percentile normalization for efficiency metrics too
                player_career_efficiency = all_efficiency_metrics.get(pid, {})
                efficiency_weight = 1.5  # Efficiency metrics weighted more than volume
                
                for metric_key, metric_val in target_career_efficiency.items():
                    val1 = metric_val
                    val2 = player_career_efficiency.get(metric_key, 0)
                    
                    # Use percentile normalization for efficiency metrics (less sensitive to outliers)
                    if metric_key in efficiency_percentiles and efficiency_percentiles[metric_key]:
                        pct1 = efficiency_percentiles[metric_key].get(player_id, 0.5)
                        pct2 = efficiency_percentiles[metric_key].get(pid, 0.5)
                        normalized_diff = abs(pct1 - pct2)
                    else:
                        # Fallback to max-value normalization if percentile not available
                        if 'pct' in metric_key or 'rate' in metric_key or 'percentage' in metric_key:
                            max_val = max(abs(val1), abs(val2), 1)
                            if max_val > 0:
                                normalized_diff = abs(val1 - val2) / max_val
                            else:
                                continue
                        else:
                            max_val = max(abs(val1), abs(val2), 0.1)
                            if max_val > 0:
                                normalized_diff = abs(val1 - val2) / max_val
                            else:
                                continue
                    
                    # Weight efficiency metrics more heavily (especially EPA)
                    weight = 2.0 if 'epa' in metric_key else (1.8 if 'per_game' in metric_key else efficiency_weight)
                    sum_squared_diff += (normalized_diff * normalized_diff) * weight
                    valid_stats += weight
                
                if valid_stats > 0:
                    # Phase 1 similarity (percentile-based weighted Euclidean)
                    distance = (sum_squared_diff / valid_stats) ** 0.5
                    phase1_similarity = max(0, 100 - (distance * 50))
                    
                    # Phase 2: Combine Phase 1 and Phase 2 similarities if available
                    phase2_sim = None
                    if use_phase2 and pid in phase2_similarities:
                        phase2_sim = phase2_similarities[pid]
                        # Weighted combination: 60% Phase 2 (PCA+Cosine), 40% Phase 1 (percentile-based)
                        similarity = (phase2_sim * 0.6) + (phase1_similarity * 0.4)
                    else:
                        similarity = phase1_similarity
                    
                    # Calculate efficiency metrics for this player to include in response
                    player_efficiency_metrics = calc_career_efficiency(player, position)
                    
                    # Combine base player data with efficiency metrics and similarity score
                    player_result = {
                        **player,
                        **player_efficiency_metrics,  # Include all calculated efficiency metrics (per-game, EPA, etc.)
                        'similarity': similarity,
                        'similarity_phase1': round(phase1_similarity, 2)
                    }
                    
                    # Add Phase 2 info if available
                    if phase2_sim is not None:
                        player_result['similarity_phase2'] = round(phase2_sim, 2)
                        player_result['similarity_method'] = 'phase2_combined'
                    else:
                        player_result['similarity_method'] = 'phase1_only'
                    
                    similar_players.append(player_result)
            
            # Sort and limit
            similar_players.sort(key=lambda x: x['similarity'], reverse=True)
            similar_players = similar_players[:limit]
        
        # Build response with metadata
        response_content = {
            "status": "success",
            "type": type,
            "data": [clean_dict(p) for p in similar_players]
        }
        
        # Add Phase 2 metadata if available
        try:
            if type == 'career' and 'phase2_metadata' in locals():
                response_content['similarity_metadata'] = phase2_metadata
            elif type == 'season' and 'season_phase2_metadata' in locals():
                response_content['similarity_metadata'] = season_phase2_metadata
        except NameError:
            # Metadata not available, skip
            pass
        
        return JSONResponse(content=response_content)
        
    except Exception as e:
        log_error(e, {"endpoint": "similar_players", "player_id": player_id, "position": position, "type": type})
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v1/strength_of_schedule")
async def get_strength_of_schedule(
    season: int = Query(2025, description="Season year"),
    game_type: str = Query("REG", description="Game type: REG (regular season), POST (playoffs), or ALL"),
    use_previous_season_for_projected: bool = Query(True, description="Use previous season ratings for projected SOS (week 0 evaluation)"),
):
    """
    Calculate Strength of Schedule metrics for each team:
    - Projected SOS: Pre-season evaluation (uses previous season final ratings or Vegas win totals)
    - Played SOS: Average opponent rating based on games already played (current season)
    - Remaining SOS: Average opponent rating based on remaining games (current season)
    
    Uses net_epa_per_play as the team rating metric.
    """
    try:
        mod = import_library()
        import json
        
        # Get current season ratings (for Played SOS and Remaining SOS)
        try:
            team_stats_response = await get_team_stats(season, game_type)
            
            # Parse the response body (it's bytes, need to decode)
            if isinstance(team_stats_response.body, bytes):
                body_str = team_stats_response.body.decode('utf-8')
            else:
                body_str = str(team_stats_response.body)
            
            team_stats_json = json.loads(body_str)
            team_stats_list = team_stats_json.get("data", [])
            
            if not team_stats_list:
                print(f"WARNING: team_stats returned empty data. Response status: {team_stats_response.status_code}")
                print(f"Response keys: {list(team_stats_json.keys())}")
                raise HTTPException(status_code=500, detail="No team stats data available for SOS calculation")
        except Exception as e:
            print(f"Error getting team stats for SOS: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to load team stats for SOS: {str(e)}")
        
        # Create a dictionary of current season team ratings (using net_epa_per_play)
        current_season_ratings = {}
        for team in team_stats_list:
            abbr = team.get("abbr")
            if abbr:
                # Use net_epa_per_play as the rating
                rating = team.get("net_epa_per_play")
                if rating is not None:
                    current_season_ratings[abbr] = float(rating)
                else:
                    # Fallback to offensive EPA if net is not available
                    current_season_ratings[abbr] = float(team.get("offensive_epa_per_play", 0.0))
        
        print(f"Loaded {len(current_season_ratings)} current season team ratings")
        
        # Get projected ratings (for Projected SOS - week 0 evaluation)
        # Priority: 1) Vegas win totals, 2) Previous season, 3) Current season
        projected_ratings = {}
        
        # Step 1: Try to load Vegas win totals (best option for pre-season evaluation)
        vegas_ratings = {}
        try:
            import os
            win_totals_path = os.path.join(os.path.dirname(__file__), "vegas_win_totals.json")
            if os.path.exists(win_totals_path):
                with open(win_totals_path, 'r') as f:
                    win_totals_data = json.load(f)
                    season_str = str(season)
                    if season_str in win_totals_data:
                        win_totals = win_totals_data[season_str]
                        print(f"Loaded Vegas win totals for {season}")
                        
                        # Convert win totals to EPA-based ratings
                        # Formula: rating = (win_total - 8.0) * 0.05
                        # This converts win totals (typically 4-13 range) to EPA ratings (roughly -0.2 to +0.25 range)
                        # The 0.05 multiplier is calibrated to match typical EPA ranges
                        for abbr, win_total in win_totals.items():
                            if isinstance(win_total, (int, float)):
                                # Convert win total to rating
                                rating = (float(win_total) - 8.0) * 0.05
                                vegas_ratings[abbr] = rating
                        
                        print(f"Converted {len(vegas_ratings)} win totals to ratings")
                    else:
                        print(f"No Vegas win totals found for season {season} in JSON file")
            else:
                print(f"Vegas win totals file not found at {win_totals_path}")
        except Exception as e:
            print(f"Warning: Could not load Vegas win totals: {e}")
        
        # Step 2: Load previous season ratings as fallback
        previous_season_ratings = {}
        if use_previous_season_for_projected and not vegas_ratings:
            previous_season = season - 1
            print(f"Loading previous season ({previous_season}) ratings for projected SOS...")
            
            try:
                prev_stats_response = await get_team_stats(previous_season, game_type)
                
                if isinstance(prev_stats_response.body, bytes):
                    prev_body_str = prev_stats_response.body.decode('utf-8')
                else:
                    prev_body_str = str(prev_stats_response.body)
                
                prev_stats_json = json.loads(prev_body_str)
                prev_stats_list = prev_stats_json.get("data", [])
                
                for team in prev_stats_list:
                    abbr = team.get("abbr")
                    if abbr:
                        rating = team.get("net_epa_per_play")
                        if rating is not None:
                            previous_season_ratings[abbr] = float(rating)
                        else:
                            previous_season_ratings[abbr] = float(team.get("offensive_epa_per_play", 0.0))
                
                print(f"Loaded {len(previous_season_ratings)} previous season ratings")
                        
            except Exception as e:
                print(f"Warning: Could not load previous season ratings: {e}")
        
        # Step 3: Build final projected_ratings with priority: Vegas > Previous Season > Current Season
        if vegas_ratings:
            # Use Vegas win totals (best option)
            projected_ratings = vegas_ratings.copy()
            print("Using Vegas win totals for projected SOS")
            
            # Fill in any missing teams with previous season, then current season
            for abbr in current_season_ratings:
                if abbr not in projected_ratings:
                    if abbr in previous_season_ratings:
                        projected_ratings[abbr] = previous_season_ratings[abbr]
                    else:
                        projected_ratings[abbr] = current_season_ratings[abbr]
        elif previous_season_ratings:
            # Use previous season ratings
            projected_ratings = previous_season_ratings.copy()
            print("Using previous season ratings for projected SOS")
            
            # Fill in missing teams with current season
            for abbr in current_season_ratings:
                if abbr not in projected_ratings:
                    projected_ratings[abbr] = current_season_ratings[abbr]
        else:
            # Fallback to current season (legacy behavior)
            projected_ratings = current_season_ratings.copy()
            print("Using current season ratings for projected SOS (fallback)")
        
        if len(current_season_ratings) == 0:
            raise HTTPException(status_code=500, detail="No team ratings available - check if PBP data is loaded")
        
        # Debug: Show sample ratings
        sample_current = list(current_season_ratings.items())[:2]
        sample_projected = list(projected_ratings.items())[:2]
        print(f"Sample current season ratings: {sample_current}")
        print(f"Sample projected ratings: {sample_projected}")
        
        # Load schedule data to identify opponents
        schedule_df, _ = call_dataset(mod, "schedules", seasons=[season])
        print(f"Loaded {len(schedule_df)} schedule rows for {season}")
        
        # Filter by game type
        if 'game_type' in schedule_df.columns and game_type != 'ALL':
            if game_type == 'REG':
                schedule_df = schedule_df[schedule_df['game_type'] == 'REG'].copy()
                print(f"Filtered to {len(schedule_df)} regular season games")
            elif game_type == 'POST':
                schedule_df = schedule_df[schedule_df['game_type'].isin(['WC', 'DIV', 'CON', 'SB'])].copy()
                print(f"Filtered to {len(schedule_df)} playoff games")
        
        # Initialize SOS data structure
        sos_data = {}
        all_teams = set()
        
        # Collect all teams and their opponents
        for _, game in schedule_df.iterrows():
            home_team = game.get('home_team')
            away_team = game.get('away_team')
            
            if not home_team or not away_team:
                continue
            
            all_teams.add(home_team)
            all_teams.add(away_team)
            
            # Initialize if needed
            if home_team not in sos_data:
                sos_data[home_team] = {
                    "abbr": home_team,
                    "projected_opponents": [],
                    "played_opponents": [],
                    "remaining_opponents": [],
                }
            if away_team not in sos_data:
                sos_data[away_team] = {
                    "abbr": away_team,
                    "projected_opponents": [],
                    "played_opponents": [],
                    "remaining_opponents": [],
                }
            
            # Add to projected opponents (both teams face each other)
            sos_data[home_team]["projected_opponents"].append(away_team)
            sos_data[away_team]["projected_opponents"].append(home_team)
            
            # Check if game is completed (has scores)
            home_score = game.get('home_score')
            away_score = game.get('away_score')
            is_completed = pd.notna(home_score) and pd.notna(away_score)
            
            if is_completed:
                sos_data[home_team]["played_opponents"].append(away_team)
                sos_data[away_team]["played_opponents"].append(home_team)
            else:
                sos_data[home_team]["remaining_opponents"].append(away_team)
                sos_data[away_team]["remaining_opponents"].append(home_team)
        
        # Calculate SOS metrics for each team
        result = []
        sample_team_logged = False
        for team_abbr in sorted(all_teams):
            if team_abbr not in sos_data:
                continue
            
            team_sos = sos_data[team_abbr]
            
            # Helper function to calculate average opponent rating
            def calc_avg_opp_rating(opponents, ratings_dict):
                if not opponents:
                    return None
                # Get ratings for each opponent, defaulting to 0.0 if not found
                ratings = []
                for opp in opponents:
                    rating = ratings_dict.get(opp, 0.0)
                    ratings.append(rating)
                if not ratings:
                    return None
                return sum(ratings) / len(ratings)
            
            # Calculate SOS metrics
            # Projected SOS uses pre-season ratings (previous season or Vegas)
            projected_sos = calc_avg_opp_rating(team_sos["projected_opponents"], projected_ratings)
            # Played and Remaining SOS use current season ratings
            played_sos = calc_avg_opp_rating(team_sos["played_opponents"], current_season_ratings)
            remaining_sos = calc_avg_opp_rating(team_sos["remaining_opponents"], current_season_ratings)
            
            # Get team's own rating (current season)
            team_rating = current_season_ratings.get(team_abbr, 0.0)
            
            # Debug logging for first team
            if not sample_team_logged:
                print(f"Sample SOS calculation for {team_abbr}:")
                print(f"  Current season team rating: {team_rating}")
                print(f"  Projected rating (for projected SOS): {projected_ratings.get(team_abbr, 'N/A')}")
                print(f"  Projected opponents: {len(team_sos['projected_opponents'])} teams")
                print(f"  Played opponents: {len(team_sos['played_opponents'])} teams")
                print(f"  Remaining opponents: {len(team_sos['remaining_opponents'])} teams")
                print(f"  Projected SOS (using pre-season ratings): {projected_sos}")
                print(f"  Played SOS (using current season ratings): {played_sos}")
                print(f"  Remaining SOS (using current season ratings): {remaining_sos}")
                sample_team_logged = True
            
            # Calculate SOS ranks (1 = hardest schedule, higher = easier)
            # We'll calculate ranks after we have all the data
            result.append({
                "abbr": team_abbr,
                "team_rating": team_rating,
                "projected_sos": projected_sos,
                "played_sos": played_sos,
                "remaining_sos": remaining_sos,
                "projected_opponent_count": len(team_sos["projected_opponents"]),
                "played_opponent_count": len(team_sos["played_opponents"]),
                "remaining_opponent_count": len(team_sos["remaining_opponents"]),
            })
        
        # Calculate ranks (higher SOS = harder schedule, so rank 1 = hardest)
        # Sort by SOS descending for ranking
        result_sorted_projected = sorted([r for r in result if r["projected_sos"] is not None], 
                                        key=lambda x: x["projected_sos"], reverse=True)
        result_sorted_played = sorted([r for r in result if r["played_sos"] is not None], 
                                     key=lambda x: x["played_sos"], reverse=True)
        result_sorted_remaining = sorted([r for r in result if r["remaining_sos"] is not None], 
                                         key=lambda x: x["remaining_sos"], reverse=True)
        
        # Add ranks
        for rank, team_data in enumerate(result_sorted_projected, 1):
            for r in result:
                if r["abbr"] == team_data["abbr"]:
                    r["projected_sos_rank"] = rank
                    break
        
        for rank, team_data in enumerate(result_sorted_played, 1):
            for r in result:
                if r["abbr"] == team_data["abbr"]:
                    r["played_sos_rank"] = rank
                    break
        
        for rank, team_data in enumerate(result_sorted_remaining, 1):
            for r in result:
                if r["abbr"] == team_data["abbr"]:
                    r["remaining_sos_rank"] = rank
                    break
        
        # Set None ranks for teams without data
        for r in result:
            if "projected_sos_rank" not in r:
                r["projected_sos_rank"] = None
            if "played_sos_rank" not in r:
                r["played_sos_rank"] = None
            if "remaining_sos_rank" not in r:
                r["remaining_sos_rank"] = None
        
        return JSONResponse(content={
            "status": "success",
            "season": season,
            "game_type": game_type,
            "teams": len(result),
            "data": [clean_dict(t) for t in result]
        })
        
    except Exception as e:
        log_error(e, {"endpoint": "strength_of_schedule", "season": season, "game_type": game_type})
        raise HTTPException(status_code=500, detail=str(e))


# Articles/Blog Posts API
ARTICLES_FILE = "articles.json"

def load_articles():
    """Load articles from JSON file."""
    try:
        import os
        articles_path = os.path.join(os.path.dirname(__file__), ARTICLES_FILE)
        if os.path.exists(articles_path):
            with open(articles_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("articles", [])
        return []
    except Exception as e:
        print(f"Error loading articles: {e}")
        return []

def save_articles(articles):
    """Save articles to JSON file."""
    try:
        import os
        articles_path = os.path.join(os.path.dirname(__file__), ARTICLES_FILE)
        data = {"articles": articles, "last_updated": datetime.now().isoformat()}
        with open(articles_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving articles: {e}")
        return False

@app.get("/v1/articles")
async def get_articles(
    published_only: bool = Query(True, description="Return only published articles"),
    limit: int = Query(100, description="Maximum number of articles to return"),
    offset: int = Query(0, description="Offset for pagination"),
):
    """
    Get list of articles/blog posts.
    Returns published articles by default, sorted by date (newest first).
    """
    try:
        articles = load_articles()
        
        # Filter by published status
        if published_only:
            articles = [a for a in articles if a.get("published", False)]
        
        # Sort by date (newest first)
        articles.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        # Apply pagination
        total = len(articles)
        articles = articles[offset:offset + limit]
        
        return JSONResponse(content={
            "status": "success",
            "total": total,
            "limit": limit,
            "offset": offset,
            "data": articles
        })
    except Exception as e:
        log_error(e, {"endpoint": "get_articles"})
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/v1/articles/{article_id}")
async def get_article(article_id: str):
    """Get a single article by ID."""
    try:
        articles = load_articles()
        article = next((a for a in articles if a.get("id") == article_id), None)
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Check if published (unless it's the author viewing)
        if not article.get("published", False):
            # In a real app, you'd check authentication here
            # For now, we'll allow viewing unpublished articles
            pass
        
        return JSONResponse(content={
            "status": "success",
            "data": article
        })
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "get_article", "article_id": article_id})
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/articles")
async def create_article(article: dict):
    """Create a new article."""
    try:
        import uuid
        articles = load_articles()
        
        # Generate ID and set timestamps
        article_id = str(uuid.uuid4())
        new_article = {
            "id": article_id,
            "title": article.get("title", ""),
            "excerpt": article.get("excerpt", ""),
            "content": article.get("content", ""),
            "author": article.get("author", "Admin"),
            "published": article.get("published", False),
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "tags": article.get("tags", []),
            "category": article.get("category", "General"),
            "featured_image": article.get("featured_image", ""),
            "slug": article.get("slug") or "".join(c if c.isalnum() or c == "-" else "-" for c in article.get("title", "").lower().replace(" ", "-")),
        }
        
        articles.append(new_article)
        
        if save_articles(articles):
            return JSONResponse(content={
                "status": "success",
                "message": "Article created successfully",
                "data": new_article
            }, status_code=201)
        else:
            raise HTTPException(status_code=500, detail="Failed to save article")
    except Exception as e:
        log_error(e, {"endpoint": "create_article"})
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/v1/articles/{article_id}")
async def update_article(article_id: str, article: dict):
    """Update an existing article."""
    try:
        articles = load_articles()
        article_index = next((i for i, a in enumerate(articles) if a.get("id") == article_id), None)
        
        if article_index is None:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Update article fields
        existing_article = articles[article_index]
        existing_article.update({
            "title": article.get("title", existing_article.get("title")),
            "excerpt": article.get("excerpt", existing_article.get("excerpt")),
            "content": article.get("content", existing_article.get("content")),
            "author": article.get("author", existing_article.get("author")),
            "published": article.get("published", existing_article.get("published")),
            "updated_at": datetime.now().isoformat(),
            "tags": article.get("tags", existing_article.get("tags")),
            "category": article.get("category", existing_article.get("category")),
            "featured_image": article.get("featured_image", existing_article.get("featured_image")),
        })
        
        if save_articles(articles):
            return JSONResponse(content={
                "status": "success",
                "message": "Article updated successfully",
                "data": existing_article
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to save article")
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "update_article", "article_id": article_id})
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/v1/articles/{article_id}")
async def delete_article(article_id: str):
    """Delete an article."""
    try:
        articles = load_articles()
        articles = [a for a in articles if a.get("id") != article_id]
        
        if len(articles) == len(load_articles()):
            raise HTTPException(status_code=404, detail="Article not found")
        
        if save_articles(articles):
            return JSONResponse(content={
                "status": "success",
                "message": "Article deleted successfully"
            })
        else:
            raise HTTPException(status_code=500, detail="Failed to save articles")
    except HTTPException:
        raise
    except Exception as e:
        log_error(e, {"endpoint": "delete_article", "article_id": article_id})
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Convenience local run: uvicorn api:app --reload
    import uvicorn  # type: ignore

    uvicorn.run("api:app", host="127.0.0.1", port=8000, reload=True)

