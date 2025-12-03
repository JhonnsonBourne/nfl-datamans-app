#!/bin/bash
# Database backup script with retention policy
# Usage: ./backup_database.sh

set -e  # Exit on error

BACKUP_DIR="${BACKUP_DIR:-/backups/nfl_datamans}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/nfl_datamans_${TIMESTAMP}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Database connection parameters
DB_HOST="${NFL_DB_HOST:-localhost}"
DB_PORT="${NFL_DB_PORT:-5432}"
DB_NAME="${NFL_DB_NAME:-nfl_datamans}"
DB_USER="${NFL_DB_USER:-airflow}"
DB_PASSWORD="${NFL_DB_PASSWORD:-airflow}"

echo "Starting database backup..."
echo "Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo "Backup file: ${BACKUP_FILE}"

# Set password for pg_dump
export PGPASSWORD="${DB_PASSWORD}"

# Perform backup using pg_dump with custom format (allows compression)
pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -F c \
    -f "${BACKUP_FILE}" \
    --verbose

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully: ${BACKUP_FILE}"
    
    # Compress backup (optional - custom format is already compressed)
    # gzip "${BACKUP_FILE}"
    # echo "Backup compressed: ${BACKUP_FILE}.gz"
    
    # Get backup size
    BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
    echo "Backup size: ${BACKUP_SIZE}"
    
    # Remove old backups
    echo "Removing backups older than ${RETENTION_DAYS} days..."
    find "$BACKUP_DIR" -name "*.sql" -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete
    
    echo "Backup cleanup completed"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Unset password
unset PGPASSWORD

echo "Backup process completed"

