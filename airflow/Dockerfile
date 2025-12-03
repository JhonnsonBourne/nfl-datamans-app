FROM apache/airflow:2.10.2-python3.11

USER root

# System deps (psycopg2 etc. use prebuilt wheels, so this is minimal)
RUN pip install --no-cache-dir \
    dbt-postgres \
    nflreadpy \
    pandas \
    psycopg2-binary

USER airflow

ENV AIRFLOW_HOME=/opt/airflow

# dbt will look here for profiles; we mount a profiles file from the host
RUN mkdir -p /opt/airflow/.dbt
