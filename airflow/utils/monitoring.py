"""
Monitoring and alerting utilities for Airflow.

Provides functions for logging metrics, sending alerts,
and tracking task performance.
"""

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from airflow.models import TaskInstance
from airflow.utils.state import TaskInstanceState

logger = logging.getLogger(__name__)


def send_alert_on_failure(context: Dict[str, Any]) -> None:
    """
    Send alert when Airflow task fails.
    
    This function is called by Airflow's on_failure_callback.
    
    Args:
        context: Airflow task context dictionary
    """
    ti: TaskInstance = context.get('ti')
    if not ti:
        logger.error("No TaskInstance in context")
        return
    
    dag_id = ti.dag_id
    task_id = ti.task_id
    execution_date = context.get('execution_date', 'unknown')
    exception = context.get('exception')
    
    error_message = f"""
🚨 Airflow Task Failed

DAG: {dag_id}
Task: {task_id}
Execution Date: {execution_date}
Exception: {exception}

Log URL: {ti.log_url if hasattr(ti, 'log_url') else 'N/A'}

Please check the Airflow UI for details.
"""
    
    logger.error(error_message)
    
    # TODO: Integrate with alerting service
    # Examples:
    # - Slack webhook
    # - Email via SMTP
    # - PagerDuty API
    # - Custom webhook
    
    # Example Slack integration:
    # try:
    #     import requests
    #     slack_webhook = os.getenv('SLACK_WEBHOOK_URL')
    #     if slack_webhook:
    #         requests.post(slack_webhook, json={'text': error_message})
    # except Exception as e:
    #     logger.error(f"Failed to send Slack alert: {e}")


def log_task_metrics(context: Dict[str, Any]) -> None:
    """
    Log task execution metrics for monitoring.
    
    Args:
        context: Airflow task context dictionary
    """
    ti: TaskInstance = context.get('ti')
    if not ti:
        return
    
    metrics = {
        'dag_id': ti.dag_id,
        'task_id': ti.task_id,
        'duration_seconds': ti.duration if hasattr(ti, 'duration') else None,
        'state': ti.state,
        'execution_date': str(context.get('execution_date', '')),
        'start_date': str(ti.start_date) if hasattr(ti, 'start_date') else None,
        'end_date': str(ti.end_date) if hasattr(ti, 'end_date') else None,
        'try_number': ti.try_number if hasattr(ti, 'try_number') else None,
    }
    
    logger.info(f"Task metrics: {metrics}")
    
    # TODO: Send to monitoring system
    # Examples:
    # - Prometheus metrics
    # - DataDog stats
    # - CloudWatch metrics
    # - Custom metrics endpoint


def log_data_quality_metrics(
    dataset: str,
    record_count: int,
    quality_checks: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None
) -> None:
    """
    Log data quality metrics after data load.
    
    Args:
        dataset: Name of the dataset
        record_count: Number of records loaded
        quality_checks: Dictionary of quality check results
        context: Optional Airflow context
    """
    metrics = {
        'dataset': dataset,
        'record_count': record_count,
        'quality_checks': quality_checks,
        'timestamp': datetime.now().isoformat(),
    }
    
    if context:
        ti = context.get('ti')
        if ti:
            metrics['dag_id'] = ti.dag_id
            metrics['task_id'] = ti.task_id
            metrics['execution_date'] = str(context.get('execution_date', ''))
    
    logger.info(f"Data quality metrics: {metrics}")
    
    # Check for quality issues
    issues = []
    for check_name, check_result in quality_checks.items():
        if isinstance(check_result, dict):
            if check_result.get('status') == 'failed':
                issues.append(f"{check_name}: {check_result.get('message', 'Failed')}")
    
    if issues:
        logger.warning(f"Data quality issues detected for {dataset}: {', '.join(issues)}")
        # TODO: Send alert if critical issues found


def track_api_performance(
    endpoint: str,
    duration_ms: float,
    status_code: int,
    record_count: Optional[int] = None
) -> None:
    """
    Track API endpoint performance metrics.
    
    Args:
        endpoint: API endpoint path
        duration_ms: Request duration in milliseconds
        status_code: HTTP status code
        record_count: Number of records returned (optional)
    """
    metrics = {
        'endpoint': endpoint,
        'duration_ms': duration_ms,
        'status_code': status_code,
        'record_count': record_count,
        'timestamp': datetime.now().isoformat(),
    }
    
    logger.info(f"API performance: {metrics}")
    
    # Alert on slow queries
    if duration_ms > 5000:  # 5 seconds
        logger.warning(f"Slow API endpoint detected: {endpoint} took {duration_ms}ms")
    
    # Alert on errors
    if status_code >= 400:
        logger.error(f"API error: {endpoint} returned {status_code}")

