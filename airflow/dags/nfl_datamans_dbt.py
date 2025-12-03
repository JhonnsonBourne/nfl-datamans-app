"""Airflow DAG: load raw nflverse data into Postgres and run dbt staging models.

This DAG does three main things:
1. Uses your existing nflread_adapter to pull player_stats and schedules from nflverse.
2. Writes them into Postgres tables in schema raw_nfl (player_stats, schedules).
3. Runs dbt to build the staging views (stg_player_stats, stg_schedules).
"""

from __future__ import annotations

import io
import os
from datetime import datetime, timedelta

import pandas as pd
import psycopg2
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.operators.bash import BashOperator

# Ensure we can import your project code (nflread_adapter) from /opt/airflow/app
import sys
from pathlib import Path

APP_ROOT = Path("/opt/airflow/app")
if str(APP_ROOT) not in sys.path:
    sys.path.insert(0, str(APP_ROOT))

from nflread_adapter import import_library, call_dataset  # type: ignore

# Phase 1: Import retry utilities
try:
    from utils.retry import retry_on_db_error
    RETRY_AVAILABLE = True
except ImportError:
    RETRY_AVAILABLE = False
    print("Warning: Retry utilities not available")


def _get_db_conn():
    """Create a psycopg2 connection to the warehouse Postgres DB.

    Uses env vars set in docker-compose:
      NFL_DB_HOST, NFL_DB_PORT, NFL_DB_NAME, NFL_DB_USER, NFL_DB_PASSWORD
    """

    host = os.getenv("NFL_DB_HOST", "localhost")
    port = int(os.getenv("NFL_DB_PORT", "5432"))
    dbname = os.getenv("NFL_DB_NAME", "nfl_datamans")
    user = os.getenv("NFL_DB_USER", "airflow")
    password = os.getenv("NFL_DB_PASSWORD", "airflow")

    conn = psycopg2.connect(
        host=host,
        port=port,
        dbname=dbname,
        user=user,
        password=password,
    )
    conn.autocommit = True
    return conn


@retry_on_db_error(max_retries=3) if RETRY_AVAILABLE else lambda f: f
def load_raw_table(dataset: str, seasons: list[int] | None = None) -> None:
    """Extract a dataset from nflverse and load it into raw_nfl.<dataset>.

    - Uses nflread_adapter.import_library + call_dataset
    - Drops and recreates the target table each run (good enough for dev)
    - Includes retry logic for database operations
    """

    # 1) Extract from nflverse via your adapter
    mod = import_library()
    df, func_name = call_dataset(mod, dataset, seasons=seasons)

    # Normalize column names to snake_case-ish and avoid uppercase
    df.columns = [str(c).strip() for c in df.columns]

    # 2) Connect to Postgres
    conn = _get_db_conn()
    cur = conn.cursor()

    # Ensure schema exists
    cur.execute("CREATE SCHEMA IF NOT EXISTS raw_nfl;")

    # Drop existing table (dev-friendly; for prod you'd want an incremental pattern)
    cur.execute(f"DROP TABLE IF EXISTS raw_nfl.{dataset} CASCADE;")

    # 3) Create table with simple inferred types
    #    We let Postgres infer types via COPY FROM CSV.
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False)
    csv_buf.seek(0)

    # Create a temporary table, then move it into place
    temp_table = f"raw_nfl.{dataset}_temp"
    cur.execute(f"DROP TABLE IF EXISTS {temp_table} CASCADE;")
    cur.execute(f"CREATE TABLE {temp_table} (LIKE raw_nfl.{dataset} INCLUDING ALL);") if False else None  # placeholder

    # Since the table doesn't exist yet, we can create it using COPY with a simple CREATE TABLE AS
    cur.execute(f"CREATE TABLE {temp_table} AS SELECT * FROM (SELECT * FROM (VALUES (NULL)) AS t(dummy)) AS base WHERE 1=0;")

    # COPY directly into the final table name by first creating it using df's header
    cur.execute(f"DROP TABLE IF EXISTS {temp_table} CASCADE;")
    cur.execute(f"CREATE TABLE {temp_table} ()")

    # Easiest dev path: let pandas_sql handle type inference using to_sql via SQLAlchemy.
    # To avoid adding SQLAlchemy as a dependency right now, we instead use a simpler pattern:
    #  - Create the table using a single-row sample
    #  - Then truncate and bulk-load all rows via COPY

    # For simplicity and robustness, we just recreate pure from CSV using COPY and an auto-created table.
    # This requires a bit more plumbing; for now, we use a minimal pattern:

    # 1) Create a temporary CSV file-like object
    csv_buf.seek(0)
    cur.copy_expert(f"COPY raw_nfl.{dataset} FROM STDIN WITH CSV HEADER", csv_buf)

    cur.close()
    conn.close()


def load_player_stats_2025(**context) -> None:  # noqa: ARG001
    # Example: load the last few seasons; you can tune this later
    seasons = [2023, 2024, 2025]
    load_raw_table("player_stats", seasons=seasons)


def load_schedules_2025(**context) -> None:  # noqa: ARG001
    seasons = [2023, 2024, 2025]
    load_raw_table("schedules", seasons=seasons)


default_args = {
    "owner": "airflow",
    "depends_on_past": False,
    "retries": 1,
    "retry_delay": timedelta(minutes=5),
}


with DAG(
    dag_id="nfl_datamans_dbt",
    default_args=default_args,
    description="Load raw nflverse data and run dbt staging models",
    schedule_interval="0 6 * * *",  # every day at 6am UTC
    start_date=datetime(2025, 1, 1),
    catchup=False,
    tags=["nfl", "dbt", "nflverse"],
) as dag:

    load_player_stats = PythonOperator(
        task_id="load_player_stats",
        python_callable=load_player_stats_2025,
        provide_context=True,
    )

    load_schedules = PythonOperator(
        task_id="load_schedules",
        python_callable=load_schedules_2025,
        provide_context=True,
    )

    dbt_run_staging = BashOperator(
        task_id="dbt_run_staging",
        bash_command=(
            "cd /opt/airflow/dbt/nfl_datamans && "
            "dbt run --select stg_player_stats stg_schedules"
        ),
    )

    [load_player_stats, load_schedules] >> dbt_run_staging
