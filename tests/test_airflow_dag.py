from pathlib import Path

import pytest


airflow = pytest.importorskip("airflow")  # skip tests if Airflow is not installed in this environment
from airflow.models import DagBag  # type: ignore  # noqa: E402


def _get_dag_bag() -> DagBag:
    dags_path = Path(__file__).parents[1] / "airflow" / "dags"
    return DagBag(dag_folder=str(dags_path), include_examples=False)


def test_dag_loaded():
    dagbag = _get_dag_bag()
    dag = dagbag.get_dag("nfl_datamans_dbt")
    assert dag is not None
    assert dag.dag_id == "nfl_datamans_dbt"


def test_dag_tasks_present():
    dagbag = _get_dag_bag()
    dag = dagbag.get_dag("nfl_datamans_dbt")
    task_ids = set(dag.task_ids)
    assert {"load_player_stats", "load_schedules", "dbt_run_staging"}.issubset(task_ids)


def test_dag_dependencies():
    dagbag = _get_dag_bag()
    dag = dagbag.get_dag("nfl_datamans_dbt")
    assert dag.get_task("dbt_run_staging").upstream_task_ids == {"load_player_stats", "load_schedules"}
