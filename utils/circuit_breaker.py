"""
Circuit breaker pattern implementation.

Prevents cascading failures by stopping requests to failing services
and allowing them to recover.
"""

from enum import Enum
from time import time
from typing import Callable, TypeVar, Any, Optional
import logging

logger = logging.getLogger(__name__)
T = TypeVar('T')


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"      # Normal operation - requests pass through
    OPEN = "open"          # Failing - reject all requests immediately
    HALF_OPEN = "half_open"  # Testing - allow one request to test recovery


class CircuitBreaker:
    """
    Circuit breaker to prevent cascading failures.
    
    When failures exceed threshold, circuit opens and rejects requests.
    After recovery timeout, circuit moves to half-open to test recovery.
    If test succeeds, circuit closes; if it fails, circuit reopens.
    
    Example:
        breaker = CircuitBreaker(failure_threshold=5, recovery_timeout=60)
        
        @breaker.call
        def risky_operation():
            # Your code here
            pass
    """
    
    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: int = 60,
        expected_exception: type = Exception,
        name: str = "circuit_breaker"
    ):
        """
        Initialize circuit breaker.
        
        Args:
            failure_threshold: Number of failures before opening circuit
            recovery_timeout: Seconds to wait before testing recovery
            expected_exception: Exception type to catch
            name: Name for logging purposes
        """
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exception = expected_exception
        self.name = name
        
        self.failure_count = 0
        self.last_failure_time: Optional[float] = None
        self.state = CircuitState.CLOSED
        self.success_count = 0  # Track successes in half-open state
    
    def call(self, func: Callable[..., T], *args: Any, **kwargs: Any) -> T:
        """
        Execute function with circuit breaker protection.
        
        Raises:
            Exception: If circuit is open or function fails
        """
        # Check if circuit should transition from OPEN to HALF_OPEN
        if self.state == CircuitState.OPEN:
            if self.last_failure_time and (time() - self.last_failure_time) > self.recovery_timeout:
                self.state = CircuitState.HALF_OPEN
                self.success_count = 0
                logger.info(f"[{self.name}] Circuit breaker: Moving to HALF_OPEN state")
            else:
                raise Exception(
                    f"[{self.name}] Circuit breaker is OPEN - service unavailable. "
                    f"Last failure: {self.last_failure_time}"
                )
        
        # Execute function
        try:
            result = func(*args, **kwargs)
            
            # Success - reset failure count
            if self.state == CircuitState.HALF_OPEN:
                self.success_count += 1
                # Need multiple successes to close circuit
                if self.success_count >= 2:
                    self.state = CircuitState.CLOSED
                    self.failure_count = 0
                    logger.info(f"[{self.name}] Circuit breaker: Service recovered, moving to CLOSED")
            elif self.state == CircuitState.CLOSED:
                # Reset failure count on success
                self.failure_count = 0
            
            return result
            
        except self.expected_exception as e:
            self.failure_count += 1
            self.last_failure_time = time()
            
            if self.state == CircuitState.HALF_OPEN:
                # Failed in half-open - reopen circuit
                self.state = CircuitState.OPEN
                logger.error(
                    f"[{self.name}] Circuit breaker: Reopened after failure in HALF_OPEN state"
                )
            elif self.failure_count >= self.failure_threshold:
                # Too many failures - open circuit
                self.state = CircuitState.OPEN
                logger.error(
                    f"[{self.name}] Circuit breaker: OPENED after {self.failure_count} failures. "
                    f"Last error: {e}"
                )
            
            raise
    
    def reset(self):
        """Manually reset circuit breaker to CLOSED state."""
        self.state = CircuitState.CLOSED
        self.failure_count = 0
        self.last_failure_time = None
        self.success_count = 0
        logger.info(f"[{self.name}] Circuit breaker: Manually reset to CLOSED")
    
    def get_state(self) -> dict:
        """Get current circuit breaker state."""
        return {
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure_time": self.last_failure_time,
            "success_count": self.success_count,
        }


# Global circuit breakers for common services
db_circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60,
    expected_exception=Exception,
    name="database"
)

