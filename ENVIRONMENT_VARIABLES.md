# Environment Variables Documentation

This document describes all environment variables used in the NFL DataMans application.

## Database Configuration

### `NFL_DB_HOST`
- **Description**: PostgreSQL database hostname
- **Default**: `localhost` (local) / `postgres` (Docker)
- **Example**: `postgres`, `localhost`, `db.example.com`
- **Used in**: API, Airflow, dbt

### `NFL_DB_PORT`
- **Description**: PostgreSQL database port
- **Default**: `5432`
- **Example**: `5432`
- **Used in**: API, Airflow, dbt

### `NFL_DB_NAME`
- **Description**: PostgreSQL database name
- **Default**: `nfl_datamans`
- **Example**: `nfl_datamans`
- **Used in**: API, Airflow, dbt

### `NFL_DB_USER`
- **Description**: PostgreSQL database username
- **Default**: `airflow`
- **Example**: `airflow`, `nfl_user`
- **Used in**: API, Airflow, dbt

### `NFL_DB_PASSWORD`
- **Description**: PostgreSQL database password
- **Default**: `airflow` (development only - change in production!)
- **Example**: `secure_password_123`
- **Used in**: API, Airflow, dbt
- **Security**: ⚠️ **Never commit passwords to version control!**

### `NFL_DB_SSLMODE`
- **Description**: PostgreSQL SSL mode
- **Default**: `prefer`
- **Options**: `disable`, `allow`, `prefer`, `require`, `verify-ca`, `verify-full`
- **Used in**: dbt profiles

## Airflow Configuration

### `AIRFLOW__CORE__EXECUTOR`
- **Description**: Airflow executor type
- **Default**: `LocalExecutor`
- **Options**: `SequentialExecutor`, `LocalExecutor`, `CeleryExecutor`
- **Used in**: Airflow docker-compose

### `AIRFLOW__CORE__SQL_ALCHEMY_CONN`
- **Description**: Airflow metadata database connection string
- **Default**: `postgresql+psycopg2://airflow:airflow@postgres:5432/nfl_datamans`
- **Format**: `postgresql+psycopg2://user:password@host:port/database`
- **Used in**: Airflow docker-compose

### `AIRFLOW__CORE__LOAD_EXAMPLES`
- **Description**: Whether to load example DAGs
- **Default**: `False`
- **Options**: `True`, `False`
- **Used in**: Airflow docker-compose

### `PYTHONPATH`
- **Description**: Python path for Airflow to find project modules
- **Default**: `/opt/airflow/app`
- **Used in**: Airflow docker-compose

## API Configuration

### `API_HOST`
- **Description**: API server host
- **Default**: `0.0.0.0`
- **Example**: `0.0.0.0`, `localhost`
- **Used in**: API startup

### `API_PORT`
- **Description**: API server port
- **Default**: `8000`
- **Example**: `8000`, `8080`
- **Used in**: API startup

## dbt Configuration

### `DBT_PROFILES_DIR`
- **Description**: Directory containing dbt profiles.yml
- **Default**: `/opt/airflow/.dbt`
- **Example**: `/opt/airflow/.dbt`, `~/.dbt`
- **Used in**: Airflow, dbt commands

## Optional: Monitoring & Alerting

### `SLACK_WEBHOOK_URL`
- **Description**: Slack webhook URL for alerts
- **Default**: Not set
- **Example**: `https://hooks.slack.com/services/YOUR/WEBHOOK/URL`
- **Used in**: Airflow monitoring utilities
- **Optional**: Yes

### `SENTRY_DSN`
- **Description**: Sentry DSN for error tracking
- **Default**: Not set
- **Example**: `https://your-sentry-dsn@sentry.io/project-id`
- **Used in**: Error tracking (if implemented)
- **Optional**: Yes

### `REDIS_URL`
- **Description**: Redis connection URL for caching
- **Default**: Not set
- **Example**: `redis://localhost:6379/0`
- **Used in**: Caching layer (if implemented)
- **Optional**: Yes

## Optional: Feature Flags

### `USE_POSTGRES_API`
- **Description**: Enable PostgreSQL-based API endpoints
- **Default**: `false`
- **Options**: `true`, `false`
- **Used in**: API feature flags
- **Optional**: Yes

### `ENABLE_CACHING`
- **Description**: Enable Redis caching
- **Default**: `false`
- **Options**: `true`, `false`
- **Used in**: Caching layer
- **Optional**: Yes

### `ENABLE_MONITORING`
- **Description**: Enable detailed monitoring
- **Default**: `true`
- **Options**: `true`, `false`
- **Used in**: Monitoring utilities
- **Optional**: Yes

## Setting Environment Variables

### Local Development

Create a `.env` file in the project root:

```bash
# .env
NFL_DB_HOST=localhost
NFL_DB_PORT=5432
NFL_DB_NAME=nfl_datamans
NFL_DB_USER=airflow
NFL_DB_PASSWORD=your_password_here
```

Load with:
```bash
export $(cat .env | xargs)
```

Or use `python-dotenv`:
```python
from dotenv import load_dotenv
load_dotenv()
```

### Docker Compose

Set in `docker-compose.yaml` or use `.env` file:

```yaml
services:
  airflow-webserver:
    env_file:
      - .env
    environment:
      NFL_DB_HOST: ${NFL_DB_HOST:-postgres}
```

### Production

Use your platform's environment variable management:
- **Render**: Environment variables in dashboard
- **Heroku**: `heroku config:set KEY=value`
- **AWS**: Parameter Store or Secrets Manager
- **Kubernetes**: ConfigMaps and Secrets

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Use secrets management** - AWS Secrets Manager, HashiCorp Vault, etc.
3. **Rotate passwords regularly** - Especially in production
4. **Use different credentials** - For dev, staging, and production
5. **Limit access** - Only grant necessary permissions
6. **Use SSL/TLS** - Set `NFL_DB_SSLMODE=require` in production

## Example `.env` File

```bash
# Database Configuration
NFL_DB_HOST=localhost
NFL_DB_PORT=5432
NFL_DB_NAME=nfl_datamans
NFL_DB_USER=airflow
NFL_DB_PASSWORD=change_me_in_production
NFL_DB_SSLMODE=prefer

# Airflow Configuration
AIRFLOW__CORE__EXECUTOR=LocalExecutor
AIRFLOW__CORE__LOAD_EXAMPLES=False

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Optional: Monitoring
# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
# SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# Optional: Feature Flags
USE_POSTGRES_API=false
ENABLE_CACHING=false
ENABLE_MONITORING=true
```

## Validation

To validate your environment variables are set correctly:

```bash
# Check database connection
python -c "from database.connection import engine; print('✅ Database config OK')"

# Check all required vars
python -c "
import os
required = ['NFL_DB_HOST', 'NFL_DB_NAME', 'NFL_DB_USER', 'NFL_DB_PASSWORD']
missing = [v for v in required if not os.getenv(v)]
print('✅ All required vars set' if not missing else f'❌ Missing: {missing}')
"
```

