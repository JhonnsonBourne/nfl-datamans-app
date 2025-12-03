"""
Improved Airflow DAG with data engineering best practices.

Features:
- Incremental loading
- Retry logic
- Error handling
- Data quality checks
- Monitoring and alerting
- Connection pooling
"""

from __future__ import annotations

import io
import os
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator
from airflow.utils.task_group import TaskGroup

# Import project utilities
import sys
from pathlib import Path

APP_ROOT = Path("/opt/airflow/app")
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from nflread_adapter import import_library, call_dataset  # type: ignore

# Import monitoring utilities (adjust path if needed)
try:
    from airflow.utils.monitoring import (
        send_alert_on_failure,
        log_task_metrics,
        log_data_quality_metrics,
    )
except ImportError:
    # Fallback if monitoring module not available
    def send_alert_on_failure(context):
        import logging
        logging.error(f"Task failed: {context.get('ti', {}).task_id}")
    
    def log_task_metrics(context):
        import logging
        logging.info(f"Task metrics: {context.get('ti', {}).task_id}")
    
    def log_data_quality_metrics(dataset, record_count, quality_checks, context=None):
        import logging
        logging.info(f"Data quality for {dataset}: {record_count} records")


def _get_db_url() -> str:
    """Get database URL for SQLAlchemy."""
    return (
        f"postgresql+psycopg2://"
        f"{os.getenv('NFL_DB_USER', 'airflow')}:"
        f"{os.getenv('NFL_DB_PASSWORD', 'airflow')}@"
        f"{os.getenv('NFL_DB_HOST', 'postgres')}:"
        f"{os.getenv('NFL_DB_PORT', '5432')}/"
        f"{os.getenv('NFL_DB_NAME', 'nfl_datamans')}"
)


