PYTHON := python3

.PHONY: test test-api test-airflow-dag test-dbt

## Run all Python tests
test:
	pytest

## Run only API tests
test-api:
	pytest tests/test_api_basic.py

## Run Airflow DAG structure tests (requires airflow installed in env)
test-airflow-dag:
	pytest tests/test_airflow_dag.py

## Run dbt tests inside the dbt project (expects dbt installed and Postgres running)
test-dbt:
	cd dbt/nfl_datamans && dbt test
