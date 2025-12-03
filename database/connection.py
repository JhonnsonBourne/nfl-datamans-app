"""
Database connection pooling and session management.

This module provides SQLAlchemy engine with connection pooling
and FastAPI dependency for database sessions.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool
from sqlalchemy.orm import sessionmaker, Session
from typing import Generator

# Build database URL from environment variables
DATABASE_URL = (
    f"postgresql+psycopg2://"
    f"{os.getenv('NFL_DB_USER', 'airflow')}:"
    f"{os.getenv('NFL_DB_PASSWORD', 'airflow')}@"
    f"{os.getenv('NFL_DB_HOST', 'localhost')}:"
    f"{os.getenv('NFL_DB_PORT', '5432')}/"
    f"{os.getenv('NFL_DB_NAME', 'nfl_datamans')}"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=10,              # Number of connections to maintain
    max_overflow=20,           # Additional connections if pool is exhausted
    pool_pre_ping=True,        # Verify connections before using
    pool_recycle=3600,         # Recycle connections after 1 hour
    echo=False,                # Set to True for SQL logging (dev only)
    connect_args={
        "connect_timeout": 10,
        "application_name": "nfl_datamans_api",
    }
)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency to get database session.
    
    Usage:
        @app.get("/endpoint")
        def my_endpoint(db: Session = Depends(get_db)):
            # Use db session
            pass
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_db_url() -> str:
    """Get database URL for pandas/sqlalchemy operations."""
    return DATABASE_URL