def _get_db_engine():
    """Get SQLAlchemy engine with connection pooling."""
    return create_engine(
        _get_db_url(),
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


def load_raw_table_incremental(
    dataset: str,
    seasons: list[int] | None = None,
    incremental_key: str = "season"
) -> dict[str, Any]:
    """
    Load data incrementally using upsert pattern.
    
    Returns:
        Dictionary with load statistics
    """
    from utils.retry import retry_on_db_error
    
    @retry_on_db_error(max_retries=3)
    def _load():
        # 1) Extract from nflverse
        mod = import_library()
        df, func_name = call_dataset(mod, dataset, seasons=seasons)
        
        if df.empty:
            return {"status": "skipped", "reason": "empty_dataframe", "records": 0}
        
        # Normalize column names
        df.columns = [str(c).strip().lower().replace(' ', '_') for c in df.columns]
        
        # 2) Load to PostgreSQL using SQLAlchemy
        engine = _get_db_engine()
        
        # Ensure schema exists
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS raw_nfl;"))
            conn.commit()
        
        # Check if table exists
        table_exists = False
        with engine.connect() as conn:
            result = conn.execute(text("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'raw_nfl' 
                    AND table_name = :table_name
                );
            """), {"table_name": dataset})
            table_exists = result.scalar()
        
        if not table_exists:
            # First load - create table
            df.to_sql(
                dataset,
                engine,
                schema='raw_nfl',
                if_exists='replace',
                index=False,
                method='multi',
                chunksize=10000
            )
            records_loaded = len(df)
            records_updated = 0
        else:
            # Incremental load - use temp table + upsert
            temp_table = f"{dataset}_temp"
            
            # Load to temp table
            df.to_sql(
                temp_table,
                engine,
                schema='raw_nfl',
                if_exists='replace',
                index=False,
                method='multi',
                chunksize=10000
            )
            
            # Determine primary key
            with engine.connect() as conn:
                # Try to find primary key
                result = conn.execute(text("""
                    SELECT column_name 
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                        ON tc.constraint_name = kcu.constraint_name
                    WHERE tc.table_schema = 'raw_nfl'
                        AND tc.table_name = :table_name
                        AND tc.constraint_type = 'PRIMARY KEY'
                    ORDER BY kcu.ordinal_position;
                """), {"table_name": dataset})
                pk_cols = [row[0] for row in result.fetchall()]
            
            if pk_cols and all(col in df.columns for col in pk_cols):
                # Upsert using primary key
                pk_list = ', '.join(pk_cols)
                update_cols = [c for c in df.columns if c not in pk_cols]
                update_set = ', '.join([f"{c} = EXCLUDED.{c}" for c in update_cols])
                
                with engine.connect() as conn:
                    # Get counts before
                    result = conn.execute(text(f"SELECT COUNT(*) FROM raw_nfl.{dataset}"))
                    before_count = result.scalar()
                    
                    # Upsert
                    conn.execute(text(f"""
                        INSERT INTO raw_nfl.{dataset}
                        SELECT * FROM raw_nfl.{temp_table}
                        ON CONFLICT ({pk_list})
                        DO UPDATE SET {update_set};
                    """))
                    conn.commit()
                    
                    # Get counts after
                    result = conn.execute(text(f"SELECT COUNT(*) FROM raw_nfl.{dataset}"))
                    after_count = result.scalar()
                    
                    # Cleanup temp table
                    conn.execute(text(f"DROP TABLE raw_nfl.{temp_table}"))
                    conn.commit()
                
                records_loaded = len(df)
                records_updated = after_count - before_count
            else:
                # No primary key - use merge on incremental_key
                with engine.connect() as conn:
                    # Delete existing records for these seasons/weeks
                    if incremental_key in df.columns:
                        unique_values = df[incremental_key].unique().tolist()
                        placeholders = ', '.join([f":val{i}" for i in range(len(unique_values))])
                        params = {f"val{i}": val for i, val in enumerate(unique_values)}
                        params['table_name'] = dataset
                        
                        conn.execute(text(f"""
                            DELETE FROM raw_nfl.{dataset}
                            WHERE {incremental_key} IN ({placeholders})
                        """), params)
                    
                    # Insert new records
                    df.to_sql(
                        dataset,
                        engine,
                        schema='raw_nfl',
                        if_exists='append',
                        index=False,
                        method='multi',
                        chunksize=10000
                    )
                    conn.commit()
                    
                    # Cleanup temp table
                    conn.execute(text(f"DROP TABLE raw_nfl.{temp_table}"))
                    conn.commit()
                
                records_loaded = len(df)
                records_updated = records_loaded
        
        engine.dispose()
        
        return {
            "status": "success",
            "records_loaded": records_loaded,
            "records_updated": records_updated,
            "function": func_name,
        }
    
    return _load()


def run_data_quality_checks(dataset: str, **context: Any) -> dict[str, Any]:
    """Run data quality checks on loaded data."""
    engine = _get_db_engine()
    
    quality_results = {}
    
    try:
        with engine.connect() as conn:
            # Check record count
            result = conn.execute(text(f"SELECT COUNT(*) FROM raw_nfl.{dataset}"))
            record_count = result.scalar()
            quality_results['record_count'] = record_count
            
            # Check for nulls in critical columns
            if dataset == 'player_stats':
                result = conn.execute(text("""
                    SELECT 
                        COUNT(*) FILTER (WHERE player_id IS NULL) as null_player_id,
                        COUNT(*) FILTER (WHERE season IS NULL) as null_season,
                        COUNT(*) FILTER (WHERE position IS NULL) as null_position
                    FROM raw_nfl.player_stats
                """))
                row = result.fetchone()
                quality_results['null_checks'] = {
                    'player_id': row[0],
                    'season': row[1],
                    'position': row[2],
                }
            
            # Check value ranges
            if dataset == 'player_stats':
                result = conn.execute(text("""
                    SELECT 
                        COUNT(*) FILTER (WHERE passing_yards < 0 OR passing_yards > 10000) as invalid_passing,
                        COUNT(*) FILTER (WHERE rushing_yards < 0 OR rushing_yards > 5000) as invalid_rushing,
                        COUNT(*) FILTER (WHERE season < 1999 OR season > 2030) as invalid_seasons
                    FROM raw_nfl.player_stats
                """))
                row = result.fetchone()
                quality_results['range_checks'] = {
                    'invalid_passing_yards': row[0],
                    'invalid_rushing_yards': row[1],
                    'invalid_seasons': row[2],
                }
            
            # Log quality metrics
            log_data_quality_metrics(
                dataset=dataset,
                record_count=record_count,
                quality_checks=quality_results,
                context=context
            )
            
            # Fail if critical issues
            if quality_results.get('null_checks', {}).get('player_id', 0) > 0:
                raise ValueError("Data quality check failed: null player_id values found")
            
    finally:
        engine.dispose()
    
    return quality_results


def load_player_stats(**context: Any) -> None:
    """Load player stats with incremental strategy."""
    seasons = [2023, 2024, 2025]
    result = load_raw_table_incremental("player_stats", seasons=seasons, incremental_key="season")
    print(f"Player stats load result: {result}")


def load_schedules(**context: Any) -> None:
    """Load schedules with incremental strategy."""
    seasons = [2023, 2024, 2025]
    result = load_raw_table_incremental("schedules", seasons=seasons, incremental_key="season")
    print(f"Schedules load result: {result}")


default_args = {
    "owner": "data_engineering",
    "depends_on_past": False,
    "email_on_failure": False,
    "email_on_retry": False,
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "on_failure_callback": send_alert_on_failure,
    "on_success_callback": log_task_metrics,
}


with DAG(
    dag_id="nfl_datamans_dbt_improved",
    default_args=default_args,
    description="Load raw nflverse data and run dbt staging models (improved)",
    schedule_interval="0 6 * * *",  # Daily at 6am UTC
    start_date=datetime(2025, 1, 1),
    catchup=False,
    max_active_runs=1,
    tags=["nfl", "dbt", "nflverse", "improved"],
) as dag:

    with TaskGroup("load_raw_data") as load_group:
        load_player_stats_task = PythonOperator(
            task_id="load_player_stats",
            python_callable=load_player_stats,
        )

        load_schedules_task = PythonOperator(
            task_id="load_schedules",
            python_callable=load_schedules,
        )

    with TaskGroup("data_quality") as quality_group:
        quality_player_stats = PythonOperator(
            task_id="quality_check_player_stats",
            python_callable=run_data_quality_checks,
            op_kwargs={"dataset": "player_stats"},
        )

        quality_schedules = PythonOperator(
            task_id="quality_check_schedules",
            python_callable=run_data_quality_checks,
            op_kwargs={"dataset": "schedules"},
        )

    dbt_run_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command=(
            "cd /opt/airflow/dbt/nfl_datamans && "
            "dbt run --select stg_player_stats stg_schedules"
        ),
    )

    dbt_test = BashOperator(
        task_id="dbt_test",
        bash_command=(
            "cd /opt/airflow/dbt/nfl_datamans && "
            "dbt test --select stg_player_stats stg_schedules"
        ),
    )

    # Task dependencies
    load_group >> quality_group >> dbt_run_staging >> dbt_test

