"""
Retry utilities with exponential backoff.

Provides decorators for retrying operations with configurable
backoff strategies.
"""

from functools import wraps
from time import sleep
import logging
from typing import Callable, TypeVar, Any, Tuple, Type

logger = logging.getLogger(__name__)
T = TypeVar('T')


def retry_with_backoff(
    max_retries: int = 3,
    initial_delay: float = 1.0,
    backoff_factor: float = 2.0,
    exceptions: Tuple[Type[Exception], ...] = (Exception,),
    on_retry: Callable[[Exception, int], None] = None,
):
    """
    Retry decorator with exponential backoff.
    
    Args:
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds before first retry
        backoff_factor: Multiplier for delay between retries
        exceptions: Tuple of exception types to catch and retry
        on_retry: Optional callback function called on each retry
                  Signature: (exception, attempt_number) -> None
    
    Example:
        @retry_with_backoff(max_retries=3, exceptions=(ConnectionError,))
        def fetch_data():
            # Your code here
            pass
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            delay = initial_delay
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {e}. "
                            f"Retrying in {delay}s..."
                        )
                        if on_retry:
                            try:
                                on_retry(e, attempt + 1)
                            except Exception:
                                pass
                        sleep(delay)
                        delay *= backoff_factor
                    else:
                        logger.error(
                            f"All {max_retries} attempts failed for {func.__name__}. "
                            f"Last error: {e}"
                        )
            
            if last_exception:
                raise last_exception
            raise Exception(f"Failed after {max_retries} attempts")
        return wrapper
    return decorator


def retry_on_db_error(
    max_retries: int = 3,
    initial_delay: float = 1.0,
):
    """
    Convenience decorator for database operations.
    
    Retries on common database errors:
    - OperationalError (connection issues)
    - InterfaceError (connection lost)
    - DatabaseError (general database errors)
    """
    from psycopg2 import OperationalError, InterfaceError, DatabaseError
    
    return retry_with_backoff(
        max_retries=max_retries,
        initial_delay=initial_delay,
        exceptions=(OperationalError, InterfaceError, DatabaseError),
    )

