"""
Performance monitoring and timing utilities.

Tracks request timing, identifies bottlenecks, and logs slow operations.
"""

import time
import functools
import logging
from typing import Callable, Any, Dict, Optional
from collections import defaultdict, deque
from datetime import datetime

logger = logging.getLogger(__name__)

# Store performance metrics
PERFORMANCE_METRICS = deque(maxlen=1000)  # Last 1000 operations
SLOW_OPERATIONS = deque(maxlen=100)  # Operations taking > 1 second
ENDPOINT_TIMINGS = defaultdict(list)  # Timings by endpoint


class PerformanceTimer:
    """Context manager for timing operations."""
    
    def __init__(self, operation_name: str, threshold_ms: float = 1000.0):
        self.operation_name = operation_name
        self.threshold_ms = threshold_ms
        self.start_time = None
        self.end_time = None
        self.duration_ms = None
    
    def __enter__(self):
        self.start_time = time.perf_counter()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.end_time = time.perf_counter()
        self.duration_ms = (self.end_time - self.start_time) * 1000
        
        # Log if slow
        if self.duration_ms > self.threshold_ms:
            logger.warning(
                f"⏱️  SLOW OPERATION: {self.operation_name} took {self.duration_ms:.2f}ms "
                f"(threshold: {self.threshold_ms}ms)"
            )
            SLOW_OPERATIONS.append({
                "operation": self.operation_name,
                "duration_ms": self.duration_ms,
                "timestamp": datetime.now().isoformat(),
            })
        
        # Store metric
        PERFORMANCE_METRICS.append({
            "operation": self.operation_name,
            "duration_ms": self.duration_ms,
            "timestamp": datetime.now().isoformat(),
        })
        
        return False


def time_operation(operation_name: Optional[str] = None, threshold_ms: float = 1000.0):
    """
    Decorator to time function execution.
    
    Usage:
        @time_operation("load_player_stats", threshold_ms=500)
        def load_player_stats():
            ...
    """
    def decorator(func: Callable) -> Callable:
        name = operation_name or f"{func.__module__}.{func.__name__}"
        
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            with PerformanceTimer(name, threshold_ms):
                return func(*args, **kwargs)
        
        return wrapper
    return decorator


def track_endpoint_timing(endpoint_path: str):
    """Decorator to track endpoint response times."""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            start = time.perf_counter()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.perf_counter() - start) * 1000
                ENDPOINT_TIMINGS[endpoint_path].append(duration_ms)
                
                if duration_ms > 2000:  # Log slow endpoints
                    logger.warning(
                        f"🐌 SLOW ENDPOINT: {endpoint_path} took {duration_ms:.2f}ms"
                    )
                
                return result
            except Exception as e:
                duration_ms = (time.perf_counter() - start) * 1000
                logger.error(
                    f"❌ ENDPOINT ERROR: {endpoint_path} failed after {duration_ms:.2f}ms: {e}"
                )
                raise
        
        return wrapper
    return decorator


def get_performance_summary() -> Dict[str, Any]:
    """Get summary of performance metrics."""
    if not PERFORMANCE_METRICS:
        return {"message": "No metrics collected yet"}
    
    # Calculate statistics
    durations = [m["duration_ms"] for m in PERFORMANCE_METRICS]
    
    return {
        "total_operations": len(PERFORMANCE_METRICS),
        "slow_operations": len(SLOW_OPERATIONS),
        "avg_duration_ms": sum(durations) / len(durations) if durations else 0,
        "min_duration_ms": min(durations) if durations else 0,
        "max_duration_ms": max(durations) if durations else 0,
        "p50_duration_ms": sorted(durations)[len(durations) // 2] if durations else 0,
        "p95_duration_ms": sorted(durations)[int(len(durations) * 0.95)] if durations else 0,
        "p99_duration_ms": sorted(durations)[int(len(durations) * 0.99)] if durations else 0,
        "recent_slow_operations": list(SLOW_OPERATIONS)[-10:],
        "endpoint_stats": {
            endpoint: {
                "count": len(timings),
                "avg_ms": sum(timings) / len(timings) if timings else 0,
                "min_ms": min(timings) if timings else 0,
                "max_ms": max(timings) if timings else 0,
                "p95_ms": sorted(timings)[int(len(timings) * 0.95)] if timings else 0,
            }
            for endpoint, timings in ENDPOINT_TIMINGS.items()
        }
    }


def get_slow_operations(limit: int = 20) -> list:
    """Get recent slow operations."""
    return list(SLOW_OPERATIONS)[-limit:]


def reset_metrics():
    """Reset all performance metrics (for testing)."""
    global PERFORMANCE_METRICS, SLOW_OPERATIONS, ENDPOINT_TIMINGS
    PERFORMANCE_METRICS.clear()
    SLOW_OPERATIONS.clear()
    ENDPOINT_TIMINGS.clear()

